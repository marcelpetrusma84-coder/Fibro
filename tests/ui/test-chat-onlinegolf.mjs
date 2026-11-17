// Een echte offline→online-overgang, een eindige animatie en geen achtergebleven melding.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakOnlineOvergang, maakChatOnlineGolf } from '../../chat-onlinegolf.js'

let binnen = 0, weg = 0
const overgang = maakOnlineOvergang({ bijBinnenkomst: () => binnen++, bijWeg: () => weg++ })
assert.equal(overgang.werkBij('bram', true), false, 'zonder gekozen vriend geen binnenkomst')
overgang.kies('bram')
assert.equal(overgang.werkBij('bram', true), false, 'eerste bekende status online is geen overgang')
assert.equal(binnen, 0)
assert.equal(overgang.werkBij('bram', false), false)
assert.equal(weg, 1, 'offline cancelt een eventueel lopend effect')
assert.equal(overgang.werkBij('bram', true), true)
assert.equal(binnen, 1, 'bekend offline naar online speelt precies één keer')
assert.equal(overgang.werkBij('bram', true), false)
assert.equal(binnen, 1, 'herhaald online speelt niet nogmaals')
assert.equal(overgang.werkBij('kim', false), false)
assert.equal(overgang.werkBij('kim', true), false)
assert.equal(weg, 1); assert.equal(binnen, 1, 'een andere vriend verandert de gevolgde status niet')
overgang.kies('kim', false)
assert.equal(overgang.werkBij('bram', true), false, 'de vorige vriend wordt na wisselen genegeerd')
assert.equal(overgang.werkBij('kim', true, false), false, 'verborgen chat consumeert de overgang zonder effect')
assert.equal(overgang.werkBij('kim', true), false, 'later zichtbaar worden speelt een geconsumeerde overgang niet alsnog')
assert.equal(binnen, 1)
overgang.werkBij('kim', false)
assert.equal(overgang.werkBij('kim', 'online'), false, 'alleen bekende booleaanse statussen tellen')
assert.equal(overgang.werkBij('kim', undefined), false)
assert.equal(overgang.werkBij('kim', true), true, 'een onbekende update overschrijft de vorige offline-status niet')
assert.equal(binnen, 2)
overgang.kies('lotte', true)
assert.equal(overgang.werkBij('lotte', true), false, 'openen van een reeds online vriend geeft geen effect')
overgang.kies('lotte', null)
assert.equal(overgang.werkBij('lotte', false), false)
assert.equal(overgang.werkBij('lotte', true), true, 'eerste offline bevestiging maakt een volgende binnenkomst herkenbaar')
overgang.kies(42, false)
assert.equal(overgang.werkBij('42', true), true, 'identieke numerieke en tekst-ID worden gelijk behandeld')
const voorReset = weg
overgang.reset()
assert.equal(weg, voorReset + 1, 'reset ruimt een actief effect op')
assert.equal(overgang.werkBij('42', true), false)
overgang.kies(null, false)
assert.equal(overgang.werkBij(null, true), false)

