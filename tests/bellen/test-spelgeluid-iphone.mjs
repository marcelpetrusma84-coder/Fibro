// Spelgeluid op de iPhone (foutmeldingen 3 nov 2026, Moderatie > Foutmeldingen):
//  1. dammen, speler 2: verbonden=nee, eigen mic=ja -> speler 2 belt nooit zelf; een tik op 📹/🎤 vraagt nu speler 1 te bellen
//  2. schaken, speler 2: verbonden=ja, eigen mic=nee terwijl de microfoon er was -> de knop zette hem uit (omdraaien);
//     de knop zet hem nu in de stand die erop staat, en de melding zegt 'gedempt' of 'onderbroken'.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const chat = lees('chat.html')
const bel = lees('bellen.js')

// bellen.js: vaste stand voor de microfoon, en of de iPhone hem onderbrak
assert.match(bel, /export function zetMic\(aan\) \{/)
assert.match(bel, /localAudioMuted: !!lokaleStream\?\.getAudioTracks\(\)\.some\(track => track\.readyState === 'live' && track\.muted\)/)

// werkt zetMic echt? (kleine nagemaakte stroom)
{
  const blok = bel.slice(bel.indexOf('export function zetMic'), bel.indexOf('export function toggleMic'))
  let gemeld = 0
  const track = { readyState:'live', enabled:true }
  const zetMic = new Function('lokaleStream', 'meldMediaStatus', blok.replace('export ', '') + '\nreturn zetMic')(
    { getAudioTracks: () => [track] }, () => { gemeld++ })
  assert.equal(zetMic(true), true); assert.equal(track.enabled, true)   // al aan: blijft aan (omdraaien zette hem uit)
  assert.equal(zetMic(false), false); assert.equal(track.enabled, false)
  assert.equal(zetMic(true), true); assert.equal(track.enabled, true)
  assert.equal(gemeld, 3)
}

// chat.html: speler 2 vraagt om te bellen, speler 1 luistert
assert.match(chat, /zetMic, toggleCamera/, 'zetMic wordt geimporteerd')
assert.match(chat, /function vraagSpelBelAan\(\) \{/)
assert.match(chat, /event:'bel-verzoek'/)
assert.match(chat, /spelKanaal\.on\('broadcast', \{ event: 'bel-verzoek' \}, \(\) => \{\n\s+if \(spelKanaal !== verbinding \|\| !benIkSpeler1 \|\| getMediaStatus\(\)\.connected\) return\n\s+startSpelBel\(true\)/)
const start = chat.slice(chat.indexOf('async function startSpelBel('), chat.indexOf('function stopSpelBel('))
assert.ok(start.indexOf('vraagSpelBelAan()') > 0 && start.indexOf('vraagSpelBelAan()') < start.indexOf('if (spelBelActief) return'),
  'het verzoek gaat mee voordat startSpelBel stopt omdat het al actief is')
assert.match(start, /if \(doorGebruiker && !benIkSpeler1 && !getMediaStatus\(\)\.connected\) vraagSpelBelAan\(\)/)
assert.match(start, /eigen mic=' \+ \(st\.localAudio \? 'ja' : st\.localAudioAvailable \? 'gedempt' : 'nee'\)/)
assert.match(start, /mic onderbroken=' \+ ja\(st\.localAudioMuted\)/)

// webcamknop en microfoonknop roepen startSpelBel altijd aan (die beslist zelf: bellen of vragen)
assert.doesNotMatch(chat, /if \(!spelBelActief\) startSpelBel\(true\)/)
assert.doesNotMatch(chat, /if \(ok && !spelBelActief\) startSpelBel\(true\)/)

// microfoonknop: de stand op de knop, niet omdraaien
const knop = chat.slice(chat.indexOf('window.toggleSpelMic = async function'), chat.indexOf('function werkSchaakOmgevingTaalBij'))
assert.match(knop, /zetMic\(knop\.getAttribute\('aria-pressed'\) !== 'true'\)/)
assert.doesNotMatch(knop, /toggleMic\(\)/)

// Engels
const zin = 'Je microfoon staat uit. Tik op 🔇 om hem weer aan te zetten.'
assert.ok(chat.includes("'" + zin + "'"))
assert.ok(lees('taal-en.js').includes(JSON.stringify(zin) + ':'))
assert.ok(lees('schaak-taal-en.js').includes(JSON.stringify(zin) + ':'))
assert.match(lees('taal.js'), /taal-en\.js\?v=5[4-9]/)
console.log('spelgeluid iphone: ok')
