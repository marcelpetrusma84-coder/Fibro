// test-muziekwidget.mjs (18 nov 2026): de muziek-widget (muziekwidget.js) voor Funkwhale (25 nov 2026: Bandcamp eruit). Welke invoer goed
// is (Bandcamp-insluitcode, Funkwhale-link), dat alleen goedgekeurde bronnen erdoor komen (ook van een vriend), hoe de
// speler geladen wordt, dat de huisregel precies klopt, en dat de widget in de Store, op Home, bij vrienden, in Profiel
// en in sync/doorgeven is aangesloten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const M = await import(new URL('../../muziekwidget.js', import.meta.url))
const P = await import(new URL('../../peertube.js', import.meta.url))

// ── Bandcamp (25 nov 2026: eruit, alleen voor persoonlijk, niet-commercieel gebruik) ──
for (const t of ['<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1466353859/size=large/" seamless></iframe>',
  'https://bandcamp.com/EmbeddedPlayer/track=3220102216/size=small/', '[bandcamp width=350 height=470 album=50768103 size=large]',
  'https://rickastley.bandcamp.com/album/beautiful-life'])
  assert.match(M.leesInvoer(t).fout, /Bandcamp kan niet/, 'Bandcamp geeft een melding: ' + t.slice(0, 40))
assert.equal(M.BANDCAMP, undefined, 'geen Bandcamp meer in de goedgekeurde bronnen')
console.log('PASS: Bandcamp kan niet meer, met een duidelijke melding')

// ── Funkwhale ──
assert.deepEqual(M.leesInvoer('<iframe width="100%" height="330" src="https://open.audio/front/embed.html?&amp;type=album&amp;id=16183"></iframe>'),
  { bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '16183' }, 'insluitcode van Funkwhale')
assert.deepEqual(M.leesInvoer('https://open.audio/embed.html?type=track&id=84899'), { bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '84899' }, 'Funkwhale 2.0: /embed.html')
assert.deepEqual(M.leesInvoer('https://open.audio/library/tracks/84899'), { bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '84899' })
assert.deepEqual(M.leesInvoer('open.audio/library/albums/8493'), { bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '8493' })
assert.match(M.leesInvoer('https://ander.pod/library/tracks/1').fout, /niet in de lijst/)
assert.ok(M.leesInvoer('https://open.audio.kwaad.nl/library/tracks/1').fout, 'nep-domein')
assert.ok(M.leesInvoer('https://open.audio/front/embed.html?type=artist&id=1').fout, 'alleen nummers en albums')
assert.ok(M.leesInvoer('https://open.audio/library/tracks/../../api').fout)
assert.ok(M.leesInvoer('https://open.audio:8080/library/tracks/1').fout)
assert.ok(M.leesInvoer('https://www.youtube.com/watch?v=x').fout)
assert.ok(M.leesInvoer('javascript:alert(1)').fout)
assert.ok(M.leesInvoer('').fout)
console.log('PASS: Funkwhale-links en -insluitcode worden herkend; andere servers niet')

// ── Wat van een vriend komt ──
assert.equal(M.normaliseer({ bron: 'bandcamp', soort: 'album', id: '123', nummer: '456', titel: 'Mooi album' }), null, 'een oude Bandcamp-widget is leeg')
assert.deepEqual(M.normaliseer({ bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '5', titel: '  Mooi   nummer ' }),
  { bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '5', titel: 'Mooi nummer' })
assert.equal(M.normaliseer({ bron: 'funkwhale', server: 'kwaad.nl', soort: 'track', id: '1' }), null)
assert.equal(M.normaliseer({ bron: 'youtube', soort: 'track', id: '1' }), null)
assert.equal(M.normaliseer(null), null)
assert.equal(M.normaliseer({ bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '1', titel: 'x'.repeat(300) }).titel.length, 80)
console.log('PASS: normaliseer laat alleen de goedgekeurde Funkwhale-servers door')

// ── v2: titel en hoes ophalen (alleen Funkwhale; alleen de eigen server) ──
const gevraagd = []
const nep = antwoord => async url => { gevraagd.push(url); return url.includes('/api/') ? { ok: true, json: async () => antwoord } : { ok: false } }
let info = await M.haalInfo({ bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '16183' }, { fetch: nep({
  title: 'Plaat', artist_credit: [{ credit: 'A', joinphrase: ' & ' }, { artist: { name: 'B' }, joinphrase: '' }],
  cover: { urls: { large_square_crop: 'https://cdn.elders.nl/x.jpg', medium_square_crop: '/media/__sized__/y.jpg' } } }) })
assert.equal(info.titel, 'Plaat – A & B')
assert.deepEqual(gevraagd, ['https://open.audio/api/v1/albums/16183/', 'https://open.audio/media/__sized__/y.jpg'], 'alleen de eigen server, nooit een ander adres')
gevraagd.length = 0
info = await M.haalInfo({ bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '84899' }, { fetch: nep({ title: 'Nummer', artist: { name: 'C' }, album: { cover: { urls: { original: 'javascript:x' } } } }) })
assert.equal(info.titel, 'Nummer – C'); assert.deepEqual(gevraagd, ['https://open.audio/api/v1/tracks/84899/'])
gevraagd.length = 0
assert.deepEqual(await M.haalInfo({ bron: 'funkwhale', server: 'kwaad.nl', soort: 'album', id: '1' }, { fetch: nep({}) }), {}); assert.deepEqual(gevraagd, [])
assert.deepEqual(await M.haalInfo({ bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '1' }, { fetch: async () => { throw new Error('weg') } }), {}, 'mislukt = gewoon zonder')
const V = await import(new URL('../../voorbeeldplaatje.js', import.meta.url))
assert.equal(V.plaatjeOpServer('/lazy-static/previews/a.jpg', 'framatube.org'), 'https://framatube.org/lazy-static/previews/a.jpg')
assert.equal(V.plaatjeOpServer('https://framatube.org:444/a.jpg', 'framatube.org'), null)
assert.equal(V.plaatjeOpServer('https://framatube.org/a.svg', 'framatube.org'), null, 'alleen jpg/png/webp')
assert.equal(V.plaatjeOpServer('//kwaad.nl/a.jpg', 'framatube.org'), null)
assert.deepEqual(V.vulStand(360, 290, 640, 360), { s: 144, x: 50, y: 50 }, 'breed plaatje: groter, zodat het vak vol is')
assert.deepEqual(V.vulStand(360, 290, 300, 300), { s: 100, x: 50, y: 50 })
const vp = lees('voorbeeldplaatje.js')
assert.match(vp, /credentials: 'omit', referrerPolicy: 'no-referrer'/, 'zonder cookies en zonder referrer')
console.log('PASS: titel en hoes: alleen Funkwhale, alleen de eigen server, en zonder als het niet lukt')

