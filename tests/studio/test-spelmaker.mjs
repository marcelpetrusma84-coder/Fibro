// test-spelmaker.mjs (25 nov 2026): Stekky Studio, een spel maken (spelmaker.js), het installatiescript
// (tests/tools/studio-spel-installeer.mjs), de computerspeler van het sjabloon, en dat een spel uit studio-spellen.js
// overal aangesloten is (Store, chat, spel.html, Profiel, uitnodigingen, spelicoon, titelscherm).
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, symlinkSync, readdirSync, copyFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const lees = f => readFileSync(path.join(REPO, f), 'utf8')
globalThis.window = {}
const S = await import(pathToFileURL(path.join(REPO, 'spelmaker.js')).href)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const WEBP = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACwAQCdASoCAAIAAUAmJaACdLoABGaAAP7tTd/9Wh/6tD/1aH7n39XYnwoLAAAA' // zoals de Studio het maakt (png maakt het script webp, maar daar is Pillow voor nodig)

// ── maakSpel en valideerSpel ──
const invul = { soort: 'kaart', naam: 'Kleurenjacht', naamEn: 'Colour Hunt', icoon: '🌈', uitleg: 'Leg kaarten van dezelfde kleur.', uitlegEn: 'Play cards of the same colour.',
  doel: 'Wie het eerst geen kaarten meer heeft, wint.', regels: 'Iedereen krijgt 7 kaarten. Leg een kaart van dezelfde kleur of waarde op de stapel. Kun je niet, pak er een.',
  met: { vriend: true, chatbalk: true, webcam: false, computer: false }, spraak: 'vanzelf', titel: 'pesten', deck: '54', perSpeler: '7',
  speciaal: [{ kaart: '2', wat: 'De ander pakt 2 kaarten.' }, { kaart: 'joker', wat: 'De ander pakt 5 kaarten.' }, { kaart: '8', wat: '' }],
  extras: { uitleg: true, beurtklok: true, onzin: true }, plaatje: WEBP }
const spel = S.maakSpel(invul)
assert.equal(spel.id, 'kleurenjacht')
assert.deepEqual(spel.naam, ['Kleurenjacht', 'Colour Hunt'])
assert.deepEqual(spel.met, { spelmenu: true, vriend: true, computer: true, chatbalk: true, webcam: false, store: true }, 'computer, Store en spelmenu zitten er altijd in')
assert.equal(spel.spraak, 'vanzelf')
assert.deepEqual(spel.extras, ['uitleg', 'beurtklok'], 'alleen bekende extra\'s')
assert.deepEqual(spel.kaarten, { deck: '54', perSpeler: 7, spelers: 2, speciaal: [{ kaart: '2', wat: 'De ander pakt 2 kaarten.' }, { kaart: 'joker', wat: 'De ander pakt 5 kaarten.' }] }, 'een lege speciale kaart valt weg')
assert.deepEqual(S.valideerSpel(spel), [])
assert.deepEqual(S.valideerSpel({ ...spel, plaatje: PNG }), [], 'png mag ook')
assert.equal(S.maakSpel({ ...invul, met: { vriend: false, chatbalk: true, webcam: true } }).spraak, 'uit', 'zonder vriend: geen spraak')
assert.deepEqual(S.maakSpel({ ...invul, met: { vriend: false, chatbalk: true, webcam: true } }).met.chatbalk, false, 'zonder vriend: geen chatbalk')
assert.equal(S.maakSpel({ ...invul, spraak: 'knop' }).spraak, 'uit', 'spraak met 📹 kan niet zonder webcam')
const beurt = S.maakSpel({ ...invul, soort: 'beurt', bord: '8 bij 8 vakjes', met: { vriend: true, chatbalk: true, webcam: true }, spraak: 'knop' })
assert.ok(!beurt.kaarten && beurt.bord === '8 bij 8 vakjes' && beurt.spraak === 'knop')
assert.deepEqual(S.valideerSpel(beurt), [])
console.log('PASS: maakSpel maakt een net spel uit wat in de Studio is ingevuld')

