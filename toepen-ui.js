// toepen-ui.js - Toepen, het tweede kaartspel op de BLAUWDRUK voor kaartspellen (v1, 11 nov 2026).
//
// In gewone woorden: de regels staan in toepen.js, de tafel (kaarten, waaier, animaties, beurtklok, reacties, geluid)
// in kaartspel-hulp.js. Dit bestand knoopt ze aan elkaar en praat met de ander over het spelkanaal, net als Pesten:
//   'zet' (de hele stand), 'vraag-stand'/'stand', 'opnieuw' (nieuw spel), 'kaartreactie' (een emoji).
// Op tafel liggen de kaarten van de slag die bezig is. Speler 1 schudt en deelt het eerste spel; daarna deelt de zet
// die een ronde afmaakt meteen de volgende ronde (zie toepen.js).
import * as P from './toepen.js?v=1'
import { maakKaartTafel, KLEUR_TEKEN, REACTIES } from './kaartspel-hulp.js?v=7'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const BEURT_SECONDEN = 30
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function start({ spelKanaal, benIkSpeler1, vriendNaam }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '✊ Toepen'
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
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[toepen]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: naam,
    groep: id => id,                                 // altijd één kaart tegelijk
    magSpelen: ids => !bezig && ids.length === 1 && P.magSpelen(staat, ik, ids[0]),
    onSpeel: speelKaart,
    onPak() {},                                      // bij Toepen pak je geen kaarten
    onReactie: emoji => { if (!solo) stuur('kaartreactie', { emoji }) },
  })

  // ── Wat de tafel laat zien ──
  const kleurTeken = k => '<span style="color:' + (['h', 'r'].includes(k) ? '#ff5c7a' : '#fff') + '">' + KLEUR_TEKEN[k] + '</span>'
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.winnaar) return ''
    if (P.moetAntwoorden(s, ik)) return T('{naam} toept! Ga je mee? (inzet {n})', { naam, n: s.inzet + 1 })
    if (s.toep === ik) return T('Toep! Gaat {naam} mee?', { naam })
    if (s.aanZet !== ik) return solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam })
    const kleur = P.gevraagd(s)
    if (kleur) return s.handen[ik].some(id => P.kaartInfo(id).kleur === kleur)
      ? T('Beken kleur: speel een {kleur}', { kleur: KLEUR_TEKEN[kleur] }) : T('Geen {kleur}: speel wat je wilt', { kleur: KLEUR_TEKEN[kleur] })
    return s.slagNr >= P.HANDGROOTTE ? T('Laatste slag: die telt!') : T('Kom uit: veeg een kaart omhoog')
  }
  function beeld(s, extra = {}) {
    return { hand: s.handen[ik], anderAantal: s.handen[hij].length, stapelAantal: s.stapel.length, afleg: s.slag.map(x => x.kaart),
      mijnBeurt: !s.winnaar && !s.toep && s.aanZet === ik, speelbaar: P.speelbaar(s, ik), status: statusTekst(s), ...extra }
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); return }
    tafel.toon(beeld(staat))
    const knoppen = []
    if (P.moetAntwoorden(staat, ik)) {
      knoppen.push({ naam: 'mee', tekst: T('👍 Ik ga mee'), nadruk: true, opKlik: mee })
      knoppen.push({ naam: 'uit', tekst: T('Ik ga eruit (+{n})', { n: staat.inzet }), opKlik: gaUit })
    } else if (P.magToepen(staat, ik)) knoppen.push({ naam: 'toep', tekst: T('✊ Toep!'), nadruk: true, opKlik: toep })
    tafel.knoppen(knoppen)
    const pil = (t, k) => '<span style="padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:13px' + (k ? ';color:' + k : '') + '">' + t + '</span>'
    let info = pil(T('Inzet {n}', { n: staat.inzet }), staat.inzet > 1 ? '#fcd34d' : '')
    info += pil(T('Slag {n}/4', { n: staat.slagNr }))
    if (P.gevraagd(staat)) info += pil(kleurTeken(P.gevraagd(staat)))
    info += pil(T('Strafpunten: jij {a} · {naam} {b}', { a: staat.straf[ik], b: staat.straf[hij], naam: naamHtml }))
    tafel.info(info)
    const klok = staat.winnaar ? '' : spelId + ':' + staat.ronde + ':' + staat.beurt + ':' + staat.aanZet
    if (klok !== klokVoor) { klokVoor = klok; tafel.beurtKlok(staat.winnaar ? null : (staat.aanZet === ik ? 'ik' : 'ander'), BEURT_SECONDEN) }
  }

  // Na een slag: even laten liggen, wie wint hem, en bij de laatste slag de ronde afsluiten (en nieuw delen)
  async function naSlag(nieuw) {
    const l = nieuw.laatste
    if (!l || !l.slag) return
    await wacht(650)
    if (!l.ronde) {
      tafel.effect(l.slagWinnaar === ik ? T('Slag voor jou') : T('Slag voor {naam}', { naam }), { gloed: false, geluid: false })
      await wacht(450)
      return
    }
    await rondeEinde(nieuw)
  }
  async function rondeEinde(nieuw) {
    const r = nieuw.laatste.ronde
    if (r.verliezer === ik) { tafel.effect(r.punten === 1 ? T('Jij krijgt 1 strafpunt') : T('Jij krijgt {n} strafpunten', { n: r.punten })); meldGeslagen('ik', r.punten > 2 ? 2 : 1, { geluid: false }) }
    else { tafel.effect(T('Ronde voor jou! +{n} voor {naam}', { n: r.punten, naam })); meldGeslagen('ander', r.punten > 2 ? 2 : 1, { geluid: false }) }
    await wacht(1300)
    if (nieuw.winnaar) return
    tafel.toon(beeld(nieuw, { mijnBeurt: false }))
    await tafel.deelAnimatie({ mijnKaarten: nieuw.handen[ik], anderAantal: nieuw.handen[hij].length, open: null })
  }
  // Tijdens de animatie van de laatste slag: de handen zijn al leeg (de nieuwe ronde is pas na het delen te zien)
  const tijdensSlag = (nieuw, extra = {}) => {
    const l = nieuw.laatste
    const leeg = l.ronde ? { hand: [], anderAantal: 0, stapelAantal: 24 } : {}
    return beeld(nieuw, { mijnBeurt: false, afleg: l.slag || nieuw.slag.map(x => x.kaart), ...leeg, ...extra })
  }

  function controleerEinde() {
    if (!staat || !staat.winnaar) return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(spelId)) { geteld.add(spelId); score[staat.winnaar]++ }
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint!') : T('😢 {naam} wint!', { naam }),
      sub: T('Strafpunten: jij {a} · {naam} {b}', { a: staat.straf[ik], b: staat.straf[hij], naam }) + '  ·  ' + T('Stand: jij {a} - {b} {naam}', { a: score[ik], b: score[hij], naam }),
      opnieuw: nieuwSpelStarten })
  }
  function naZet(oud) {
    teken()
    if (staat.winnaar) controleerEinde()
    else if (staat.aanZet === ik && (!oud || oud.aanZet !== ik)) { tafel.geluid.beurt(); tafel.tril(15) }
  }
  function zet(nieuw, animatie) {
    const oud = staat
    staat = nieuw; nr++
    stuur('zet', { staat, nr, spelId })
    tafel.knoppen([])                                // knoppen weg tot de animatie klaar is
    inRij(async () => { if (animatie) await animatie(); naZet(oud) })
  }

  // ── Jij speelt een kaart ──
  function speelKaart(ids, { snelheid, richting }) {
    const id = ids[0]
    if (bezig || !P.magSpelen(staat, ik, id)) return
    const nieuw = P.speel(staat, ik, id)
    if (!nieuw) return
    const vanRects = [tafel.kaartRechthoek(id)]
    tafel.wisSelectie()
    zet(nieuw, async () => {
      tafel.toon(tijdensSlag(nieuw))
      await tafel.speelAnimatie([id], { snelheid, richting, vanRects })
      await naSlag(nieuw)
    })
  }
  function toep() {
    if (bezig) return
    const n = P.toep(staat, ik)
    if (!n) return
    tafel.geluid.roep()
    zet(n, async () => { tafel.effect(T('Toep!'), { geluid: false }) })
  }
  function mee() {
    if (bezig) return
    const n = P.mee(staat, ik)
    if (n) zet(n, async () => { tafel.effect(T('Mee! Inzet {n}', { n: n.inzet })) })
  }
  function gaUit() {
    if (bezig) return
    const n = P.gaUit(staat, ik)
    if (n) zet(n, async () => { await rondeEinde(n) })
  }

  // ── Een stand van de ander verwerken ──
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    if (l.soort === 'deel' || !oud) {
      tafel.sluitEinde()
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      await tafel.deelAnimatie({ mijnKaarten: nieuw.handen[ik], anderAantal: nieuw.handen[hij].length, open: null })
    } else if (l.soort === 'speel' && l.wie === hij) {
      tafel.toon(tijdensSlag(nieuw))
      await tafel.anderSpeeltAnimatie([l.kaart])
      await naSlag(nieuw)
    } else if (l.soort === 'toep' && l.wie === hij) {
      tafel.toon(beeld(nieuw, { mijnBeurt: false }))
      tafel.geluid.roep(); tafel.tril([20, 40, 20])
      tafel.effect(T('{naam} toept!', { naam }), { geluid: false })
    } else if (l.soort === 'mee' && l.wie === hij) {
      tafel.effect(T('{naam} gaat mee! Inzet {n}', { naam, n: nieuw.inzet }))
    } else if (l.soort === 'uit' && l.wie === hij) {
      tafel.effect(T('{naam} gaat eruit', { naam }), { geluid: false })
      await wacht(700)
      await rondeEinde(nieuw)
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
    spelId = id; nr = 0; staat = nieuw
    stuur('opnieuw', { staat, nr, spelId })
    inRij(async () => { await verwerk(null, nieuw); naZet(null) })
  }

  const timer = setInterval(() => {
    if (!tafel.element.isConnected) { clearInterval(timer); return }
    if (!staat || (!staat.winnaar && staat.aanZet !== ik)) stuur('vraag-stand', { spelId, nr })
  }, 3000)

  teken()
  if (ik === 1) nieuwSpelStarten()
  else stuur('vraag-stand', { spelId, nr })
}
