import assert from 'node:assert/strict'
import * as Schaak from '../../schaak.js'
import { schaakUltraBot } from '../../schaak-ultra.js'
import { uciNaarZet } from '../../schaak-ultra-engine.js'

const tick = async () => { for (let count = 0; count < 16; count++) await Promise.resolve() }
const result = (bestmove = 'e7e5', source = 'lichess') => ({ bestmove, source, cp:30, mate:null, depth:25 })

function fakeClock(samples = [1]) {
  let time = 0, nextTimer = 0, randomCalls = 0
  const timers = new Map()
  const timing = {
    now:() => time,
    random:() => { randomCalls++; return samples[Math.min(randomCalls - 1, samples.length - 1)] },
    setTimeout(callback, delay) {
      const id = nextTimer++
      timers.set(id, { callback, deadline:time + delay })
      return id
    },
    clearTimeout:id => timers.delete(id),
  }
  return {
    timing,
    get time() { return time },
    get pending() { return timers.size },
    get randomCalls() { return randomCalls },
    wait:(delay, value) => new Promise(resolve => timing.setTimeout(() => resolve(value), delay)),
    async advance(duration) {
      const target = time + duration
      await tick()
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.deadline <= target).sort((a, b) => a[1].deadline - b[1].deadline || a[0] - b[0])[0]
        if (!next) break
        const [id, timer] = next
        timers.delete(id)
        time = timer.deadline
        timer.callback()
        await tick()
      }
      time = target
      await tick()
    },
  }
}

function harness({ samples, cloud, engine, thinkingMs } = {}) {
  const clock = fakeClock(samples)
  const events = [], cloudCalls = [], engineCalls = []
  let board = Schaak.nieuweSpelStaat(), closed = false, engineDisposals = 0, cloudDisposals = 0
  const bot = schaakUltraBot({
    motor:Schaak, timing:clock.timing, isDicht:() => closed,
    cloudFactory:() => ({
      async zoek(fen, options) {
        const request = { fen, options }
        cloudCalls.push(request)
        return cloud ? cloud({ clock, ...request }, cloudCalls.length - 1) : result()
      },
      dispose() { cloudDisposals++ },
    }),
    engineFactory:() => ({
      async analyse(fen, options) {
        const request = { fen, options }
        engineCalls.push(request)
        return engine ? engine({ clock, ...request }, engineCalls.length - 1) : result('e7e5', 'stockfish')
      },
      dispose() { engineDisposals++ },
    }),
    stuur(event, payload) {
      events.push({ event, payload, time:clock.time })
      if (event === 'zet') {
        const legal = Schaak.alleLegaleZetten(board, 'z').some(move => JSON.stringify(move) === JSON.stringify(payload.zet))
        assert(legal, 'a timed reply must still be legal on the current UI board')
        Schaak.voerZetUit(board, payload.zet, payload.promotieStuk)
      }
    },
  })
  if (thinkingMs !== undefined) bot.ontvang('bot-instellingen', { thinkingMs })
  return {
    bot, clock, events, cloudCalls, engineCalls,
    get engineDisposals() { return engineDisposals },
    get cloudDisposals() { return cloudDisposals },
    moves:() => events.filter(message => message.event === 'zet'),
    white(uci = 'e2e4') {
      const choice = uciNaarZet(Schaak, board, uci)
      assert(choice, 'the fixture supplies a legal human move')
      Schaak.voerZetUit(board, choice.zet, choice.promotieStuk)
      bot.ontvang('zet', choice)
    },
    setting:value => bot.ontvang('bot-instellingen', { thinkingMs:value }),
    reset() { bot.ontvang('opnieuw'); board = Schaak.nieuweSpelStaat() },
    close() { closed = true },
    stop:() => bot.stop(),
  }
}

{
  const replies = ['e7e5', 'b8c6', 'g8f6']
  const h = harness({ samples:[0, 1, 0.5], cloud:(_request, index) => result(replies[index]) })
  h.white()
  await h.clock.advance(999)
  assert.equal(h.moves().length, 0)
  await h.clock.advance(1)
  assert.equal(h.moves()[0].time, 1000, 'the default maximum permits a one-second response')
  h.white('g1f3')
  await h.clock.advance(4999)
  assert.equal(h.moves().length, 1)
  await h.clock.advance(1)
  assert.equal(h.moves()[1].time, 6000, 'the default maximum is five seconds')
  h.white('f1c4')
  await h.clock.advance(3000)
  assert.equal(h.moves()[2].time, 9000, 'successive turns use varied human response times')
  assert.equal(h.clock.randomCalls, 3)
  assert.equal(h.engineCalls.length, 0)
  h.stop()
}

{
  const h = harness({ samples:[1], cloud:({ clock }) => clock.wait(1500, null), engine:({ clock, options }) => clock.wait(options.movetime, result('e7e5', 'stockfish')) })
  h.white()
  await h.clock.advance(1500)
  assert.equal(h.engineCalls[0].options.movetime, 1800)
  await h.clock.advance(1800)
  assert.equal(h.moves().length, 0)
  await h.clock.advance(1699)
  assert.equal(h.moves().length, 0)
  await h.clock.advance(1)
  assert.equal(h.moves()[0].time, 5000, 'cloud and engine time are included in the response target')
  h.stop()
}

{
  const h = harness({ samples:[1], cloud:({ clock }) => clock.wait(4200, null), engine:({ clock, options }) => clock.wait(options.movetime, result('e7e5', 'stockfish')) })
  h.white()
  await h.clock.advance(4200)
  assert.equal(h.engineCalls[0].options.movetime, 800, 'a slow cloud response reduces the remaining Stockfish time budget')
  await h.clock.advance(800)
  assert.equal(h.moves()[0].time, 5000)
  assert.equal(h.clock.pending, 0)
  h.stop()
}

