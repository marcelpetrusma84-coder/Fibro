// v171: een spelsticker die in beeld is wordt niet onderbroken door een sticker van de ander;
// die wacht en komt daarna. Draait de stickercode uit chat.html in een nagebootste pagina.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const html = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
const begin = html.indexOf('  let spelStickerMag = true')
const eind = html.indexOf('  function bouwSpelChatUI()')
assert.ok(begin > 0 && eind > begin, 'stickercode gevonden in chat.html')
const code = html.slice(begin, eind)

// Nep-klok
let nu = 0, timers = []
const setTimeout = (fn, ms) => { const t = { fn, op: nu + ms }; timers.push(t); return t }
const clearTimeout = t => { timers = timers.filter(x => x !== t) }
function wacht(ms) {
  const doel = nu + ms
  for (;;) {
    timers.sort((a, b) => a.op - b.op)
    const t = timers[0]
    if (!t || t.op > doel) break
    timers.shift(); nu = t.op; t.fn()
  }
  nu = doel
}

// Nep-pagina
function maakEl(tag) {
  return {
    tag, id: '', style: {}, kinderen: [], parentNode: null,
    appendChild(k) { k.parentNode = this; this.kinderen.push(k); return k },
    remove() { if (this.parentNode) { this.parentNode.kinderen = this.parentNode.kinderen.filter(k => k !== this); this.parentNode = null } }
  }
}
const overlay = maakEl('div'); overlay.id = 'spelOverlay'
function zoek(el, id) { if (el.id === id) return el; for (const k of el.kinderen) { const r = zoek(k, id); if (r) return r } return null }
const document = { createElement: maakEl, getElementById: id => zoek(overlay, id) }
const getoond = []
const ctx = vm.createContext({
  document, setTimeout, clearTimeout, T: s => s, console,
  spelActief: true, spelKanaal: {}, geselecteerdeVriend: null,
  isEigenCode: () => false, zoekSticker: c => ({ src: c + '.png', code: c }),
  speelFx: (img, st) => getoond.push(st.code), toonSpelChat() {},
  stuurBeveiligdeSpelInhoud: async () => true, maakStickerkeuze() {}
})
vm.runInContext(code + '\n;globalThis.api = { toonSpelSticker, spelStickerVrij, spelStickerStop }', ctx)
const { toonSpelSticker, spelStickerStop } = ctx.api
const inBeeld = () => { const v = zoek(overlay, 'spelStickerGroot'); return v && v.kinderen[0].src }

// 1. Mijn sticker staat in beeld, de ander stuurt er een: de mijne blijft staan
await toonSpelSticker('f1-01', true)
assert.equal(inBeeld(), 'f1-01.png')
wacht(1000)
await toonSpelSticker('f2-02', false)
assert.equal(inBeeld(), 'f1-01.png', 'mijn sticker wordt niet onderbroken')
assert.deepEqual(getoond, ['f1-01'], 'die van de ander speelt nog niet')

// 2. Na afloop van de mijne komt die van de ander
wacht(2100)
assert.equal(inBeeld(), 'f2-02.png', 'sticker van de ander komt daarna')
assert.deepEqual(getoond, ['f1-01', 'f2-02'])

// 3. Andersom ook: mijn sticker onderbreekt die van de ander niet
await toonSpelSticker('f3-03', true)
assert.equal(inBeeld(), 'f2-02.png', 'sticker van de ander wordt ook niet onderbroken')
wacht(3100)
assert.equal(inBeeld(), 'f3-03.png')
wacht(3100)
assert.equal(inBeeld(), null, 'daarna is het beeld leeg')

// 4. Spel dicht: de wachtrij verdwijnt, er komt niets meer in beeld
await toonSpelSticker('f4-04', true)
ctx.api.spelStickerVrij()
await toonSpelSticker('f5-05', false)
spelStickerStop()
overlay.kinderen = []
wacht(10000)
assert.equal(inBeeld(), null, 'na het sluiten komt er geen sticker meer')
assert.ok(!getoond.includes('f5-05'))

// 5. Na het sluiten werkt een nieuwe sticker meteen weer
await toonSpelSticker('f6-06', true)
assert.equal(inBeeld(), 'f6-06.png')

console.log('PASS: spelsticker wordt niet onderbroken, wacht in de rij, en de rij is leeg na het sluiten van het spel')
