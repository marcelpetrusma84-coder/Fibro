// videopoker-ui.js - Video Poker (Jacks or Better), een kaartspel uit Stekky Studio (v1, 27 nov 2026; spellen/videopoker.md).
// Je speelt alleen tegen de automaat (solo.js: zonderKanaal). De regels staan in videopoker.js.
//
// In gewone woorden: bovenin de uitbetalingstabel, daaronder je saldo en je inzet (10, 25, 50 of 100 tokens, of zonder
// tokens). Tik op "Deel": 5 kaarten. Tik de kaarten aan die je houdt (HOUDEN) en tik op "Ruil". De andere kaarten worden
// vervangen en je ziet meteen wat je wint (de regel in de tabel licht op).
//  - Met tokens deelt de SERVER (sql/videopoker.sql): hij schudt, ruilt en betaalt uit. Zo kan niemand een hand verzinnen.
//  - Zonder tokens (of zonder internet of account) deelt het toestel zelf, met dezelfde tabel.
//  - 💡 Tip zet de HOUDEN-vinkjes zoals een eenvoudige strategie het zou doen.
import * as V from './videopoker.js?v=2'
import { kaartSvg, achterkantSvg, kaartNaam, zetStijl as zetKaartStijl, kaartGeluid, tril } from './kaartspel-hulp.js?v=23'
import { supabase } from './supabase.js?v=95'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Video Poker': 'Video Poker', 'Deel': 'Deal', 'Ruil': 'Draw', 'HOUDEN': 'HOLD', '💡 Tip': '💡 Tip', 'Inzet': 'Bet',
  'Met tokens': 'With tokens', 'Zonder tokens': 'Without tokens', 'Saldo: 🪙 {n}': 'Balance: 🪙 {n}',
  'Tik op Deel om te beginnen.': 'Tap Deal to start.', 'Tik de kaarten aan die je wilt houden en tik op Ruil.': 'Tap the cards you want to hold, then tap Draw.',
  '{hand}! +{n}': '{hand}! +{n}', '{hand}: je inzet terug': '{hand}: your bet back', 'Geen winst': 'No win', 'Geen winst. Nog een keer?': 'No win. Again?',
  'Royal flush': 'Royal flush', 'Straight flush': 'Straight flush', 'Four of a kind': 'Four of a kind', 'Full house': 'Full house', 'Flush': 'Flush',
  'Straight': 'Straight', 'Three of a kind': 'Three of a kind', 'Twee paar': 'Two pair', 'Boeren of beter': 'Jacks or better',
  'Zoveel tokens heb je niet. Je kunt tot -100 staan.': "You don't have that many tokens. You can go down to -100.",
  'De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.': "The server isn't working right now. Play without tokens or try again in a moment.",
  'Je ronde van eerder: kies wat je houdt.': 'Your round from before: choose what to hold.',
  'Tokens kunnen alleen met internet en een account.': 'Tokens only work with internet and an account.',
  'Spelregels van Video Poker': 'Video Poker rules', 'Terug': 'Back',
  'Je kiest je inzet en tikt op Deel: je krijgt 5 kaarten.': 'Choose your bet and tap Deal: you get 5 cards.',
  'Tik de kaarten aan die je wilt houden. Tik op Ruil: de andere kaarten worden één keer vervangen.': 'Tap the cards you want to hold. Tap Draw: the other cards are replaced once.',
  'Je eindhand bepaalt wat je wint: de tabel bovenin, keer je inzet. Een paar boeren of hoger geeft je inzet terug; een paar tienen of lager niets.': 'Your final hand decides what you win: the table at the top, times your bet. A pair of jacks or higher gives your bet back; a pair of tens or lower nothing.',
  'Met tokens deelt de server de kaarten, zodat niemand valsspeelt. Zonder tokens speel je gewoon voor de lol.': 'With tokens the server deals the cards, so nobody can cheat. Without tokens you just play for fun.',
})
const REGELS = ['Je kiest je inzet en tikt op Deel: je krijgt 5 kaarten.',
  'Tik de kaarten aan die je wilt houden. Tik op Ruil: de andere kaarten worden één keer vervangen.',
  'Je eindhand bepaalt wat je wint: de tabel bovenin, keer je inzet. Een paar boeren of hoger geeft je inzet terug; een paar tienen of lager niets.',
  'Met tokens deelt de server de kaarten, zodat niemand valsspeelt. Zonder tokens speel je gewoon voor de lol.']
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const getal = n => new Intl.NumberFormat(T.locale || 'nl-NL').format(n)

