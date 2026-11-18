// test-peertube.mjs (18 nov 2026): de PeerTube-widget (peertube.js). Welke links goed zijn, dat alleen goedgekeurde
// servers erdoor komen (ook als een vriend iets anders stuurt), dat de speler zonder p2p en zonder PeerTube-link laadt,
// dat de huisregel (frame-src) precies dezelfde servers toelaat, en dat de widget overal is aangesloten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const P = await import(new URL('../../peertube.js', import.meta.url))

// ── Goede links ──
const kort = 'kkGMgK9ZtnKfYAgnEtQxbv'
const uuid = '9c9de5e8-0a1e-484a-b099-e80766180a6d'
assert.deepEqual(P.leesLink('https://framatube.org/w/' + kort), { server: 'framatube.org', id: kort })
assert.deepEqual(P.leesLink('  https://framatube.org/w/' + kort + '?start=10s  '), { server: 'framatube.org', id: kort })
assert.deepEqual(P.leesLink('https://Video.Blender.org/videos/watch/' + uuid), { server: 'video.blender.org', id: uuid })
assert.deepEqual(P.leesLink('https://tilvids.com/videos/embed/' + uuid), { server: 'tilvids.com', id: uuid })
assert.deepEqual(P.leesLink('framatube.org/w/' + kort), { server: 'framatube.org', id: kort }, 'zonder https:// mag ook')

// ── Foute links ──
assert.ok(P.leesLink('').fout)
assert.ok(P.leesLink('https://youtube.com/watch?v=abc').fout, 'geen YouTube')
assert.match(P.leesLink('https://peertube.voorbeeld.nl/w/' + kort).fout, /niet in de lijst/)
assert.ok(P.leesLink('https://framatube.org.kwaad.nl/w/' + kort).fout, 'nep-domein dat op een goede server lijkt')
assert.ok(P.leesLink('https://kwaad.nl/framatube.org/w/' + kort).fout)
assert.ok(P.leesLink('https://iemand@framatube.org/w/' + kort).fout, 'geen inlognaam in de link')
assert.ok(P.leesLink('https://framatube.org:8443/w/' + kort).fout, 'geen andere poort')
assert.ok(P.leesLink('javascript:alert(1)').fout)
assert.match(P.leesLink('https://framatube.org/w/p/' + kort).fout, /Afspeellijsten/)
assert.ok(P.leesLink('https://framatube.org/w/' + kort + '/extra').fout)
assert.ok(P.leesLink('https://framatube.org/w/abc"onload=x').fout)
assert.ok(P.leesLink('https://framatube.org/a/iemand/video-channels').fout)
console.log('PASS: leesLink kent de goede links en weigert de rest')

// ── Wat van een vriend komt ──
assert.deepEqual(P.normaliseer({ server: 'framatube.org', id: kort, titel: '  Mijn   video ' }), { server: 'framatube.org', id: kort, titel: 'Mijn video' })
assert.equal(P.normaliseer({ server: 'kwaad.nl', id: kort }), null)
assert.equal(P.normaliseer({ server: 'framatube.org', id: '../../api/v1/x' }), null)
assert.equal(P.normaliseer({ server: 'framatube.org' }), null)
assert.equal(P.normaliseer(null), null)
assert.equal(P.normaliseer('framatube.org'), null)
assert.equal(P.normaliseer({ server: 'framatube.org', id: kort, titel: 'x'.repeat(500) }).titel.length, 80)
console.log('PASS: normaliseer laat alleen goedgekeurde servers en nette codes door')

// ── De speler ──
const url = new URL(P.speelUrl({ server: 'framatube.org', id: kort }))
assert.equal(url.origin + url.pathname, 'https://framatube.org/videos/embed/' + kort)
assert.equal(url.searchParams.get('p2p'), '0', 'geen delen tussen kijkers')
assert.equal(url.searchParams.get('peertubeLink'), '0', 'geen link naar PeerTube')
assert.equal(P.speelUrl({ server: 'kwaad.nl', id: kort }), null)
const pt = lees('peertube.js')
assert.match(pt, /setAttribute\('sandbox', 'allow-scripts allow-same-origin'\)/, 'afgesloten kader')
const zandbak = [...pt.matchAll(/setAttribute\('sandbox', '([^']*)'\)/g)].map(m => m[1])
assert.deepEqual(zandbak, ['allow-scripts allow-same-origin'], 'de speler kan geen nieuwe vensters openen of de app wegsturen (geen allow-popups / allow-top-navigation)')
assert.match(pt, /setAttribute\('referrerpolicy', 'no-referrer'\)/)
assert.equal((pt.match(/createElement\('iframe'\)/g) || []).length, 1, 'er is precies één plek die de speler maakt')
assert.match(pt, /\/\/ Pas hier wordt er iets van buiten geladen\n  function speler\(\)/, 'de speler alleen in speler(), na een tik')
console.log('PASS: de speler laadt zonder p2p, zonder PeerTube-link, in een afgesloten kader')

// ── Huisregel: precies de goedgekeurde servers ──
for (const pagina of ['index.html', 'vriend-profiel.html']) {
  const csp = lees(pagina).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
  const frame = csp.match(/frame-src ([^;]*);/)[1].split(' ')
  assert.deepEqual(frame, ["'self'", ...P.SERVERS.map(s => 'https://' + s)], pagina + ': frame-src = de lijst uit peertube.js')
  assert.doesNotMatch(csp, /connect-src[^;]*(framatube|tilvids)/, pagina + ': Stekky zelf praat niet met PeerTube')
}
for (const pagina of ['chat.html', 'login.html', 'over.html', 'spelregels.html']) {
  assert.match(lees(pagina), /frame-src 'self';/, pagina + ': geen PeerTube nodig, dus dicht')
}
console.log('PASS: de huisregel laat precies de goedgekeurde servers toe, alleen waar de widget staat')

// ── Overal aangesloten ──
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \['quote', 'aftel', 'optel', 'poll', 'quiz', 'peertube'\]/)
assert.match(sync, /\['quiz','quiz_'\],\['peertube','peertube_'\]\]/)
assert.match(lees('doorgeven.js'), /const KLEIN = \['quote', 'aftel', 'optel', 'poll', 'quiz', 'peertube'\]/)
assert.match(lees('index.html'), /\{ id:'peertube',\s+icon:'🎬', titel:'PeerTube',\s+w:4, h:3 \}/)
assert.match(lees('index.html'), /\} else if \(id === 'peertube'\) \{\n    renderPeertube\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widget-peertube" onclick="toggleWidget\('peertube'\)"/)
assert.match(lees('profiel.html'), /peertube:\s+\{ id:'peertube'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'peertube'\) \{/)
assert.match(lees('vriend-profiel.html'), /cfg = P\.normaliseer\(JSON\.parse\(ruw\)\)/, 'wat een vriend stuurt gaat door normaliseer')
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/peertube\.js\?v=1'\)/)
const en = lees('taal-en.js')
for (const t of ['PeerTube', 'Uit de Store: video van PeerTube, laadt pas na een tik', 'Nog geen video', '▶ Afspelen', 'Toegestane servers: {lijst}'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: de PeerTube-widget staat op Home, bij vrienden, in Profiel en gaat mee via sync')
