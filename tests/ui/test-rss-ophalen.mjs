// test-rss-ophalen.mjs (19 nov 2026): de edge function rss-ophalen (supabase/functions/rss-ophalen/index.ts) echt
// draaien, met een nagemaakte Deno, Supabase en internet. Controleert: alleen ingelogd, doorverwijzingen worden
// opnieuw gecontroleerd (niet naar http of een eigen netwerk), hoogstens 3 doorverwijzingen, hoogstens 2 MB,
// een naam die naar een eigen netwerk wijst wordt niet opgehaald, en er gaat alleen tekst terug.
// Kan deze Node geen TypeScript lezen (ouder dan 22.18), dan slaat de test zichzelf over.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const MAP = new URL('../../supabase/functions/rss-ophalen/', import.meta.url)
const tmp = mkdtempSync(path.join(tmpdir(), 'rss-ophalen-'))
copyFileSync(new URL('feed.js', MAP), path.join(tmp, 'feed.js'))
const bron = readFileSync(new URL('index.ts', MAP), 'utf8')
const regel = 'import { createClient } from "npm:@supabase/supabase-js@2";'
assert.ok(bron.includes(regel))
writeFileSync(path.join(tmp, 'index.ts'), bron.replace(regel, 'const createClient = () => globalThis.__supa;'))

let handler = null
globalThis.Deno = {
  serve: h => { handler = h }, env: { get: () => 'x' },
  resolveDns: async (h, soort) => soort === 'A' ? (h === 'intern.nl' ? ['10.0.0.1'] : ['145.58.1.1']) : [],
}
globalThis.__supa = {
  auth: { getUser: async p => ({ data: { user: p === 'GOED' ? { id: 'u1' } : p === 'GEBLOKKEERD' ? { id: 'u2' } : null } }) },
  from: () => ({ select: () => ({ eq: (k, id) => ({ maybeSingle: async () => ({ data: { geblokkeerd: id === 'u2' } }) }) }) }),
}
const RSS = '<rss><channel><title>Test</title><item><title>Kop &amp; <b>zo</b></title><link>https://t.nl/1</link><description><![CDATA[<img src="https://spion.nl/p.gif">]]></description></item></channel></rss>'
const routes = {
  'https://t.nl/rss': () => new Response(RSS),
  'https://t.nl/oud': () => new Response(null, { status: 301, headers: { location: '/rss' } }),
  'https://t.nl/naar-intern': () => new Response(null, { status: 302, headers: { location: 'https://192.168.1.1/x' } }),
  'https://t.nl/naar-http': () => new Response(null, { status: 302, headers: { location: 'http://t.nl/rss' } }),
  'https://t.nl/lus': () => new Response(null, { status: 302, headers: { location: '/lus' } }),
  'https://t.nl/groot': () => new Response('x'.repeat(3 * 1024 * 1024)),
  'https://t.nl/html': () => new Response('<html>hoi</html>'),
  'https://intern.nl/rss': () => new Response(RSS),
}
const gehaald = []
globalThis.fetch = async (u, o) => {
  gehaald.push(u)
  assert.equal(o.redirect, 'manual', 'doorverwijzingen niet vanzelf volgen')
  return (routes[u] || (() => new Response('', { status: 404 })))()
}
try { await import(path.join(tmp, 'index.ts')) } catch (e) {
  if (/Unknown file extension|ERR_UNKNOWN_FILE_EXTENSION|strip/i.test(String(e))) { console.log('OVERGESLAGEN: deze Node leest geen TypeScript'); process.exit(0) }
  throw e
}
assert.ok(handler, 'Deno.serve aangeroepen')
const vraag = async (url, pas = 'GOED', methode = 'POST') => {
  const r = await handler(new Request('https://f.supabase.co/functions/v1/rss-ophalen', { method: methode, headers: { Authorization: 'Bearer ' + pas }, body: methode === 'POST' ? JSON.stringify({ url }) : undefined }))
  return [r.status, await r.json()]
}

let [st, d] = await vraag('https://t.nl/rss')
assert.equal(st, 200)
assert.deepEqual(d, { ok: true, titel: 'Test', berichten: [{ titel: 'Kop & zo', link: 'https://t.nl/1', datum: 0 }] }, 'alleen tekst: geen html, geen plaatjes')
;[st, d] = await vraag('https://t.nl/oud'); assert.equal(st, 200, 'een gewone doorverwijzing mag'); assert.equal(d.titel, 'Test')
;[st] = await vraag('https://t.nl/naar-intern'); assert.equal(st, 400, 'niet doorverwijzen naar een eigen netwerk')
;[st] = await vraag('https://t.nl/naar-http'); assert.equal(st, 400, 'niet doorverwijzen naar http')
;[st, d] = await vraag('https://t.nl/lus'); assert.equal(st, 502); assert.equal(d.reden, 'te veel doorverwijzingen')
assert.equal(gehaald.filter(u => u === 'https://t.nl/lus').length, 4, 'hoogstens 3 doorverwijzingen')
;[st] = await vraag('https://t.nl/groot'); assert.equal(st, 413, 'hoogstens 2 MB')
;[st, d] = await vraag('https://t.nl/html'); assert.equal(st, 422); assert.equal(d.reden, 'geen feed')
;[st] = await vraag('https://intern.nl/rss'); assert.equal(st, 400, 'naam die naar een eigen netwerk wijst')
assert.ok(!gehaald.includes('https://intern.nl/rss') && !gehaald.some(u => u.includes('192.168')), 'een eigen netwerk wordt nooit gevraagd')
;[st] = await vraag('http://t.nl/rss'); assert.equal(st, 400)
;[st] = await vraag('https://t.nl/rss', 'KWAAD'); assert.equal(st, 401, 'alleen ingelogd')
;[st] = await vraag('https://t.nl/rss', 'GEBLOKKEERD'); assert.equal(st, 403, 'niet als je geblokkeerd bent')
;[st] = await vraag('', 'GOED', 'GET'); assert.equal(st, 405)
let laatste = 0
for (let i = 0; i < 31; i++) [laatste] = await vraag('https://t.nl/rss')
assert.equal(laatste, 429, 'hoogstens 30 per minuut')
console.log('PASS: rss-ophalen: ingelogd, https, geen eigen netwerk (ook niet na doorverwijzen), 2 MB, alleen tekst terug')
