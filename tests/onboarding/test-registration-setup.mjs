import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../../login.html', import.meta.url), 'utf8')
const home = await readFile(new URL('../../index.html', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../../manifest.json', import.meta.url), 'utf8'))

const continuation = source.match(/window\.voltooiRegistratie = function\(\) \{[\s\S]*?\n  \}/)?.[0]
assert.ok(continuation, 'The three registration paths share a device-setup continuation')
const window = { location: { href: 'login.html' } }
vm.runInNewContext(continuation, { window })
assert.equal(window.location.href, 'login.html', 'Defining the continuation must not hide the recovery code')
window.voltooiRegistratie()
assert.equal(window.location.href, 'setup.html?welcome=1', 'Only a user click continues, without identity or key data in the URL')
assert.equal((source.match(/verder\.onclick = window\.voltooiRegistratie/g) || []).length, 2, 'Passkey and reserve-code completion use the shared action')
assert.equal((source.match(/onclick="voltooiRegistratie\(\)"/g) || []).length, 1, 'The non-passkey registration path also uses the shared action')
assert.equal((source.match(/T\('Continue to device setup'\)/g) || []).length, 3)

const sessionHandler = source.match(/supabase\.auth\.getSession\(\)\.then\(\(\{ data: \{ session \} \}\) => \{[\s\S]*?\n  \}\)/)?.[0]
assert.ok(sessionHandler)

async function runSessionHandler({ hash = '', session = { user: { id: 'account' } }, search = '', keyPresent = true } = {}) {
  let recoveryPrompts = 0
  let keyReads = 0
  const window = { location: { hash, search, href: 'login.html' } }
  vm.runInNewContext(sessionHandler, {
    window,
    URLSearchParams,
    supabase: { auth: { getSession: async () => ({ data: { session } }) } },
    naInloggenFaceId: async () => { recoveryPrompts++ },
    haalPrivateKeyOp: () => { keyReads++; return keyPresent ? 'test-key' : null }
  })
  await new Promise(resolve => setImmediate(resolve))
  return { window, recoveryPrompts, keyReads }
}

for (const keyPresent of [false, true]) {
  const result = await runSessionHandler({ hash: '#herstellen', keyPresent })
  assert.equal(result.window.location.href, 'login.html', 'Key recovery stays open with or without a device key')
  assert.equal(result.recoveryPrompts, 0, 'Opening the recovery shortcut must not start a passkey action')
  assert.equal(result.keyReads, 0, 'The shortcut does not depend on or change local encryption keys')
}
const signedIn = await runSessionHandler()
assert.equal(signedIn.recoveryPrompts, 1)
assert.equal(signedIn.window.location.href, 'index.html', 'Ordinary signed-in visits retain the existing Home redirect')
for (const options of [{ session: null }, { search: '?logout=1' }]) {
  const result = await runSessionHandler(options)
  assert.equal(result.window.location.href, 'login.html')
  assert.equal(result.recoveryPrompts, 0)
}

assert.match(home, /Key recovery'\), \(\) => \{ window\.location\.href = 'login\.html#herstellen'/)
assert.match(home, /Install Fibro & shortcuts'\), \(\) => \{ window\.location\.href = 'setup\.html'/)
assert.equal(manifest.id, '/Fibro/')
assert.equal(manifest.start_url, './index.html')
assert.equal(manifest.scope, './')
assert.deepEqual(manifest.shortcuts.map(({ name, url }) => ({ name, url })), [
  { name: 'Home', url: './index.html' },
  { name: 'Key recovery', url: './login.html#herstellen' }
])
assert.ok(manifest.shortcuts.every(shortcut => shortcut.icons.some(icon => icon.src === 'icon-192.png')))

console.log('PASS: explicit registration continuation, recovery shortcut without auto-redirect or passkey prompt, existing login routing, Home menu links, and manifest shortcuts.')
