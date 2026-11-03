// 3 nov 2026: reparaties voor de foutmeldingen uit Moderatie > Fouten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

// 1. 'Object.hasOwn is not a function' (Chrome 79): huisregel.js legt hem bij, op elke pagina als eerste script
{
  const ctx = vm.createContext({ window: {}, document: { addEventListener() {} }, localStorage: { getItem: () => null }, location: { href: 'https://x/', pathname: '/x' }, console })
  vm.runInContext('delete Object.hasOwn', ctx)
  vm.runInContext(lees('huisregel.js'), ctx)
  assert.equal(vm.runInContext("Object.hasOwn({ a: 1 }, 'a') && !Object.hasOwn({}, 'toString')", ctx), true)
  for (const f of ['chat.html', 'spel.html', 'index.html', 'login.html', 'invite.html', 'bellen.html', 'over.html', 'spelregels.html', 'spellen/runner-gunner.html']) {
    const s = lees(f)
    assert.match(s, /huisregel\.js\?v=2"/, f)
    const mod = s.indexOf('<script type="module"')
    assert.ok(mod < 0 || s.indexOf('huisregel.js') < mod, f + ': voor de modules')
  }
}

// 2. 'lokaleStream is null' en 'Called in wrong state: stable' (bellen.js)
{
  const b = lees('bellen.js')
  assert.match(b, /if \(!peerConnection && !lokaleStream\) \{ console\.warn\('\[bellen\] offer zonder gesprek genegeerd'\); return \}\n  if \(!peerConnection\) maakPeerConnection\(\)/)
  assert.match(b, /;\(lokaleStream \? lokaleStream\.getTracks\(\) : \[\]\)\.forEach\(track => \{/)
  assert.match(b, /if \(antwoordVerwerkt\.has\(pc\)\) return\n    antwoordVerwerkt\.add\(pc\)\n    await pc\.setRemoteDescription/)
  for (const f of ['chat.html', 'bellen.html', 'bel-luisteraar.js']) assert.match(lees(f), /bellen\.js\?v=161/, f)
}

// 3. 'Failed to fetch dynamically imported module' en 'Importing a module script failed': nog één keer proberen
{
  const c = lees('chat.html')
  assert.match(c, /const laadModule = url => import\(url\)\.catch\(async \(\) => \{/)
  for (const spel of ['bke-ui', 'vieroprij-ui', 'schaken-ui', 'pong-ui', 'blockit-ui', 'swarm-ui', 'ecto-ui', 'neon-raiders-ui'])
    assert.match(c, new RegExp("const m = await laadModule\\('\\./" + spel + "\\.js\\?v=\\d+'\\)"), spel)
  assert.ok(!/const m = await import\('\.\//.test(c), 'geen spel meer zonder herkansing')
  for (const n of ['vriendverzoek', 'ongelezen', 'blokkade'])
    assert.match(c, new RegExp("await import\\('\\./" + n + "\\.js\\?v=\\d+'\\)\\.catch\\(\\(\\) => new Promise"), n)
  assert.match(c, /toonSpelMelding\(T\('Het spel kon niet laden\. Controleer je internet en probeer het opnieuw\.'\)\)/)
  // 4. microfoon geweigerd in een spel: een tip
  assert.match(c, /if \(!ok\) toonMicrofoonTip\(\)/)
  const en = lees('taal-en.js')
  for (const k of ['Het spel kon niet laden. Controleer je internet en probeer het opnieuw.', 'Fibro kon je microfoon niet openen. Tik nog eens op 🎤 en kies Toestaan.'])
    assert.ok(en.includes(JSON.stringify(k) + ':'), 'Engels: ' + k)
  assert.match(lees('taal.js'), /taal-en\.js\?v=5\d/)
}
console.log('PASS: foutmeldingen 3 nov: oude browsers, bellen, spelbestanden opnieuw laden, microfoon-tip.')
