// eenentwintigen-ui.js - Eenentwintigen, het derde kaartspel op de BLAUWDRUK voor kaartspellen (v1, 11 nov 2026).
//
// In gewone woorden: de regels staan in eenentwintigen.js, de tafel in kaartspel-hulp.js. Tik of veeg op de stapel
// voor een kaart, tik op "Ik blijf" als je genoeg hebt. Aan het eind draait de ander zijn kaarten om (ze vliegen
// open op tafel). Over het spelkanaal precies zoals Pesten: 'zet', 'vraag-stand'/'stand', 'opnieuw', 'kaartreactie'.
import * as P from './eenentwintigen.js?v=1'
import { maakKaartTafel, REACTIES } from './kaartspel-hulp.js?v=3'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const BEURT_SECONDEN = 30
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function start({ spelKanaal, benIkSpeler1, vriendNaam }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '♠️ Eenentwintigen'
  const ik = benIkSpeler1 ? 1 : 2, hij = ik === 1 ? 2 : 1
  const solo = Boolean(spelKanaal && spelKanaal.isSolo)
  const naam = solo ? T('Computer') : (vriendNaam || T('vriend'))
  const naamHtml = esc(naam)   // in de pilletjes (html): de naam van je vriend veilig

  let staat = null, spelId = -1, nr = 0
  let bezig = 0
  let rij = Promise.resolve()
  const score = { [ik]: 0, [hij]: 0 }
  const geteld = new Set()
  let klokVoor = ''

  const stuur = (event, payload) => { try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
  const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[eenentwintigen]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: naam,
    magSpelen: () => false,                          // je speelt geen kaarten uit je hand
    onSpeel() {},
    onPak: pakKaart,
    onReactie: emoji => { if (!solo) stuur('kaartreactie', { emoji }) },
  })

  // ── Wat de tafel laat zien ──
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.klaar) return ''
    const mijn = P.totaal(s.handen[ik])
    if (s.aanZet === ik && !s.gestopt[ik]) return T('Je hebt {n}. Tik op de stapel voor een kaart, of op Ik blijf', { n: mijn })
    if (s.gestopt[ik]) return T('Jij blijft op {n}. Nu is {naam}...', { n: mijn, naam })
    return solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam })
  }
  function beeld(s, extra = {}) {
    return { hand: s.handen[ik], anderAantal: s.handen[hij].length, stapelAantal: s.stapel.length, afleg: s.klaar ? s.handen[hij] : [],
      mijnBeurt: P.magPakken(s, ik), speelbaar: [], status: statusTekst(s), ...extra }
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); return }
    tafel.toon(beeld(staat))
    tafel.knoppen(P.magBlijven(staat, ik) ? [{ naam: 'blijf', tekst: T('✋ Ik blijf'), nadruk: true, opKlik: blijf }] : [])
    tekenInfo(staat)
    const klok = staat.klaar ? '' : spelId + ':' + staat.aanZet
    if (klok !== klokVoor) { klokVoor = klok; tafel.beurtKlok(staat.klaar ? null : (staat.aanZet === ik ? 'ik' : 'ander'), BEURT_SECONDEN) }
  }
  // De pilletjes boven de stapel: jouw totaal (meteen bij het pakken bijgewerkt, niet pas na de animatie)
  function tekenInfo(staat) {
    const pil = (t, k) => '<span style="padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:15px' + (k ? ';color:' + k : '') + '">' + t + '</span>'
    const mijn = P.totaal(staat.handen[ik])
    let info = pil(T('Jij: {n}', { n: mijn }), mijn > 21 ? '#ff5c7a' : mijn === 21 ? '#86efac' : '')
    if (staat.gestopt[hij] && !staat.klaar) info += pil(T('{naam} blijft', { naam: naamHtml }))
    if (staat.klaar) info += pil(naamHtml + ': ' + P.totaal(staat.handen[hij]), P.totaal(staat.handen[hij]) > 21 ? '#ff5c7a' : '')
    tafel.info(info)
  }

  // Einde: de ander draait zijn kaarten om, dan de uitslag
  async function omdraaien(s) {
    tafel.toon(beeld(s, { anderAantal: 0, mijnBeurt: false, status: '' }))
    await tafel.anderSpeeltAnimatie(s.handen[hij])
    await wacht(400)
  }
  function controleerEinde() {
    if (!staat || !staat.klaar) return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(spelId)) { geteld.add(spelId); if (staat.winnaar) score[staat.winnaar]++; if (staat.winnaar === hij) meldGeslagen('ik', 1, { geluid: false }) }
    const a = P.totaal(staat.handen[ik]), b = P.totaal(staat.handen[hij])
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint!') : staat.winnaar ? T('😢 {naam} wint!', { naam }) : T('🤝 Gelijkspel!'),
      sub: T('Jij {a} · {naam} {b}', { a, b, naam }) + '  ·  ' + T('Stand: jij {a} - {b} {naam}', { a: score[ik], b: score[hij], naam }),
      opnieuw: nieuwSpelStarten })
  }
  function naZet(oud) {
    teken()
    if (staat.klaar) controleerEinde()
    else if (staat.aanZet === ik && (!oud || oud.aanZet !== ik)) { tafel.geluid.beurt(); tafel.tril(15) }
  }
  function zet(nieuw, animatie) {
    const oud = staat
    staat = nieuw; nr++
    stuur('zet', { staat, nr, spelId })
    tafel.knoppen([])                                // knoppen weg tot de animatie klaar is
    inRij(async () => { if (animatie) await animatie(); naZet(oud) })
  }

  // ── Jij pakt een kaart (tik of veeg op de stapel) ──
  function pakKaart({ manier }) {
    if (bezig || !P.magPakken(staat, ik)) return
    const nieuw = P.pak(staat, ik)
    if (!nieuw) return
    const l = nieuw.laatste
    zet(nieuw, async () => {
      tafel.toon(beeld(nieuw, { afleg: [], mijnBeurt: false }))
      await tafel.pakAnimatie(l.kaarten, { manier })
      tekenInfo({ ...nieuw, klaar: false })
      if (l.soort === 'dood') { tafel.effect(T('{n}: te veel!', { n: l.totaal })); tafel.tril([40, 60, 40]); await wacht(900) }
      else if (l.eenentwintig) { tafel.effect('21!'); await wacht(700) }
      if (nieuw.klaar) await omdraaien(nieuw)
    })
  }
  function blijf() {
    if (bezig) return
    const n = P.stop(staat, ik)
    if (n) zet(n, async () => { if (n.klaar) await omdraaien(n) })
  }

  // ── Een stand van de ander ──
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    if (l.soort === 'deel' || !oud) {
      tafel.sluitEinde()
      tafel.toon(beeld(nieuw, { mijnBeurt: false, afleg: [] }))
      await tafel.deelAnimatie({ mijnKaarten: nieuw.handen[ik], anderAantal: nieuw.handen[hij].length, open: null })
      if (P.totaal(nieuw.handen[ik]) === 21) { tafel.effect('21!'); await wacht(600) }
      if (nieuw.klaar) await omdraaien(nieuw)
    } else if ((l.soort === 'pak' || l.soort === 'dood') && l.wie === hij) {
      tafel.toon(beeld(nieuw, { afleg: [], mijnBeurt: false }))
      await tafel.anderPaktAnimatie(1)
      if (l.soort === 'dood') { tafel.effect(T('{naam}: te veel!', { naam })); meldGeslagen('ander', 1, { geluid: false }); await wacht(800) }
      if (nieuw.klaar) await omdraaien(nieuw)
    } else if (l.soort === 'stop' && l.wie === hij) {
      tafel.effect(T('{naam} blijft', { naam }), { gloed: false, geluid: false })
      await wacht(500)
      if (nieuw.klaar) await omdraaien(nieuw)
    }
  }
  function ontvang(p, alsNieuwSpel) {
    if (!p || !P.geldigeStand(p.staat)) return
    const id = p.spelId ?? spelId, n = p.nr ?? 0
    if (!(alsNieuwSpel ? id > spelId : nieuwer(id, n))) return
    const oud = id === spelId ? staat : null
    spelId = id; nr = n; staat = p.staat
    inRij(async () => { await verwerk(oud, p.staat); naZet(oud) })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, msg => ontvang(msg.payload, false))
  spelKanaal.on('broadcast', { event: 'stand' }, msg => ontvang(msg.payload, false))
  spelKanaal.on('broadcast', { event: 'opnieuw' }, msg => ontvang(msg.payload, true))
  spelKanaal.on('broadcast', { event: 'vraag-stand' }, msg => {
    const p = msg.payload || {}
    if (staat && (spelId > (p.spelId ?? -1) || (spelId === (p.spelId ?? -1) && nr > (p.nr ?? 0)))) stuur('stand', { staat, nr, spelId })
  })
  spelKanaal.on('broadcast', { event: 'kaartreactie' }, msg => {
    const e = msg.payload && msg.payload.emoji
    if (REACTIES.includes(e)) tafel.reactie(e, 'ander')
  })

  function nieuwSpelStarten() {
    const begint = staat ? (staat.begint === 1 ? 2 : 1) : 1
    const id = Math.max(Date.now(), spelId + 1)
    const nieuw = P.nieuwSpel({ begint })
    spelId = id; nr = 0; staat = nieuw
    stuur('opnieuw', { staat, nr, spelId })
    inRij(async () => { await verwerk(null, nieuw); naZet(null) })
  }

  const timer = setInterval(() => {
    if (!tafel.element.isConnected) { clearInterval(timer); return }
    if (!staat || (!staat.klaar && staat.aanZet !== ik)) stuur('vraag-stand', { spelId, nr })
  }, 3000)

  teken()
  if (ik === 1) nieuwSpelStarten()
  else stuur('vraag-stand', { spelId, nr })
}
