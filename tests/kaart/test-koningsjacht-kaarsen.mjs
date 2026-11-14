import assert from 'node:assert/strict'
import { zetKaarsSlijtage } from '../../koningsjacht-kaarsen.js'

class Style {
  removeProperty(naam) { delete this[naam.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] }
  setProperty(naam, waarde) { this[naam.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(waarde) }
}
class Element {
  constructor(doc, tag = 'div') {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.style = new Style()
    this.className = ''; this.classList = { contains: naam => this.className.split(/\s+/).includes(naam) }
  }
  appendChild(kind) { this.children.push(kind); kind.parentNode = this; return kind }
  setAttribute(naam, waarde) { this[naam] = String(waarde) }
  querySelectorAll(selector) {
    const gevonden = []
    for (const kind of this.children) {
      if (selector.startsWith('.') && kind.classList.contains(selector.slice(1))) gevonden.push(kind)
      gevonden.push(...kind.querySelectorAll(selector))
    }
    return gevonden
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
}
const doc = { createElement: tag => new Element(doc, tag) }
const tafel = new Element(doc)
for (const kant of ['kj-links', 'kj-rechts']) {
  const kaars = doc.createElement('div'); kaars.className = 'kj-kaars ' + kant
  const frame = doc.createElement('img'); frame.className = 'kj-kandelaar'
  const vlam = doc.createElement('div'); vlam.className = 'kj-vlam'
  kaars.appendChild(frame); kaars.appendChild(vlam); tafel.appendChild(kaars)
}
const [links, rechts] = tafel.children
const frame = kaars => kaars.querySelector('.kj-kandelaar')
const vlam = kaars => kaars.querySelector('.kj-vlam')
const bron = kaars => new URL(frame(kaars).src).pathname.split('/').at(-1)
function pointervrij() {
  for (const kaars of [links, rechts]) for (const kind of kaars.children) {
    if (kind === frame(kaars) || kind === vlam(kaars)) continue
    assert.equal(kind.style.pointerEvents, 'none', 'slijtage-decoratie blokkeert geen kaarten of knoppen')
  }
}

zetKaarsSlijtage(tafel, { scene: 'modern', bierpul: true, ronde: 0 })
assert.equal(links.dataset.slijtage, '0'); assert.equal(rechts.dataset.slijtage, '0')
assert.equal(bron(links), 'candle-modern-left.png')
assert.equal(bron(rechts), 'candle-modern-right.png')
assert.ok(!vlam(links).style.bottom, 'zonder slijtage geldt de gewone CSS-vlampositie')
assert.ok(!vlam(rechts).style.bottom)

zetKaarsSlijtage(tafel, { scene: 'modern', bierpul: true, ronde: 1 })
assert.equal(links.dataset.slijtage, '1'); assert.equal(rechts.dataset.slijtage, '1')
assert.equal(bron(links), 'candle-modern-left-empty.png')
assert.equal(bron(rechts), 'candle-modern-right-empty.png')
assert.ok(Number.isFinite(parseFloat(vlam(links).style.bottom)))
assert.ok(Number.isFinite(parseFloat(vlam(rechts).style.bottom)))
pointervrij()

zetKaarsSlijtage(tafel, { scene: 'modern', bierpul: true, ronde: 9 })
const laagsteLinks = vlam(links).style.bottom, laagsteRechts = vlam(rechts).style.bottom
assert.equal(links.dataset.slijtage, '9'); assert.equal(rechts.dataset.slijtage, '9')
zetKaarsSlijtage(tafel, { scene: 'modern', bierpul: true, ronde: 99 })
assert.equal(links.dataset.slijtage, '9'); assert.equal(rechts.dataset.slijtage, '9')
assert.equal(vlam(links).style.bottom, laagsteLinks, 'slijtage blijft op negen stappen begrensd')
assert.equal(vlam(rechts).style.bottom, laagsteRechts)

zetKaarsSlijtage(tafel, { scene: 'middeleeuws', bierpul: true, ronde: 3 })
for (const kaars of [links, rechts]) {
  assert.equal(kaars.dataset.slijtage, '3')
  assert.equal(bron(kaars), 'chamberstick-empty.png', 'scene-wissel gebruikt de juiste vaste kandelaar')
}
pointervrij()
zetKaarsSlijtage(tafel, { scene: 'standaard', bierpul: true, ronde: 2 })
assert.equal(bron(links), 'chamberstick-empty.png')

zetKaarsSlijtage(tafel, { scene: 'modern', bierpul: false, ronde: 99 })
assert.equal(bron(links), 'candle-modern-left.png'); assert.equal(bron(rechts), 'candle-modern-right.png')
for (const kaars of [links, rechts]) {
  assert.equal(kaars.dataset.slijtage, '0')
  assert.ok(!vlam(kaars).style.bottom, 'bier uit herstelt de oorspronkelijke vlampositie')
  for (const kind of kaars.children) if (kind !== frame(kaars) && kind !== vlam(kaars)) assert.equal(kind.hidden, true, 'bier uit ruimt zichtbare slijtage op')
}
zetKaarsSlijtage(tafel, { scene: 'middeleeuws', bierpul: false, ronde: 9 })
assert.equal(bron(links), 'chamberstick.png'); assert.equal(bron(rechts), 'chamberstick.png')
zetKaarsSlijtage(tafel, { scene: 'modern', bierpul: true, ronde: NaN })
assert.equal(links.dataset.slijtage, '0')
assert.equal(bron(links), 'candle-modern-left.png')
assert.doesNotThrow(() => zetKaarsSlijtage(null))
console.log('Koningsjacht kaarsen: slijtage per ronde, begrenzing, scene-wissel, herstel en pointervrije decoratie goed')
