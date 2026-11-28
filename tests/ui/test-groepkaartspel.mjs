// test-groepkaartspel.mjs (25 nov 2026): kaartspellen met de groep in de groepschat (groepkaartspel.js, multiplayer stap 2).
// Dat de knop 🎲 werkt, dat het spel over het groepskanaal loopt (event 'gs') en welke spellen met de groep kunnen.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const G = await import('../../groepkaartspel.js').catch(e => ({ fout: e }))
// groepkaartspel.js gebruikt document pas bij maakGroepKaartspel; groepSpellen kan zonder
assert.ok(!G.fout, String(G.fout))
const lijst = G.groepSpellen().map(s => s.id)
assert.ok(lijst.includes('eenendertigen'), 'Eenendertigen kan met de groep')
for (const s of G.groepSpellen()) assert.ok(s.max > 2 && s.max <= 6 && s.soort === 'kaart', s.id + ': 3 tot 6 spelers')
console.log('PASS: de spellen voor de groep: ' + lijst.join(', '))

const groep = lees('groep.html')
assert.match(groep, /import \{ maakGroepKaartspel \} from '\.\/groepkaartspel\.js\?v=\d+'/)
assert.match(groep, /id="spelKnop" data-icoon="spel"/, 'de knop 🎲 heeft een id')
assert.doesNotMatch(groep, /class="balk-knop later" data-icoon="spel"/, 'de knop is niet meer "komt later"')
assert.match(groep, /\.on\('broadcast', \{ event: 'gs' \}, m => \{ try \{ kaartspel\?\.ontvang\(m && m\.payload\) \}/, 'het spel loopt over het groepskanaal')
assert.match(groep, /kaartspel = maakGroepKaartspel\(\{\n\s+ik, groepId: groep\.id, kanaal: \(\) => lijn\?\.kanaal\?\.\(\), leden: \(\) => leden\.filter\(l => !isGeblokt\(l\.id\)\)/, 'met de leden (niet wie ik blokkeerde)')
assert.match(groep, /\$\('spelKnop'\)\.addEventListener\('click', \(\) => \{ if \(!groep \|\| !kaartspel\) return; kaartspel\.kies\(\) \}\)/)
assert.match(groep, /bel: \{ kan: \(\) => Boolean\(gesprek && magBellen\(\)\)/, 'de microfoon in het spelmenu = de voice chat van de groep')
console.log('PASS: de groepschat: knop 🎲, het groepskanaal (gs) en de voice chat')

const gk = lees('groepkaartspel.js')
assert.match(gk, /if \(!p \|\| typeof p !== 'object' \|\| !GELDIG\.test\(String\(p\.van\)\) \|\| p\.van === ik \|\| !lid\(p\.van\)\) return/, 'alleen van leden')
assert.match(gk, /const MAX = 6/, 'hoogstens 6 spelers')
assert.match(gk, /m\.start\(\{ spelKanaal, spelers, mijnZetel, groepId \}\)/, 'het spel krijgt spelers, mijn zetel en de groep (28 nov 2026: voor de wachtspelletjes)')
assert.match(lees('groepspel.js'), /else if \(!gastheer && z === 1 && !gestopt\) \{ try \{ onGastheerWeg\(\) \}/, 'de gastheer weg = het spel stopt')
console.log('PASS: groepkaartspel: alleen leden, 6 spelers, het spel krijgt de spelers')
// 25 nov 2026: pushmelding bij een nieuw spel, en wie later binnenkomt ziet de uitnodiging toch (hallo)
const gh = lees('groep.html')
assert.match(gh, /meldPush: \(spel, sessie\) => meldGroepSpel\(groep\.id, spel, sessie\)/, 'groep.html: meldPush')
assert.match(gh, /body: JSON\.stringify\(\{ groep_spel: \{ groep_id: groepId, spel, sessie \} \}\)/, 'groep.html: naar stuur-push')
assert.match(gh, /kaartspel\?\.hallo\(\)/, 'groep.html: hallo zodra het kanaal open is')
assert.match(gk, /try \{ meldPush\?\.\(spel, lobby\.sessie\) \}/, 'open = pushmelding')
assert.match(gk, /if \(p\.e === 'hallo'\) \{ if \(lobby && lobby\.host === ik\)/, 'hallo: de wachtkamer nog eens')
const sp = lees('supabase/functions/stuur-push/index.ts')
assert.match(sp, /if \(invoer\.groep_spel\) return await meldGroepSpel\(supabase, req, invoer\.groep_spel\)/, 'stuur-push: groepspel')
assert.match(sp, /groepspel: "spel"/, 'stuur-push: valt onder Spellen in ☰ > Pushmeldingen')
console.log('PASS: groepkaartspel: pushmelding naar de groep en hallo')
