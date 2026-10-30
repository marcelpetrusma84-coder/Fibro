// spelregels.html (v229): de spelregels bestaan, zijn helemaal vertaald, en zijn te vinden bij het aanmelden,
// op Over Fibro en in het menu op Home.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const regels = lees('spelregels.html'), over = lees('over.html'), index = lees('index.html')

// 1. De pagina volgt de huisregels van de andere pagina's
assert.match(regels, /<html lang="nl" data-taal/)
assert.equal(regels.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0], over.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0], 'dezelfde huisregel als Over Fibro')
for (const s of ['huisregel.js?v=1', 'foutmelder.js?v=1']) assert.ok(regels.includes('<script src="' + s + '"></script>'), s)
// taal.js: het ?v=-nummer gaat omhoog bij elke nieuwe vertaling (30 okt 2026: 37), dus alleen of hij er is
assert.match(regels, /<script src="taal\.js\?v=\d+"><\/script>/, 'taal.js')
assert.match(regels, /<meta name="viewport"/)
assert.doesNotMatch(regels, /https?:\/\/(?!qmgatbphiplrfxrljtbe\.supabase\.co)/, 'geen externe adressen')

// 2. Elke zichtbare tekst heeft een Engelse versie
{
  const blok = regels.match(/<script>\n(\/\/ v229[\s\S]*?)<\/script>/)[1]
  const w = {}
  new Function('window', blok)(w)
  const en = w.FIBRO_EN
  const teksten = [...regels.matchAll(/data-t>([^<]+)</g)].map(m => m[1])
  assert.ok(teksten.length >= 30, 'teksten gevonden')
  for (const t of teksten) assert.ok(typeof en[t] === 'string' && en[t].length > 0, 'Engels ontbreekt: ' + t)
}

// 3. De belangrijkste regels staan erin
for (const z of ['Fibro is vanaf 16 jaar', 'Pesten, bedreigen', 'jonger is dan 18', 'Bericht melden', 'stuurt je toestel wél leesbaar naar de moderator', 'Bel 112', '0800-0113', 'voor een dag, drie dagen, een week, een maand of voor altijd']) {
  assert.ok(regels.includes(z), 'staat erin: ' + z)
}

// 4. Te vinden bij het aanmelden (in een nieuw tabblad, zodat het formulier blijft staan), op Over Fibro en op Home
const LINK = 'Ik ga akkoord met de <a href="spelregels.html" target="_blank" rel="noopener" style="color:var(--accent)">spelregels van Fibro</a>'
for (const p of ['login.html', 'invite.html']) {
  const s = lees(p)
  assert.ok(s.includes('data-t>\n            ' + LINK) || s.includes(LINK), p + ': link naar de spelregels')
  assert.ok(s.includes("'" + LINK + "': 'I agree to the <a href=\"spelregels.html\""), p + ': ook in het Engels')
  assert.doesNotMatch(s, /<span style="color:var\(--accent\)">spelregels van Fibro<\/span>/, p + ': geen tekst zonder link meer')
}
assert.ok(over.includes('<a href="spelregels.html"'), 'Over Fibro verwijst naar de spelregels')
assert.match(index, /item\(g, T\('\\u\{1F4DC\} Spelregels'\), \(\) => \{ window\.location\.href = 'spelregels\.html' \}\)/, 'menu op Home')
assert.ok(index.includes("'\\u{1F4DC} Spelregels': '\\u{1F4DC} House rules'"), 'menu op Home in het Engels')

console.log('test-spelregels: alles goed')
