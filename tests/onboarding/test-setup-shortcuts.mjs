import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const html = await readFile(new URL('../../login.html', import.meta.url), 'utf8')
const start = html.indexOf('  supabase.auth.getSession().then(')
const end = html.indexOf('\n  async function laadWallpaper()', start)
assert(start >= 0 && end > start)
const boot = html.slice(start, end)

async function arrive({ hash = '', session = { user:{ id:'synthetic-user' } }, search = '' } = {}) {
  const calls = []
  const location = { hash, search, href:`login.html${hash}` }
  const context = {
    URLSearchParams,
    window:{ location },
    supabase:{ auth:{ getSession:async () => ({ data:{ session } }) } },
    naInloggenFaceId:async () => { calls.push('automatic-key-flow') },
    haalPrivateKeyOp:() => { calls.push('read-device-key'); return 'synthetic-existing-key' }
  }
  await vm.runInNewContext(boot, context)
  await new Promise(resolve => setImmediate(resolve))
  return { location, calls }
}

for (const session of [null, { user:{ id:'synthetic-user' } }]) {
  const result = await arrive({ hash:'#herstellen', session })
  assert.equal(result.location.href, 'login.html#herstellen', 'recovery stays reachable with and without an existing login/key')
  assert.deepEqual(result.calls, [], 'opening a recovery shortcut never starts a key/passkey operation')
}
const ordinary = await arrive()
assert.equal(ordinary.location.href, 'index.html', 'ordinary existing-session login still returns Home')
assert.deepEqual(ordinary.calls, ['automatic-key-flow'])
assert.deepEqual((await arrive({ search:'?logout=1' })).calls, [])

const manifest = JSON.parse(await readFile(new URL('../../manifest.json', import.meta.url), 'utf8'))
assert.deepEqual(manifest.shortcuts.map(shortcut => shortcut.url), ['./index.html', './login.html#herstellen'])
for (const shortcut of manifest.shortcuts) {
  assert(shortcut.icons.some(icon => icon.src === 'icon-192.png'), 'both app-menu destinations retain the Fibro icon')
}
console.log('PASS: recovery shortcut stays open without automatic key changes; normal login and both manifest destinations remain correct.')

const home = await readFile(new URL('../../index.html', import.meta.url), 'utf8')
const setup = await readFile(new URL('../../setup.html', import.meta.url), 'utf8')
assert.doesNotMatch(home, /(?:home|setup)-shortcuts|fibro-shortcuts-check/u, 'shortcut checkbox belongs only to Setup')
assert.match(setup, /id="setup-shortcuts-slot"/u)
assert.match(setup, /src="setup-shortcuts\.js\?v=\d+"/u)
assert.equal((html.match(/const verder = regKnop\(T\('Verder met setup'\)/g) || []).length, 2)
assert.match(html, /onclick="window\.location\.href='setup\.html'">\$\{T\('Verder met setup'\)/u)
console.log('PASS: shortcut checkbox mounts only in Setup; all three registration completions offer Setup.')
