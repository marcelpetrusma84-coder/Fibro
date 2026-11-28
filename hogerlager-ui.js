// hogerlager-ui.js - Hoger of lager (v3, 28 nov 2026, Marcel; spellen/hogerlager.md), gemaakt uit sjabloon-automaat-ui.js.
// De regels staan in hogerlager.js.
//
// In gewone woorden: je ziet een kaart; tik ⬆ Hoger of ⬇ Lager. Op de knop staat wat je wint (bijvoorbeeld 2,06×): hoe
// kleiner de kans, hoe meer. De volgende kaart draait om. Daarna "Nieuwe kaart". Dezelfde waarde = verloren.
//  - Met tokens (18+): kies 5, 10, 25, 50 of 100. De SERVER deelt en betaalt uit (sql/casino-volwassen.sql), want het
//    kan meer dan 2× zijn (v3: eerst altijd 2×, dat was te veel).
//  - Zonder tokens (onder de 18, zonder internet of account) speel je gewoon voor de lol, met dezelfde regels.
//  - Twee manieren: als spel (start(), in #spelInhoud van spel.html) en als wachtspelletje in een kleiner vak
//    (maakHogerLager(host, { casino }), wachtspellen.js).
import * as R from './hogerlager.js?v=2'
import { kaartSvg, achterkantSvg, kaartNaam, zetStijl as zetKaartStijl, kaartGeluid, tril } from './kaartspel-hulp.js?v=23'
import { INZETTEN, MINIMUM } from './casino.js?v=5'
import { supabase } from './supabase.js?v=95'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Hoger of lager': 'Higher or lower', '⬆ Hoger · {m}': '⬆ Higher · {m}', '⬇ Lager · {m}': '⬇ Lower · {m}', 'Nieuwe kaart': 'New card',
  'Met tokens': 'With tokens', 'Zonder tokens': 'Without tokens', 'Inzet': 'Bet', 'Is de volgende kaart hoger of lager?': 'Is the next card higher or lower?',
  'Goed geraden!': 'Well guessed!', 'Goed geraden! +{n}': 'Well guessed! +{n}', 'Dezelfde waarde: verloren.': 'Same value: you lose.',
  'Helaas, mis.': 'Too bad, wrong.', 'De kaarten worden geschud...': 'Shuffling the cards...',
  'Zoveel tokens heb je niet. Je kunt tot -100 staan.': "You don't have that many tokens. You can go down to -100.",
  'De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.': "The server isn't working right now. Play without tokens or try again in a moment.",
  'Spelregels van Hoger of lager': 'Higher or lower rules', 'Spelregels': 'Rules', 'Terug': 'Back',
  'Je ziet een kaart. Raad of de volgende hoger of lager is (aas is het hoogst, 2 het laagst).': 'You see a card. Guess whether the next one is higher or lower (ace is highest, 2 lowest).',
  'Goed geraden = gewonnen. Fout of dezelfde waarde = verloren.': 'Guessed right = you win. Wrong or the same value = you lose.',
  'Op de knop staat wat je wint: hoe kleiner de kans, hoe meer. Bij een 8 is het ongeveer 2×; bij een 3 "lager" meer dan 12×.': 'The button shows what you win: the smaller the chance, the more. At an 8 it is about 2×; at a 3 "lower" more than 12×.',
  'Eerlijk gezegd: welke keuze je ook maakt, op de lange duur krijg je ongeveer 97 van elke 100 terug.': 'To be honest: whatever you choose, in the long run you get back about 97 of every 100.',
  'Met tokens (18+) deelt de server de kaarten, zodat niemand valsspeelt. Zonder tokens speel je gewoon voor de lol.': 'With tokens (18+) the server deals the cards, so nobody can cheat. Without tokens you just play for fun.',
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
.hl-fiches{display:flex;gap:6px;justify-content:center}
.hl-fiche{width:44px;height:44px;padding:0;border-radius:50%;border:3px dashed #ffffffaa;background:#8b3fd1;color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #4c1d7a}
.hl-fiche[data-inzet='5']{background:#5b6b86}.hl-fiche[data-inzet='25']{background:#0f9f6e}.hl-fiche[data-inzet='50']{background:#d1453f}.hl-fiche[data-inzet='100']{background:#1f1f2e}
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
//   opUitslag('winst' | 'verlies') na elke ronde (het scorebord). Geeft { el }.
export function maakHogerLager(host, { casino = null, vol = false, opUitslag = () => {},
  server = casino ? R.maakHogerLagerServer({ supabase, inzetten: INZETTEN }) : null } = {}) {
  zetKaartStijl(); zetStijl()
  const locale = (window.T && window.T.locale) || 'nl-NL'
  let saldo = null, metTokens = false, bezig = false, ronde = R.nieuweRonde()   // ronde.rondeId = van de server
  let inzet = (() => { try { const n = Number(localStorage.getItem('fibro_hogerlager_inzet')); return INZETTEN.includes(n) ? n : 10 } catch (e) { return 10 } })()

  const doos = document.createElement('div'); doos.className = 'hl' + (vol ? ' vol' : '')
  doos.innerHTML = '<div class="hl-balk"><span class="hl-saldo"></span><button type="button" class="hl-wissel" hidden></button></div><div class="hl-fiches" hidden></div>'
    + '<div class="hl-kaarten"><span class="hl-nu"></span><span class="hl-volgende"></span></div><div class="hl-melding" aria-live="polite"></div>'
    + '<div class="hl-knoppen"><button type="button" class="hl-knop" data-naam="hoger"></button><button type="button" class="hl-knop" data-naam="lager"></button>'
    + '<button type="button" class="hl-knop licht" data-naam="uitleg" aria-label="' + esc(T('Spelregels')) + '">❓</button></div>'
  const $ = s => doos.querySelector(s)
  const melding = t => { $('.hl-melding').textContent = t }
  const fout = e => T(e && e.reden === 'te-weinig' ? 'Zoveel tokens heb je niet. Je kunt tot -100 staan.' : 'De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.')

  function teken() {
    const s = $('.hl-saldo')
    s.textContent = metTokens ? '🪙 ' + saldo : casino ? T('Zonder tokens') : ''   // onder de 18 niets over tokens
    s.classList.toggle('min', metTokens && saldo < 0)
    const w = $('.hl-wissel'); w.hidden = saldo === null; w.textContent = metTokens ? T('Zonder tokens') : T('Met tokens'); w.disabled = bezig
    // past je gekozen fiche niet meer (je zou onder -100 komen), dan de grootste die nog wel kan
    if (metTokens && saldo - inzet < MINIMUM) { const ok = INZETTEN.filter(n => saldo - n >= MINIMUM); if (ok.length) inzet = ok[ok.length - 1] }
    const f = $('.hl-fiches'); f.hidden = !metTokens
    f.innerHTML = INZETTEN.map(n => '<button type="button" class="hl-fiche' + (n === inzet ? ' gekozen' : '') + '" data-inzet="' + n + '"' + (bezig || saldo - n < MINIMUM ? ' disabled' : '') + ' aria-label="' + esc(T('Inzet') + ' ' + n) + '">' + n + '</button>').join('')
    for (const b of f.querySelectorAll('.hl-fiche')) b.onclick = () => { inzet = Number(b.dataset.inzet); try { localStorage.setItem('fibro_hogerlager_inzet', String(inzet)) } catch (e) {} ; teken() }
    $('.hl-nu').innerHTML = ronde.kaart ? kaartSvg(ronde.kaart) : achterkantSvg(); $('.hl-nu').setAttribute('aria-label', ronde.kaart ? kaartNaam(ronde.kaart) : '?')
    $('.hl-volgende').innerHTML = ronde.klaar ? kaartSvg(ronde.volgende) : achterkantSvg()
    $('.hl-volgende').setAttribute('aria-label', ronde.klaar ? kaartNaam(ronde.volgende) : '?')
    const h = $('[data-naam=hoger]'), l = $('[data-naam=lager]')
    const mh = ronde.kaart ? R.maal100(ronde.kaart, 'hoger') : 0, ml = ronde.kaart ? R.maal100(ronde.kaart, 'lager') : 0
    h.textContent = ronde.klaar ? T('Nieuwe kaart') : T('⬆ Hoger · {m}', { m: R.maalTekst(mh, locale) })
    l.textContent = T('⬇ Lager · {m}', { m: R.maalTekst(ml, locale) }); l.hidden = ronde.klaar
    for (const b of doos.querySelectorAll('.hl-knop')) b.disabled = bezig && b.dataset.naam !== 'uitleg'
    if (!ronde.klaar) {
      if (!mh || !ronde.kaart) h.disabled = true
      if (!ml || !ronde.kaart) l.disabled = true
      if (metTokens && saldo - inzet < MINIMUM) { h.disabled = true; l.disabled = true }
    }
  }
  // een nieuwe kaart: met tokens van de server (nog zonder inzet), anders op het toestel
  async function nieuw() {
    if (bezig) return
    bezig = true; melding(T('De kaarten worden geschud...')); kaartGeluid.schud()
    if (metTokens) {
      ronde = { kaart: null, klaar: false }; teken()
      try { const d = await server.deel(); ronde = { kaart: d.kaart, rondeId: d.rondeId, klaar: false } }
      catch (e) { metTokens = false; ronde = R.nieuweRonde(); bezig = false; melding(fout(e)); kaartGeluid.nee(); teken(); return }
    } else ronde = R.nieuweRonde()
    bezig = false; melding(T('Is de volgende kaart hoger of lager?')); teken()
  }
  async function kies(keuze) {
    if (bezig || ronde.klaar || !ronde.kaart || !R.maal100(ronde.kaart, keuze)) return
    bezig = true; teken()
    let plus = 0
    if (metTokens) {
      try {
        const r = await server.raad(ronde.rondeId, keuze, inzet)
        ronde = { ...ronde, volgende: r.volgende, klaar: true, keuze, uitslag: r.uitslag, gelijk: r.gelijk }
        saldo = r.saldo; plus = r.uitbetaling - r.inzet
      } catch (e) { bezig = false; melding(fout(e)); kaartGeluid.nee(); teken(); return }
    } else ronde = R.raad(ronde, keuze)
    teken()
    $('.hl-volgende').animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 260 })
    kaartGeluid.deel()
    await wacht(260)
    if (ronde.uitslag === 'winst') { melding(metTokens ? T('Goed geraden! +{n}', { n: plus }) : T('Goed geraden!')); kaartGeluid.win(); tril([30, 40, 30]) }
    else if (ronde.gelijk) { melding(T('Dezelfde waarde: verloren.')); kaartGeluid.verlies() }
    else { melding(T('Helaas, mis.')); kaartGeluid.verlies() }
    try { opUitslag(ronde.uitslag) } catch (e) {}
    bezig = false; teken()
  }
  function toonRegels() {
    doos.querySelector('.hl-regels')?.remove()
    const lijst = ['Je ziet een kaart. Raad of de volgende hoger of lager is (aas is het hoogst, 2 het laagst).',
      'Goed geraden = gewonnen. Fout of dezelfde waarde = verloren.',
      'Op de knop staat wat je wint: hoe kleiner de kans, hoe meer. Bij een 8 is het ongeveer 2×; bij een 3 "lager" meer dan 12×.']
    if (casino) lijst.push('Eerlijk gezegd: welke keuze je ook maakt, op de lange duur krijg je ongeveer 97 van elke 100 terug.',
      'Met tokens (18+) deelt de server de kaarten, zodat niemand valsspeelt. Zonder tokens speel je gewoon voor de lol.')   // onder de 18: niets over tokens
    const d = document.createElement('div'); d.className = 'hl-regels'
    d.innerHTML = '<div role="dialog" aria-modal="true"><div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels van Hoger of lager')) + '</div><ul>'
      + lijst.map(t => '<li>' + esc(T(t)) + '</li>').join('') + '</ul><button type="button" class="hl-knop">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    doos.appendChild(d)
  }
  $('[data-naam=hoger]').onclick = () => (ronde.klaar ? nieuw() : kies('hoger'))
  $('[data-naam=lager]').onclick = () => kies('lager')
  $('[data-naam=uitleg]').onclick = toonRegels
  $('.hl-wissel').onclick = () => { if (bezig || saldo === null) return; metTokens = !metTokens; nieuw() }
  host.replaceChildren(doos)
  melding(T('Is de volgende kaart hoger of lager?'))
  teken()
  // Tokens? (18+, internet, een account; anders gewoon voor de lol). Met tokens komt de kaart van de server.
  ;(async () => {
    let ov = null
    try { ov = casino && server ? await casino.overzicht() : null } catch (e) {}
    if (!ov || !doos.isConnected) return
    saldo = ov.saldo
    if (!bezig && !ronde.klaar) { metTokens = true; nieuw() } else teken()
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
