// Run: node tests/security/test-crypto.mjs
// All keys and messages are disposable test material. No storage or network is used.
// These are primitive/protocol regression tests, not proof of end-to-end security,
// forward secrecy, trusted key distribution, XSS resistance, or post-quantum safety.
import assert from 'node:assert/strict'
import { createECDH, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
// Import as a module even on Node versions that do not infer ESM for .js files.
const source = await readFile(new URL('../../crypto.js', import.meta.url), 'utf8')
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const {
  genereerKeypair, versleutel, ontsleutel, ontsleutelBericht,
  sleutelVingerafdruk, isZelfdeSleutel, eigenPubliekeSleutel,
  maakHerstelSleutel, normaliseerHerstelSleutel,
  versleutelPrivateKey, ontsleutelPrivateKey, ONLEESBAAR, VERVALST
} = api

// Fixed synthetic P-256 scalars give reproducible identities, without real users' keys.
async function fixtureKey(scalar) {
  const d = Buffer.alloc(32)
  d.writeUInt32BE(scalar, 28)
  const ec = createECDH('prime256v1')
  ec.setPrivateKey(d)
  const point = ec.getPublicKey()
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: point.subarray(1, 33).toString('base64url'),
    y: point.subarray(33).toString('base64url'),
    d: d.toString('base64url')
  }
  const privateKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits', 'deriveKey'])
  const publicKey = await crypto.subtle.importKey(
    'jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  return {
    privateKeyB64: Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64'),
    publicKeyB64: Buffer.from(await crypto.subtle.exportKey('spki', publicKey)).toString('base64'),
    privateKey, publicKey
  }
}

function mutateData(blob, byte = -1) {
  const parts = blob.split(':')
  const bytes = Buffer.from(parts[4], 'base64')
  bytes[byte < 0 ? bytes.length + byte : byte] ^= 1
  parts[4] = bytes.toString('base64')
  return parts.join(':')
}

const [alice, bob, outsider] = await Promise.all([fixtureKey(1), fixtureKey(2), fixtureKey(3)])
const now = Date.UTC(2026, 9, 22, 12)
const realNow = Date.now
Date.now = () => now
const ctx = { soort: 'bericht', van: 'alice-id', naar: 'bob-id', serverTijd: now }
const reaction = { soort: 'reactie', van: 'alice-id', bij: 'message-id', serverTijd: now }
const plaintext = 'A test message: ♟️ café 🧑🏽‍💻\nsecond line'
const encrypt = (text = plaintext, context = ctx) =>
  versleutel(text, alice.privateKeyB64, bob.publicKeyB64, context)
const decrypt = (blob, context = ctx, privateKey = bob.privateKeyB64, publicKey = alice.publicKeyB64) =>
  ontsleutelBericht(blob, privateKey, publicKey, context)

