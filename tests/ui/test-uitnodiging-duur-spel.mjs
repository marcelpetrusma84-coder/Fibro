// v250 (2 nov 2026): bij Uitnodigen zelf kiezen hoe lang de link geldig is (1 uur, 1 dag, 3 dagen, 7 dagen;
// standaard 3 dagen) en een van de 12 spellen meesturen, dat je vriend via de link meteen kan spelen (ook zonder account).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const vrienden = lees('vrienden.html'), invite = lees('invite.html'), spel = lees('spel.html'), solo = lees('solo.js')

// 1. de keuze voor hoe lang
for (const [sec, tekst] of [[3600, '1 uur'], [86400, '1 dag'], [259200, '3 dagen'], [604800, '7 dagen']])
  assert.match(vrienden, new RegExp('data-sec="' + sec + '" role="radio" data-t>' + tekst + '<'), tekst)
assert.match(vrienden, /const DUREN = \[3600, 86400, 259200, 604800\]/)
assert.match(vrienden, /const STANDAARD_DUUR = 259200/, 'standaard 3 dagen')
assert.match(vrienden, /zetKeuze\(STANDAARD_DUUR\)/, 'bij openen weer 3 dagen')
assert.match(vrienden, /const verlooptOm = new Date\(Date\.now\(\) \+ DUUR \* 1000\)\.toISOString\(\)/)
assert.match(vrienden, /secondsLeft = Math\.max\(0, Math\.ceil\(\(eindTijd - Date\.now\(\)\) \/ 1000\)\)/, 'timer vanaf de eindtijd')
assert.ok(!/const DUUR = 20 \* 60/.test(vrienden), 'niet meer vast 20 minuten')

// tijdTekst (de echte functie)
const knip = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, a); return src.slice(i, j) }
const T = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)
const tijdTekst = new Function('T', knip(vrienden, 'function tijdTekst(sec) {', '\n  // ===') + '; return tijdTekst')(T)
assert.equal(tijdTekst(604800 - 2), '6 d 23:59:58')
assert.equal(tijdTekst(3600), '01:00:00')
assert.equal(tijdTekst(59), '00:59')
assert.equal(tijdTekst(-5), '00:00')

// 2. een spel meesturen: dezelfde 12 als in solo.js
const soloIds = [...knip(solo, 'SOLO_SPELLEN', '\n}\n').matchAll(/^\s+(\w+):\s+\{ naam:/gm)].map(m => m[1])
assert.equal(soloIds.length, 12, 'twaalf spellen om alleen te spelen')
const vrIds = [...knip(vrienden, 'const MEE_SPELLEN = [', '\n  ]\n').matchAll(/\['(\w+)', /g)].map(m => m[1])
const invIds = [...knip(invite, 'const MEE_SPELLEN = {', '\n}\n').matchAll(/(\w+): \['/g)].map(m => m[1])
assert.deepEqual([...vrIds].sort(), [...soloIds].sort(), 'vrienden.html: dezelfde spellen als solo.js')
assert.deepEqual([...invIds].sort(), [...soloIds].sort(), 'invite.html: dezelfde spellen als solo.js')
for (const id of soloIds) {
  const naam = new RegExp('\\b' + id + ":\\s+\\{ naam: '([^']+)'").exec(solo)[1]
  assert.ok(vrienden.includes("'" + naam + "'") && invite.includes("'" + naam + "'"), 'zelfde naam voor ' + id)
}
assert.match(vrienden, /const spelDeel = MEE_SPELLEN\.some\(s => s\[0\] === meeSpel\) \? '&spel=' \+ encodeURIComponent\(meeSpel\) : ''/, 'alleen een bekend spel in de link')
assert.match(vrienden, /'\?token=' \+ token \+ spelDeel \+ \(hekje \? '#' \+ hekje : ''\)/, 'het spel voor het hekje (vingerafdruk en naam achter het hekje)')
assert.match(vrienden, /\[vinger \? 's=' \+ vinger : '', naamDeel\]\.filter\(Boolean\)\.join\('&'\)/, 'v265: eerst de vingerafdruk, dan de naam')

// 3. de uitnodigingspagina: alleen een bekend spel, met een knop naar spel.html
assert.match(invite, /if \(!Object\.prototype\.hasOwnProperty\.call\(MEE_SPELLEN, id\)\) return/)
assert.match(invite, /knop\.href = 'spel\.html\?spel=' \+ encodeURIComponent\(id\) \+ '&terug=uitnodiging'/)
assert.match(invite, /toonSpelUitdaging\(toonNaam\)/, 'pas na een geldige uitnodiging (v265: met de weergavenaam)')
assert.ok(invite.indexOf("toonSpelUitdaging(toonNaam") > invite.indexOf("if (error || data === null) { toonFout(); return }"), 'niet bij een verlopen link')
assert.match(invite, /textContent = T\('\{naam\} daagt je uit voor een potje \{spel\}!'/, 'tekst via textContent (geen html van buiten)')

// 4. spel.html: terug naar de uitnodiging
assert.match(spel, /const vanUitnodiging = new URLSearchParams\(location\.search\)\.get\('terug'\) === 'uitnodiging'/)
assert.match(spel, /if \(vanUitnodiging && history\.length > 1\) history\.back\(\)/)

// 5. Engels
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const k of ['Kies hoe lang de link geldig is, en stuur eventueel een spel mee dat je vriend meteen kan spelen.', 'Geldig', '1 uur', '1 dag', '3 dagen', '7 dagen',
  'Spel meesturen', 'Geen spel', 'Link maken', '{d} d', 'Probeer het meteen, ook zonder account.', '{naam} daagt je uit voor een potje {spel}!', '▶ Speel {spel}'])
  assert.ok(Object.hasOwn(EN, k), 'Engels voor ' + k)
delete globalThis.window

console.log('ok: uitnodiging 1 uur tot 7 dagen (standaard 3), met een spel om meteen te spelen')
