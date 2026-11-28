// fruitautomaat-ui.js - de Fruitautomaat (v2, 28 nov 2026, Marcel; spellen/fruitautomaat.md). De regels staan in
// fruitautomaat.js.
//
// In gewone woorden: drie rollen met kersen, citroenen, sinaasappels, druiven, bellen, sterren en de 7. Kies je inzet
// (10, 25, 50 of 100 tokens, of zonder tokens) en tik op Draai. De rollen stoppen één voor één; drie dezelfde wint.
//  - Met tokens draait de SERVER (sql/casino-volwassen.sql), want een prijs kan tot 200× je inzet zijn.
//  - Zonder tokens (onder de 18, zonder internet of account) draait het toestel zelf, met dezelfde tabel.
//  - Twee manieren: als spel (start(), in #spelInhoud van spel.html) en als wachtspelletje in een kleiner vak
//    (maakFruitautomaat(host, { casino, server }), wachtspellen.js).
import * as F from './fruitautomaat.js?v=1'
import { zetStijl as zetKaartStijl, kaartGeluid, tril } from './kaartspel-hulp.js?v=23'
import { supabase } from './supabase.js?v=95'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Fruitautomaat': 'Fruit machine', 'Draai': 'Spin', 'Met tokens': 'With tokens', 'Zonder tokens': 'Without tokens', 'Inzet': 'Bet',
  'Kers': 'Cherry', 'Citroen': 'Lemon', 'Sinaasappel': 'Orange', 'Druif': 'Grape', 'Bel': 'Bell', 'Ster': 'Star', 'Zeven': 'Seven',
  'Tik op Draai!': 'Tap Spin!', 'Drie keer {naam}! +{n}': 'Three {naam}! +{n}', 'Drie keer {naam}!': 'Three {naam}!',
  'Twee kersen! +{n}': 'Two cherries! +{n}', 'Twee kersen!': 'Two cherries!', 'Een kers: je inzet terug': 'A cherry: your bet back', 'Een kers!': 'A cherry!',
  'Niets. Nog een keer?': 'Nothing. Again?',
  'Zoveel tokens heb je niet. Je kunt tot -100 staan.': "You don't have that many tokens. You can go down to -100.",
  'De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.': "The server isn't working right now. Play without tokens or try again in a moment.",
  'Spelregels van de Fruitautomaat': 'Fruit machine rules', 'Terug': 'Back',
  'Tik op Draai: de drie rollen draaien en stoppen één voor één.': 'Tap Spin: the three reels spin and stop one by one.',
  'Drie dezelfde wint (× je inzet): 7 7 7 = 200, ⭐ = 60, 🔔 = 40, 🍇 = 20, 🍊 = 15, 🍋 = 12, 🍒 = 10.': 'Three of a kind wins (× your bet): 7 7 7 = 200, ⭐ = 60, 🔔 = 40, 🍇 = 20, 🍊 = 15, 🍋 = 12, 🍒 = 10.',
  'Twee kersen = 4×. Een kers op de eerste rol = je inzet terug.': 'Two cherries = 4×. A cherry on the first reel = your bet back.',
  'Eerlijk gezegd: ongeveer 1 op de 4 keer win je iets, en op de lange duur krijg je ongeveer {p} van elke 100 terug.': 'To be honest: about 1 in 4 spins wins something, and in the long run you get back about {p} of every 100.',
  'Met tokens (18+) draait de server de rollen, zodat niemand valsspeelt. Zonder tokens speel je gewoon voor de lol.': 'With tokens (18+) the server spins the reels, so nobody can cheat. Without tokens you just play for fun.',
  'Spelregels': 'Rules',
})
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const wacht = ms => new Promise(k => setTimeout(k, ms))
const getal = n => new Intl.NumberFormat(T.locale || 'nl-NL').format(n)

