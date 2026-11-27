// sjabloon-kaartspel-ui.js - SJABLOON voor een nieuw kaartspel met 2 tot 6 spelers (v1, 27 nov 2026). Hoort bij
// sjabloon-kaartspel.js (de regels). Stekky Studio kopieert dit naar <id>-ui.js; daarna komen de echte regels erin.
//
// In gewone woorden: een klein, echt werkend kaartspel ("Hoogste kaart") met alles wat een kaartspel in Stekky nodig heeft:
//   - tegen de computer (eerst kiezen tegen hoeveel computers), met een vriend in de chat, en met de groep (2 tot 6);
//   - groepspel.js: één gastheer heeft de stand, de computer speelt lege zetels en wie weggaat;
//   - de kaarttafel (kaartspel-hulp.js): je hand, de anderen als rondjes, beurtklok, effecten, reacties, ❓ spelregels,
//     het eindscherm met ↻ Opnieuw spelen (en het scorebord via window.fibroSoloUitslag in spel.html);
//   - teksten in het Nederlands met de Engelse vertaling hieronder (window.FIBRO_EN).
// Tokens inzetten (zoals Black Jack en Poker): zie pokertexasholdem-ui.js (casino.js, kiesInzet en uitslag).
import * as P from './sjabloon-kaartspel.js?v=1'
import { maakKaartTafel, kaartSvg, kaartNaam, REACTIES } from './kaartspel-hulp.js?v=23'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'
import { maakGroepSpel } from './groepspel.js?v=2'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Hoogste kaart': 'Highest card', 'Jij': 'You', 'vriend': 'friend', 'Computer': 'Computer', 'Computer {n}': 'Computer {n}',
  'Slag {n} van {m}': 'Trick {n} of {m}', '{n} slagen': '{n} tricks', '1 slag': '1 trick',
  'Leg een kaart: tik erop en veeg omhoog (of tik twee keer).': 'Play a card: tap it and swipe up (or double tap).',
  '{naam} is aan de beurt': "It's {naam}'s turn", 'De computer denkt na...': 'The computer is thinking...', 'Wachten op {naam}...': 'Waiting for {naam}...',
  'De kaarten worden geschud...': 'Shuffling the cards...', 'Jij wint de slag!': 'You win the trick!', '{naam} wint de slag': '{naam} wins the trick',
  '🎉 Jij wint!': '🎉 You win!', '😢 {naam} wint!': '😢 {naam} wins!', '🤝 Gelijkspel!': '🤝 Draw!',
  'Tegen hoeveel computers wil je spelen?': 'How many computer players?', 'Het spel is gestopt.': 'The game has stopped.',
  '{naam} heeft het spel verlaten.': '{naam} has left the game.', 'Spelregels': 'Rules', 'Terug': 'Back',
  'Iedereen krijgt 5 kaarten. Om de beurt leg je één kaart op tafel.': 'Everyone gets 5 cards. Taking turns, you put one card on the table.',
  'De hoogste kaart wint de slag (aas is het hoogst). Bij gelijk wint wie hem het eerst legde.': 'The highest card wins the trick (ace is highest). If equal, whoever played it first wins.',
  'Wie de slag wint, begint de volgende. Na 5 slagen wint wie de meeste slagen heeft.': 'Whoever wins the trick starts the next one. After 5 tricks, whoever has the most tricks wins.',
})
const REGELS = ['Iedereen krijgt 5 kaarten. Om de beurt leg je één kaart op tafel.',
  'De hoogste kaart wint de slag (aas is het hoogst). Bij gelijk wint wie hem het eerst legde.',
  'Wie de slag wint, begint de volgende. Na 5 slagen wint wie de meeste slagen heeft.']
const BEURT_SECONDEN = 30
const VOLGENDE_MS = 1800       // pauze na een slag, dan deelt de gastheer de volgende
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function zetStijl() {
  if (document.getElementById('sjk-css')) return
  const s = document.createElement('style'); s.id = 'sjk-css'
  s.textContent = `.sjk-midden{display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2}
.sjk-pil{padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:13px;color:#fff}
.sjk-tafel{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:92vw}
.sjk-leg{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:#fff;font-weight:700}
.sjk-leg .sjk-kaart{width:52px}
.sjk-leg.winst .sjk-kaart{border-radius:6px;box-shadow:0 0 0 2px #facc15,0 0 14px #facc15b0}`
  document.head.append(s)
}

