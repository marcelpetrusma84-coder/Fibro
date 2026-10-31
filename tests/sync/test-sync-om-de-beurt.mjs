// v247 (31 okt 2026): sync.js synct om de beurt met alle online vrienden (syncbeurt.js). Hier: hoe het is aangesloten.
// De regels zelf: test-syncbeurt.mjs. In een echte browser met 3 tot 6 telefoons: tests/tools/syncproef/.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const sync = lees('sync.js'), vp = lees('vriend-profiel.html'), profiel = lees('profiel.html')
const deel = (begin, eind) => { const a = sync.indexOf(begin), b = sync.indexOf(eind, a + 1); assert.ok(a >= 0 && b > a, begin); return sync.slice(a, b) }

// 1. Om de beurt kiezen, en eerst vragen
assert.match(sync, /import \* as SB from '\.\/syncbeurt\.js\?v=1'/)
assert.match(sync, /import \{ [^}]*opBericht, stuurNaar, zetKenmerk, heeftKenmerk \} from '\.\/paren\.js\?v=2'/)
const start = deel('function checkSyncStart() {', '\n}\n')
assert.match(start, /if \(syncPartnerId \|\| wachtOp\) return/)
assert.match(start, /const ander = SB\.kiesVolgende\(g\)/)
assert.match(start, /vraagBeurt\(ander\)/)
assert.ok(!/\[\.\.\.onlineGebruikers\]\.find\(kan\)/.test(sync), 'niet meer steeds de eerste online vriend')
const vraag = deel('async function vraagBeurt(id) {', '\n}\n')
assert.match(vraag, /if \(!heeftKenmerk\(id, 'syncbeurt'\)\) \{ beginMet\(id\); return \}/, 'oudere Fibro: zoals vroeger')
assert.match(vraag, /stuurNaar\(id, 'syncbeurt', \{ type: 'vraag' \}\)/)
assert.match(sync, /opBericht\('syncbeurt', beurtBericht\)/)
assert.match(sync, /zetKenmerk\('syncbeurt', true\)/)
const antwoord = deel('function beurtBericht(data, van) {', '\n}\n')
assert.match(antwoord, /if \(!heeftSlot \|\|/, 'alleen het tabblad met de sync antwoordt')
assert.match(antwoord, /SB\.beslisVraag\(/)

// 2. Klaar = alles binnen aan beide kanten; dan door naar de volgende
assert.match(deel("if (bericht.type === 'klaar') {", 'return\n'), /naKlaar\(\)/)
assert.match(sync, /verwachtItems\(nodig\) \/\/ v247/)
for (const naam of ["itemBinnen('layout')", "itemBinnen('muziek:' + muziekItemId)", "itemBinnen('klein:' + sl)", "itemBinnen('videometa')"]) assert.ok(sync.includes(naam), naam)
assert.match(sync, /itemBinnen\(itemId\.startsWith\('pfoto_'\) \? 'foto:' \+ itemId : itemId\.startsWith\('sticker_'\) \? 'sticker:' \+ itemId\.slice\(8\)/)
const volgende = deel('function probeerVolgende() {', '\n}\n')
assert.match(volgende, /beschermd\(syncPartnerId\)/, 'een open chat of video niet onderbreken')
assert.match(volgende, /stopSync\(\)\n  vraagBeurt\(volgende\)/)
assert.match(sync, /if \(syncPartnerId\) \{ probeerVolgende\(\); return \} \/\/ v247/, 'komt er iemand online terwijl ik klaar ben: door')

// 3. Niet meer eeuwig wachten
assert.match(sync, /if \(status === 'SUBSCRIBED' && !isInitiator\) \{[\s\S]{0,400}?mislukking\(partner, 'Geen offer'\)[\s\S]{0,80}?\}, 35000\)/, 'de wachtende kant geeft het na 35 s op')
assert.match(sync, /console\.log\('\[sync\] Vriend met een oudere Fibro is stil - klaar'\)/, 'een oudere Fibro stuurt geen klaar na het ophalen')

// 4. Muziek die via de relay niet mee mocht, en de uitleg op Profiel
assert.match(sync, /const relaySleutel = 'fibro_muziekrelay_' \+ huidigeUserId \+ '_' \+ syncPartnerId/)
assert.match(vp, /muziek: muziekTekst \}\[w\.id\]/)
const uitleg = profiel.match(/<p class="toestel-uitleg" data-t[^>]*>([^<]+)<\/p>/)
assert.ok(uitleg, 'uitleg op Profiel > Widgets')

// 5. Engels en versies
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const k of [uitleg[1].trim(), 'De muziek komt binnen zodra jullie allebei online zijn.',
  'De muziek komt binnen zodra jullie telefoons elkaar rechtstreeks kunnen bereiken (bijvoorbeeld allebei op wifi).']) assert.ok(EN[k], 'Engels voor: ' + k.slice(0, 40))
delete globalThis.window
for (const f of ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html']) {
  const v = [...lees(f).matchAll(/sync\.js\?v=(\d+)/g)].map(m => Number(m[1]))
  assert.ok(v.length === 1 && v[0] >= 247, f + ': sync.js v247 of nieuwer')
}
console.log('ok: sync om de beurt (aansluiting)')
