// Run: node tests/security/test-key-recovery.mjs
// Exercises the real recovery form with synthetic keys and mocked storage/API.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const moduleFrom = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}
const cryptoApi = await moduleFrom('../../crypto.js')
globalThis.window = { T: text => text }
const { sleutelPastBij } = await moduleFrom('../../passkey-kluis.js')
delete globalThis.window

const html = await readFile(new URL('../../login.html', import.meta.url), 'utf8')
const start = html.indexOf('window.herstelMetSleutel = async function()')
const end = html.indexOf('window.herstelMetFaceId', start)
assert.ok(start >= 0 && end > start, 'Recovery handler must be present')
const handler = html.slice(start, end)
const [account, unrelated] = await Promise.all([
  cryptoApi.genereerKeypair(), cryptoApi.genereerKeypair()
])
const code = 'FIBRO-ABCD-EFGH-JKLM'
const blob = await cryptoApi.versleutelPrivateKey(account.privateKeyB64, code)

async function recover({ publicKey = account.publicKeyB64, profileError = null,
  fetchFailure = false, vault = blob, suppliedCode = code, signInError = null } = {}) {
  const elements = {
    'herstel-msg': {},
    'herstel-username': { value: 'SyntheticUser' },
    'herstel-wachtwoord': { value: 'test-only-password' },
    'herstelsleutel-input': { value: suppliedCode }
  }
  const saved = new Map([['account-id', 'existing-device-key']])
  const cleared = [], timers = [], calls = []
  const context = {
    window: { location: { href: 'login.html#herstellen' } },
    document: { getElementById: id => elements[id] },
    T: text => text,
    toonBericht: (el, type, text) => { el.type = type; el.text = text },
    normaliseerHerstelSleutel: cryptoApi.normaliseerHerstelSleutel,
    ontsleutelPrivateKey: cryptoApi.ontsleutelPrivateKey,
    sleutelPastBij,
    slaPrivateKeyOp: (userId, key) => saved.set(userId, key),
    sessionStorage: { removeItem: key => cleared.push(key) },
    setTimeout: callback => timers.push(callback),
    console: { error: () => {} },
    supabase: {
      auth: { signInWithPassword: async () => ({ data: { user: { id: 'account-id' } }, error: signInError }) },
      from(table) {
        calls.push(table)
        return {
          select() { return this }, eq() { return this },
          maybeSingle: async () => ({ data: { blob: vault } }),
          single: async () => {
            if (fetchFailure) throw new Error('synthetic network failure')
            return { data: { public_key: publicKey }, error: profileError }
          }
        }
      }
    }
  }
  vm.runInNewContext(handler, context)
  await context.window.herstelMetSleutel()
  return { saved, cleared, timers, calls, message: elements['herstel-msg'], location: context.window.location }
}

const valid = await recover()
assert.equal(valid.saved.get('account-id'), account.privateKeyB64)
assert.equal(valid.message.type, 'success')
assert.deepEqual(valid.cleared, ['fibro_sleutel_mist'])
assert.equal(valid.timers.length, 1)
assert.deepEqual(valid.calls, ['sleutel_kluis', 'profiles'])

for (const options of [
  { publicKey: unrelated.publicKeyB64 },
  { publicKey: 'not-a-key' },
  { publicKey: null },
  { profileError: { message: 'synthetic fetch error' } },
  { fetchFailure: true },
  { vault: 'AQ==' },
  { suppliedCode: 'FIBRO-ABCD-EFGH-JKLN' },
  { signInError: { message: 'synthetic auth failure' } }
]) {
  const failed = await recover(options)
  assert.equal(failed.saved.get('account-id'), 'existing-device-key', 'Failed recovery must preserve existing key')
  assert.deepEqual(failed.cleared, [], 'Failed recovery must keep missing-key state')
  assert.deepEqual(failed.timers, [], 'Failed recovery must not redirect')
  assert.equal(failed.location.href, 'login.html#herstellen')
  assert.equal(failed.message.type, 'error')
}
const mismatched = await recover({ publicKey: unrelated.publicKeyB64 })
assert.match(mismatched.message.text, /no longer matches/)
const unavailable = await recover({ fetchFailure: true })
assert.match(unavailable.message.text, /could not verify/)
console.log('PASS: recovery checks the real P-256 key pair before storage; mismatch, missing/malformed public key, API/network failure, invalid backup/code and auth failure preserve the device key and recovery screen.')