const fout = (wijzig, tekst) => { const f = S.valideerSpel({ ...spel, ...wijzig }); assert.ok(f.some(x => x.includes(tekst)), tekst + ' (' + f.join(' | ') + ')') }
fout({ formaat: 'iets' }, 'geen spelbestand')
fout({ id: 'pesten' }, 'al een spel')
fout({ id: 'x' }, 'minstens 3 letters')
fout({ id: '../kwaad' }, 'minstens 3 letters')
fout({ naam: ['<script>', 'x'] }, 'rare tekens')
fout({ icoon: '' }, 'icoon')
fout({ uitleg: ['Iets', ''] }, 'Engelse uitleg')
fout({ regels: 'kort' }, 'spelregels')
fout({ spraak: 'hard' }, 'spraak')
fout({ titel: 'kwaad' }, 'titelscherm')
fout({ met: { ...spel.met, computer: false } }, 'altijd in een spel')
fout({ met: { ...spel.met, webcam: false }, spraak: 'knop' }, '📹')
fout({ met: { ...spel.met, vriend: false } }, 'alleen voor spelen met een vriend')
fout({ kaarten: { ...spel.kaarten, deck: '52' } }, 'joker zit alleen')
fout({ kaarten: { ...spel.kaarten, deck: '32', speciaal: [{ kaart: '2', wat: 'x' }] } }, 'onder de 7')
fout({ kaarten: { ...spel.kaarten, perSpeler: 30 } }, '1 tot 26')
fout({ kaarten: { deck: '32', perSpeler: 20, speciaal: [] } }, 'Zoveel kaarten')
fout({ kaarten: { ...spel.kaarten, speciaal: [{ kaart: '2', wat: 'a' }, { kaart: '2', wat: 'b' }] } }, 'twee keer')
// v2: hoeveel spelers (2 tot 6)
fout({ kaarten: { ...spel.kaarten, spelers: 7 } }, '2 tot 6')
fout({ kaarten: { ...spel.kaarten, spelers: 1 } }, '2 tot 6')
fout({ kaarten: { deck: '32', perSpeler: 8, spelers: 5, speciaal: [] } }, 'niet genoeg kaarten')
fout({ kaarten: { ...spel.kaarten, spelers: 4 }, met: { ...spel.met, vriend: false, chatbalk: false, webcam: false }, spraak: 'uit' }, 'Met een vriend spelen')
assert.deepEqual(S.valideerSpel({ ...spel, kaarten: { ...spel.kaarten, spelers: 6 } }), [], '6 spelers met 7 kaarten uit 54: goed')
{ const oud = { ...spel, kaarten: { ...spel.kaarten } }; delete oud.kaarten.spelers; assert.deepEqual(S.valideerSpel(oud), [], 'een oud spelbestand (zonder spelers) is nog goed') }
assert.equal(S.maakSpel({ ...invul, spelers: '4' }).kaarten.spelers, 4); assert.equal(S.maakSpel({ ...invul, spelers: '9' }).kaarten.spelers, 6); assert.equal(S.maakSpel(invul).kaarten.spelers, 2)
fout({ plaatje: 'data:image/svg+xml;base64,AAAA' }, 'spelicoon')
fout({ plaatje: 'javascript:alert(1)' }, 'spelicoon')
assert.ok(S.valideerSpel(spel, { bestaand: ['kleurenjacht'] }).some(x => x.includes('al een spel')), 'een Studio-spel dat er al is')
console.log('PASS: valideerSpel houdt foute spelbestanden tegen')

// ── De bouwopdracht ──
const md = S.bouwopdracht(spel)
for (const t of ['# Bouwopdracht: Kleurenjacht (🌈)', 'BLAUWDRUK-KAARTSPEL.md', '`kleurenjacht-ui.js`', 'Iedereen krijgt 7 kaarten', 'Met 2 jokers (54 kaarten)',
  '- Kaarten per speler: 7', '**joker**: De ander pakt 5 kaarten.', 'Chatbalk in het spel: stickers 🎨, emoji 😊 en berichten: ja', 'Webcamrondjes bovenin (met 📹-knop): nee',
  'Spraak: Spraak meteen aan', 'Titelscherm: zoals Pesten', 'Beurtklok', 'Wie het eerst geen kaarten meer heeft'])
  assert.ok(md.includes(t), 'bouwopdracht: ' + t)
assert.ok(S.bouwopdracht(beurt).includes('## Bord') && S.bouwopdracht(beurt).includes('BLAUWDRUK-BEURTSPEL.md'))
assert.ok(md.includes('- Spelers: 2') && !md.includes('## Met meer spelers'), 'met 2 spelers geen stuk over meer spelers')
{ const md4 = S.bouwopdracht({ ...spel, kaarten: { ...spel.kaarten, spelers: 4 } })
  for (const t of ['- Spelers: 2 tot 4', '## Met meer spelers (2 tot 4)', 'groepspel.js', 'start({ spelKanaal, spelers, mijnZetel })', 'tafel.tegenstanders', '(1 tot 3)', '"max": 4', 'proef340'])
    assert.ok(md4.includes(t), 'bouwopdracht met 4 spelers: ' + t) }
console.log('PASS: de bouwopdracht heeft alles wat in de Studio is ingevuld')

