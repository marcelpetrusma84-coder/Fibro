// Animaties bij Stijl (v234): vuurwerk, onweer (regen met bliksem) en glitter, en het voorbeeld op Profiel dat
// dezelfde tekencode gebruikt als de echte achtergrond. Het tekenen is in een echte browser bekeken.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
globalThis.document ??= { addEventListener() {} } // animatie.js luistert of de pagina zichtbaar is
const A = await import(new URL('../../animatie.js', import.meta.url))

// 1. De soorten, en hoeveel deeltjes
for (const s of ['vuurwerk', 'onweer', 'glitter', 'sterren', 'regen', 'confetti']) assert.ok(A.SOORTEN.includes(s), s)
assert.ok(A.aantalDeeltjes('glitter', 390, 844) >= 300, 'glitter op een telefoon: heel veel')
assert.ok(A.aantalDeeltjes('glitter', 2560, 1440) <= 700, 'maar niet onbeperkt (groot scherm)')
assert.ok(A.aantalDeeltjes('glitter', 300, 120) >= 80, 'ook in het kleine voorbeeld genoeg')
assert.equal(A.aantalDeeltjes('sterren', 390, 844), 60, 'de oude soorten blijven zoals ze waren')

// 2. Elke soort tekent zonder fouten (een nep-doek dat alles slikt), ook honderden beelden achter elkaar
{
  const niets = () => {}
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : niets), set: (o, k, v) => { o[k] = v; return true } })
  for (const s of A.SOORTEN.filter(x => x !== 'geen')) {
    const doek = { width: 390, height: 700, getContext: () => ctx }
    const t = A.maakTekenaar(doek, s)
    t.vul()
    for (let i = 0; i < 400; i++) t.stap()
  }
}

// 3. Bliksem: nooit vaker dan eens per 4 seconden, zacht, en zonder flits bij 'minder beweging'
const code = lees('animatie.js')
assert.match(code, /volgendeBliksem = nu \+ rnd\(4000, 9000\)/)
assert.match(code, /flits = zacht \? 0 : 0\.28/)
assert.match(code, /prefers-reduced-motion: reduce/)

// 4. Profiel: de drie nieuwe keuzes, in het Engels, en het voorbeeld via animatie.js (geen eigen kopie meer)
const profiel = lees('profiel.html')
for (const [id, naam] of [['vuurwerk', 'Vuurwerk'], ['onweer', 'Onweer'], ['glitter', 'Glitter']]) {
  assert.ok(profiel.includes(`id="anim-${id}" onclick="selectAnimatie('${id}')"`), id)
  assert.ok(profiel.includes(`data-t>${naam}</div>`), naam)
  assert.match(profiel, new RegExp(`'${naam}': '[A-Za-z]+'`), naam + ' in het Engels')
}
for (const s of A.SOORTEN) assert.ok(profiel.includes(`id="anim-${s}"`), 'elke soort is te kiezen: ' + s)
assert.match(profiel, /stopVoorbeeld=startAnimatieOp\(canvas,huidigeAnimatie\)/)
assert.doesNotMatch(profiel, /huidigeAnimatie==='sterren'\|\|/, 'geen oude kopie van de tekencode')

// 5. Nieuwe versies, zodat iedereen de nieuwe code krijgt
assert.match(lees('thema.js'), /animatie\.js\?v=234'/)
for (const p of ['index.html', 'chat.html', 'vrienden.html', 'vriend-profiel.html', 'profiel.html']) assert.match(lees(p), /thema\.js\?v=234'/, p)
assert.match(profiel, /animatie\.js\?v=234'/)
console.log('test-animaties: alles goed')