function zetStijl() {
  if (document.getElementById('vp-css')) return
  const s = document.createElement('style'); s.id = 'vp-css'
  s.textContent = `.vp{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:64px 12px 18px;overflow:auto;color:#fff;
  background:radial-gradient(ellipse at 50% 30%,#2a1248,#1a0a2e 70%)}
.vp-tabel{width:min(100%,380px);display:grid;grid-template-columns:1fr auto;gap:0 12px;padding:8px 12px;border:2px solid #facc15aa;border-radius:14px;background:#0b0418cc;font-size:13px;font-weight:700;color:#fde68a;box-shadow:0 0 20px #facc1522 inset}
.vp-tabel div{padding:2px 4px;border-radius:6px}
.vp-tabel .winst{background:#facc15;color:#1a0a2e}
.vp-balk{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:min(100%,380px)}
.vp-saldo{font-size:20px;font-weight:900;color:#fde68a;font-variant-numeric:tabular-nums}
.vp-saldo.min{color:#ff8fa3}
.vp-wissel{padding:5px 10px;border-radius:999px;border:1px solid #c084fc88;background:transparent;color:#c084fc;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.vp-fiches{display:flex;gap:8px}
.vp-fiches[hidden],.vp-wissel[hidden]{display:none}
.vp-fiche{width:46px;height:46px;border-radius:50%;border:3px dashed #ffffffaa;background:#8b3fd1;color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #4c1d7a}
.vp-fiche:nth-child(2){background:#0f9f6e}.vp-fiche:nth-child(3){background:#d1453f}.vp-fiche:nth-child(4){background:#1f1f2e}
.vp-fiche.gekozen{outline:3px solid #facc15;outline-offset:2px}
.vp-fiche:disabled{opacity:.3;cursor:not-allowed}
.vp-kaarten{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:min(100%,400px);margin-top:4px}
.vp-kaart{position:relative;padding:0;border:0;background:none;cursor:pointer;border-radius:8px;transition:transform .15s}
.vp-kaart svg,.vp-kaart img{display:block;width:100%;height:auto}
.vp-kaart.houd{transform:translateY(-8px)}
.vp-houd{position:absolute;left:50%;bottom:-20px;transform:translateX(-50%);font-size:11px;font-weight:900;color:#facc15;letter-spacing:.04em;opacity:0}
.vp-kaart.houd .vp-houd{opacity:1}
.vp-kaart.win{box-shadow:0 0 0 2px #facc15,0 0 16px #facc15b0}
.vp-melding{min-height:24px;margin-top:16px;text-align:center;font-weight:800;font-size:16px}
.vp-melding.goud{color:#fde68a;text-shadow:0 0 12px #facc1588}
.vp-knoppen{display:flex;gap:8px;margin-top:auto}
.vp-knop{padding:12px 18px;border-radius:14px;border:1px solid #c084fc88;background:#ffffff14;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.vp-knop.groot{min-width:130px;background:#8b3fd1;border-color:#c084fc;font-size:17px}
.vp-knop:disabled{opacity:.4;cursor:not-allowed}`
  document.head.append(s)
}