function zetStijl() {
  if (document.getElementById('fa-css')) return
  const s = document.createElement('style'); s.id = 'fa-css'
  s.textContent = `.fa{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;color:#fff;text-align:center}
.fa.vol{position:absolute;inset:0;padding:64px 12px 18px;overflow:auto;background:radial-gradient(ellipse at 50% 30%,#2a1248,#1a0a2e 70%)}
.fa-kast{width:min(100%,340px);padding:12px;border:3px solid #fde68a;border-radius:22px;background:linear-gradient(160deg,#3a1766,#1d0b34);box-shadow:0 0 24px #facc1533,inset 0 0 18px #0008}
.fa-rollen{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px;border-radius:14px;background:#fff}
.fa-rol{height:84px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:linear-gradient(#e9e4f5,#fff 30%,#fff 70%,#e9e4f5);font-size:48px;line-height:1;overflow:hidden}
.fa-rol .zeven{font-weight:900;color:#d1453f;font-size:54px;text-shadow:0 2px 0 #7a1d1a}
.fa-rol.draait span{animation:fa-wip .09s linear infinite}
.fa-rol.win{box-shadow:0 0 0 3px #facc15,0 0 14px #facc15}
@keyframes fa-wip{from{transform:translateY(-14px)}to{transform:translateY(14px)}}
.fa-vol .fa-rol{height:100px}
.fa-balk{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.fa-saldo{font-size:20px;font-weight:900;color:#fde68a;font-variant-numeric:tabular-nums}
.fa-saldo.min{color:#ff8fa3}
.fa-wissel{padding:5px 10px;border-radius:999px;border:1px solid #c084fc88;background:transparent;color:#c084fc;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.fa-wissel[hidden],.fa-fiches[hidden]{display:none}
.fa-fiches{display:flex;gap:8px;justify-content:center}
.fa-fiche{width:44px;height:44px;border-radius:50%;border:3px dashed #ffffffaa;background:#8b3fd1;color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #4c1d7a}
.fa-fiche:nth-child(2){background:#0f9f6e}.fa-fiche:nth-child(3){background:#d1453f}.fa-fiche:nth-child(4){background:#1f1f2e}
.fa-fiche.gekozen{outline:3px solid #facc15;outline-offset:2px}.fa-fiche:disabled{opacity:.3;cursor:not-allowed}
.fa-melding{min-height:22px;font-weight:800;font-size:15px}
.fa-melding.goud{color:#fde68a;text-shadow:0 0 12px #facc1588}
.fa-knoppen{display:flex;gap:8px;justify-content:center}
.fa-knop{padding:12px 18px;border-radius:14px;border:1px solid #c084fc88;background:#ffffff14;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.fa-knop.groot{min-width:130px;background:#8b3fd1;border-color:#c084fc;font-size:17px}
.fa-knop:disabled{opacity:.4;cursor:not-allowed}
.fa-regels{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:10px;background:#1a0a2ee6;border-radius:16px}
.fa-regels>div{max-width:420px;max-height:100%;overflow:auto;text-align:left;padding:14px 16px;border:1px solid #c084fc88;border-radius:16px;background:#2a1248}
.fa-regels ul{margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px}`
  document.head.append(s)
}
const plaatje = s => s === 'zeven' ? '<span class="zeven">7</span>' : '<span>' + F.PLAATJE[s] + '</span>'

