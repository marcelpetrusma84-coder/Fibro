import assert from 'node:assert/strict'
import { maakSpelVerbinding } from '../../spelverbinding.js'
import * as Schaak from '../../schaak.js'

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fakeClock() {
  let time = 0, id = 0
  const timers = new Map()
  return {
    now: () => time,
    setTimeout(fn, ms) { timers.set(++id, { fn, at: time + ms }); return id },
    clearTimeout(timer) { timers.delete(timer) },
    get count() { return timers.size },
    async advance(ms) {
      const end = time + ms
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0]
        if (!next || next[1].at > end) break
        time = next[1].at
        timers.delete(next[0])
        next[1].fn()
        await settle()
      }
      time = end
      await settle()
    }
  }
}

function network() {
  const channels = [], sent = []
  let blocked = false, drop = () => false
  function client(label) {
    return {
      getChannels: () => channels.filter(channel => channel.owner === label && channel.state !== 'closed'),
      async removeChannel(channel) { channel.state = 'closed'; channel.callback?.('CLOSED') },
      channel(name, options) {
        const channel = {
          owner: label, topic: 'realtime:' + name, options, state: 'closed',
          on(type, filter, fn) { this.listener = fn; return this },
          subscribe(callback) {
            this.callback = callback
            this.state = 'joining'
            queueMicrotask(() => { this.state = 'joined'; callback('SUBSCRIBED') })
            return this
          },
          async send(message) {
            sent.push({ owner: label, message: structuredClone(message) })
            if (blocked || drop(label, message)) return 'ok'
            const peers = channels.filter(peer => peer !== this && peer.topic === this.topic && peer.state === 'joined')
            for (const peer of peers) queueMicrotask(() => peer.listener(structuredClone(message)))
            return 'ok'
          },
          fail(status = 'CHANNEL_ERROR') { this.state = status === 'CLOSED' ? 'closed' : 'errored'; this.callback(status) }
        }
        channels.push(channel)
        return channel
      }
    }
  }
  return { client, channels, sent, set blocked(value) { blocked = value }, set drop(fn) { drop = fn } }
}

function setup() {
  const clock = fakeClock(), net = network(), moves = { a: [], b: [] }, states = { a: [], b: [] }
  const events = new EventTarget(), page = new EventTarget()
  page.visibilityState = 'visible'
  let online = true
  const common = { naam: 'chess-session', clock, events, page, isOnline: () => online }
  const a = maakSpelVerbinding({ ...common, client: net.client('a'), instanceId: 'a', onStatus: state => states.a.push(state) })
  const b = maakSpelVerbinding({ ...common, client: net.client('b'), instanceId: 'b', onStatus: state => states.b.push(state) })
  for (const [id, connection] of [['a', a], ['b', b]]) {
    connection.on('broadcast', { event: 'zet' }, message => moves[id].push(message.payload.move))
    connection.on('broadcast', { event: 'opnieuw' }, () => moves[id].push('restart'))
    connection.subscribe()
  }
  return { a, b, clock, net, moves, states, events, page, set online(value) { online = value } }
}

{
  const test = setup()
  await settle()
  assert.equal(test.net.channels.length, 2)
  assert.equal(test.net.channels[0].options.config.broadcast.ack, true)
  let dropped = false
  test.net.drop = (owner, message) => {
    if (owner === 'b' && message.event === '__spel_ack' && !dropped) { dropped = true; return true }
    return false
  }
  await test.a.send({ type: 'broadcast', event: 'zet', payload: { move: 'e2-e4' } })
  await settle()
  await test.clock.advance(4000)
  assert.equal(dropped, true)
  assert.deepEqual(test.moves.b, ['e2-e4'], 'lost ACK retries must not apply a move twice')
  assert(test.net.sent.filter(item => item.message.event === 'zet').length >= 2)

  test.net.blocked = true
  await test.a.send({ type: 'broadcast', event: 'zet', payload: { move: 'g1-f3' } })
  await test.a.send({ type: 'broadcast', event: 'opnieuw', payload: {} })
  await test.clock.advance(70000)
  assert(test.states.a.includes('waiting'))
  assert.equal(test.net.channels.length, 2, 'peer silence must retain the active game channel')
  assert.equal(test.clock.count, 2, 'silence must not stop game recovery')
  test.net.blocked = false
  await test.b.reconnect()
  await settle()
  assert.deepEqual(test.moves.b, ['e2-e4', 'g1-f3', 'restart'], 'resume must replay missed moves in order')
  assert.equal(test.states.a.at(-1), 'connected')

  test.net.channels.find(channel => channel.owner === 'a').fail('CLOSED')
  await test.clock.advance(23000)
  assert.equal(test.net.channels.filter(channel => channel.owner === 'a').length, 2, 'closed channel must be recreated')
  await test.a.send({ type: 'broadcast', event: 'zet', payload: { move: 'd2-d4' } })
  await settle()
  assert.deepEqual(test.moves.b, ['e2-e4', 'g1-f3', 'restart', 'd2-d4'])

  const oldCount = test.net.channels.length
  test.events.dispatchEvent(new Event('online'))
  test.page.dispatchEvent(new Event('visibilitychange'))
  await settle()
  assert.equal(test.net.channels.length, oldCount, 'healthy lifecycle resume must retain its channel')
  await Promise.all([test.a.stop(), test.b.stop()])
  assert.equal(test.clock.count, 0)
  test.events.dispatchEvent(new Event('online'))
  await test.clock.advance(120000)
  assert.equal(test.net.channels.length, oldCount, 'disposed sessions must not reconnect')
}

