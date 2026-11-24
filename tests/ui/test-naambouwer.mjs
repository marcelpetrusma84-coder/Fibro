// test-naambouwer.mjs (24 nov 2026): de gebruikersnaam-generator met veel meer woorden en "Zelf samenstellen"
// (naambouwer.js). Controleert de lijsten (alleen letters, geen dubbele, genoeg woorden), dat een willekeurige naam
// kort genoeg blijft, en dat login.html en invite.html de gedeelde lijsten gebruiken in plaats van hun eigen.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { BEGIN, MIDDEN, MIDDEN_ALLES, EINDE, genereerNaam, willekeurigeDelen, plakNaam, isGeldigeDelen, MAX_WILLEKEURIG } from '../../naambouwer.js'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')

for (const w of [...BEGIN, ...MIDDEN_ALLES]) assert.match(w, /^[A-Za-z]+$/, 'alleen letters: ' + w)
for (const w of EINDE) assert.match(w, /^[A-Za-z0-9]+$/, 'einde: letters of cijfers: ' + w)
for (const [naam, lijst] of [['BEGIN', BEGIN], ['EINDE', EINDE], ['MIDDEN', Object.values(MIDDEN).flat()]]) {
  assert.equal(new Set(lijst).size, lijst.length, naam + ': geen dubbele woorden')
}
assert.ok(BEGIN.length >= 150, 'veel meer begin-woorden (' + BEGIN.length + ')')
assert.ok(MIDDEN.Dieren.length >= 150, 'veel meer dieren (' + MIDDEN.Dieren.length + ')')
assert.ok(MIDDEN_ALLES.length >= 350, 'veel meer dieren en grappige woorden (' + MIDDEN_ALLES.length + ')')
assert.ok(EINDE.length >= 80, 'meer einden (' + EINDE.length + ')')
for (const oud of ['Kikker', 'Capibara', 'Blobfish', 'Toaster', 'Burrito']) assert.ok(MIDDEN_ALLES.includes(oud), 'oud woord blijft: ' + oud)
assert.deepEqual(Object.keys(MIDDEN), ['Dieren', 'Fantasie', 'Eten', 'Dingen en geluiden'], 'groepjes in het keuzelijstje')

for (let i = 0; i < 3000; i++) {
  const d = willekeurigeDelen()
  assert.ok(isGeldigeDelen(d), 'stukjes komen uit de lijsten')
  assert.ok(plakNaam(d).length <= MAX_WILLEKEURIG, 'willekeurige naam is kort genoeg: ' + plakNaam(d))
}
const namen = new Set(Array.from({ length: 2000 }, () => genereerNaam()))
assert.ok(namen.size > 1950, 'veel verschillende namen (' + namen.size + ' van 2000)')
assert.equal(genereerNaam(() => 0), BEGIN[0] + MIDDEN_ALLES[0] + EINDE[0], 'rnd is te vervangen')
assert.ok(isGeldigeDelen({ begin: 'Gekke', midden: 'Stroopwafel', einde: '' }), 'zonder einde mag ook')
assert.ok(!isGeldigeDelen({ begin: 'Gekke', midden: 'Sanne', einde: '' }), 'een eigen woord mag niet')

for (const [pagina, veld, zelf] of [['login.html', 'reg-username', 'reg-naam-zelf'], ['invite.html', 'gebruikersnaam', 'naam-zelf']]) {
  const s = lees(pagina)
  assert.ok(!/const (BIJVOEGLIJK|DIEREN|ACHTER) =/.test(s), pagina + ': geen eigen woordenlijsten meer')
  assert.match(s, /import \{ maakNaamBouwer \} from '\.\/naambouwer\.js\?v=\d+'/, pagina + ': gebruikt naambouwer.js')
  assert.match(s, new RegExp('id="' + veld + '"[^>]*readonly'), pagina + ': naamveld blijft op slot')
  const knop = s.match(new RegExp('<button[^>]*id="' + zelf + '"[^>]*>([^<]*)</button>'))
  assert.ok(knop, pagina + ': knop Zelf samenstellen')
  assert.match(knop[0], /type="button"/, pagina + ': knop verstuurt geen formulier')
  assert.equal(knop[1], '✏️ Zelf samenstellen', pagina + ': tekst op de knop')
  assert.ok(s.indexOf('onclick="nieuweNaam()"') < s.indexOf('id="' + zelf + '"'), pagina + ': onder de generatorknop')
}
const en = lees('taal-en.js')
for (const zin of ['✏️ Zelf samenstellen', 'Dier of woord', 'Dingen en geluiden', 'Kies zelf de drie stukjes van je gebruikersnaam. Met 🔄 krijg je een willekeurig stukje.']) {
  assert.ok(en.includes(JSON.stringify(zin) + ':'), 'Engelse tekst: ' + zin)
}
console.log('ok: naambouwer met ' + BEGIN.length + ' x ' + MIDDEN_ALLES.length + ' x ' + EINDE.length + ' = ' +
  (BEGIN.length * MIDDEN_ALLES.length * EINDE.length).toLocaleString('nl-NL') + ' namen, en zelf samenstellen')
