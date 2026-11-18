// test-muziekwidget.mjs (18 nov 2026): de muziek-widget (muziekwidget.js) voor Bandcamp en Funkwhale. Welke invoer goed
// is (Bandcamp-insluitcode, Funkwhale-link), dat alleen goedgekeurde bronnen erdoor komen (ook van een vriend), hoe de
// speler geladen wordt, dat de huisregel precies klopt, en dat de widget in de Store, op Home, bij vrienden, in Profiel
// en in sync/doorgeven is aangesloten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const M = await import(new URL('../../muziekwidget.js', import.meta.url))
const P = await import(new URL('../../peertube.js', import.meta.url))

// ── Bandcamp ──
const code = '<iframe style="border: 0; width: 350px; height: 470px;" src="https://bandcamp.com/EmbeddedPlayer/album=1466353859/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/" seamless><a href="https://iemand.bandcamp.com/album/plaat">Plaat van Iemand</a></iframe>'
assert.deepEqual(M.leesInvoer(code), { bron: 'bandcamp', soort: 'album', id: '1466353859' }, 'de insluitcode zoals Bandcamp hem geeft')
assert.deepEqual(M.leesInvoer('https://bandcamp.com/EmbeddedPlayer/album=3656183138/size=large/track=3220102216/'),
  { bron: 'bandcamp', soort: 'album', id: '3656183138', nummer: '3220102216' }, 'album met een gekozen nummer')
assert.deepEqual(M.leesInvoer('https://bandcamp.com/EmbeddedPlayer/track=3220102216/size=small/'), { bron: 'bandcamp', soort: 'track', id: '3220102216' })
assert.deepEqual(M.leesInvoer('[bandcamp width=350 height=470 album=50768103 size=large]'), { bron: 'bandcamp', soort: 'album', id: '50768103' }, 'WordPress-vorm')
assert.deepEqual(M.leesInvoer('album=50768103'), { bron: 'bandcamp', soort: 'album', id: '50768103' })
assert.match(M.leesInvoer('https://rickastley.bandcamp.com/album/beautiful-life').fout, /insluitcode/, 'gewone Bandcamp-link: uitleg')
assert.match(M.leesInvoer('https://bandcamp.com/discover').fout, /insluitcode/)
assert.ok(M.leesInvoer('https://bandcamp.com/EmbeddedPlayer/size=large/').fout, 'zonder nummer')
assert.ok(M.leesInvoer('https://bandcamp.com/EmbeddedPlayer/album=12"onload=x/').id === '12', 'alleen de cijfers tellen')
console.log('PASS: Bandcamp-insluitcode wordt herkend; een gewone link krijgt uitleg')

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
assert.deepEqual(M.normaliseer({ bron: 'bandcamp', soort: 'album', id: '123', nummer: '456', titel: '  Mooi   album ' }),
  { bron: 'bandcamp', soort: 'album', id: '123', nummer: '456', titel: 'Mooi album' })
assert.equal(M.normaliseer({ bron: 'bandcamp', soort: 'album', id: '1"/><script>' }), null)
assert.equal(M.normaliseer({ bron: 'bandcamp', soort: 'video', id: '1' }), null)
assert.equal(M.normaliseer({ bron: 'funkwhale', server: 'kwaad.nl', soort: 'track', id: '1' }), null)
assert.equal(M.normaliseer({ bron: 'youtube', soort: 'track', id: '1' }), null)
assert.equal(M.normaliseer(null), null)
assert.equal(M.normaliseer({ bron: 'bandcamp', soort: 'track', id: '1', nummer: '2' }).nummer, undefined, 'nummer alleen bij een album')
assert.equal(M.normaliseer({ bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '1', titel: 'x'.repeat(300) }).titel.length, 80)
console.log('PASS: normaliseer laat alleen Bandcamp en de goedgekeurde Funkwhale-servers door')

// ── De speler ──
const bc = M.speelUrl({ bron: 'bandcamp', soort: 'album', id: '3656183138', nummer: '3220102216' })
assert.equal(bc.src, 'https://bandcamp.com/EmbeddedPlayer/album=3656183138/track=3220102216/size=large/bgcol=1a0a2e/linkcol=c084fc/tracklist=false/artwork=small/transparent=true/')
assert.equal(bc.hoogte, 120)
assert.deepEqual(M.speelUrl({ bron: 'funkwhale', server: 'open.audio', soort: 'track', id: '84899' }), { src: 'https://open.audio/front/embed.html?&type=track&id=84899', hoogte: 150 })
assert.equal(M.speelUrl({ bron: 'funkwhale', server: 'open.audio', soort: 'album', id: '1' }).hoogte, 330)
assert.equal(M.speelUrl({ bron: 'funkwhale', server: 'kwaad.nl', soort: 'album', id: '1' }), null)
const mw = lees('muziekwidget.js')
assert.deepEqual([...mw.matchAll(/setAttribute\('sandbox', '([^']*)'\)/g)].map(m => m[1]), ['allow-scripts allow-same-origin'], 'afgesloten kader, geen popups')
assert.match(mw, /setAttribute\('referrerpolicy', 'no-referrer'\)/)
assert.equal((mw.match(/createElement\('iframe'\)/g) || []).length, 1)
assert.match(mw, /\/\/ Pas hier wordt er iets van buiten geladen\n  function speler\(\)/)
console.log('PASS: de speler laadt pas na een tik, in een afgesloten kader')

// ── Huisregel: precies PeerTube + Bandcamp + Funkwhale, alleen waar de widgets staan ──
const verwacht = ["'self'", ...P.SERVERS.map(s => 'https://' + s), 'https://' + M.BANDCAMP, ...M.FUNKWHALE.map(s => 'https://' + s)]
for (const pagina of ['index.html', 'vriend-profiel.html']) {
  const csp = lees(pagina).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
  assert.deepEqual(csp.match(/frame-src ([^;]*);/)[1].split(' '), verwacht, pagina + ': frame-src')
  assert.doesNotMatch(csp.replace(/frame-src [^;]*;/, ''), /bandcamp|open\.audio/, pagina + ': alleen in frame-src')
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
assert.match(lees('index.html'), /\{ id:'muziekwidget',\s+icon:'🎧', titel:'Bandcamp & Funkwhale', w:4, h:3 \}/)
assert.match(lees('index.html'), /\} else if \(id === 'muziekwidget'\) \{\n    renderMuziekwidget\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widgetRij-muziekwidget" style="display:none"/, 'pas zichtbaar na downloaden')
assert.match(lees('profiel.html'), /muziekwidget: \{ id:'muziekwidget'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'muziekwidget'\) \{/)
assert.match(lees('vriend-profiel.html'), /cfg = M\.normaliseer\(JSON\.parse\(ruw\)\)/, 'wat een vriend stuurt gaat door normaliseer')
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/muziekwidget\.js\?v=1'\)/)
const en = lees('taal-en.js')
for (const t of ['Bandcamp & Funkwhale', 'Nog geen muziek', '▶ Luisteren', item.uitleg, 'Uit de Store: muziek van Bandcamp of Funkwhale, laadt pas na een tik'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: de muziek-widget staat in de Store, op Home, bij vrienden, in Profiel en gaat mee via sync')