// ── De computerspeler van het sjabloon ──
const B = await import(pathToFileURL(path.join(REPO, 'sjabloon-beurtspel.js')).href)
for (const over of [2, 3, 4, 6, 7, 8]) assert.equal((over - B.kies(over, 'moeilijk')) % 4, 1, 'moeilijk laat er 1, 5, 9 of 13 over (' + over + ')')
for (let i = 0; i < 50; i++) { const n = B.kies(2, 'makkelijk'); assert.ok(n >= 1 && n <= 2) }
const gestuurd = []
const bot = B.bot({ stuur: (e, p) => gestuurd.push([e, p]), niveau: 'moeilijk', isDicht: () => false })
bot.ontvang('zet', { staat: { over: 12, aanZet: 2 }, nr: 1, spelId: 5 })
await new Promise(r => setTimeout(r, 1000))
assert.equal(gestuurd.length, 1); assert.equal(gestuurd[0][0], 'zet')
assert.deepEqual(gestuurd[0][1], { staat: { over: 9, aanZet: 1 }, nr: 2, spelId: 5, einde: undefined }, 'de computer zet, met de hele stand')
bot.ontvang('vraag-stand', { spelId: 5, nr: 1 }); assert.equal(gestuurd.at(-1)[0], 'stand', 'wie achterloopt krijgt de stand')
bot.stop()
console.log('PASS: de computerspeler van het sjabloon speelt mee (en moeilijk wint)')

// ── Het installatiescript, in een kopie ──
const tmp = mkdtempSync(path.join(os.tmpdir(), 'spelmaker-'))
try {
  for (const n of readdirSync(REPO)) {
    if (['.git', 'node_modules', 'studio-spellen.js', 'spelicoon', 'spellen'].includes(n)) continue
    symlinkSync(path.join(REPO, n), path.join(tmp, n))
  }
  copyFileSync(path.join(REPO, 'studio-spellen.js'), path.join(tmp, 'studio-spellen.js'))
  mkdirSync(path.join(tmp, 'spelicoon'))
  const json = path.join(tmp, 'kleurenjacht.stekkyspel.json'); writeFileSync(json, JSON.stringify(spel))
  const draai = f => spawnSync(process.execPath, [path.join(REPO, 'tests/tools/studio-spel-installeer.mjs'), f, '--map', tmp, '--zonder-versies'], { encoding: 'utf8' })
  let r = draai(json)
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /als kleurenjacht/)
  for (const f of ['kleurenjacht-ui.js', 'kleurenjacht.js', 'spelicoon/kleurenjacht.webp', 'spellen/kleurenjacht.md', 'spellen/kleurenjacht.stekkyspel.json']) assert.ok(existsSync(path.join(tmp, f)), 'gemaakt: ' + f)
  const ui = readFileSync(path.join(tmp, 'kleurenjacht-ui.js'), 'utf8')
  assert.match(ui, /titel\.textContent = "🌈 " \+ T\("Kleurenjacht"\)/, 'de eigen naam in de titelbalk')
  assert.match(ui, /^\/\/ kleurenjacht-ui\.js .*\n\/\/ BEGINSPEL uit het sjabloon\. De echte regels staan in spellen\/kleurenjacht\.md: bouw die hier \(zie BLAUWDRUK-KAARTSPEL\.md\)/)
  assert.match(readFileSync(path.join(tmp, 'kleurenjacht.js'), 'utf8'), /export function bot\(/)
  assert.ok(!readFileSync(path.join(tmp, 'spellen/kleurenjacht.stekkyspel.json'), 'utf8').includes('base64'), 'zonder plaatje bewaard')
  const D = await import(pathToFileURL(path.join(tmp, 'studio-spellen.js')).href + '?x=1')
  assert.deepEqual(D.STUDIO_SPELLEN.at(-1), { id: 'kleurenjacht', soort: 'kaart', naam: ['Kleurenjacht', 'Colour Hunt'], icoon: '🌈', uitleg: spel.uitleg, v: 1,
    met: { vriend: true, computer: true, chatbalk: true, webcam: false }, spraak: 'vanzelf', titel: 'pesten' }, 'achteraan erbij gezet')
  assert.equal(window.FIBRO_EN['Kleurenjacht'], 'Colour Hunt', 'de Engelse naam')
  assert.equal(D.spelBestand(D.STUDIO_SPELLEN.at(-1)), './kleurenjacht-ui.js?v=1')
  assert.deepEqual(D.studioWidgetDef('spel_kleurenjacht'), { id: 'spel_kleurenjacht', icon: '🌈', titel: 'Kleurenjacht', w: 2, h: 1 })
  assert.equal(D.studioWidgetDef('spel_pesten'), null)
  r = draai(json); assert.notEqual(r.status, 0, 'twee keer hetzelfde spel kan niet'); assert.match(r.stderr, /al een spel/)
  writeFileSync(json, JSON.stringify({ ...spel, id: 'tweede', plaatje: undefined })); r = draai(json)
  assert.notEqual(r.status, 0); assert.match(r.stderr, /spelicoon ontbreekt/)
  writeFileSync(json, '{kapot'); r = draai(json); assert.notEqual(r.status, 0); assert.match(r.stderr, /geen geldige JSON/)
} finally { rmSync(tmp, { recursive: true, force: true }) }
console.log('PASS: het installatiescript zet het spel in de app en schrijft de bouwopdracht')

