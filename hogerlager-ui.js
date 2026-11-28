// hogerlager-ui.js - Hoger of lager (v2, 28 nov 2026, Marcel; spellen/hogerlager.md), gemaakt uit sjabloon-automaat-ui.js.
// De regels staan in hogerlager.js.
//
// In gewone woorden: je ziet een kaart; tik ⬆ Hoger of ⬇ Lager. De volgende kaart draait om. Daarna "Nieuwe kaart".
//  - Met tokens (18+): kies 10, 25, 50 of 100; goed geraden = 2× terug, dezelfde waarde = je inzet terug (casino.js).
//  - Zonder tokens (onder de 18, zonder internet of account) speel je gewoon voor de lol.
//  - Twee manieren: als spel (start(), in #spelInhoud van spel.html) en als wachtspelletje in een kleiner vak
//    (maakHogerLager(host, { casino }), wachtspellen.js).
import * as R from './hogerlager.js?v=1'
import { kaartSvg, achterkantSvg, kaartNaam, zetStijl as zetKaartStijl, kaartGeluid, tril } from './kaartspel-hulp.js?v=23'
import { INZETTEN, MINIMUM, verschil } from './casino.js?v=4'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Hoger of lager': 'Higher or lower', '⬆ Hoger': '⬆ Higher', '⬇ Lager': '⬇ Lower', 'Nieuwe kaart': 'New card',
  'Met tokens': 'With tokens', 'Zonder tokens': 'Without tokens', 'Inzet': 'Bet', 'Is de volgende kaart hoger of lager?': 'Is the next card higher or lower?',
  'Goed geraden!': 'Well guessed!', 'Goed geraden! +{n}': 'Well guessed! +{n}', 'Dezelfde waarde: je inzet terug': 'Same value: your bet back',
  'Dezelfde waarde!': 'Same value!', 'Helaas, mis.': 'Too bad, wrong.',
  'Inzetten lukt nu niet. Speel zonder tokens of probeer het zo nog eens.': 'Betting does not work right now. Play without tokens or try again in a moment.',
  'Spelregels van Hoger of lager': 'Higher or lower rules', 'Spelregels': 'Rules', 'Terug': 'Back',
  'Je ziet een kaart. Raad of de volgende hoger of lager is (aas is het hoogst, 2 het laagst).': 'You see a card. Guess whether the next one is higher or lower (ace is highest, 2 lowest).',
  'Goed geraden = gewonnen. Dezelfde waarde = gelijk. Fout = verloren.': 'Guessed right = you win. Same value = a draw. Wrong = you lose.',
  'Met tokens (18+) krijg je bij winst je inzet dubbel terug, en bij dezelfde waarde je inzet terug.': 'With tokens (18+) you get double your bet back when you win, and your bet back on the same value.',
})
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const wacht = ms => new Promise(k => setTimeout(k, ms))

function zetStijl() {
  if (document.getElementById('hl-css')) return
  const s = document.createElement('style'); s.id = 'hl-css'
  s.textContent = `.hl{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;color:#fff;text-align:center}
.hl.vol{position:absolute;inset:0;gap:14px;padding:70px 14px 20px;overflow:auto;background:radial-gradient(ellipse at 50% 30%,#2a1248,#1a0a2e 70%)}
.hl-balk{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.hl-saldo{font-size:20px;font-weight:900;color:#fde68a;font-variant-numeric:tabular-nums}
.hl-saldo.min{color:#ff8fa3}
.hl-wissel{padding:5px 10px;border-radius:999px;border:1px solid #c084fc88;background:transparent;color:#c084fc;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.hl-wissel[hidden],.hl-fiches[hidden],.hl-knop[hidden]{display:none}
.hl-fiches{display:flex;gap:8px;justify-content:center}
.hl-fiche{width:44px;height:44px;border-radius:50%;border:3px dashed #ffffffaa;background:#8b3fd1;color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #4c1d7a}
.hl-fiche:nth-child(2){background:#0f9f6e}.hl-fiche:nth-child(3){background:#d1453f}.hl-fiche:nth-child(4){background:#1f1f2e}
.hl-fiche.gekozen{outline:3px solid #facc15;outline-offset:2px}.hl-fiche:disabled{opacity:.3;cursor:not-allowed}
.hl-kaarten{display:flex;gap:14px;justify-content:center}.hl-kaarten span{display:block;width:84px}
.hl.vol .hl-kaarten span{width:110px}
.hl-kaarten svg,.hl-kaarten img{display:block;width:100%;height:auto}
.hl-melding{min-height:22px;font-weight:800;font-size:15px}
.hl-knoppen{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.hl.vol .hl-knoppen{margin-top:auto}
.hl-knop{padding:12px 18px;border-radius:14px;border:1px solid #c084fc88;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.hl-knop.licht{background:#ffffff14}.hl-knop:disabled{opacity:.4;cursor:not-allowed}
.hl-regels{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:10px;background:#1a0a2ee6;border-radius:16px}
.hl-regels>div{max-width:420px;max-height:100%;overflow:auto;text-align:left;padding:14px 16px;border:1px solid #c084fc88;border-radius:16px;background:#2a1248}
.hl-regels ul{margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px}`
  document.head.append(s)
}