// ── De speler ──
assert.equal(M.speelUrl({ bron: 'bandcamp', soort: 'album', id: '3656183138' }), null, 'geen Bandcamp-speler')
assert.deepEqual(M.speelUrl({ bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '84899' }), { src: 'https://open.audio/front/embed.html?&type=track&id=84899', hoogte: 150 })
assert.equal(M.speelUrl({ bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '1' }).hoogte, 330)
assert.equal(M.speelUrl({ bron: 'funkwhale', server: 'kwaad.nl', soort: 'album', id: '1' }), null)
const mw = lees('muziekwidget.js')
assert.deepEqual([...mw.matchAll(/setAttribute\('sandbox', '([^']*)'\)/g)].map(m => m[1]), ['allow-scripts allow-same-origin'], 'afgesloten kader, geen popups')
assert.match(mw, /setAttribute\('referrerpolicy', 'no-referrer'\)/)
assert.equal((mw.match(/createElement\('iframe'\)/g) || []).length, 1)
assert.match(mw, /\/\/ Pas hier wordt er iets van buiten geladen\n  function speler\(\)/)
console.log('PASS: de speler laadt pas na een tik, in een afgesloten kader')

// ── Huisregel: precies PeerTube + Funkwhale, alleen waar de widgets staan ──
const verwacht = ["'self'", ...P.SERVERS.map(s => 'https://' + s), ...M.FUNKWHALE.map(s => 'https://' + s)]
for (const pagina of ['index.html', 'vriend-profiel.html']) {
  const csp = lees(pagina).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
  assert.deepEqual(csp.match(/frame-src ([^;]*);/)[1].split(' '), verwacht, pagina + ': frame-src')
  const rest = csp.replace(/frame-src [^;]*;/, '').replace(/connect-src [^;]*;/, '')
  assert.doesNotMatch(rest, /bandcamp|open\.audio/, pagina + ': alleen in frame-src (en op Home in connect-src)')
  const connect = csp.match(/connect-src [^;]*;/)[0]
  assert.doesNotMatch(csp, /bandcamp/, pagina + ': Bandcamp staat nergens in de huisregel')
  if (pagina === 'index.html') assert.match(connect, / https:\/\/open\.audio[ ;]/, 'index.html: titel en hoes van Funkwhale ophalen')
  else assert.doesNotMatch(connect, /open\.audio/, pagina + ': vrienden vragen Funkwhale niets')
}
for (const pagina of ['chat.html', 'login.html', 'over.html']) assert.match(lees(pagina), /frame-src 'self';/)
console.log('PASS: de huisregel laat precies de goedgekeurde bronnen toe')

// ── Overal aangesloten ──
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null }
const S = await import(new URL('../../store.js', import.meta.url))
const item = S.STORE_WIDGETS.find(w => w.id === 'muziekwidget')
assert.ok(item && item.soort === 'widget' && item.widget === 'muziekwidget' && item.w === 4 && item.h === 3 && S.STORE_ITEMS.includes(item))
assert.deepEqual(S.gameWidgets(new Set(['muziekwidget'])), ['muziekwidget'])
assert.equal(S.storeWidgetItem('muziekwidget'), item)
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \[[^\]]*'muziekwidget'[^\]]*\]/)
assert.match(sync, /\['muziekwidget','muziekwidget_'\]/)
assert.match(lees('doorgeven.js'), /const KLEIN = \[[^\]]*'muziekwidget'[^\]]*\]/)
assert.match(lees('index.html'), /\{ id:'muziekwidget',\s+icon:'🎧', titel:'Funkwhale',\s+w:4, h:3 \}/)
assert.match(lees('index.html'), /\} else if \(id === 'muziekwidget'\) \{\n    renderMuziekwidget\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widgetRij-muziekwidget" style="display:none"/, 'pas zichtbaar na downloaden')
assert.match(lees('profiel.html'), /muziekwidget: \{ id:'muziekwidget'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'muziekwidget'\) \{/)
assert.match(lees('vriend-profiel.html'), /cfg = M\.normaliseer\(JSON\.parse\(ruw\)\)/, 'wat een vriend stuurt gaat door normaliseer')
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/muziekwidget\.js\?v=3'\)/)
const en = lees('taal-en.js')
assert.equal(item.titel, 'Funkwhale')
assert.doesNotMatch(item.uitleg, /Bandcamp/)
for (const t of ['Funkwhale', 'Nog geen muziek', '▶ Luisteren', item.uitleg, 'Uit de Store: muziek van Funkwhale, laadt pas na een tik', 'Bandcamp kan niet in Stekky. Plak een link van Funkwhale.'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: de muziek-widget staat in de Store, op Home, bij vrienden, in Profiel en gaat mee via sync')