export function start() {
  zetKaartStijl(); zetStijl()
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🎰 ' + T('Video Poker')
  const casino = window.fibroCasino && window.fibroCasino.spel === 'videopoker' ? window.fibroCasino : null
  const server = V.maakVideoPokerServer({ supabase })

  let saldo = null              // null = geen tokens mogelijk (geen account, geen internet of geen SQL)
  let metTokens = false
  let inzet = (() => { try { const n = Number(localStorage.getItem('fibro_videopoker_inzet')); return V.INZETTEN.includes(n) ? n : 10 } catch (e) { return 10 } })()
  let fase = 'deel'             // 'deel' (klaar voor een nieuwe ronde), 'ruil' (kies wat je houdt), 'bezig'
  let ronde = null              // { kaarten, stapel? (zonder tokens), rondeId? (met tokens), inzet }
  let houd = [false, false, false, false, false]
  let uitslag = null

  const doos = document.createElement('div'); doos.className = 'vp'
  doos.innerHTML = '<div class="vp-tabel" role="table"></div><div class="vp-balk"><span class="vp-saldo"></span><button type="button" class="vp-wissel"></button></div>'
    + '<div class="vp-fiches"></div><div class="vp-kaarten"></div><div class="vp-melding" aria-live="polite"></div>'
    + '<div class="vp-knoppen"><button type="button" class="vp-knop" data-naam="tip"></button><button type="button" class="vp-knop groot" data-naam="hoofd"></button><button type="button" class="vp-knop" data-naam="uitleg">❓</button></div>'
  inhoud.replaceChildren(doos)
  const $ = s => doos.querySelector(s)
  const melding = (t, goud = false) => { $('.vp-melding').textContent = t; $('.vp-melding').classList.toggle('goud', goud) }

  function tekenTabel() {
    $('.vp-tabel').innerHTML = V.TABEL.map(r => {
      const w = uitslag && uitslag.hand === r.hand ? ' winst' : ''
      return '<div class="' + w + '">' + esc(T(r.naam)) + '</div><div class="' + w + '" style="text-align:right">' + (metTokens ? getal(r.maal * inzet) : r.maal + '×') + '</div>'
    }).join('')
  }
  function tekenBalk() {
    const s = $('.vp-saldo')
    s.textContent = metTokens ? '🪙 ' + getal(saldo) : T('Zonder tokens')
    s.classList.toggle('min', metTokens && saldo < 0)
    const w = $('.vp-wissel')
    w.hidden = saldo === null
    w.textContent = metTokens ? T('Zonder tokens') : T('Met tokens')
    w.disabled = fase !== 'deel'
    const f = $('.vp-fiches')
    f.hidden = !metTokens
    f.innerHTML = V.INZETTEN.map(n => '<button type="button" class="vp-fiche' + (n === inzet ? ' gekozen' : '') + '" data-inzet="' + n + '"' + (fase !== 'deel' || saldo - n < -100 ? ' disabled' : '') + ' aria-label="' + esc(T('Inzet') + ' ' + n) + '">' + n + '</button>').join('')
    for (const b of f.querySelectorAll('.vp-fiche')) b.onclick = () => { inzet = Number(b.dataset.inzet); try { localStorage.setItem('fibro_videopoker_inzet', String(inzet)) } catch (e) {} ; teken() }
  }
  function tekenKaarten() {
    const k = $('.vp-kaarten')
    const winKaarten = new Set(uitslag && uitslag.maal ? ronde.kaarten : [])
    k.innerHTML = (ronde ? ronde.kaarten : [null, null, null, null, null]).map((id, i) =>
      '<button type="button" class="vp-kaart' + (houd[i] && fase === 'ruil' ? ' houd' : '') + (winKaarten.has(id) ? ' win' : '') + '" data-i="' + i + '" data-id="' + (id || '') + '"'
      + ' aria-pressed="' + (houd[i] && fase === 'ruil') + '" aria-label="' + esc(id ? kaartNaam(id) : '') + '">' + (id ? kaartSvg(id) : achterkantSvg()) + '<span class="vp-houd">' + esc(T('HOUDEN')) + '</span></button>').join('')
    for (const b of k.querySelectorAll('.vp-kaart')) b.onclick = () => {
      if (fase !== 'ruil') return
      const i = Number(b.dataset.i); houd[i] = !houd[i]; kaartGeluid.tik(); tekenKaarten()
    }
  }
  function teken() {
    tekenTabel(); tekenBalk(); tekenKaarten()
    const hoofd = $('[data-naam=hoofd]')
    hoofd.textContent = fase === 'ruil' ? T('Ruil') : T('Deel')
    hoofd.disabled = fase === 'bezig' || (fase === 'deel' && metTokens && saldo - inzet < -100)
    $('[data-naam=tip]').textContent = T('💡 Tip')
    $('[data-naam=tip]').disabled = fase !== 'ruil'
  }

  async function deel() {
    if (fase !== 'deel') return
    fase = 'bezig'; uitslag = null; houd = [false, false, false, false, false]; melding(''); teken()
    try {
      if (metTokens) {
        const r = await server.deel(inzet)
        ronde = { kaarten: r.kaarten, rondeId: r.rondeId, inzet: r.inzet }
        inzet = r.inzet; saldo = r.saldo
        if (r.verder) melding(T('Je ronde van eerder: kies wat je houdt.'))
      } else ronde = { ...V.nieuweRonde(), inzet: 0 }
    } catch (e) {
      fase = 'deel'
      melding(e.reden === 'te-weinig' ? T('Zoveel tokens heb je niet. Je kunt tot -100 staan.') : T('De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.'))
      kaartGeluid.nee(); teken(); return
    }
    fase = 'ruil'
    teken()
    await omdraaien([0, 1, 2, 3, 4])
    if (!$('.vp-melding').textContent) melding(T('Tik de kaarten aan die je wilt houden en tik op Ruil.'))
  }
  async function omdraaien(plekken) {
    for (const i of plekken) {
      const el = $('.vp-kaart[data-i="' + i + '"]')
      el?.animate([{ transform: 'rotateY(90deg) scale(.9)' }, { transform: el.classList.contains('houd') ? 'translateY(-8px)' : 'none' }], { duration: 220, easing: 'ease-out' })
      kaartGeluid.deel()
      await wacht(90)
    }
  }
  async function ruil() {
    if (fase !== 'ruil' || !ronde) return
    fase = 'bezig'; teken()
    const nieuw = houd.map((h, i) => (h ? -1 : i)).filter(i => i >= 0)
    try {
      if (metTokens) {
        const r = await server.ruil(ronde.rondeId, houd)
        ronde = { ...ronde, kaarten: r.kaarten }
        uitslag = { ...r.uitslag, uitbetaling: r.uitbetaling }
        saldo = r.saldo
      } else {
        const r = V.ruil(ronde, houd)
        ronde = { ...ronde, kaarten: r.kaarten }
        uitslag = { ...r.uitslag, uitbetaling: 0 }
      }
    } catch (e) {
      fase = 'ruil'
      melding(T('De server doet het nu niet. Speel zonder tokens of probeer het zo nog eens.'))
      kaartGeluid.nee(); teken(); return
    }
    fase = 'deel'
    const gehouden = houd.slice()
    houd = gehouden   // voor het tekenen van de omhooggezette kaarten tijdens het omdraaien
    teken()
    await omdraaien(nieuw)
    houd = [false, false, false, false, false]
    teken()
    const naam = T(uitslag.naam)
    if (uitslag.maal >= 2) { melding(metTokens ? T('{hand}! +{n}', { hand: naam, n: getal(uitslag.uitbetaling) }) : naam + '!', true); kaartGeluid.win(); tril([30, 50, 30]) }
    else if (uitslag.maal === 1) { melding(metTokens ? T('{hand}: je inzet terug', { hand: naam }) : naam + '!', true); kaartGeluid.speciaal() }
    else { melding(T('Geen winst. Nog een keer?')); kaartGeluid.verlies() }
    try { window.fibroSoloUitslag?.(uitslag.maal > 0 ? 'winst' : 'verlies') } catch (e) {}   // het scorebord (spel.html)
  }
  function toonTip() {
    if (fase !== 'ruil' || !ronde) return
    houd = V.tip(ronde.kaarten); kaartGeluid.pop(); tekenKaarten()
  }
  function toonRegels() {
    doos.querySelector('.vp-regels')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze vp-regels'
    d.innerHTML = '<div class="kt-keuzekaart" role="dialog" aria-modal="true" style="max-width:440px;text-align:left;max-height:80vh;overflow:auto">'
      + '<div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels van Video Poker')) + '</div>'
      + '<ul style="margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px">' + REGELS.map(t => '<li>' + esc(T(t)) + '</li>').join('') + '</ul>'
      + '<button type="button" class="kt-knop kt-nadruk">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    doos.appendChild(d)
  }
  $('[data-naam=hoofd]').onclick = () => (fase === 'ruil' ? ruil() : deel())
  $('[data-naam=tip]').onclick = toonTip
  $('[data-naam=uitleg]').onclick = toonRegels
  $('.vp-wissel').onclick = () => { if (fase !== 'deel' || saldo === null) return; metTokens = !metTokens; uitslag = null; melding(''); teken() }

  teken()
  melding(T('Tik op Deel om te beginnen.'))
  // Tokens? (account, internet en de SQL op de server). Zonder: gewoon voor de lol.
  ;(async () => {
    let ov = null
    try { ov = casino ? await casino.overzicht() : null } catch (e) { ov = null }
    if (!ov || !doos.isConnected) return
    saldo = ov.saldo
    if (fase === 'deel' && !ronde) metTokens = true   // al zonder tokens begonnen: dan blijft dat zo (je kunt wisselen)
    teken()
  })()
}