{
  const h = harness({ samples:[0], cloud:() => null, engine:({ clock }) => clock.wait(6200, result('e7e5', 'stockfish')) })
  h.white()
  await h.clock.advance(6200)
  assert.equal(h.moves()[0].time, 6200, 'slow engine startup delivers the strong result as soon as it is ready')
  assert.equal(h.engineCalls[0].options.movetime, 1800)
  assert.equal(h.clock.pending, 0, 'an over-budget calculation does not receive additional artificial delay')
  h.stop()
}

{
  const h = harness({ thinkingMs:0, cloud:() => null, engine:({ clock, options }) => clock.wait(options.movetime, result('e7e5', 'stockfish')) })
  h.white()
  await h.clock.advance(1800)
  assert.equal(h.engineCalls[0].options.movetime, 1800, 'zero padding retains the normal engine search')
  assert.equal(h.moves()[0].time, 1800)
  assert.equal(h.clock.randomCalls, 0)
  assert.equal(h.clock.pending, 0)
  h.stop()
  const instant = harness({ thinkingMs:0 })
  instant.white(); await tick()
  assert.equal(instant.moves()[0].time, 0, 'zero padding delivers a cached strong cloud move immediately')
  assert.equal(instant.clock.randomCalls, 0)
  instant.stop()
}

{
  const h = harness({ samples:[1] })
  h.white(); await tick()
  assert.equal(h.clock.pending, 1)
  await h.clock.advance(1500)
  h.setting(2000)
  assert.equal(h.clock.pending, 1, 'changing the slider replaces the pending timer')
  assert.equal(h.cloudCalls.length, 1, 'changing timing reuses the completed legal cloud result')
  await h.clock.advance(499)
  assert.equal(h.moves().length, 0)
  await h.clock.advance(1)
  assert.equal(h.moves()[0].time, 2000, 'changed settings retain the original human-input start time')
  await h.clock.advance(5000)
  assert.equal(h.moves().length, 1, 'the replaced timer cannot emit a second move')
  h.stop()
}

{
  const h = harness({ samples:[1] })
  h.white(); await tick()
  await h.clock.advance(100)
  h.setting(0)
  assert.equal(h.moves()[0].time, 100, 'turning padding off delivers a ready result immediately')
  assert.equal(h.clock.pending, 0)
  h.setting(0)
  await h.clock.advance(6000)
  assert.equal(h.moves().length, 1)
  h.stop()
}

{
  const h = harness({ thinkingMs:0, samples:[1], cloud:({ clock }) => clock.wait(1000, result()) })
  h.white()
  await h.clock.advance(500)
  h.setting(3000)
  await h.clock.advance(2499)
  assert.equal(h.moves().length, 0)
  await h.clock.advance(1)
  assert.equal(h.moves()[0].time, 3000, 'enabling padding during analysis uses the same original turn start')
  assert.equal(h.clock.randomCalls, 1)
  h.stop()
}

{
  const h = harness({ samples:[1], cloud:({ clock }) => clock.wait(4200, null), engine:({ clock, options }) => clock.wait(options.movetime, result('e7e5', 'stockfish')) })
  h.white()
  await h.clock.advance(1000)
  h.setting(2000)
  await h.clock.advance(3200)
  assert.equal(h.engineCalls[0].options.movetime, 100, 'an exhausted deadline still allows a real Stockfish calculation')
  await h.clock.advance(100)
  assert.equal(h.moves()[0].time, 4300)
  assert.equal(h.cloudCalls.length, 1)
  h.stop()
}

for (const action of ['reset', 'stop', 'close']) {
  const h = harness({ samples:[1] })
  h.white(); await tick()
  assert.equal(h.clock.pending, 1)
  h[action]()
  if (action !== 'close') assert.equal(h.clock.pending, 0, action + ' clears the pending reply timer')
  await h.clock.advance(6000)
  assert.equal(h.moves().length, 0, 'a delayed result cannot move after ' + action)
  h.stop(); h.stop()
  assert.equal(h.engineDisposals, 1)
}

{
  const replies = ['e7e5', 'd7d5']
  const h = harness({ samples:[1], cloud:(_request, index) => result(replies[index]) })
  h.white(); await tick()
  await h.clock.advance(500)
  h.reset()
  h.white('d2d4'); await tick()
  await h.clock.advance(5000)
  assert.equal(h.moves().length, 1, 'a restart has exactly one delivery for the new generation')
  assert.deepEqual(h.moves()[0].payload.zet.naar, [3, 3])
  assert.equal(h.moves()[0].time, 5500)
  h.stop()
}

{
  const h = harness({ samples:[1] })
  h.white(); await tick()
  h.bot.ontvang('ultra-evaluatie-instelling', { enabled:true })
  h.bot.ontvang('ultra-evaluatie-instelling', { enabled:false })
  assert.equal(h.clock.pending, 1, 'hiding the evaluation meter preserves the pending bot reply')
  await h.clock.advance(5000)
  assert.equal(h.moves().length, 1)
  assert.equal(h.engineCalls.length, 0)
  h.stop()
}

for (const [setting, delay] of [[9000, 7000], [-20, 0], [500, 500]]) {
  const h = harness({ samples:[1], thinkingMs:setting })
  h.white()
  await h.clock.advance(delay)
  assert.equal(h.moves()[0].time, delay, 'slider settings use the shared 0..7000 ms bounds')
  h.stop()
}

console.log('Ultra variable thinking-time tests passed')