// De Fruitautomaat in host. casino = maakCasino({ spel: 'fruitautomaat' }) of null (dan zonder tokens).
//   opUitslag('winst' | 'verlies') na elke draai (het scorebord). Geeft { el }.
export function maakFruitautomaat(host, { casino = null, server = casino ? F.maakFruitServer({ supabase }) : null, vol = false, opUitslag = () => {} } = {}) {
  zetKaartStijl(); zetStijl()
  let saldo = null, metTokens = false, bezig = false
  let inzet = (() => { try { const n = Number(localStorage.getItem('fibro_fruitautomaat_inzet')); return F.INZETTEN.includes(n) ? n : 10 } catch (e) { return 10 } })()
  let rollen = ['kers', 'bel', 'zeven']
  const doos = document.createElement('div'); doos.className = 'fa' + (vol ? ' vol fa-vol' : '')
  doos.innerHTML = '<div class="fa-balk"><span class="fa-saldo"></span><button type="button" class="fa-wissel" hidden></button></div>'
    + '<div class="fa-fiches" hidden></div><div class="fa-kast"><div class="fa-rollen">' + '<div class="fa-rol"></div>'.repeat(3) + '</div></div>'
    + '<div class="fa-melding" aria-live="polite"></div><div class="fa-knoppen"><button type="button" class="fa-knop groot" data-naam="draai"></button>'
    + '<button type="button" class="fa-knop" data-naam="uitleg" aria-label="' + esc(T('Spelregels')) + '">❓</button></div>'
  const $ = s => doos.querySelector(s)
  const melding = (t, goud = false) => { $('.fa-melding').textContent = t; $('.fa-melding').classList.toggle('goud', goud) }

  function tekenRollen(win = false) {
    doos.querySelectorAll('.fa-rol').forEach((el, i) => { el.innerHTML = plaatje(rollen[i]); el.classList.toggle('win', win); el.setAttribute('aria-label', T(F.NAAM[rollen[i]])) })
  }
  function teken() {
    const s = $('.fa-saldo')
    s.textContent = metTokens ? '🪙 ' + getal(saldo) : casino ? T('Zonder tokens') : ''   // onder de 18 niets over tokens
    s.classList.toggle('min', metTokens && saldo < 0)
    const w = $('.fa-wissel'); w.hidden = saldo === null; w.textContent = metTokens ? T('Zonder tokens') : T('Met tokens'); w.disabled = bezig
    const f = $('.fa-fiches'); f.hidden = !metTokens
    f.innerHTML = F.INZETTEN.map(n => '<button type="button" class="fa-fiche' + (n === inzet ? ' gekozen' : '') + '" data-inzet="' + n + '"' + (bezig || saldo - n < -100 ? ' disabled' : '') + ' aria-label="' + esc(T('Inzet') + ' ' + n) + '">' + n + '</button>').join('')
    for (const b of f.querySelectorAll('.fa-fiche')) b.onclick = () => { inzet = Number(b.dataset.inzet); try { localStorage.setItem('fibro_fruitautomaat_inzet', String(inzet)) } catch (e) {} ; teken() }
    const d = $('[data-naam=draai]'); d.textContent = '🎰 ' + T('Draai'); d.disabled = bezig || (metTokens && saldo - inzet < -100)
  }

  async function speel() {
    if (bezig) return
    bezig = true; melding(''); tekenRollen(); teken()
    const els = [...doos.querySelectorAll('.fa-rol')]
    let wip = true
    for (const el of els) el.classList.add('draait')
    kaartGeluid.schud()
    // tijdens het draaien wisselen de plaatjes
    ;(async () => { while (wip && doos.isConnected) { els.forEach(el => { if (el.classList.contains('draait')) el.innerHTML = plaatje(F.SYMBOLEN[Math.floor(Math.random() * 7)]) }); await wacht(90) } })()
    let uit
    try {
      uit = metTokens ? await server.draai(inzet) : { rollen: F.draai(), inzet: 0, uitbetaling: 0, saldo }
    } catch (e) {
      wip = false; els.forEach(el => el.classList.remove('draait')); bezig = false; tekenRollen(); teken()
      melding(e.reden === 'te-weinig' ? T('Zoveel tokens heb je niet. Je kunt tot -100 staan.') : T('De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.'))
      kaartGeluid.nee(); return
    }
    await wacht(500)
    rollen = uit.rollen
    for (let i = 0; i < 3; i++) {
      els[i].classList.remove('draait'); els[i].innerHTML = plaatje(rollen[i])
      els[i].animate([{ transform: 'translateY(-10px)' }, { transform: 'none' }], { duration: 160, easing: 'ease-out' })
      kaartGeluid.deel(); await wacht(320)
    }
    wip = false
    if (metTokens) saldo = uit.saldo
    const m = F.maal(rollen), plus = metTokens ? uit.uitbetaling - uit.inzet : 0
    tekenRollen(m > 0)
    if (m >= 10) { const naam = T(F.NAAM[rollen[0]]); melding(metTokens ? T('Drie keer {naam}! +{n}', { naam, n: getal(plus) }) : T('Drie keer {naam}!', { naam }), true); kaartGeluid.win(); tril([40, 60, 40, 60, 80]) }
    else if (m === F.TWEE_KERSEN) { melding(metTokens ? T('Twee kersen! +{n}', { n: getal(plus) }) : T('Twee kersen!'), true); kaartGeluid.win(); tril([30, 40, 30]) }
    else if (m === F.EERSTE_KERS) { melding(metTokens ? T('Een kers: je inzet terug') : T('Een kers!')); kaartGeluid.speciaal() }
    else { melding(T('Niets. Nog een keer?')); kaartGeluid.verlies() }
    try { opUitslag(m > 1 ? 'winst' : 'verlies') } catch (e) {}
    bezig = false; teken()
  }
  function toonRegels() {
    doos.querySelector('.fa-regels')?.remove()
    const p = Math.round(F.terugKans().terug * 100)
    const regels = ['Tik op Draai: de drie rollen draaien en stoppen één voor één.',
      'Drie dezelfde wint (× je inzet): 7 7 7 = 200, ⭐ = 60, 🔔 = 40, 🍇 = 20, 🍊 = 15, 🍋 = 12, 🍒 = 10.',
      'Twee kersen = 4×. Een kers op de eerste rol = je inzet terug.']
    const lijst = regels.map(t => T(t))
    if (casino) {   // onder de 18 is er geen casino en ook geen uitleg over tokens
      lijst.push(T('Eerlijk gezegd: ongeveer 1 op de 4 keer win je iets, en op de lange duur krijg je ongeveer {p} van elke 100 terug.', { p }))
      lijst.push(T('Met tokens (18+) draait de server de rollen, zodat niemand valsspeelt. Zonder tokens speel je gewoon voor de lol.'))
    }
    const d = document.createElement('div'); d.className = 'fa-regels'
    d.innerHTML = '<div role="dialog" aria-modal="true"><div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels van de Fruitautomaat')) + '</div><ul>'
      + lijst.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul><button type="button" class="fa-knop groot">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    doos.appendChild(d)
  }
  $('[data-naam=draai]').onclick = speel
  $('[data-naam=uitleg]').onclick = toonRegels
  $('.fa-wissel').onclick = () => { if (bezig || saldo === null) return; metTokens = !metTokens; melding(''); teken() }
  host.replaceChildren(doos)
  tekenRollen(); teken(); melding(T('Tik op Draai!'))
  // Tokens? (18+, account, internet en de SQL op de server). Zonder: gewoon voor de lol.
  ;(async () => {
    let ov = null
    try { ov = casino && server ? await casino.overzicht() : null } catch (e) { ov = null }
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
  if (titel) titel.textContent = '🍒 ' + T('Fruitautomaat')
  const casino = window.fibroCasino && window.fibroCasino.spel === 'fruitautomaat' ? window.fibroCasino : null
  maakFruitautomaat(inhoud, { casino, vol: true, opUitslag: u => window.fibroSoloUitslag?.(u) })
}
