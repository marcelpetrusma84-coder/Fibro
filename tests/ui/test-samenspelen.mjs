// test-samenspelen.mjs (26 nov 2026, Marcel): samen spelen vanaf Home (spel.html + samenspelen.js).
// Dat de lijsten gelijk zijn aan die in de chat en de groepschat, dat de knoppen in spel.html staan en dat de groepschat
// met ?spel= meteen de wachtkamer opent.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const S = await import('../../samenspelen.js')
const G = await import('../../groepkaartspel.js')
const { STUDIO_SPELLEN } = await import('../../studio-spellen.js')

// 1. Met een vriend: dezelfde spellen als speelMee in chat.html (zonder driespelerschaak, dat is met z'n drieën)
const chat = lees('chat.html')
const m = chat.match(/const beschikbaar = \[([^\]]+?), \.\.\.STUDIO_SPELLEN\.filter\(s => s\.met\.vriend\)/)
assert.ok(m, 'de lijst beschikbaar in chat.html gevonden')
const chatLijst = [...m[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]).filter(id => id !== 'schakendrie')
const vast = S.VRIEND_SPELLEN.filter(id => !STUDIO_SPELLEN.some(s => s.id === id))
assert.deepEqual(vast.sort(), chatLijst.sort(), 'samenspelen.js en chat.html kennen dezelfde spellen voor een vriend')
assert.ok(S.kanMetVriend('pesten') && S.kanMetVriend('eenendertigen') && !S.kanMetVriend('schakendrie') && !S.kanMetVriend('onzin'))
console.log('PASS: met een vriend: ' + S.VRIEND_SPELLEN.length + ' spellen, gelijk aan de chat')

// 2. Met een groep: dezelfde regel als groepSpellen in groepkaartspel.js
const groepLijst = G.groepSpellen().map(s => s.id)
for (const s of STUDIO_SPELLEN) assert.equal(S.kanMetGroep(s.id), groepLijst.includes(s.id), s.id)
assert.ok(S.kanMetGroep('eenendertigen') && !S.kanMetGroep('pesten') && !S.kanMetGroep('schaken'))
const id = '11111111-2222-4333-8444-555555555555'
assert.equal(S.groepAdres(id, 'eenendertigen'), 'groep.html?id=' + id + '&spel=eenendertigen')
assert.equal(S.groepAdres('../index.html', 'eenendertigen'), null, 'alleen een echt groepsnummer')
assert.equal(S.groepAdres(id, 'pesten'), null, 'alleen spellen voor de groep')
console.log('PASS: met een groep: ' + groepLijst.join(', '))

// 3. spel.html: de knoppen en de keuzes
const spel = lees('spel.html')
assert.match(spel, /import \{ kanMetVriend, kanMetGroep, groepAdres \} from '\.\/samenspelen\.js\?v=\d+'/)
assert.match(spel, /id="vriendKnop"[^`]*👤 Tegen een vriend/, 'knop tegen een vriend')
assert.match(spel, /id="groepKnop"[^`]*👥 Met een groep/, 'knop met een groep')
assert.match(spel, /supabase\.rpc\('mijn_groepen'\)/, 'de groepen ophalen')
assert.match(spel, /content:'spelinvite:' \+ spelId \+ ':'/, 'de uitnodiging voor het gekozen spel (niet altijd schaken)')
assert.equal((spel.match(/samenKnoppen\(\)\}/g) || []).length, 2, 'bij het niveau kiezen en bij het startscherm van arcadespellen')
assert.match(spel, /starterId:user\.id, titel:'1' \}\)/, 'de chat weet dat het titelscherm er al was')
console.log('PASS: spel.html heeft de knoppen tegen een vriend en met een groep')

// 26 nov 2026: vanaf Home niet eerst de chat en niet nog een keer het titelscherm
assert.match(chat, /if \(!q\.get\('spelVriend'\) \|\| !q\.get\('spelType'\) \|\| !q\.get\('sessieId'\)\) return[\s\S]{0,400}o\.classList\.add\('open'\)/, 'meteen het spelscherm')
assert.match(chat, /const zonderTitel = urlParams\.get\('titel'\) === '1'/)
assert.match(chat, /speelMee\(spelType, sessieId, starterId \|\| spelVriend, invitedPlayers, \{ zonderTitel \}\)/)
assert.match(chat, /const titel = opties\?\.zonderTitel \? null : /, 'geen tweede titelscherm')
assert.ok(lees('taal-en.js').includes('"Spel laden...":'))
console.log('PASS: vanaf Home meteen het spel, zonder tweede titelscherm')

// 4. Op Home (ingebed) mag het spelvenster ook naar de groepschat
assert.match(lees('titelscherm.js'), /d\.adres\.startsWith\('groep\.html\?'\)/)
// 5. groep.html?spel=... opent de wachtkamer (groepkaartspel open)
const groep = lees('groep.html')
assert.match(groep, /get\('spel'\)[\s\S]{0,120}kaartspel\?\.open\(startSpel\)/)
assert.match(lees('groepkaartspel.js'), /open: spel => \{ if \(!lopend && !lobby && groepSpellen\(\)\.some\(s => s\.id === spel\)\) open\(spel\) \}/)
console.log('PASS: groep.html?spel= opent meteen de wachtkamer')

// 6. Engels
const taalEn = lees('taal-en.js')
for (const z of ['👤 Tegen een vriend', '👥 Met een groep', 'Kies een vriend om uit te nodigen voor {spel}.', 'Uitnodiging voor {spel} versturen…',
  'Spelen met een groep', 'Kies een groep. De groep krijgt een uitnodiging voor {spel}.', 'Groepen laden…',
  'Je groepen konden niet geladen worden. Probeer het opnieuw.', 'Je zit nog niet in een groep. Maak er een in de chat met + Groep.'])
  assert.ok(taalEn.includes(JSON.stringify(z) + ':'), 'Engels voor: ' + z)
console.log('PASS: alles ook in het Engels')
