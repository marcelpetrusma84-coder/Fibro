// pesten-ui.js - Pesten, het eerste kaartspel op de BLAUWDRUK voor kaartspellen (v1, 11 nov 2026).
//
// In gewone woorden: de regels staan in pesten.js, de tafel (kaarten, waaier, stapel, animaties, beurtklok,
// reacties, geluid) in kaartspel-hulp.js. Dit bestand knoopt ze aan elkaar en praat met de ander over het
// spelkanaal, precies zoals BLAUWDRUK-BEURTSPEL.md het beschrijft:
//   'zet'          na elke zet de HELE stand (staat, nr, spelId)
//   'vraag-stand'  wie wacht, vraagt elke 3 seconden de stand op; 'stand' is het antwoord
//   'opnieuw'      een nieuw spel, met de nieuwe stand erbij (wie op Opnieuw tikt, schudt en deelt)
//   'kaartreactie' een emoji die over tafel vliegt
// Speler 1 schudt en deelt het eerste spel. De chatbalk, stickers, webcam en het spraakgesprek komen van chat.html.
import * as P from './pesten.js?v=1'
import { maakKaartTafel, KLEUR_TEKEN, REACTIES } from './kaartspel-hulp.js?v=3'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const BEURT_SECONDEN = 30

export function start({ spelKanaal, benIkSpeler1, vriendNaam }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🃏 Pesten'
  const ik = benIkSpeler1 ? 1 : 2, hij = ik === 1 ? 2 : 1
  const solo = Boolean(spelKanaal && spelKanaal.isSolo)
  const naam = solo ? T('Computer') : (vriendNaam || T('vriend'))

  let staat = null, spelId = -1, nr = 0
  let bezig = 0                       // > 0 zolang er een animatie loopt: dan even geen invoer
  let rij = Promise.resolve()
  const score = { [ik]: 0, [hij]: 0 }
  const geteld = new Set()
  let klokVoor = ''

  const stuur = (event, payload) => { try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
  const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[pesten]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: naam,
    groep: id => P.kaartInfo(id).waarde,
    magSpelen: ids => !bezig && P.magSpelen(staat, ik, ids),
    onSpeel: speelKaarten,
    onPak: pakKaart,
    onReactie: emoji => { if (!solo) stuur('kaartreactie', { emoji }) },
  })

  // ── Wat de tafel laat zien ──
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.winnaar) return ''
    if (s.aanZet !== ik) return solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam })
    if (s.straf > 0) return P.speelbaar(s, ik).length ? T('Pest terug met een 2 of joker, of pak er {n}', { n: s.straf }) : T('Tik op de stapel: je pakt er {n}', { n: s.straf })
    if (s.getrokken) return P.speelbaar(s, ik).length ? T('Speel een kaart of tik op Pas') : T('Past niet. Tik op Pas')
    if (!P.speelbaar(s, ik).length) return T('Je kunt niet: tik op de stapel')
    return T('Jouw beurt: veeg een kaart omhoog')
  }
  function beeld(s, extra = {}) {
    return { hand: s.handen[ik], anderAantal: s.handen[hij].length, stapelAantal: s.stapel.length, afleg: s.aflegstapel,
      mijnBeurt: !s.winnaar && s.aanZet === ik, speelbaar: P.speelbaar(s, ik), status: statusTekst(s), ...extra }
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); return }
    tafel.toon(beeld(staat))
    const mijnBeurt = !staat.winnaar && staat.aanZet === ik
    const knoppen = []
    if (P.magRoepen(staat, ik)) knoppen.push({ naam: 'roep', tekst: T('☝ Laatste kaart!'), nadruk: true, schud: staat.handen[ik].length === 2, opKlik: roep })
    if (mijnBeurt && staat.getrokken) knoppen.push({ naam: 'pas', tekst: T('Pas'), opKlik: pas })
    tafel.knoppen(knoppen)
    tafel.anderKnop(P.magBetrappen(staat, ik) ? { naam: 'betrap', tekst: T('🫵 Betrapt!'), opKlik: betrap } : null)
    const pil = (t, k) => '<span style="padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:14px' + (k ? ';color:' + k : '') + '">' + t + '</span>'
    let info = ''
    if (staat.kleur) info += pil(T('Kleur') + ' <span style="font-size:18px;color:' + (['h', 'r'].includes(staat.kleur) ? '#ff5c7a' : '#fff') + '">' + KLEUR_TEKEN[staat.kleur] + '</span>')
    if (staat.straf) info += pil('+' + staat.straf, '#fcd34d')
    tafel.info(info)
    const klok = staat.winnaar ? '' : spelId + ':' + staat.aanZet + ':' + (staat.aanZet === ik ? 'ik' : 'ander')
    if (klok !== klokVoor) { klokVoor = klok; tafel.beurtKlok(staat.winnaar ? null : (staat.aanZet === ik ? 'ik' : 'ander'), BEURT_SECONDEN) }
  }

  // Effect bij een sterke kaart (bij jou en bij de ander hetzelfde)
  function kaartEffect(s) {
    const l = s.laatste
    if (!l || l.soort !== 'speel') return
    const w = P.kaartInfo(l.kaarten[0]).waarde
    if (w === '2' || w === 'J') tafel.effect('+' + s.straf)
    else if (w === 'B') tafel.effect(T('Kleur') + ' ' + KLEUR_TEKEN[s.kleur])
    else if (w === '7') tafel.effect(T('Blijft plakken!'))
    else if (w === '8') tafel.effect(T('Wacht!'))
    else if (w === 'A') tafel.effect(T('Keer om!'))
  }

  function controleerEinde() {
    if (!staat || !staat.winnaar) return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(spelId)) { geteld.add(spelId); score[staat.winnaar]++; if (!gewonnen) meldGeslagen('ik', 1, { geluid: false }) }
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint!') : T('😢 {naam} wint!', { naam }),
      sub: T('Stand: jij {a} - {b} {naam}', { a: score[ik], b: score[hij], naam }),
      opnieuw: nieuwSpelStarten })
  }
  function naZet(oud) {
    teken()
    if (staat.winnaar) controleerEinde()
    else if (staat.aanZet === ik && (!oud || oud.aanZet !== ik)) { tafel.geluid.beurt(); tafel.tril(15) }
  }

  // Een eigen zet: stand bijwerken, meteen naar de ander, dan de animatie
  function zet(nieuw, animatie) {
    const oud = staat
    staat = nieuw; nr++
    stuur('zet', { staat, nr, spelId })
    inRij(async () => { if (animatie) await animatie(); naZet(oud) })
  }

  // ── Jij speelt ──
  async function speelKaarten(ids, { snelheid, richting }) {
    if (bezig || !P.magSpelen(staat, ik, ids)) return
    let kleur
    if (P.kaartInfo(ids[0]).waarde === 'B') {
      bezig++
      try {
        kleur = await tafel.kiesUit(T('Welke kleur wordt het?'), P.KLEUREN.map(k => ({ waarde: k, html: KLEUR_TEKEN[k], label: k, kleur: ['h', 'r'].includes(k) ? '#d62246' : '#1a0a2e' })))
      } finally { bezig-- }
    }
    const nieuw = P.speel(staat, ik, ids, kleur)
    if (!nieuw) return
    const vanRects = ids.map(id => tafel.kaartRechthoek(id))
    tafel.wisSelectie()
    zet(nieuw, async () => {
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      await tafel.speelAnimatie(ids, { snelheid, richting, vanRects })
      kaartEffect(nieuw)
    })
  }

  // ── Jij tikt of veegt op de stapel ──
  function pakKaart({ manier }) {
    if (bezig || !staat) return
    const nieuw = P.pak(staat, ik)
    if (!nieuw) return
    const l = nieuw.laatste
    if (l.soort === 'pas') { zet(nieuw); return }
    zet(nieuw, async () => {
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      if (l.soort === 'straf') { tafel.geluid.straf(); meldGeslagen('ik', l.n > 4 ? 2 : 1, { geluid: false }) }
      await tafel.pakAnimatie(l.kaarten, { manier })
    })
  }
  function pas() { if (!bezig) { const n = P.pas(staat, ik); if (n) zet(n) } }
  function roep() {
    if (bezig) return
    const n = P.roep(staat, ik)
    if (!n) return
    tafel.geluid.roep()
    zet(n, async () => { tafel.effect(T('Laatste kaart!'), { geluid: false }) })
  }
  function betrap() {
    if (bezig) return
    const n = P.betrap(staat, ik)
    if (!n) return
    zet(n, async () => {
      tafel.toon(beeld(n, { mijnBeurt: false }))
      tafel.effect(T('Betrapt! +{n}', { n: n.laatste.n }))
      meldGeslagen('ander', 1, { geluid: false })
      await tafel.anderPaktAnimatie(n.laatste.n)
    })
  }

  // ── Een stand van de ander verwerken (met de passende animatie) ──
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    tafel.toon(beeld(nieuw, { mijnBeurt: false }))
    if (l.soort === 'deel' || !oud) {
      tafel.sluitEinde()
      await tafel.deelAnimatie({ mijnKaarten: nieuw.handen[ik], anderAantal: nieuw.handen[hij].length, open: P.bovenste(nieuw) })
    } else if (l.soort === 'speel' && l.wie === hij) {
      await tafel.anderSpeeltAnimatie(l.kaarten)
      kaartEffect(nieuw)
    } else if ((l.soort === 'pak' || l.soort === 'straf') && l.wie === hij) {
      if (l.soort === 'straf') meldGeslagen('ander', l.n > 4 ? 2 : 1, { geluid: false })
      await tafel.anderPaktAnimatie(l.n)
    } else if (l.soort === 'betrapt' && l.wie === ik) {
      tafel.effect(T('Betrapt! +{n}', { n: l.n }))
      meldGeslagen('ik', 1, { geluid: false })
      await tafel.pakAnimatie(l.kaarten, { manier: 'tik' })
    } else if (l.soort === 'roep' && l.wie === hij) {
      tafel.geluid.roep()
      tafel.effect(T('Laatste kaart!'), { geluid: false })
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

  // ── Een nieuw spel: wie begint wisselt ──
  function nieuwSpelStarten() {
    const begint = staat ? (staat.begint === 1 ? 2 : 1) : 1
    const id = Math.max(Date.now(), spelId + 1)
    const nieuw = P.nieuwSpel({ begint })
    const oud = null
    spelId = id; nr = 0; staat = nieuw
    stuur('opnieuw', { staat, nr, spelId })
    inRij(async () => { await verwerk(oud, nieuw); naZet(oud) })
  }

  // Elke 3 s de stand opvragen als je wacht; stoppen zodra het spel gesloten is
  const timer = setInterval(() => {
    if (!tafel.element.isConnected) { clearInterval(timer); return }
    if (!staat || (!staat.winnaar && staat.aanZet !== ik)) stuur('vraag-stand', { spelId, nr })
  }, 3000)

  teken()
  if (ik === 1) nieuwSpelStarten()        // speler 1 schudt en deelt; speler 2 krijgt de stand
  else stuur('vraag-stand', { spelId, nr })
}
