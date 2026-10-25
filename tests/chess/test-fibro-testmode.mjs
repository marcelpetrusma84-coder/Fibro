import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as Schaak from '../../schaak.js'
import { isFibroTestCommand, maakSchaakTestKanaal } from '../../schaak-testmodus.js'

assert.equal(isFibroTestCommand('FIBRO TEST'), true)
for (const nearMiss of ['fibro test', 'FIBRO  TEST', ' FIBRO TEST', 'FIBRO TEST ']) {
  assert.equal(isFibroTestCommand(nearMiss), false, `${JSON.stringify(nearMiss)} must not start the test`)
}

const events = []
const statuses = []
const channel = maakSchaakTestKanaal(Schaak, { responseDelayMs:5, onStatus:message => statuses.push(message) })
channel.on('broadcast', { event:'zet' }, message => events.push(message.payload))
assert.equal(channel.isSolo, false, 'the chess UI should expose friend-only controls in the local test')
assert.equal(channel.isTest, true)

const replica = Schaak.nieuweSpelStaat()
const whiteMove = Schaak.alleLegaleZetten(replica, 'w')[0]
Schaak.voerZetUit(replica, whiteMove)
await channel.send({ type:'broadcast', event:'zet', payload:{ zet:whiteMove } })
await new Promise(resolve => setTimeout(resolve, 30))
assert.equal(events.length, 1, 'the local opponent emits one reply')
assert.equal(events[0].testOnly, true)
assert.equal(replica.aanZet, 'z')
assert(Schaak.alleLegaleZetten(replica, 'z').some(move =>
  move.van[0] === events[0].zet.van[0] && move.van[1] === events[0].zet.van[1] &&
  move.naar[0] === events[0].zet.naar[0] && move.naar[1] === events[0].zet.naar[1] && move.type === events[0].zet.type
), 'the local opponent reply must be legal')
assert(statuses.some(message => message.includes('thinking')), 'the test opponent reports its thinking state')

channel.send({ type:'broadcast', event:'opnieuw', payload:{} })
assert.equal(events.length, 1, 'restart does not create an opponent move')
assert.equal(channel.isTest, true)
channel.stop()
await channel.send({ type:'broadcast', event:'zet', payload:{ zet:whiteMove } })
await new Promise(resolve => setTimeout(resolve, 15))
assert.equal(events.length, 1, 'a closed test game cannot make later moves')

const chat = await readFile(new URL('../../chat.html', import.meta.url), 'utf8')
const sendFunction = chat.slice(chat.indexOf('window.sendMsg = async function()'), chat.indexOf('// ─── Sticker versturen'))
assert(sendFunction.indexOf('isFibroTestCommand(input.value)') < sendFunction.indexOf('if (!geselecteerdeVriend)'), 'the local test trigger works without a selected friend')
assert(sendFunction.includes('getUserMedia({ video:true, audio:false })'), 'the test requests local video without microphone audio')
assert(chat.includes('NO INVITES SENT'), 'the app makes the local-only status obvious')

// Preloading, the real test flow, and the standalone preview must load the same
// version. Otherwise the cache-first service worker can revive the old board.
const preview = await readFile(new URL('../../chess-three-preview.html', import.meta.url), 'utf8')
const renderer = await readFile(new URL('../../schaken-drie-ui.js', import.meta.url), 'utf8')
const uiImports = [...(chat + preview).matchAll(/\.\/schaken-drie-ui\.js\?v=(\d+)/g)]
assert.equal(uiImports.length, 3, 'preload, launch, and preview all declare the renderer version')
assert.equal(new Set(uiImports.map(match => match[1])).size, 1, 'all entry points use one renderer version')
assert(Number(uiImports[0][1]) >= 18, 'cached pre-reference renderers are replaced')
assert(renderer.includes("'./schaak-drie.js?v=10'"), 'the original board uses the corrected seam topology')
assert(renderer.includes('THREE_PLAYER_BOARD_ARTWORK'), 'FIBRO TEST renders the original source artwork')
assert(chat.includes("spelSpelers = ['fibro-test-you', 'fibro-test-black', 'fibro-test-red']"), 'test identities follow the white/black/red roster')
assert(chat.includes('onInviteThird:fibroChessTest?.active ? joinFibroTestAsThirdPlayer'), 'the regular two-player settings invite enters the local three-player flow')
assert(chat.includes('onReturnToTwoPlayer:testMode ? returnToFibroTwoPlayerTest : null'), 'the three-player flow can return to the two-player test')

console.log('Fibro local chess test mode tests passed')
