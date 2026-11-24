// Stekky Studio: de prompt voor Gemini (studio-prompt.js) - de tekst past zich aan en bevat de regels die het knippen nodig heeft.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { maakPrompt, roosterOpmerking, maakGeluidPrompt, STANDAARD, MIN_STICKERS } from '../../studio-prompt.js'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

// Zonder invullen: de standaardprompt, zonder losse [haakjes]
const std = maakPrompt()
assert.ok(std.includes('15 losse stickers in een strak rooster van 5 kolommen en 3 rijen'), 'standaard 5 x 3 = 15')
assert.ok(std.includes('Thema: ' + STANDAARD.thema) && std.includes(STANDAARD.stijl) && std.includes('licht beige'), 'standaardwaarden staan erin')
assert.ok(!/[\[\]]/.test(std), 'geen blokhaken in de tekst')
assert.ok(std.includes('16:9 liggend'), 'meer kolommen dan rijen = liggend')

// De regels die de Studio nodig heeft om netjes te knippen
for (const regel of ['één effen, egale kleur', 'Geen verloop', 'Geen enkele sticker gebruikt die achtergrondkleur', 'helemaal los', 'Niets raakt of overlapt',
  'Geen schaduwen', 'Geen tekst', 'witte rand', 'ongeveer even groot', 'precies hetzelfde']) assert.ok(std.includes(regel), 'regel ontbreekt: ' + regel)

// Invullen
const eigen = maakPrompt({ thema: '  winterdieren  ', stijl: 'zachte waterverf', achtergrond: 'lichtgrijs', kolommen: '4', rijen: '4' })
assert.ok(eigen.includes('16 losse stickers in een strak rooster van 4 kolommen en 4 rijen'))
assert.ok(eigen.includes('Thema: winterdieren\n') && eigen.includes('- zachte waterverf') && eigen.includes('kleur: lichtgrijs.'))
assert.ok(eigen.includes('vierkant'), '4 x 4 = vierkant')
assert.ok(maakPrompt({ kolommen: 3, rijen: 5 }).includes('9:16 staand'), 'meer rijen = staand')

// Rommel in de velden
assert.ok(maakPrompt({ thema: '   ', stijl: '', achtergrond: null }).includes(STANDAARD.thema), 'lege velden = standaard')
assert.ok(maakPrompt({ thema: 'regel een\n\nregel   twee' }).includes('Thema: regel een regel twee'), 'regeleinden en dubbele spaties worden één spatie')
assert.ok(maakPrompt({ kolommen: 'abc', rijen: '' }).includes('5 kolommen en 3 rijen'), 'geen getal = standaard')
assert.ok(maakPrompt({ kolommen: '99', rijen: '0' }).includes('8 kolommen en 1 rijen'), 'te groot en te klein worden begrensd')

// De opmerking onder de velden
assert.ok(roosterOpmerking().includes('5 kolommen en 3 rijen') && !roosterOpmerking().includes('nodig'))
assert.ok(roosterOpmerking({ kolommen: 3, rijen: 3 }).includes('maar 9') && roosterOpmerking({ kolommen: 3, rijen: 3 }).includes('nodig'))
assert.equal(MIN_STICKERS, 12)
assert.ok(!roosterOpmerking({ kolommen: 4, rijen: 3 }).includes('nodig'), '4 x 3 = precies 12 mag')

// ── De beschrijving van het geluid van één sticker ──
const en = maakGeluidPrompt({ naam: 'Happy frog', beweging: 'Bounce' })
assert.ok(en.includes('"Happy frog"') && en.includes('moves like this: bounce.') && en.includes('no music, no voice'), en)
const nl = maakGeluidPrompt({ naam: 'Blije kikker', beweging: 'Stuiteren', taal: 'nl' })
assert.ok(nl.includes('"Blije kikker"') && nl.includes('De sticker beweegt zo: stuiteren.') && nl.includes('zonder muziek, zonder stem'), nl)
assert.ok(!maakGeluidPrompt({ naam: 'x', beweging: '' }).includes('moves like'), 'zonder beweging geen zin over beweging')
assert.ok(maakGeluidPrompt({ naam: '  Ha "ha"\n ha ' }).includes('"Ha \'ha\' ha"'), 'aanhalingstekens en regeleinden in de naam')
assert.ok(maakGeluidPrompt().includes('a sticker') && maakGeluidPrompt({ taal: 'nl' }).includes('een sticker'), 'zonder naam een nette tekst')
assert.ok(maakGeluidPrompt({ naam: 'x'.repeat(200) }).length < 400, 'een lange naam wordt ingekort')

// Het onderdeel staat in studio.html, binnen het deel dat alleen moderators zien
const html = readFileSync(path.join(REPO, 'studio.html'), 'utf8')
assert.ok(html.indexOf('id="promptBlok"') > html.indexOf('<main id="inhoud"'), 'de prompt staat binnen #inhoud')
for (const id of ['promptThema', 'promptStijl', 'promptAchtergrond', 'promptKolommen', 'promptRijen', 'promptTekst', 'kopieerPrompt', 'kopieerMelding', 'promptOpmerking'])
  assert.ok(html.includes('id="' + id + '"'), 'studio.html mist #' + id)

console.log('studio-prompt ok')