// spelers/mijnZetel: met een groep (groepschat of Home); anders met z'n tweeën in de chat, of tegen de computer.
export function start({ spelKanaal, benIkSpeler1, vriendNaam, spelers: groep, mijnZetel }) {
  zetStijl()
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🃏 ' + T('Hoogste kaart') // STUDIO-TITEL
  const solo = Boolean(spelKanaal && spelKanaal.isSolo)
  const niveau = (spelKanaal && spelKanaal.niveau) || 'normaal'
  let spelers, ik
  if (Array.isArray(groep) && groep.length >= 2) { spelers = groep.slice(0, P.MAX_SPELERS).map((s, i) => ({ zetel: i + 1, naam: s.naam, id: s.id, computer: Boolean(s.computer) })); ik = mijnZetel || 1 }
  else if (solo) { spelers = null; ik = 1 }
  else { ik = benIkSpeler1 ? 1 : 2; spelers = [{ zetel: 1, naam: benIkSpeler1 ? T('Jij') : (vriendNaam || T('vriend')) }, { zetel: 2, naam: benIkSpeler1 ? (vriendNaam || T('vriend')) : T('Jij') }] }
  const naamVan = z => z === ik ? T('Jij') : ((spelers || []).find(s => s.zetel === z) || {}).naam || '?'
  const isComputer = z => Boolean(((spelers || []).find(s => s.zetel === z) || {}).computer)

  let staat = null, spel = null, bezig = 0, rij = Promise.resolve(), klokVoor = '', potjeNr = 0
  const geteld = new Set()
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[kaartspel]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: solo ? T('Computer') : (vriendNaam || T('vriend')),
    groep: id => id,                                                       // één kaart tegelijk
    magSpelen: ids => !bezig && ids.length === 1 && P.magLeggen(staat, ik, ids[0]),
    onSpeel: ids => { if (spel && spel.doe({ soort: 'leg', kaart: ids[0] })) tafel.knoppen([{ naam: 'uitleg', tekst: '❓', opKlik: toonRegels }]) },
    onPak() {},
    onReactie: emoji => { if (!solo) spelKanaal.send({ type: 'broadcast', event: 'kaartreactie', payload: { emoji, zetel: ik } }) },
  })
  const middenEl = document.createElement('div'); middenEl.className = 'sjk-midden'
  tafel.element.querySelector('.kt-midden').appendChild(middenEl)
  for (const e of tafel.element.querySelectorAll('.kt-stapel-groep, .kt-stapel, .kt-afleg')) e.style.display = 'none'

  const mijnHand = s => (s && s.handen[ik]) || []
  const slagenTekst = n => n === 1 ? T('1 slag') : T('{n} slagen', { n })
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.fase !== 'spel') return ''
    if (P.aanDeBeurt(s, ik)) return T('Leg een kaart: tik erop en veeg omhoog (of tik twee keer).')
    if (isComputer(s.aanZet) && spelers.length === 2) return T('De computer denkt na...')
    return spelers.length > 2 ? T('{naam} is aan de beurt', { naam: naamVan(s.aanZet) }) : T('Wachten op {naam}...', { naam: naamVan(s.aanZet) })
  }
  const anderen = s => P.zetels(s).map((_, i) => ((ik - 1 + i + 1) % s.n) + 1).filter(z => z !== ik)
  function tekenTegenstanders(s) {
    tafel.tegenstanders(anderen(s).map(z => ({ zetel: z, naam: naamVan(z), icoon: isComputer(z) ? '🤖' : '',
      info: slagenTekst(s.slagen[z]), beurt: s.fase === 'spel' && s.aanZet === z })))
  }
  function tekenMidden(s) {
    if (!s) { middenEl.innerHTML = ''; return }
    const winnaar = s.fase !== 'spel' ? s.slagWinnaar : 0
    middenEl.innerHTML = '<span class="sjk-pil">' + esc(T('Slag {n} van {m}', { n: s.slag, m: P.KAARTEN_PER_SPELER })) + ' · ' + esc(T('Jij')) + ': ' + esc(slagenTekst(s.slagen[ik])) + '</span>'
      + '<div class="sjk-tafel">' + s.tafel.map(t => '<div class="sjk-leg' + (t.z === winnaar ? ' winst' : '') + '"><span class="sjk-kaart" aria-label="' + esc(kaartNaam(t.kaart)) + '">'
        + kaartSvg(t.kaart) + '</span>' + esc(naamVan(t.z)) + '</div>').join('') + '</div>'
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); return }
    const mag = P.aanDeBeurt(staat, ik)
    tafel.toon({ hand: mijnHand(staat), anderAantal: 0, stapelAantal: 0, afleg: [], mijnBeurt: mag, speelbaar: mag ? mijnHand(staat) : [], status: statusTekst(staat) })
    tekenTegenstanders(staat)
    tekenMidden(staat)
    tafel.knoppen([{ naam: 'uitleg', tekst: '❓', opKlik: toonRegels }])
    const klok = staat.fase === 'spel' ? potjeNr + ':' + staat.slag + ':' + staat.tafel.length : ''
    if (klok !== klokVoor) { klokVoor = klok; tafel.beurtKlok(staat.fase !== 'spel' ? null : staat.aanZet === ik ? 'ik' : 'zetel:' + staat.aanZet, BEURT_SECONDEN) }
  }
  function toonRegels() {
    tafel.element.querySelector('.sjk-regels')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze sjk-regels'
    d.innerHTML = '<div class="kt-keuzekaart" role="dialog" aria-modal="true" style="max-width:420px;text-align:left">'
      + '<div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels')) + '</div>'
      + '<ul style="margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px">' + REGELS.map(t => '<li>' + esc(T(t)) + '</li>').join('') + '</ul>'
      + '<button type="button" class="kt-knop kt-nadruk">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    tafel.element.appendChild(d)
  }

  // Een nieuwe stand: eerst de animatie (wat de ander deed), dan pas tekenen
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    if (!oud || oud.ronde > nieuw.ronde || l.soort === 'deel') {
      tafel.sluitEinde()
      tafel.toon({ hand: [], anderAantal: 0, stapelAantal: 0, afleg: [], mijnBeurt: false, speelbaar: [], status: '' })
      tekenTegenstanders(nieuw); tekenMidden(nieuw)
      await tafel.deelAnimatie({ mijnKaarten: mijnHand(nieuw), anderAantal: 0, open: null })
      return
    }
    if ((l.soort === 'leg' || l.soort === 'slag') && l.wie !== ik) { tekenMidden(nieuw); tafel.geluid.leg?.(); await wacht(350) }
    if (l.soort === 'slag') {
      tekenMidden(nieuw)
      tafel.effect(l.winnaar === ik ? T('Jij wint de slag!') : T('{naam} wint de slag', { naam: naamVan(l.winnaar) }), { gloed: l.winnaar === ik })
      await wacht(900)
    }
  }
  function controleerEinde() {
    if (!staat || staat.fase !== 'klaar') return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(potjeNr)) { geteld.add(potjeNr); if (staat.winnaar && !gewonnen) meldGeslagen('ik', 1, { geluid: false }) }
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint!') : staat.winnaar ? T('😢 {naam} wint!', { naam: naamVan(staat.winnaar) }) : T('🤝 Gelijkspel!'),
      sub: P.zetels(staat).map(z => naamVan(z) + ' ' + staat.slagen[z]).join(' · '),
      opnieuw: spel && spel.gastheer ? nieuwSpelStarten : null })
  }
  spelKanaal.on('broadcast', { event: 'kaartreactie' }, msg => {
    const e = msg.payload && msg.payload.emoji, z = Number(msg.payload && msg.payload.zetel)
    if (REACTIES.includes(e)) tafel.reactie(e, z ? 'zetel:' + z : 'ander')
  })
  function nieuwSpelStarten() {
    if (!spel || !spel.gastheer) return
    const begint = staat ? (staat.begint % spelers.length) + 1 : 1   // wie begint, schuift per potje door
    spel.start(P.nieuwSpel({ spelers: spelers.length, begint }))
  }
  function begin() {
    spel = maakGroepSpel({ kanaal: spelKanaal, zetel: ik, spelers, niveau, beurtMs: BEURT_SECONDEN * 1000, rondePauze: VOLGENDE_MS,
      denkMs: () => 500 + Math.floor(Math.random() * 700),
      regels: { aanZet: s => (s && s.fase === 'spel' ? s.aanZet : 0), doeStap: P.doeStap, computerStap: P.computerStap,
        geldigeStand: P.geldigeStand, volgendeRonde: P.volgendeRonde },
      onStand: (oud, nieuw) => { if (!oud || nieuw.ronde < oud.ronde) potjeNr++; staat = nieuw; inRij(async () => { await verwerk(oud, nieuw); teken(); controleerEinde() }) },
      onGastheerWeg: () => { tafel.beurtKlok(null); tafel.knoppen([]); tafel.einde({ gewonnen: false, titel: T('Het spel is gestopt.'), sub: T('{naam} heeft het spel verlaten.', { naam: naamVan(1) }) }) } })
    const weg = setInterval(() => { if (!tafel.element.isConnected) { clearInterval(weg); spel.stop() } }, 1000)
    teken()
    if (spel.gastheer) nieuwSpelStarten()
  }
  if (spelers) begin()
  else tafel.kiesUit(T('Tegen hoeveel computers wil je spelen?'), [1, 2, 3, 4, 5].map(n => ({ html: String(n), waarde: n, label: String(n) }))).then(n => {
    spelers = [{ zetel: 1, naam: T('Jij') }, ...Array.from({ length: n }, (_, i) => ({ zetel: i + 2, naam: n === 1 ? T('Computer') : T('Computer {n}', { n: i + 1 }), computer: true }))]
    begin()
  })
}