class Gebeurtenissen {
  constructor() { this.events = new Map() }
  addEventListener(naam, fn) { if (!this.events.has(naam)) this.events.set(naam, new Set()); this.events.get(naam).add(fn) }
  removeEventListener(naam, fn) { this.events.get(naam)?.delete(fn) }
  roep(naam, event = {}) { for (const fn of this.events.get(naam) || []) fn(event) }
  aantal(naam) { return this.events.get(naam)?.size || 0 }
}
function omgeving({ minder = false, hidden = false } = {}) {
  let nu = 0, volgnummer = 0, gpuPogingen = 0
  const frames = new Map(), timers = new Map(), gemaakt = []
  const win = new Gebeurtenissen()
  Object.assign(win, {
    performance: { now: () => nu }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
    matchMedia: () => ({ matches: minder }),
    requestAnimationFrame: fn => { const id = ++volgnummer; frames.set(id, fn); return id },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, ms) => { const id = ++volgnummer; timers.set(id, { fn, op: nu + ms }); return id },
    clearTimeout: id => timers.delete(id)
  })
  const doc = new Gebeurtenissen(); doc.defaultView = win; doc.hidden = hidden
  class Element extends Gebeurtenissen {
    constructor(tag) {
      super(); this.tag = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}; this.className = ''; this._text = ''
      this.classList = {
        add: naam => { if (!this.classList.contains(naam)) this.className += (this.className ? ' ' : '') + naam },
        remove: naam => { this.className = this.className.split(/\s+/).filter(x => x !== naam).join(' ') },
        contains: naam => this.className.split(/\s+/).includes(naam)
      }
    }
    appendChild(e) { e.parent = this; this.children.push(e); return e }
    prepend(e) { e.parent = this; this.children.unshift(e) }
    remove() { if (!this.parent) return; this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null }
    setAttribute(naam, waarde) { this.attributes[naam] = String(waarde) }
    set textContent(waarde) { this._text = String(waarde); this.children = [] }
    get textContent() { return this._text + this.children.map(e => e.textContent).join('') }
    set innerHTML(_) { throw new Error('Onveilige HTML in plaats van tekst') }
    getContext() { gpuPogingen++; return null }
  }
  doc.createElement = tag => { const el = new Element(tag); gemaakt.push(el); return el }
  const ouder = new Element('div'), berichten = new Element('div')
  ouder.appendChild(berichten)
  const vind = naam => ouder.children.find(e => e.classList.contains(naam))
  const tijd = waarde => {
    assert.ok(waarde >= nu); nu = waarde
    for (;;) {
      const klaar = [...timers].filter(([, t]) => t.op <= nu).sort((a, b) => a[1].op - b[1].op)[0]
      if (!klaar) break
      timers.delete(klaar[0]); klaar[1].fn()
    }
    const gepland = [...frames.values()]; frames.clear()
    for (const fn of gepland) fn(nu)
  }
  return { doc, win, ouder, berichten, frames, timers, gemaakt, vind, tijd, gpu: () => gpuPogingen,
    schoon: () => { assert.equal(ouder.children.length, 1); assert.equal(ouder.children[0], berichten); assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.ok(!ouder.classList.contains('chat-onlinegolf-actief')); assert.ok(!berichten.classList.contains('chat-onlinegolf-lezen')) } }
}

const o = omgeving()
const golf = maakChatOnlineGolf({ ouder: o.ouder, berichten: o.berichten, tekst: naam => naam + ' is nu online' })
golf.speel('<img src=x onerror=alert(1)>')
assert.equal(o.gpu(), 1, 'zonder GPU schakelt de renderer zonder fout over op de fallback')
assert.ok(o.vind('chat-onlinegolf').classList.contains('zonder-webgl'))
assert.equal(o.vind('chat-onlinegolf').attributes['aria-hidden'], 'true', 'decoratieve golf wordt niet voorgelezen')
assert.equal(o.vind('chat-onlinegolf').children.length, 0, 'de ongebruikte canvas is verwijderd')
assert.ok(o.ouder.classList.contains('chat-onlinegolf-actief'))
assert.ok(o.berichten.classList.contains('chat-onlinegolf-lezen'))
assert.equal(o.vind('chat-onlinegolf-melding').textContent, '', 'de status verschijnt pas na de golf')
assert.equal(o.vind('chat-onlinegolf-melding').attributes.role, 'status')
assert.equal(o.vind('chat-onlinegolf-melding').attributes['aria-live'], 'polite')
o.tijd(2499)
assert.ok(o.vind('chat-onlinegolf'), 'de golf duurt tot 2,5 seconden')
assert.equal(o.vind('chat-onlinegolf-melding').textContent, '')
o.tijd(2500)
assert.equal(o.vind('chat-onlinegolf'), undefined, 'na 2,5 seconden blijft geen golf over')
assert.equal(o.frames.size, 0)
assert.ok(!o.berichten.classList.contains('chat-onlinegolf-lezen'), 'berichten zijn na afloop weer zonder visueel effect')
assert.equal(o.vind('chat-onlinegolf-melding').textContent, '<img src=x onerror=alert(1)> is nu online', 'de naam wordt tekst, nooit uitvoerbare HTML')
assert.equal(o.vind('chat-onlinegolf-melding').children.length, 0)
assert.ok(o.vind('chat-onlinegolf-melding').classList.contains('is-zichtbaar'))
o.tijd(5999); assert.ok(o.vind('chat-onlinegolf-melding'))
o.tijd(6000); o.schoon()