// ── Overal aangesloten ──
const chat = lees('chat.html')
for (const re of [/import \{ STUDIO_SPELLEN, studioSpel, spelBestand as studioBestand, spelIcoon as studioIcoon \} from '\.\/studio-spellen\.js\?v=\d+'/,
  /for \(const s of STUDIO_SPELLEN\) SPEL_INFO\[s\.id\] = /, /for \(const s of STUDIO_SPELLEN\) SPEL_BESTAND\[s\.id\] = studioBestand\(s\)/,
  /'shmup', \.\.\.STUDIO_SPELLEN\.filter\(s => s\.met\.vriend\)\.map\(s => s\.id\)\]/, /else if \(studioSpel\(spelType\)\) await startKaartspel\(spelType\)/,
  /\.\.\.STUDIO_SPELLEN\.filter\(s => s\.met\.vriend\)\.map\(s => \(\{ id: s\.id, naam: s\.naam\[0\], widget: 'spel_' \+ s\.id, icoon: studioIcoon\(s\) \}\)\)\]/,
  /BEURTSPELLEN\.push\(\.\.\.STUDIO_SPELLEN\.filter\(s => s\.met\.vriend && s\.met\.webcam\)/, /KAARTSPELLEN\.push\(\.\.\.STUDIO_SPELLEN\.filter\(s => s\.met\.vriend && s\.spraak === 'vanzelf'\)/])
  assert.match(chat, re)
assert.ok(chat.indexOf('BEURTSPELLEN.push(') < chat.indexOf('const CAMERA_RONDJES'), 'de webcamlijst is af voordat de rondjes gemaakt worden')
assert.match(lees('solo.js'), /for \(const s of STUDIO_SPELLEN\) if \(s\.met\.computer\)\n  SOLO_SPELLEN\[s\.id\] = \{ naam: s\.naam\[0\], icon: s\.icoon, bestand: studioBestand\(s\), bot: luieBot\(s\), store: true, studio: true \}/)
assert.match(lees('store.js'), /\.\.\.STUDIO_SPELLEN\.map\(s => \(\{ id: s\.id, soort: 'game', titel: s\.naam\[0\], widget: 'spel_' \+ s\.id/)
assert.match(lees('profiel.html'), /studioWidgetDef\(n\)\)\.filter\(Boolean\)/)
assert.match(lees('profiel.html'), /filter\(it=>it&&it\.studio\)/)
assert.match(lees('invite.html'), /for \(const s of STUDIO_SPELLEN\) MEE_SPELLEN\[s\.id\] = \[s\.icoon, s\.naam\[0\]\]/)
assert.match(lees('speluitnodiging.js'), /for \(const s of STUDIO_SPELLEN\) SPEL_INFO\[s\.id\] = /)
assert.match(lees('spelicoon.js'), /\.\.\.STUDIO_SPELLEN\.map\(s => s\.id\)\]/)
assert.match(lees('titelscherm.js'), /const scene = SCENES\[leen\(spelId\)\]/)
assert.match(lees('titelscherm.js'), /hasOwnProperty\.call\(SCENES, leen\(spelId\)\)/)
assert.match(lees('studio.html'), /<details class="promptblok" id="spelBlok">/)
assert.match(lees('studio.html'), /import '\.\/studio-spel-ui\.js\?v=\d+'/)
for (const t of Object.keys(S.TITELS).filter(Boolean)) assert.match(lees('titelscenes.js'), new RegExp('\\n    ' + t + ': \\{'), 'titelscherm om te lenen: ' + t)
for (const f of ['BLAUWDRUK-BEURTSPEL.md', 'BLAUWDRUK-KAARTSPEL.md']) assert.match(lees(f), /Stekky Studio/, f + ': de Studio staat erin')
console.log('PASS: een spel uit studio-spellen.js staat overal: Store, chat, spel.html, Profiel, uitnodigingen, spelicoon en titelscherm')