// Hoger of lager in host. casino = maakCasino({ spel: 'hogerlager' }) of null (dan zonder tokens).
//   opUitslag('winst' | 'gelijk' | 'verlies') na elke ronde (het scorebord). Geeft { el }.
export function maakHogerLager(host, { casino = null, vol = false, opUitslag = () => {} } = {}) {
  zetKaartStijl(); zetStijl()
  let saldo = null, metTokens = false, bezig = false, ronde = R.nieuweRonde()
  let inzet = (() => { try { const n = Number(localStorage.getItem('fibro_hogerlager_inzet')); return INZETTEN.includes(n) ? n : 10 } catch (e) { return 10 } })()

  const doos = document.createElement('div'); doos.className = 'hl' + (vol ? ' vol' : '')
  doos.innerHTML = '<div class="hl-balk"><span class="hl-saldo"></span><button type="button" class="hl-wissel" hidden></button></div><div class="hl-fiches" hidden></div>'
    + '<div class="hl-kaarten"><span class="hl-nu"></span><span class="hl-volgende"></span></div><div class="hl-melding" aria-live="polite"></div>'
    + '<div class="hl-knoppen"><button type="button" class="hl-knop" data-naam="hoger"></button><button type="button" class="hl-knop" data-naam="lager"></button>'
    + '<button type="button" class="hl-knop licht" data-naam="uitleg" aria-label="' + esc(T('Spelregels')) + '">❓</button></div>'
  const $ = s => doos.querySelector(s)
  const melding = t => { $('.hl-melding').textContent = t }

  function teken() {
    const s = $('.hl-saldo')
    s.textContent = metTokens ? '🪙 ' + saldo : casino ? T('Zonder tokens') : ''   // onder de 18 niets over tokens
    s.classList.toggle('min', metTokens && saldo < 0)
    const w = $('.hl-wissel'); w.hidden = saldo === null; w.textContent = metTokens ? T('Zonder tokens') : T('Met tokens'); w.disabled = bezig
    const f = $('.hl-fiches'); f.hidden = !metTokens
    f.innerHTML = INZETTEN.map(n => '<button type="button" class="hl-fiche' + (n === inzet ? ' gekozen' : '') + '" data-inzet="' + n + '"' + (bezig || saldo - n < MINIMUM ? ' disabled' : '') + ' aria-label="' + esc(T('Inzet') + ' ' + n) + '">' + n + '</button>').join('')
    for (const b of f.querySelectorAll('.hl-fiche')) b.onclick = () => { inzet = Number(b.dataset.inzet); try { localStorage.setItem('fibro_hogerlager_inzet', String(inzet)) } catch (e) {} ; teken() }
    $('.hl-nu').innerHTML = kaartSvg(ronde.kaart); $('.hl-nu').setAttribute('aria-label', kaartNaam(ronde.kaart))
    $('.hl-volgende').innerHTML = ronde.klaar ? kaartSvg(ronde.volgende) : achterkantSvg()
    $('.hl-volgende').setAttribute('aria-label', ronde.klaar ? kaartNaam(ronde.volgende) : '?')
    $('[data-naam=hoger]').textContent = ronde.klaar ? T('Nieuwe kaart') : T('⬆ Hoger')
    $('[data-naam=lager]').textContent = T('⬇ Lager'); $('[data-naam=lager]').hidden = ronde.klaar
    for (const b of doos.querySelectorAll('.hl-knop')) b.disabled = bezig && b.dataset.naam !== 'uitleg'
    if (!ronde.klaar && metTokens && saldo - inzet < MINIMUM) { $('[data-naam=hoger]').disabled = true; $('[data-naam=lager]').disabled = true }
  }
  async function kies(keuze) {
    if (bezig || ronde.klaar) return
    bezig = true; teken()
    let pot = null
    if (metTokens) {
      try { pot = await casino.zetIn(inzet); saldo = pot.saldo }
      catch (e) { bezig = false; melding(T('Inzetten lukt nu niet. Speel zonder tokens of probeer het zo nog eens.')); kaartGeluid.nee(); teken(); return }
    }
    ronde = R.raad(ronde, keuze)
    teken()
    $('.hl-volgende').animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 260 })
    kaartGeluid.deel()
    await wacht(260)
    if (pot) { casino.uitslag(pot.runId, ronde.uitslag).catch(() => {}); saldo += pot.inzet + verschil(pot.inzet, ronde.uitslag) }
    const v = pot ? verschil(pot.inzet, ronde.uitslag) : 0
    if (ronde.uitslag === 'winst') { melding(pot ? T('Goed geraden! +{n}', { n: v }) : T('Goed geraden!')); kaartGeluid.win(); tril([30, 40, 30]) }
    else if (ronde.uitslag === 'gelijk') { melding(pot ? T('Dezelfde waarde: je inzet terug') : T('Dezelfde waarde!')); kaartGeluid.speciaal() }
    else { melding(T('Helaas, mis.')); kaartGeluid.verlies() }
    try { opUitslag(ronde.uitslag) } catch (e) {}
    bezig = false; teken()
  }
  function nieuw() { if (bezig) return; ronde = R.nieuweRonde(); melding(T('Is de volgende kaart hoger of lager?')); kaartGeluid.schud(); teken() }
  function toonRegels() {
    doos.querySelector('.hl-regels')?.remove()
    const lijst = ['Je ziet een kaart. Raad of de volgende hoger of lager is (aas is het hoogst, 2 het laagst).',
      'Goed geraden = gewonnen. Dezelfde waarde = gelijk. Fout = verloren.']
    if (casino) lijst.push('Met tokens (18+) krijg je bij winst je inzet dubbel terug, en bij dezelfde waarde je inzet terug.')   // onder de 18: niets over tokens
    const d = document.createElement('div'); d.className = 'hl-regels'
    d.innerHTML = '<div role="dialog" aria-modal="true"><div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels van Hoger of lager')) + '</div><ul>'
      + lijst.map(t => '<li>' + esc(T(t)) + '</li>').join('') + '</ul><button type="button" class="hl-knop">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    doos.appendChild(d)
  }
  $('[data-naam=hoger]').onclick = () => (ronde.klaar ? nieuw() : kies('hoger'))
  $('[data-naam=lager]').onclick = () => kies('lager')
  $('[data-naam=uitleg]').onclick = toonRegels
  $('.hl-wissel').onclick = () => { if (bezig || saldo === null) return; metTokens = !metTokens; teken() }
  host.replaceChildren(doos)
  melding(T('Is de volgende kaart hoger of lager?'))
  teken()
  // Tokens? (18+, internet, een account; anders gewoon voor de lol)
  ;(async () => {
    let ov = null
    try { ov = casino ? await casino.overzicht() : null } catch (e) {}
    if (!ov || !doos.isConnected) return
    saldo = ov.saldo
    if (!bezig) metTokens = true
    teken()
  })()
  return { el: doos }
}

// Als spel (spel.html): window.fibroCasino staat klaar als je 18+ bent (en anders null).
export function start() {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🃏 ' + T('Hoger of lager') // STUDIO-TITEL
  const casino = window.fibroCasino && window.fibroCasino.spel === 'hogerlager' ? window.fibroCasino : null
  maakHogerLager(inhoud, { casino, vol: true, opUitslag: u => window.fibroSoloUitslag?.(u) })
}