golf.speel('Bram')
const oudFrame = [...o.frames.values()][0]
golf.stop(); o.schoon()
oudFrame(8500)
o.schoon()
assert.equal(o.vind('chat-onlinegolf-melding'), undefined, 'stop voorkomt ook een reeds ingeplande oude aankondiging')
golf.speel('Bram'); const oudElement = o.vind('chat-onlinegolf')
const vervangenFrame = [...o.frames.values()][0]
o.tijd(7000)
golf.speel('Kim')
assert.equal(oudElement.parent, null, 'een herhaling ruimt het vorige effect op')
assert.equal(o.ouder.children.length, 3, 'slechts één golf en één melding tegelijk')
vervangenFrame(9500)
assert.equal(o.vind('chat-onlinegolf-melding').textContent, '', 'een oude generatie toont niet de verkeerde naam')
o.tijd(9499); assert.ok(o.vind('chat-onlinegolf'))
o.tijd(9500)
assert.equal(o.vind('chat-onlinegolf-melding').textContent, 'Kim is nu online')
o.win.roep('pagehide'); o.schoon()
golf.speel('Lotte'); o.doc.hidden = true; o.doc.roep('visibilitychange'); o.schoon()
golf.speel('Niemand'); o.schoon()
o.doc.hidden = false; golf.speel('Bram')
assert.equal(o.doc.aantal('visibilitychange'), 1); assert.equal(o.win.aantal('pagehide'), 1)
golf.ruimOp(); o.schoon()
assert.equal(o.doc.aantal('visibilitychange'), 0); assert.equal(o.win.aantal('pagehide'), 0)
golf.speel('Kim'); o.schoon()
assert.doesNotThrow(() => golf.ruimOp(), 'herhaald opruimen is veilig')

const r = omgeving({ minder: true })
const rustig = maakChatOnlineGolf({ ouder: r.ouder, berichten: r.berichten, tekst: naam => naam + ' online' })
rustig.speel('Bram')
assert.equal(r.gpu(), 0, 'verminderde beweging probeert geen GPU te starten')
assert.equal(r.gemaakt.filter(e => e.tag === 'canvas').length, 0)
assert.equal(r.vind('chat-onlinegolf'), undefined, 'verminderde beweging toont geen golf')
assert.equal(r.frames.size, 0)
assert.ok(!r.berichten.classList.contains('chat-onlinegolf-lezen'))
assert.equal(r.vind('chat-onlinegolf-melding').textContent, 'Bram online', 'de status blijft wel beschikbaar zonder animatie')
r.tijd(3499); assert.ok(r.vind('chat-onlinegolf-melding'))
r.tijd(3500); r.schoon()
rustig.ruimOp()
const leeg = maakChatOnlineGolf({ ouder: null })
assert.doesNotThrow(() => { leeg.speel('Bram'); leeg.stop(); leeg.ruimOp() })

// De decoratieve laag en de melding mogen geen klik of veeg voor de chat afvangen.
const css = readFileSync(new URL('../../chat-onlinegolf.css', import.meta.url), 'utf8')
for (const selector of ['.chat-onlinegolf', '.chat-onlinegolf-melding']) {
  const regel = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(m => m[1].trim().split(',').map(s => s.trim()).includes(selector))
  assert.ok(regel, 'CSS-regel voor ' + selector)
  assert.match(regel[2], /pointer-events\s*:\s*none/, selector + ' houdt de chat bedienbaar')
}
console.log('Chat-onlinegolf: overgangen, timing, fallback, tekstveiligheid, verminderde beweging en opruimen goed')
