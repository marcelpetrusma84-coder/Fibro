// Stekky Studio: stickers uit een plaat knippen (studio-knippen.js). Een zelfgemaakte plaat: beige achtergrond met
// zes stickers (met witte rand), waaronder een ring (gat erin) en een sticker met een los stukje ernaast.
import assert from 'node:assert/strict'
import * as K from '../../studio-knippen.js'

const W = 480, H = 330
const BEIGE = [236, 226, 206]
function nieuwePlaat() {
  const d = new Uint8ClampedArray(W * H * 4)
  for (let p = 0; p < W * H; p++) { d[p * 4] = BEIGE[0]; d[p * 4 + 1] = BEIGE[1]; d[p * 4 + 2] = BEIGE[2]; d[p * 4 + 3] = 255 }
  return d
}
const zet = (d, x, y, k) => { const i = (y * W + x) * 4; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255 }
const cirkel = (d, cx, cy, r, k, gat = 0) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { const a = (x - cx) ** 2 + (y - cy) ** 2; if (a <= r * r && a >= gat * gat) zet(d, x, y, k) } }
const vak = (d, x0, y0, bw, bh, k) => { for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) zet(d, x, y, k) }
const WIT = [255, 255, 255]

const plaat = nieuwePlaat()
cirkel(plaat, 70, 70, 44, WIT); cirkel(plaat, 70, 70, 40, [200, 40, 40])                   // 1: rode cirkel
vak(plaat, 190, 40, 84, 64, WIT); vak(plaat, 194, 44, 76, 56, [40, 160, 70])                // 2: groen vak
cirkel(plaat, 390, 70, 44, WIT); cirkel(plaat, 390, 70, 40, [40, 80, 200]); cirkel(plaat, 390, 70, 14, BEIGE)   // 3: ring met gat
cirkel(plaat, 70, 240, 40, WIT); cirkel(plaat, 70, 240, 36, [230, 190, 30]); cirkel(plaat, 126, 240, 7, [230, 190, 30])   // 4: cirkel met los stukje (spleet 9)
vak(plaat, 200, 200, 70, 80, WIT); vak(plaat, 204, 204, 62, 72, [150, 60, 170])             // 5: paars vak
cirkel(plaat, 390, 245, 44, WIT); cirkel(plaat, 390, 245, 40, [240, 120, 20])               // 6: oranje cirkel

// ── De achtergrond ──
const bg = K.schatAchtergrond(plaat, W, H)
assert.deepEqual(bg.map(Math.round), BEIGE, 'achtergrond = de kleur langs de rand')

// ── Verbreden en versmallen ──
{
  const m = new Uint8Array(11 * 11); m[5 * 11 + 5] = 1
  const dik = K.verbreed(m, 11, 11, 2)
  assert.equal(dik.reduce((a, b) => a + b, 0), 25, 'verbreden met 2 = 5 x 5')
  assert.equal(K.versmal(dik, 11, 11, 2).reduce((a, b) => a + b, 0), 1, 'en weer versmallen = 1 pixel')
}

// ── Vinden: zes stickers, in leesvolgorde ──
const { stickers } = K.vindStickers(plaat, W, H)
assert.equal(stickers.length, 6, 'zes stickers gevonden, niet ' + stickers.length)
const midden = stickers.map(s => [Math.round(s.x + s.w / 2), Math.round(s.y + s.h / 2)])
const verwacht = [[70, 70], [232, 72], [390, 70], [88, 240], [235, 240], [390, 245]]
// sticker 4 heeft een los stukje: het midden schuift naar rechts, we kijken alleen of het in zijn eigen vakje blijft
midden.forEach((m, i) => { assert.ok(Math.abs(m[0] - verwacht[i][0]) < 30 && Math.abs(m[1] - verwacht[i][1]) < 12, `sticker ${i + 1} staat op zijn plek: ${m} (verwacht ${verwacht[i]})`) })
assert.ok(stickers[3].w > 90, 'het losse stukje hoort bij sticker 4 (breder dan alleen de cirkel)')
assert.ok(stickers.every(s => !s.samengeklonterd), 'geen sticker is een kluit')

// ── Het gat in de ring wordt dicht gemaakt; de achtergrond buiten de sticker blijft doorzichtig ──
const ring = stickers[2]
const alfaIn = (s, x, y) => s.alfa[(y - s.y) * s.w + (x - s.x)]
assert.equal(alfaIn(ring, 390, 70), 1, 'het gat midden in de ring is dicht (de sticker is één stuk)')
assert.equal(alfaIn(ring, ring.x + 1, ring.y + 1), 0, 'de hoek buiten de cirkel is achtergrond')
const uitsnede = K.maakUitsnede(plaat, W, H, ring)
const px = (x, y) => uitsnede.rgba.subarray(((y - ring.y + 2) * uitsnede.w + (x - ring.x + 2)) * 4, ((y - ring.y + 2) * uitsnede.w + (x - ring.x + 2)) * 4 + 4)
assert.deepEqual([...px(370, 70)].slice(0, 3), [40, 80, 200], 'de kleur van de sticker blijft zoals hij was')
assert.equal(px(370, 70)[3], 255, 'binnen de sticker: dekkend')
assert.equal(uitsnede.rgba[3], 0, 'de hoek van de uitsnede is doorzichtig')

// ── Gevoeligheid: te hoog = niets gevonden, geen fout ──
assert.equal(K.vindStickers(plaat, W, H, { gevoeligheid: 600 }).stickers.length, 0, 'bij een veel te hoge gevoeligheid blijft er niets over')

// ── Een kluit: twee stickers die elkaar raken tellen als één, en worden gemeld ──
{
  const p2 = nieuwePlaat()
  for (const [cx, cy] of [[60, 60], [300, 60], [60, 200], [300, 200]]) { cirkel(p2, cx, cy, 36, WIT); cirkel(p2, cx, cy, 32, [60, 60, 60]) }
  cirkel(p2, 150, 60, 36, WIT); cirkel(p2, 150, 60, 32, [90, 90, 20]); cirkel(p2, 190, 60, 36, WIT); cirkel(p2, 190, 60, 32, [20, 90, 90])   // raken elkaar
  const r = K.vindStickers(p2, W, H)
  assert.equal(r.stickers.length, 5, 'de twee die elkaar raken zijn één stuk')
  assert.equal(r.stickers.filter(s => s.samengeklonterd).length, 1, 'en dat stuk wordt gemeld')
}

// ── Rooster: 3 kolommen x 2 rijen, een sticker per vakje ──
const rooster = K.knipRooster(plaat, W, H, 3, 2)
assert.equal(rooster.stickers.length, 6)
assert.deepEqual(rooster.stickers.map(s => s.vakje), [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]])
assert.ok(rooster.stickers[4].x > 160 && rooster.stickers[4].x < 210, 'sticker 5 staat op de goede plek in de hele plaat')

// ── Leesvolgorde ──
const door = [{ x: 300, y: 10, w: 50, h: 50 }, { x: 10, y: 12, w: 50, h: 50 }, { x: 150, y: 200, w: 50, h: 50 }, { x: 10, y: 205, w: 50, h: 50 }]
assert.deepEqual(K.leesvolgorde(door).map(s => s.x + ',' + s.y), ['10,12', '300,10', '10,205', '150,200'])

console.log('studio knippen: ok')
