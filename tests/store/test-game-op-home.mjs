// node tests/store/test-game-op-home.mjs (17 nov 2026) - een game uit de Store komt na downloaden meteen op Home,
// tenzij daar geen ruimte meer is; en een gedownloade game kun je meesturen met een uitnodigingslink (alleen spelen).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const opslag = new Map()
const ls = { getItem: k => opslag.has(k) ? opslag.get(k) : null, setItem: (k, v) => opslag.set(k, String(v)), removeItem: k => opslag.delete(k),
  get length () { return opslag.size }, key: i => [...opslag.keys()][i] ?? null }
globalThis.localStorage = ls
const { zetGameWidgetAan, vakjesInGebruik, HOME_MAX_VAKJES, STORE_GAMES, gameWidgetAan } = await import('../../store.js')
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const UID = '11111111-2222-4333-8444-555555555555'
const L = 'fibro_widgets_profiel_' + UID, P = 'fibro_profiel_' + UID
const pesten = STORE_GAMES.find(g => g.id === 'pesten'), toepen = STORE_GAMES.find(g => g.id === 'toepen')
let ok = 0
const test = async (naam, f) => { opslag.clear(); await f(); ok++; console.log('OK  ', naam) }

await test('download: game komt achteraan op Home en bij de schakelaars van Stijl', async () => {
  ls.setItem(L, JSON.stringify([{ id: 'mood', w: 4, h: 1, volgorde: 0, aan: true }, { id: 'gastenboek', w: 4, h: 4, volgorde: 1, aan: true }]))
  ls.setItem(P, JSON.stringify({ naam: 'x', widgets: ['mood', 'gastenboek'] }))
  assert.equal(zetGameWidgetAan(UID, pesten), 'aan')
  const l = JSON.parse(ls.getItem(L))
  assert.deepEqual(l.map(w => w.id), ['mood', 'gastenboek', 'spel_pesten'])
  assert.deepEqual(l[2], { id: 'spel_pesten', icon: '🃏', titel: 'Pesten', w: 2, h: 1, volgorde: 2, aan: true })
  assert.deepEqual(JSON.parse(ls.getItem(P)).widgets, ['mood', 'gastenboek', 'spel_pesten'])
  assert.equal(gameWidgetAan(UID, 'spel_pesten'), true)
  assert.equal(zetGameWidgetAan(UID, pesten), 'al', 'niet dubbel')
  assert.equal(JSON.parse(ls.getItem(L)).length, 3)
})
await test('geen ruimte meer op Home: niets veranderen', async () => {
  const vol = Array.from({ length: 12 }, (_, i) => ({ id: 'w' + i, w: 4, h: 1, volgorde: i, aan: true }))
  assert.equal(vakjesInGebruik(vol), HOME_MAX_VAKJES)
  ls.setItem(L, JSON.stringify(vol))
  assert.equal(zetGameWidgetAan(UID, toepen), 'vol')
  assert.equal(JSON.parse(ls.getItem(L)).length, 12)
  // precies nog 2 vakjes vrij: past wel
  ls.setItem(L, JSON.stringify(vol.slice(0, 11).concat([{ id: 'x', w: 2, h: 1, volgorde: 11, aan: true }])))
  assert.equal(zetGameWidgetAan(UID, toepen), 'aan')
})
await test('nog nooit een indeling (oud account): alleen de game; Stijl zonder schakelaars blijft zo', async () => {
  assert.equal(zetGameWidgetAan(UID, pesten), 'aan')
  assert.deepEqual(JSON.parse(ls.getItem(L)).map(w => w.id), ['spel_pesten'])
  assert.equal(ls.getItem(P), null)
})
await test('Store-pagina: zet de game op Home en heeft een deelknop', async () => {
  const s = lees('store.html')
  assert.match(s, /const opHome = it\.soort === 'game' \? zetGameWidgetAan\(mijnId, it\) : ''/)
  assert.match(s, /'vrienden\.html\?uitnodigen=' \+ encodeURIComponent\(it\.id\)/)
  assert.match(s, /if \(heb && it\.soort === 'game'\)/)
})
await test('uitnodiging: gedownloade games meesturen, invite.html laat ze alleen spelen', async () => {
  const v = lees('vrienden.html')
  assert.match(v, /if \(!mijn\.has\(g\.id\) \|\| MEE_SPELLEN\.some/)
  assert.match(v, /get\('uitnodigen'\)/)
  const i = lees('invite.html')
  for (const id of ['pesten', 'toepen', 'eenentwintigen', 'koningsjacht']) assert.match(i, new RegExp(id + ": \\['"))
  assert.match(i, /knop\.href = 'spel\.html\?spel=' \+ encodeURIComponent\(id\)/)
  const solo = lees('solo.js')
  for (const id of ['pesten', 'toepen', 'eenentwintigen', 'koningsjacht']) assert.match(solo, new RegExp('\\n  ' + id + ':'))
})
await test('nieuwe zinnen staan in het Engels', async () => {
  const en = lees('taal-en.js')
  for (const z of ['Gedownload! {naam} staat nu op je beginscherm.', '🔗 Delen met uitnodigingslink',
    'Gedownload! Er is geen ruimte meer op je beginscherm. Haal iets weg, of zet hem aan bij Profiel → Widgets → Spellen.']) assert.ok(en.includes(JSON.stringify(z) + ':'), z)
})

console.log(`\n${ok} van ${ok} goed`)
