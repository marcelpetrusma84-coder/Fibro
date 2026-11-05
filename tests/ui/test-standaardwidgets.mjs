// v267 (5 nov 2026): een nieuw account krijgt bij de eerste start meteen widgets op Home (standaardwidgets.js):
// Mood, foto's 2×2, Four in a Row, een sticker en het gastenboek. Alleen nieuw (< 14 dagen) en alleen als er nog nooit
// een indeling bewaard is.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { zetStandaardWidgets, isNieuwAccount, beginSchakelaars, STANDAARD_LAYOUT, STANDAARD_SCHAKELAARS } from '../../standaardwidgets.js'

const UID = '11111111-2222-3333-4444-555555555555'
const NU = Date.parse('2026-11-05T12:00:00Z')
function opslag(gemaakt, extra = {}) {
  const m = new Map(Object.entries(extra))
  if (gemaakt !== undefined) m.set('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify({ user: { id: UID, created_at: gemaakt } }))
  return { get length() { return m.size }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)), m }
}
const K = 'fibro_widgets_profiel_' + UID

// 1. nieuw account: vijf widgets aan, in deze volgorde
let ls = opslag('2026-11-05T11:00:00Z')
assert.equal(zetStandaardWidgets(ls, UID, NU), true)
const l = JSON.parse(ls.getItem(K))
assert.deepEqual(l.map(w => w.id), ['mood', 'fotos_2x2', 'spel_vieroprij', 'sticker_f6-05', 'gastenboek'])
assert.ok(l.every((w, i) => w.aan === true && w.volgorde === i))
// nog een keer: verandert niets
assert.equal(zetStandaardWidgets(ls, UID, NU), false)

// 2. al iets bewaard (ook leeg = alles uitgezet): niet aankomen
ls = opslag('2026-11-05T11:00:00Z', { [K]: '[]' })
assert.equal(zetStandaardWidgets(ls, UID, NU), false); assert.equal(ls.getItem(K), '[]')

// 3. ouder account (nieuw toestel): niets, anders overschrijf je de echte indeling bij vrienden
ls = opslag('2026-09-01T10:00:00Z')
assert.equal(zetStandaardWidgets(ls, UID, NU), false); assert.equal(ls.getItem(K), null)
assert.equal(isNieuwAccount(opslag('2026-10-23T12:00:00Z'), UID, NU), true)
assert.equal(isNieuwAccount(opslag('2026-10-21T12:00:00Z'), UID, NU), false)

// 4. onbekend: geen sessie, andere gebruiker, geen geldige uid
assert.equal(zetStandaardWidgets(opslag(undefined), UID, NU), false)
assert.equal(zetStandaardWidgets(opslag('2026-11-05T11:00:00Z'), 'lokaal', NU), false)
const ander = opslag(undefined); ander.setItem('sb-x-auth-token', JSON.stringify({ user: { id: 'iemand-anders', created_at: '2026-11-05T11:00:00Z' } }))
assert.equal(zetStandaardWidgets(ander, UID, NU), false)

// 5. de vakjes zijn precies wat profiel.html bij Opslaan maakt (anders verspringt Home na de eerste keer Opslaan)
const sticker = STANDAARD_LAYOUT.find(w => w.id.startsWith('sticker_'))
assert.match(sticker.id, /^sticker_(?:f[1-6]|e[12])-(?:0[1-9]|1[0-2])$/)
const sw = readFileSync(new URL('../../stickerwidget.js', import.meta.url), 'utf8')
assert.match(sw, /\{ id: String\(id\), icon: '\\u\{1F3A8\}', titel: 'Sticker', w: 1, h: 1, geenHeader: true \}/, 'sticker-vakje gelijk aan stickerWidgetDef')
assert.deepEqual(sticker, { id: sticker.id, icon: '\u{1F3A8}', titel: 'Sticker', w: 1, h: 1, geenHeader: true })
const profiel = readFileSync(new URL('../../profiel.html', import.meta.url), 'utf8')
for (const w of STANDAARD_LAYOUT.filter(w => !w.id.startsWith('sticker_'))) {
  const re = new RegExp("\\{ ?id:'" + w.id + "',\\s*icon:'[^']*',\\s*titel:'" + w.titel.replace(/[×]/g, '.') + "',\\s*w:" + w.w + ",\\s*h:" + w.h + ' ?\\}')
  assert.match(profiel, re, 'zelfde vakje in profiel.html: ' + w.id)
}
assert.match(profiel, /id="widget-spel_vieroprij"/)

// 6. Stijl begint met wat er op Home staat, en anders met de standaard
ls = opslag('2026-11-05T11:00:00Z'); zetStandaardWidgets(ls, UID, NU)
assert.deepEqual(beginSchakelaars(ls, UID), STANDAARD_SCHAKELAARS)
ls = opslag(undefined, { [K]: JSON.stringify([{ id: 'gastenboek', aan: true, volgorde: 1, papier: false }, { id: 'fotos_3x3', aan: true, volgorde: 0 }, { id: 'muziek', aan: false, volgorde: 2 }]) })
assert.deepEqual(beginSchakelaars(ls, UID), ['fotos', 'gastenboek', 'gastenboek_effen'])
assert.deepEqual(beginSchakelaars(opslag(undefined), UID), STANDAARD_SCHAKELAARS)

// 7. aangesloten in index.html (voor Home getekend wordt) en profiel.html
const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
assert.match(index, /import \{ zetStandaardWidgets \} from '\.\/standaardwidgets\.js\?v=1'/)
const start = index.indexOf('init().then(() => {')
assert.ok(index.indexOf('zetStandaardWidgets(localStorage', start) > start && index.indexOf('zetStandaardWidgets(localStorage', start) < index.indexOf("laadLayout('home')", start))
assert.match(profiel, /beginSchakelaars\(localStorage,userId\)/)
assert.doesNotMatch(profiel, /\['gastenboek','mood','muziek'\]/)
console.log('test-standaardwidgets: alles goed')
