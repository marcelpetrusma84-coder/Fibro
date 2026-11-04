// test-regels-geen-dichte-functie.mjs (4 nov 2026, v260): een regel (policy) draait met de rechten van de gebruiker.
// Roept een regel een functie aan die voor de app dicht staat, dan faalt ELKE schrijfactie (42501, HTTP 403).
// Zo werkten likes en de postbus niet (is_geblokkeerd in sql/profiel-likes.sql en sql/profiel-post.sql).
// Deze test kijkt in alle sql-bestanden: welke functies zijn dicht voor authenticated (revoke ... from ... authenticated)
// en gebruikt een regel er een van? Een latere grant aan authenticated maakt hem weer open.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const MAP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../sql')
const bestanden = readdirSync(MAP).filter(f => f.endsWith('.sql')).sort()
const zonderCommentaar = s => s.replace(/--.*$/gm, '')
const dicht = new Set()
for (const f of bestanden) {
  const s = zonderCommentaar(readFileSync(path.join(MAP, f), 'utf8'))
  for (const m of s.matchAll(/revoke\s+execute\s+on\s+function\s+(?:public\.)?(\w+)\s*\([^)]*\)\s+from\s+([^;]+);/gi))
    if (/\bauthenticated\b/i.test(m[2])) dicht.add(m[1].toLowerCase())
}
for (const f of bestanden) {
  const s = zonderCommentaar(readFileSync(path.join(MAP, f), 'utf8'))
  for (const m of s.matchAll(/grant\s+execute\s+on\s+function\s+(?:public\.)?(\w+)\s*\([^)]*\)\s+to\s+([^;]+);/gi))
    if (/\bauthenticated\b/i.test(m[2])) dicht.delete(m[1].toLowerCase())
}
assert.ok(dicht.has('is_geblokkeerd'), 'is_geblokkeerd hoort dicht te zijn (sql/blokkeren.sql)')
const fout = []
for (const f of bestanden) {
  const s = zonderCommentaar(readFileSync(path.join(MAP, f), 'utf8'))
  for (const m of s.matchAll(/create\s+policy\s+("[^"]+"|\w+)[\s\S]*?;/gi))
    for (const fn of dicht) if (new RegExp('\\b' + fn + '\\s*\\(', 'i').test(m[0])) fout.push(f + ': ' + m[1] + ' gebruikt ' + fn)
}
assert.deepEqual(fout, [], 'regels die een dichte functie gebruiken:\n' + fout.join('\n'))
console.log('ok: geen regel gebruikt een functie die dicht is voor de app (' + dicht.size + ' dichte functies, ' + bestanden.length + ' bestanden)')
