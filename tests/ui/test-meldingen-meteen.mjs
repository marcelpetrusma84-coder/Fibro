// v258 (4 nov 2026): meldingen meteen aanzetten (meldingen-aan.js). Vaste afspraken in de code; het echte gedrag staat
// in tests/tools/proef237.py (Home, het welkomstscherm en de iPhone in Chrome).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const mod = lees('meldingen-aan.js'), index = lees('index.html'), invite = lees('invite.html'), beltoon = lees('beltoon.js')

// 1. De vraag van de telefoon komt meteen bij de tik: in zetMeldingenAan staat requestPermission voor elke await
const romp = mod.slice(mod.indexOf('export async function zetMeldingenAan'), mod.indexOf('\n}\n', mod.indexOf('export async function zetMeldingenAan')))
assert.ok(romp.indexOf('Notification.requestPermission()') > 0, 'vraagt toestemming')
assert.ok(romp.indexOf('Notification.requestPermission()') < romp.indexOf('await '), 'eerst de vraag, dan pas wachten (iPhone)')
assert.match(romp, /if \(iphoneZonderApp\(\)\) \{ openBeginschermUitleg\(\{ reden: 'meldingen' \}\); return 'iphone-zonder-app' \}/)
assert.match(romp, /upsert\(\{ user_id: userId, subscription: sub\.toJSON\(\) \}, \{ onConflict: 'user_id,endpoint' \}\)/)
assert.match(mod, /const WERKER = '\.\/service-worker\.js\?v=97'/, 'dezelfde service worker als de andere pagina\'s')
assert.ok(mod.includes(lees('profiel.html').match(/applicationServerKey: '([^']+)'/)[1]), 'dezelfde serversleutel als Profiel')

// 2. Home: de kaart, niet in Safari op de iPhone (daar de tip voor het beginscherm), 'Nu niet' = 3 dagen
assert.match(index, /import\('\.\/meldingen-aan\.js\?v=5'\)\.then\(m => m\.toonMeldkaart\(document\.getElementById\('beginschermTip'\), supabase, window\._uid\)\)/)
assert.match(mod, /if \(stand === 'aan' \|\| stand === 'niet-mogelijk' \|\| stand === 'iphone-zonder-app'\) return null/)
assert.match(mod, /const WEG_DAGEN = 3/)

// 3. De eerste tik op 'Welkom bij Fibro' (iPhone, beltoon.js) vraagt de meldingen mee, alleen bij het welkom, een keer
assert.match(beltoon, /if \(welkom\) \{ try \{ if \(typeof window\.FibroMeldingenBijTik === 'function'\) window\.FibroMeldingenBijTik\(\) \} catch \(er\) \{\} \}/)
assert.match(mod, /if \(stand === 'uit'\) \{\n\s+window\.FibroMeldingenBijTik = \(\) => \{\n\s+window\.FibroMeldingenBijTik = null/)

// 4. Het welkomstscherm na het inschrijven: alle drie de wegen (herstelcode, reserve-herstelcode, Face ID gelukt)
assert.equal((invite.match(/toonMeldWelkom\(/g) || []).length, 4, 'een functie en drie aanroepen')
assert.match(invite, /if \(data\.user\) toonMeldWelkom\(data\.user\.id\) \/\/ v258/)
assert.match(invite, /toonMeldWelkom\(userId, ja\) \/\/ v258/)
assert.ok(!/id="meldWelkomKnop"[^>]*class="btn"/.test(invite), 'geen .btn: toonAppKaart zoekt de eerste .btn (Naar inloggen)')
assert.match(invite, /<div id="meldWelkom" hidden/, 'pas zichtbaar als het kan')

// 5. Versies en Engels
for (const [bestand, v] of [['bel-luisteraar.js', "beltoon.js?v=11"], ['chat.html', 'beltoon.js?v=11']]) assert.ok(lees(bestand).includes(v), bestand)
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const k of ['Aanzetten', 'Nu niet', '\u{1F514} <b>Zet meldingen aan</b>, dan weet je wanneer vrienden je schrijven, buzzen of uitdagen.',
  '\u{1F515} <b>Meldingen staan uit</b> voor Stekky, dus je mist berichten van vrienden.', 'Zet ze aan in <b>Instellingen > Meldingen > Stekky</b>.',
  'Houd het Stekky-icoon ingedrukt, kies <b>App-info > Meldingen</b> en zet ze aan.', 'Klik op het slotje naast het adres van deze pagina en zet <b>Meldingen</b> op Toestaan.',
  '✅ <b>Meldingen staan aan!</b>', '🔔 Meldingen', 'Krijg een melding als een vriend je schrijft, buzzt of uitdaagt.', '🔔 Meldingen aanzetten',
  'Meldingen staan uit voor Stekky. Je kunt ze later aanzetten in Stijl > Meldingen.', '✅ Meldingen staan aan!'])
  assert.ok(Object.hasOwn(EN, k), 'Engels voor ' + k)
delete globalThis.window
console.log('meldingen meteen: alles goed')