try {
  const blob = await encrypt()
  assert.match(blob, /^e2e:2:[0-9a-z]+:[0-9a-f]{12}:[A-Za-z0-9+/]+={0,2}$/)
  assert.deepEqual(await decrypt(blob), { tekst: plaintext, status: 'v2', verstuurd: now })
  assert.equal(await ontsleutel(blob, bob.privateKeyB64, alice.publicKeyB64, ctx), plaintext)

  // The sender must also be able to display their own stored ciphertext.
  assert.equal((await decrypt(blob, ctx, alice.privateKeyB64, bob.publicKeyB64)).tekst, plaintext)
  const responseContext = { ...ctx, van: ctx.naar, naar: ctx.van }
  const response = await versleutel('Reply', bob.privateKeyB64, alice.publicKeyB64, responseContext)
  assert.equal((await decrypt(response, responseContext, alice.privateKeyB64, bob.publicKeyB64)).tekst, 'Reply')
  assert.equal((await decrypt(await encrypt(''))).tekst, '')

  // Same plaintext, same millisecond, same key pair: a fresh 96-bit IV changes ciphertext.
  const second = await encrypt()
  const firstBytes = Buffer.from(blob.split(':')[4], 'base64')
  const secondBytes = Buffer.from(second.split(':')[4], 'base64')
  assert.equal(firstBytes.length, 12 + Buffer.byteLength(plaintext) + 16)
  assert.notDeepEqual(firstBytes.subarray(0, 12), secondBytes.subarray(0, 12))
  assert.notEqual(blob, second)

  for (const changed of [
    { ...ctx, van: 'someone-else' },
    { ...ctx, naar: 'someone-else' },
    { ...ctx, van: ctx.naar, naar: ctx.van },
    { soort: 'reactie', van: ctx.van, bij: ctx.naar }
  ]) assert.deepEqual(await decrypt(blob, changed), { tekst: VERVALST, status: 'vervalst' })
  const timeParts = blob.split(':')
  timeParts[2] = (now + 1).toString(36)
  assert.equal((await decrypt(timeParts.join(':'))).status, 'vervalst')
  const later = await decrypt(blob, { ...ctx, serverTijd: now + 15 * 60_000 + 1 })
  assert.equal(later.status, 'tijd')
  assert.equal(later.tekst, plaintext)
  assert.equal((await decrypt(blob, { ...ctx, serverTijd: now + 15 * 60_000 })).status, 'v2')

  const reactionBlob = await encrypt('👍', reaction)
  assert.equal((await decrypt(reactionBlob, reaction)).tekst, '👍')
  for (const changed of [
    { ...reaction, van: 'someone-else' },
    { ...reaction, bij: 'other-message-id' },
    { soort: 'bericht', van: reaction.van, naar: reaction.bij }
  ]) assert.equal((await decrypt(reactionBlob, changed)).status, 'vervalst')

  assert.equal((await decrypt(blob, ctx, outsider.privateKeyB64)).status, 'onleesbaar')
  assert.equal((await decrypt(blob, ctx, bob.privateKeyB64, outsider.publicKeyB64)).status, 'onleesbaar')
  assert.equal((await decrypt(blob, ctx, '', alice.publicKeyB64)).status, 'onleesbaar')
  assert.equal((await decrypt(blob, ctx, bob.privateKeyB64, 'not a key')).status, 'onleesbaar')
  for (const context of [undefined, {}, { soort: 'bericht', van: ctx.van }, { ...ctx, van: '' }]) {
    assert.equal((await ontsleutelBericht(blob, bob.privateKeyB64, alice.publicKeyB64, context)).status, 'onleesbaar')
  }
  const oldError = console.error
  console.error = () => {} // Expected refusal must not print synthetic key material/stack traces.
  try {
    for (const context of [undefined, {}, { soort: 'bericht', van: ctx.van }, { ...ctx, naar: '' }]) {
      await assert.rejects(() => versleutel('refuse', alice.privateKeyB64, bob.publicKeyB64, context), /Versleutelen mislukt/)
    }
  } finally { console.error = oldError }

  for (const corrupted of [mutateData(blob), mutateData(blob, 0), 'e2e:2:',
    blob.replace(/:[^:]+$/, ':AA=='), blob + '!', blob.replace('e2e:2:', 'e2e:2:!')]) {
    assert.deepEqual(await decrypt(corrupted), { tekst: VERVALST, status: 'vervalst' })
  }
  assert.deepEqual(await decrypt('e2e:invalid###'), { tekst: ONLEESBAAR, status: 'onleesbaar' })
  for (const open of ['ordinary text', null, 42]) {
    assert.deepEqual(await decrypt(open), { tekst: open, status: 'open' })
  }

  const fingerprint = await sleutelVingerafdruk(alice.publicKeyB64)
  const otherFingerprint = await sleutelVingerafdruk(outsider.publicKeyB64)
  assert.match(fingerprint, /^[0-9a-f]{64}$/)
  assert.equal(await sleutelVingerafdruk(alice.publicKeyB64), fingerprint)
  assert.notEqual(fingerprint, otherFingerprint)
  assert.equal(await eigenPubliekeSleutel(alice.privateKeyB64), alice.publicKeyB64)
  assert.equal(isZelfdeSleutel(fingerprint, fingerprint), true)
  assert.equal(isZelfdeSleutel(fingerprint.slice(0, 32), fingerprint), true)
  for (const remembered of [otherFingerprint, '', fingerprint.slice(0, 31), fingerprint.slice(0, 33), null]) {
    assert.equal(isZelfdeSleutel(remembered, fingerprint), false)
  }
  assert.equal(isZelfdeSleutel(fingerprint, fingerprint.slice(0, 32)), false)

  // genereerKeypair exports PKCS#8, so its initial deriveKey usage does not prevent
  // importing the exported key with deriveBits for the v2 ECDH -> HKDF path.
  const generated = await genereerKeypair()
  const generatedPublic = await eigenPubliekeSleutel(generated.privateKeyB64)
  assert.equal(generatedPublic, generated.publicKeyB64)
  const generatedBlob = await versleutel('Generated key works', generated.privateKeyB64, bob.publicKeyB64, ctx)
  assert.equal((await decrypt(generatedBlob, ctx, bob.privateKeyB64, generated.publicKeyB64)).tekst, 'Generated key works')

  // Independent legacy AES-GCM encryption verifies old stored messages remain readable.
  const legacyAes = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const legacyIv = new Uint8Array(12).fill(7)
  const legacyCt = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: legacyIv }, legacyAes, new TextEncoder().encode('Legacy message'))
  const legacyBlob = 'e2e:' + Buffer.concat([Buffer.from(legacyIv), Buffer.from(legacyCt)]).toString('base64')
  assert.deepEqual(await decrypt(legacyBlob), { tekst: 'Legacy message', status: 'v1' })

  const recovery = 'FIBRO-ABCD-EFGH-JKLM'
  assert.equal(normaliseerHerstelSleutel(' fibro abcd efgh jklm '), recovery)
  assert.equal(normaliseerHerstelSleutel('FIBRO-ABCD-EFGH-IJKL'), null)
  assert.equal(normaliseerHerstelSleutel('too short'), null)
  assert.equal(normaliseerHerstelSleutel(null), null)
  const generatedRecovery = maakHerstelSleutel()
  assert.match(generatedRecovery, /^FIBRO-(?:[A-HJ-NP-Z2-9]{4}-){2}[A-HJ-NP-Z2-9]{4}$/)
  assert.equal(normaliseerHerstelSleutel(generatedRecovery), generatedRecovery)
  const vault = await versleutelPrivateKey(alice.privateKeyB64, recovery)
  assert.equal(await ontsleutelPrivateKey(vault, recovery), alice.privateKeyB64)
  const secondVault = await versleutelPrivateKey(alice.privateKeyB64, recovery)
  assert.notEqual(vault, secondVault)
  const vaultBytes = Buffer.from(vault, 'base64')
  assert.equal(vaultBytes[0], 1)
  assert.notDeepEqual(vaultBytes.subarray(1, 29), Buffer.from(secondVault, 'base64').subarray(1, 29))
  await assert.rejects(() => ontsleutelPrivateKey(vault, 'FIBRO-ABCD-EFGH-JKLN'), /Herstelsleutel klopt niet/)
  for (const byte of [1, 17, vaultBytes.length - 1]) {
    const changed = Buffer.from(vaultBytes)
    changed[byte] ^= 1
    await assert.rejects(() => ontsleutelPrivateKey(changed.toString('base64'), recovery), /Herstelsleutel klopt niet/)
  }
  await assert.rejects(() => ontsleutelPrivateKey('AA==', recovery), /Onbekende kluisversie/)
  await assert.rejects(() => ontsleutelPrivateKey('AQ==', recovery))
  await assert.rejects(() => versleutelPrivateKey(alice.privateKeyB64, 'invalid'), /Ongeldige herstelsleutel/)
  await assert.rejects(() => ontsleutelPrivateKey(vault, 'invalid'), /Ongeldige herstelsleutel/)
  console.log('PASS: synthetic P-256 key agreement, v2 roundtrip, fresh IVs, authenticated context/time/reactions, tamper and wrong-key rejection, fingerprints, generated-key deriveBits import, legacy decrypt, recovery vault and corruption rejection.')
} finally {
  Date.now = realNow
}
