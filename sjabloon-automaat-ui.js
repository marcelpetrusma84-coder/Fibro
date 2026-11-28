// sjabloon-automaat-ui.js - SJABLOON voor een automaat die je alleen speelt (v1, 27 nov 2026), zoals Video Poker.
// Hoort bij sjabloon-automaat.js (de regels). Stekky Studio kopieert dit naar <id>-ui.js voor een kaartspel zonder
// vriend en zet "zonderKanaal" aan in studio-spellen.js (geen niveaus, geen computerspeler, niet in de chat).
//
// In gewone woorden: "Hoger of lager" met alles wat een automaat nodig heeft:
//   - een eigen scherm in #spelInhoud (de kaarten komen van kaartspel-hulp.js: kaartSvg, achterkantSvg, kaartGeluid);
//   - met of zonder casino-tokens: staat het spel in CASINO_SPELLEN (casino.js) en in de lijst van casino_inzet
//     (sql/casino-tokens.sql), dan zet spel.html window.fibroCasino klaar en kun je inzetten (fiches 10/25/50/100,
//     winst = 2× terug). Anders speel je gewoon voor de lol;
//   - het scorebord via window.fibroSoloUitslag (spel.html), en ❓ spelregels.
import * as R from './sjabloon-automaat.js?v=1'
import { kaartSvg, achterkantSvg, kaartNaam, zetStijl as zetKaartStijl, kaartGeluid, tril } from './kaartspel-hulp.js?v=23'
import { INZETTEN, MINIMUM, verschil } from './casino.js?v=5'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Hoger of lager': 'Higher or lower', '⬆ Hoger': '⬆ Higher', '⬇ Lager': '⬇ Lower', 'Nieuwe kaart': 'New card',
  'Zonder tokens': 'Without tokens', 'Is de volgende kaart hoger of lager?': 'Is the next card higher or lower?',
  'Goed geraden!': 'Well guessed!', 'Goed geraden! +{n}': 'Well guessed! +{n}', 'Dezelfde waarde: je inzet terug': 'Same value: your bet back',
  'Helaas, mis.': 'Too bad, wrong.', 'Inzetten lukt nu niet. Speel zonder tokens of probeer het zo nog eens.': 'Betting does not work right now. Play without tokens or try again in a moment.',
  'Spelregels': 'Rules', 'Terug': 'Back',
  'Je ziet een kaart. Raad of de volgende hoger of lager is (aas is het hoogst).': 'You see a card. Guess whether the next one is higher or lower (ace is highest).',
  'Goed geraden = gewonnen. Dezelfde waarde = gelijk. Met tokens krijg je bij winst je inzet dubbel terug.': 'Guessed right = you win. Same value = a draw. With tokens you get double your bet back when you win.',
})
const REGELS = ['Je ziet een kaart. Raad of de volgende hoger of lager is (aas is het hoogst).',
  'Goed geraden = gewonnen. Dezelfde waarde = gelijk. Met tokens krijg je bij winst je inzet dubbel terug.']
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const wacht = ms => new Promise(k => setTimeout(k, ms))

function zetStijl() {
  if (document.getElementById('sja-css')) return
  const s = document.createElement('style'); s.id = 'sja-css'
  s.textContent = `.sja{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:14px;padding:70px 14px 20px;color:#fff;background:radial-gradient(ellipse at 50% 30%,#2a1248,#1a0a2e 70%)}
.sja-saldo{font-size:20px;font-weight:900;color:#fde68a}
.sja-fiches{display:flex;gap:8px}.sja-fiches[hidden]{display:none}
.sja-fiche{width:46px;height:46px;border-radius:50%;border:3px dashed #ffffffaa;background:#8b3fd1;color:#fff;font:inherit;font-weight:900;cursor:pointer}
.sja-fiche.gekozen{outline:3px solid #facc15;outline-offset:2px}.sja-fiche:disabled{opacity:.3}
.sja-kaarten{display:flex;gap:14px}.sja-kaarten span{display:block;width:96px}
.sja-melding{min-height:24px;font-weight:800;font-size:16px;text-align:center}
.sja-knoppen{display:flex;gap:8px;margin-top:auto}
.sja-knop{padding:12px 18px;border-radius:14px;border:1px solid #c084fc88;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.sja-knop.licht{background:#ffffff14}.sja-knop:disabled{opacity:.4}`
  document.head.append(s)
}