{
  const test = setup()
  await settle()
  let firstMove
  test.net.drop = (owner, message) => {
    if (owner === 'a' && message.event === 'zet' && !firstMove) { firstMove = message; return true }
    return false
  }
  await test.a.send({ type: 'broadcast', event: 'zet', payload: { move: 'first' } })
  await test.a.send({ type: 'broadcast', event: 'zet', payload: { move: 'second' } })
  await settle()
  assert.deepEqual(test.moves.b, [], 'later move must wait for the missing earlier move')
  await test.clock.advance(4000)
  assert.deepEqual(test.moves.b, ['first', 'second'])
  await Promise.all([test.a.stop(), test.b.stop()])
  assert.equal(test.clock.count, 0)
}

{
  const test = setup()
  const boards = { a: Schaak.nieuweSpelStaat(), b: Schaak.nieuweSpelStaat() }
  const queues = { a: Promise.resolve(), b: Promise.resolve() }
  const applied = { a: 0, b: 0 }
  for (const [id, connection] of [['a', test.a], ['b', test.b]]) {
    connection.on('broadcast', { event: 'zet' }, message => {
      queues[id] = queues[id].then(() => {
        const move = message.payload.zet
        assert(Schaak.alleLegaleZetten(boards[id], boards[id].aanZet).some(legal => JSON.stringify(legal) === JSON.stringify(move)))
        Schaak.voerZetUit(boards[id], move)
        applied[id]++
      })
    })
  }
  async function move(id, from, to) {
    const zet = Schaak.alleLegaleZetten(boards[id], boards[id].aanZet).find(candidate =>
      candidate.van[0] === from[0] && candidate.van[1] === from[1] && candidate.naar[0] === to[0] && candidate.naar[1] === to[1])
    assert(zet)
    Schaak.voerZetUit(boards[id], zet)
    await test[id].send({ type: 'broadcast', event: 'zet', payload: { zet } })
    await settle()
  }
  await settle()
  test.net.blocked = true
  await move('a', [6, 4], [4, 4]) // e2-e4 while the friend is suspended.
  await test.clock.advance(65000)
  test.net.blocked = false
  await test.b.reconnect()
  await settle()
  await queues.b
  assert.deepEqual(boards.a, boards.b, 'the real chess state must recover a move after more than a minute')
  await move('b', [1, 4], [3, 4])
  await queues.a
  let droppedAck = false
  test.net.drop = (owner, message) => {
    if (owner === 'b' && message.event === '__spel_ack' && !droppedAck) { droppedAck = true; return true }
    return false
  }
  await move('a', [7, 6], [5, 5])
  await test.clock.advance(4000)
  await queues.b
  await move('b', [0, 1], [2, 2])
  await queues.a
  assert.deepEqual(boards.a, boards.b, 'recovered chess positions must remain identical after later turns')
  assert.deepEqual(applied, { a: 2, b: 2 }, 'ACK-before-animation completion must still enqueue each move once')
  await Promise.all([test.a.stop(), test.b.stop()])
  assert.equal(test.clock.count, 0)
}

{
  const test = setup()
  await settle()
  test.online = false
  test.events.dispatchEvent(new Event('offline'))
  await test.a.send({type:'broadcast',event:'zet',payload:{move:'queued offline'}})
  await test.clock.advance(90000)
  assert.equal(test.states.a.at(-1),'offline')
  assert.deepEqual(test.moves.b,[])
  test.online = true
  test.events.dispatchEvent(new Event('online'))
  await settle()
  assert.deepEqual(test.moves.b,['queued offline'],'offline move must arrive after network returns')
  assert.equal(test.states.a.at(-1),'connected')
  await Promise.all([test.a.stop(),test.b.stop()])
  assert.equal(test.clock.count,0)
}

{
  const clock = fakeClock(), net = network(), events = new EventTarget()
  const connection = maakSpelVerbinding({ client: net.client('new'), naam: 'legacy', clock, events, page: null, isOnline: () => true })
  const legacy = net.client('old').channel('legacy', {})
  const moves = []
  legacy.on('broadcast', { event: '*' }, message => { if (message.event === 'zet') moves.push(message) }).subscribe(() => {})
  connection.subscribe()
  await settle()
  await legacy.send({ type: 'broadcast', event: 'ping', payload: {} })
  await connection.send({ type: 'broadcast', event: 'zet', payload: { move: 'legacy' } })
  await clock.advance(20000)
  await connection.reconnect()
  await settle()
  assert.equal(moves.length, 1, 'legacy peer must receive best-effort moves once')
  await connection.stop()
  assert.equal(clock.count, 0)
}

console.log('PASS: lost ACK deduplication, ordered move retry/resume, 70-second peer silence, 90-second offline recovery, closed-channel recovery, real chess positions after interruption, lifecycle resume, stop cleanup, legacy compatibility.')
