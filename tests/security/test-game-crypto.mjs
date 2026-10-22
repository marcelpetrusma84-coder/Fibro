// Run: node tests/security/test-game-crypto.mjs
// Disposable identities only. No Supabase connection or real private keys.
import assert from 'node:assert/strict'
import { createECDH, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const cryptoUrl = moduleUrl(await readFile(new URL('../../crypto.js', import.meta.url), 'utf8'))
const cryptoApi = await import(cryptoUrl)
const gameSource = await readFile(new URL('../../spelchat-crypto.js', import.meta.url), 'utf8')
assert.ok(gameSource.includes("'./crypto.js?v=182'"), 'Update test import adapter if the production import changes')
const { maakSpelChatCrypto } = await import(moduleUrl(gameSource.replace("'./crypto.js?v=182'", JSON.stringify(cryptoUrl))))

async function fixtureKey(scalar) {
  const d = Buffer.alloc(32)
  d.writeUInt32BE(scalar, 28)
  const ec = createECDH('prime256v1')
  ec.setPrivateKey(d)
  const point = ec.getPublicKey()
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: point.subarray(1, 33).toString('base64url'),
    y: point.subarray(33).toString('base64url')
  }
  const privateKey = await crypto.subtle.importKey(
    'jwk', { ...jwk, d: d.toString('base64url') }, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  return {
    privateKey: Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64'),
    publicKey: Buffer.from(await crypto.subtle.exportKey('spki', publicKey)).toString('base64')
  }
}

const [alice, bob, stranger] = await Promise.all([fixtureKey(11), fixtureKey(12), fixtureKey(13)])
const bobFingerprint = await cryptoApi.sleutelVingerafdruk(bob.publicKey)
const aliceFingerprint = await cryptoApi.sleutelVingerafdruk(alice.publicKey)
const session = 'private-game-channel:alice:bob:latest-session-id'
const optionsA = {
  mijnId: 'alice-id', vriendId: 'bob-id', mijnPrivateKey: alice.privateKey,
  vriendPublicKey: bob.publicKey, sessie: session, vingerafdruk: bobFingerprint
}
const optionsB = {
  mijnId: 'bob-id', vriendId: 'alice-id', mijnPrivateKey: bob.privateKey,
  vriendPublicKey: alice.publicKey, sessie: session, vingerafdruk: aliceFingerprint
}
const makeA = overrides => maakSpelChatCrypto({ ...optionsA, ...overrides })
const makeB = overrides => maakSpelChatCrypto({ ...optionsB, ...overrides })
const realNow = Date.now
const now = Date.UTC(2026, 9, 22, 12)
Date.now = () => now

try {
  const a = makeA(), b = makeB()
  const message = 'Private chess chat: 🧑🏽‍💻 café ♟️'
  const packet = await a.verpak('spelchat', message)
  assert.deepEqual(Object.keys(packet), ['ciphertext'])
  assert.match(packet.ciphertext, /^e2e:2:/)
  assert.equal(JSON.stringify(packet).includes(message), false)
  assert.equal(await b.open('spelchat', packet), message)
  assert.equal(await b.open('spelchat', packet), null, 'A packet is displayed only once')
  const reply = await b.verpak('spelchat', 'Reply from the other side')
  assert.equal(await a.open('spelchat', reply), 'Reply from the other side')
  for (const [sender, receiver, sticker] of [[a, b, 'f1-01'], [b, a, 'e2-03']]) {
    const stickerPacket = await sender.verpak('spelsticker', sticker)
    assert.deepEqual(Object.keys(stickerPacket), ['ciphertext'])
    assert.equal(await receiver.open('spelsticker', stickerPacket), sticker)
    assert.equal(await receiver.open('spelsticker', stickerPacket), null)
  }

  const fresh = await a.verpak('spelchat', 'Bound to the current game and event')
  assert.equal(await makeB({ sessie: session + ':other-channel' }).open('spelchat', fresh), null)
  assert.equal(await makeB({ sessie: 'older-session-id' }).open('spelchat', fresh), null)
  assert.equal(await makeB().open('spelsticker', fresh), null)
  assert.equal(await makeB().open('unknown-event', fresh), null)
  assert.equal(await makeB({ vriendId: 'stranger-id' }).open('spelchat', fresh), null)
  assert.equal(await makeB({ mijnId: 'stranger-id' }).open('spelchat', fresh), null)
  assert.equal(await makeB({ mijnPrivateKey: stranger.privateKey }).open('spelchat', fresh), null)

  const damagedParts = fresh.ciphertext.split(':')
  const damagedBytes = Buffer.from(damagedParts[4], 'base64')
  damagedBytes[damagedBytes.length - 1] ^= 1
  damagedParts[4] = damagedBytes.toString('base64')
  assert.equal(await makeB().open('spelchat', { ciphertext: damagedParts.join(':') }), null)
  for (const bad of [undefined, null, {}, { tekst: 'legacy readable chat' },
    { ciphertext: 'legacy readable chat' }, { ciphertext: 'e2e:legacy' },
    { ciphertext: 'e2e:2:' }, { ciphertext: 123 }, { ciphertext: 'e2e:2:' + 'A'.repeat(18000) }]) {
    assert.equal(await makeB().open('spelchat', bad), null)
  }

  Date.now = () => now + 15 * 60_000 + 1
  assert.equal(await makeB().open('spelchat', fresh), null, 'Expired packets fail closed')
  Date.now = () => now - 15 * 60_000 - 1
  assert.equal(await makeB().open('spelchat', fresh), null, 'Packets too far in the future fail closed')
  Date.now = () => now
  assert.equal(await makeB({ vingerafdruk: aliceFingerprint.slice(0, 32) }).open('spelchat', fresh), 'Bound to the current game and event')
  assert.equal(await makeB({ vingerafdruk: bobFingerprint }).open('spelchat', fresh), null)
  await assert.rejects(() => makeA({ vingerafdruk: aliceFingerprint }).verpak('spelchat', 'Do not send'), /changed-key/)
  for (const missing of ['mijnId', 'vriendId', 'mijnPrivateKey', 'vriendPublicKey', 'sessie']) {
    await assert.rejects(() => makeA({ [missing]: '' }).verpak('spelchat', 'Do not send'), /missing-key/)
    assert.equal(await makeB({ [missing]: '' }).open('spelchat', fresh), null)
  }

  for (const [type, data] of [
    ['unknown-event', 'hello'], ['spelchat', ''], ['spelchat', '  '],
    ['spelchat', 'a'.repeat(2001)], ['spelchat', 1],
    ['spelsticker', 'javascript:alert(1)'], ['spelsticker', 'f9-01']
  ]) await assert.rejects(() => a.verpak(type, data), /invalid-game-message/)

  // Even authenticated peers cannot bypass the inner session/event/data validation.
  const inner = { v: 1, sessie: session, type: 'spelchat', id: crypto.randomUUID(), data: 'valid' }
  for (const changed of [
    { ...inner, v: 2 }, { ...inner, sessie: 'another-game' },
    { ...inner, type: 'spelsticker' }, { ...inner, id: 'not-a-message-id' },
    { ...inner, data: ' '.repeat(10) }, { ...inner, data: 'a'.repeat(2001) }
  ]) {
    const ciphertext = await cryptoApi.versleutel(JSON.stringify(changed), alice.privateKey, bob.publicKey,
      { soort: 'bericht', van: 'alice-id', naar: 'bob-id' })
    assert.equal(await makeB().open('spelchat', { ciphertext }), null)
  }
  const duplicateTarget = makeB()
  const concurrent = await Promise.all([
    duplicateTarget.open('spelchat', fresh), duplicateTarget.open('spelchat', fresh)
  ])
  assert.deepEqual(concurrent.filter(value => value !== null), ['Bound to the current game and event'])
  console.log('PASS: encrypted game chat/stickers both ways, ciphertext-only envelopes, session/event/identity binding, tamper/replay/expiry rejection, fail-closed keys/fingerprints, payload validation, concurrent duplicate suppression.')
} finally { Date.now = realNow }