export function start() {
  zetKaartStijl(); zetStijl()
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🃏 ' + T('Hoger of lager') // STUDIO-TITEL
  const casino = window.fibroCasino || null        // alleen als dit spel in CASINO_SPELLEN staat (casino.js)
  let saldo = null, inzet = 10, pot = null, ronde = R.nieuweRonde(), bezig = false

  const doos = document.createElement('div'); doos.className = 'sja'
  doos.innerHTML = '<div class="sja-saldo"></div><div class="sja-fiches" hidden></div><div class="sja-kaarten"><span class="sja-nu"></span><span class="sja-volgende"></span></div>'
    + '<div class="sja-melding" aria-live="polite"></div><div class="sja-knoppen"><button type="button" class="sja-knop" data-naam="hoger"></button>'
    + '<button type="button" class="sja-knop" data-naam="lager"></button><button type="button" class="sja-knop licht" data-naam="uitleg">❓</button></div>'
  inhoud.replaceChildren(doos)
  const $ = s => doos.querySelector(s)
  const melding = t => { $('.sja-melding').textContent = t }

  function teken() {
    $('.sja-saldo').textContent = saldo === null ? T('Zonder tokens') : '🪙 ' + saldo
    const f = $('.sja-fiches'); f.hidden = saldo === null
    f.innerHTML = INZETTEN.map(n => '<button type="button" class="sja-fiche' + (n === inzet ? ' gekozen' : '') + '" data-inzet="' + n + '"' + (bezig || saldo - n < MINIMUM ? ' disabled' : '') + '>' + n + '</button>').join('')
    for (const b of f.querySelectorAll('.sja-fiche')) b.onclick = () => { inzet = Number(b.dataset.inzet); teken() }
    $('.sja-nu').innerHTML = kaartSvg(ronde.kaart); $('.sja-nu').setAttribute('aria-label', kaartNaam(ronde.kaart))
    $('.sja-volgende').innerHTML = ronde.klaar ? kaartSvg(ronde.volgende) : achterkantSvg()
    $('[data-naam=hoger]').textContent = ronde.klaar ? T('Nieuwe kaart') : T('⬆ Hoger')
    $('[data-naam=lager]').textContent = T('⬇ Lager'); $('[data-naam=lager]').hidden = ronde.klaar
    for (const b of doos.querySelectorAll('.sja-knop')) b.disabled = bezig && b.dataset.naam !== 'uitleg'
  }
  async function kies(keuze) {
    if (bezig || ronde.klaar) return
    bezig = true; teken()
    pot = null
    if (saldo !== null) {
      try { pot = await casino.zetIn(inzet); saldo = pot.saldo }
      catch (e) { bezig = false; melding(T('Inzetten lukt nu niet. Speel zonder tokens of probeer het zo nog eens.')); kaartGeluid.nee(); teken(); return }
    }
    ronde = R.raad(ronde, keuze)
    teken()
    $('.sja-volgende').animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 260 })
    kaartGeluid.deel()
    await wacht(260)
    if (pot) { casino.uitslag(pot.runId, ronde.uitslag).catch(() => {}); saldo += pot.inzet + verschil(pot.inzet, ronde.uitslag) }
    const v = pot ? verschil(pot.inzet, ronde.uitslag) : 0
    if (ronde.uitslag === 'winst') { melding(pot ? T('Goed geraden! +{n}', { n: v }) : T('Goed geraden!')); kaartGeluid.win(); tril([30, 40, 30]) }
    else if (ronde.uitslag === 'gelijk') { melding(T('Dezelfde waarde: je inzet terug')); kaartGeluid.speciaal() }
    else { melding(T('Helaas, mis.')); kaartGeluid.verlies() }
    try { window.fibroSoloUitslag?.(ronde.uitslag) } catch (e) {}   // het scorebord (spel.html)
    bezig = false; teken()
  }
  function nieuw() { if (bezig) return; ronde = R.nieuweRonde(); melding(T('Is de volgende kaart hoger of lager?')); kaartGeluid.schud(); teken() }
  function toonRegels() {
    doos.querySelector('.sja-regels')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze sja-regels'
    d.innerHTML = '<div class="kt-keuzekaart" role="dialog" aria-modal="true" style="max-width:420px;text-align:left"><div style="font-weight:800;font-size:17px;margin-bottom:8px">'
      + esc(T('Spelregels')) + '</div><ul style="margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px">' + REGELS.map(t => '<li>' + esc(T(t)) + '</li>').join('')
      + '</ul><button type="button" class="kt-knop kt-nadruk">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    doos.appendChild(d)
  }
  $('[data-naam=hoger]').onclick = () => (ronde.klaar ? nieuw() : kies('hoger'))
  $('[data-naam=lager]').onclick = () => kies('lager')
  $('[data-naam=uitleg]').onclick = toonRegels
  melding(T('Is de volgende kaart hoger of lager?'))
  teken()
  // Tokens? (alleen met internet, een account en als het spel in CASINO_SPELLEN staat)
  ;(async () => {
    let ov = null
    try { ov = casino ? await casino.overzicht() : null } catch (e) {}
    if (ov && doos.isConnected) { saldo = ov.saldo; teken() }
  })()
}
