// pokertexasholdem-ui.js - Poker Texas Hold'em, een kaartspel uit Stekky Studio (v1, 27 nov 2026; spellen/pokertexasholdem.md).
// 2 tot 6 spelers via groepspel.js (één gastheer heeft de stand; lege zetels speelt de computer). Tegen de computer kies
// je eerst met hoeveel computers (1 tot 5) en daarna je inzet in casino-tokens (of zonder tokens). In de chat met z'n
// tweeën; met een groep komt start() met spelers en mijnZetel. Met een vriend of de groep altijd zonder tokens.
//
// In gewone woorden: de regels staan in pokertexasholdem.js, de tafel in kaartspel-hulp.js (BLAUWDRUK-KAARTSPEL.md).
// Midden op tafel: de pot, de blinds en de vijf tafelkaarten. Onderin je twee kaarten en de knoppen Fold, Check/Call,
// Raise (kies hoeveel) en All-in. Bovenin de anderen met hun fiches en wat ze deden. Na een hand zie je wie wat had en
// wie de pot krijgt; de gastheer deelt dan vanzelf de volgende hand.
import * as P from './pokertexasholdem.js?v=2'
import { maakKaartTafel, kaartSvg, kaartNaam, REACTIES } from './kaartspel-hulp.js?v=23'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'
import { maakGroepSpel } from './groepspel.js?v=2'
import { verschil, uitbetaling } from './casino.js?v=4'
import { benIkVolwassen } from './leeftijd.js?v=1'   // 28 nov 2026: onder de 18 niets over tokens
const volwassen = benIkVolwassen() !== false
import { wachtspelKnop } from './wachtspellen.js?v=1'   // 28 nov 2026: lig je eruit in de groep, dan snel een gokje

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  "Poker Texas Hold'em": "Poker Texas Hold'em", 'Hand {n}': 'Hand {n}', 'Blinds {a}/{b}': 'Blinds {a}/{b}', 'Pot {n}': 'Pot {n}',
  'Jij': 'You', 'Inzet {n}': 'Bet {n}', 'Je hebt: {hand}': 'You have: {hand}', '✖ Fold': '✖ Fold', '✔ Check': '✔ Check', 'Call {n}': 'Call {n}',
  '⬆ Raise': '⬆ Raise', '⬆ Bet': '⬆ Bet', 'All-in': 'All-in', 'Hoeveel?': 'How much?', 'Naar {n}': 'To {n}', 'Minimaal': 'Minimum', '½ pot': '½ pot', 'Pot': 'Pot',
  'All-in ({n})': 'All-in ({n})', 'Terug': 'Back', '{naam}: fold': '{naam}: fold', '{naam}: check': '{naam}: check', '{naam}: call {n}': '{naam}: call {n}',
  '{naam}: raise naar {n}': '{naam}: raise to {n}', '{naam}: bet {n}': '{naam}: bet {n}', '{naam}: all-in!': '{naam}: all-in!',
  'Jij wint {n}': 'You win {n}', '{naam} wint {n}': '{naam} wins {n}', 'met {hand}': 'with {hand}', 'Gedeelde pot': 'Split pot',
  'Je bent aan de beurt': "It's your turn", 'Je bent aan de beurt: {n} om mee te gaan': "Your turn: {n} to call", '{naam} is aan de beurt': "It's {naam}'s turn",
  'De computer denkt na...': 'The computer is thinking...', 'Wachten op {naam}...': 'Waiting for {naam}...', 'Je hebt gepast. Kijk mee!': 'You folded. Keep watching!',
  'Je bent all-in!': "You're all-in!", 'De volgende hand wordt gedeeld...': 'Dealing the next hand...', 'Wachten tot {naam} de volgende hand deelt...': 'Waiting for {naam} to deal the next hand...',
  'Je ligt eruit. Kijk nog even mee!': "You're out. Keep watching!", 'De kaarten worden geschud...': 'Shuffling the cards...',
  'Tegen hoeveel computers wil je spelen?': 'How many computer players?', 'Computer': 'Computer', 'Computer {n}': 'Computer {n}',
  '🎉 Jij wint de tafel!': '🎉 You win the table!', '😢 Je fiches zijn op': '😢 You are out of chips', '😢 {naam} wint de tafel!': '😢 {naam} wins the table!',
  'Na {n} handen': 'After {n} hands', 'Na 1 hand': 'After 1 hand', 'Het spel is gestopt.': 'The game has stopped.', '{naam} heeft het spel verlaten.': '{naam} has left the game.',
  'Spelregels van Poker': 'Poker rules', 'Fold': 'Fold', 'All-in!': 'All-in!', 'Dealer': 'Dealer',
  'Hoge kaart': 'High card', 'Eén paar': 'One pair', 'Twee paar': 'Two pair', 'Three of a kind': 'Three of a kind', 'Straight': 'Straight', 'Flush': 'Flush',
  'Full house': 'Full house', 'Four of a kind': 'Four of a kind', 'Straight flush': 'Straight flush', 'Royal flush': 'Royal flush',
  '+{n} tokens': '+{n} tokens', '−{n} tokens': '−{n} tokens', 'Saldo: 🪙 {n}': 'Balance: 🪙 {n}',
  'Iedereen begint met 1000 fiches. De blinds beginnen op 10/20 en gaan elke 10 handen omhoog. Wie als laatste fiches heeft, wint de tafel.': 'Everyone starts with 1000 chips. The blinds start at 10/20 and go up every 10 hands. Whoever has chips left last wins the table.',
  'Je krijgt 2 eigen kaarten. Er komen 5 kaarten open op tafel: eerst 3 (de flop), dan 1 (de turn) en nog 1 (de river). Na elke stap is er een inzetronde.': 'You get 2 cards of your own. 5 cards come face up on the table: first 3 (the flop), then 1 (the turn) and 1 more (the river). After each step there is a betting round.',
  'De speler links van de dealer (D) legt de small blind in, de speler daarnaast de big blind. Met z\'n tweeën is de dealer de small blind.': "The player left of the dealer (D) puts in the small blind, the next player the big blind. With two players the dealer is the small blind.",
  'Check: niets inzetten als er nog niets ligt. Call: meegaan. Raise: verhogen (minstens zoveel als de vorige verhoging). All-in: al je fiches. Fold: je kaarten weggooien.': 'Check: bet nothing when nothing has been bet. Call: match the bet. Raise: increase (at least as much as the last raise). All-in: all your chips. Fold: throw away your cards.',
  'Je maakt de beste vijf kaarten uit je 2 eigen kaarten en de 5 op tafel. Van hoog naar laag: royal flush, straight flush, four of a kind, full house, flush, straight, three of a kind, twee paar, één paar, hoge kaart.': 'You make the best five cards from your 2 cards and the 5 on the table. From high to low: royal flush, straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, one pair, high card.',
  'Blijft er één speler over, dan krijgt die de pot. Anders laat iedereen zijn kaarten zien en wint de beste hand. Gelijk = de pot delen. Wie all-in is, kan alleen winnen wat hij zelf inzette (zijpot).': 'If only one player is left, they get the pot. Otherwise everyone shows their cards and the best hand wins. Equal = split the pot. Whoever is all-in can only win what they put in themselves (side pot).',
  'Tegen de computer kun je casino-tokens inzetten. Win je de hele tafel, dan krijg je je inzet dubbel terug.': 'Against the computer you can bet casino tokens. Win the whole table and you get double your bet back.',
})
const REGELS = ['Iedereen begint met 1000 fiches. De blinds beginnen op 10/20 en gaan elke 10 handen omhoog. Wie als laatste fiches heeft, wint de tafel.',
  'Je krijgt 2 eigen kaarten. Er komen 5 kaarten open op tafel: eerst 3 (de flop), dan 1 (de turn) en nog 1 (de river). Na elke stap is er een inzetronde.',
  'De speler links van de dealer (D) legt de small blind in, de speler daarnaast de big blind. Met z\'n tweeën is de dealer de small blind.',
  'Check: niets inzetten als er nog niets ligt. Call: meegaan. Raise: verhogen (minstens zoveel als de vorige verhoging). All-in: al je fiches. Fold: je kaarten weggooien.',
  'Je maakt de beste vijf kaarten uit je 2 eigen kaarten en de 5 op tafel. Van hoog naar laag: royal flush, straight flush, four of a kind, full house, flush, straight, three of a kind, twee paar, één paar, hoge kaart.',
  'Blijft er één speler over, dan krijgt die de pot. Anders laat iedereen zijn kaarten zien en wint de beste hand. Gelijk = de pot delen. Wie all-in is, kan alleen winnen wat hij zelf inzette (zijpot).',
  'Tegen de computer kun je casino-tokens inzetten. Win je de hele tafel, dan krijg je je inzet dubbel terug.']
const BEURT_SECONDEN = 30
const VOLGENDE_MS = 4200
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const getal = n => new Intl.NumberFormat(T.locale || 'nl-NL').format(n)

function zetStijl() {
  if (document.getElementById('pk-css')) return
  const s = document.createElement('style'); s.id = 'pk-css'
  s.textContent = `.pk-midden{display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2;max-width:96vw}
.pk-pillen{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.pk-pil{padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:13px;white-space:nowrap;color:#fff}
.pk-pil.goud{color:#fde68a;border-color:#facc15aa}
.pk-pil.pot{font-size:15px;color:#fde68a;border-color:#facc15}
.pk-bord{display:flex;gap:clamp(4px,1.2vw,10px);justify-content:center}
.pk-kaart{width:clamp(50px,min(17.5vw,13vh),100px);aspect-ratio:5/7;border-radius:7%}   /* 28 nov 2026: groeit mee met het scherm (was 50px) */
.pk-kaart.leeg{border:2px dashed #ffffff33;background:#ffffff08}
.pk-kaart.winst{box-shadow:0 0 0 2px #facc15,0 0 14px #facc15b0}
.pk-uitslag{display:flex;flex-direction:column;gap:4px;width:min(92vw,360px);max-height:30vh;overflow:auto}
.pk-rij{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:3px 8px;border-radius:10px;background:#000a;font-size:12px;color:#fff}
.pk-rij.winst{background:#4c1d95cc;outline:1px solid #facc15}
.pk-rij .pk-mini{display:flex;gap:2px}.pk-rij .pk-mini span{display:block;width:24px}
.pk-naam{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.pk-plus{color:#fde68a;font-weight:800;font-variant-numeric:tabular-nums}`
  document.head.append(s)
}

// spelers/mijnZetel: met een groep (groepschat of Home); anders met z'n tweeën in de chat, of tegen de computer.
export function start({ spelKanaal, benIkSpeler1, vriendNaam, spelers: groep, mijnZetel, groepId = null }) {
  zetStijl()
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🎲 ' + T("Poker Texas Hold'em")
  const solo = Boolean(spelKanaal && spelKanaal.isSolo)
  const niveau = (spelKanaal && spelKanaal.niveau) || 'normaal'
  const casino = solo && window.fibroCasino && window.fibroCasino.spel === 'pokertexasholdem' ? window.fibroCasino : null
  let spelers, ik
  if (Array.isArray(groep) && groep.length >= 2) { spelers = groep.slice(0, P.MAX_SPELERS).map((s, i) => ({ zetel: i + 1, naam: s.naam, id: s.id, computer: Boolean(s.computer) })); ik = mijnZetel || 1 }
  else if (solo) { spelers = null; ik = 1 }        // eerst kiezen hoeveel computers
  else { ik = benIkSpeler1 ? 1 : 2; spelers = [{ zetel: 1, naam: benIkSpeler1 ? T('Jij') : (vriendNaam || T('vriend')) }, { zetel: 2, naam: benIkSpeler1 ? (vriendNaam || T('vriend')) : T('Jij') }] }
  const naamVan = z => z === ik ? T('Jij') : ((spelers || []).find(s => s.zetel === z) || {}).naam || '?'
  const isComputer = z => Boolean(((spelers || []).find(s => s.zetel === z) || {}).computer)

  let staat = null, spel = null
  let bezig = 0
  let rij = Promise.resolve()
  let pot = { inzet: 0 }          // casino-tokens van dit potje: { inzet, runId, saldo, uitslag }
  let kiest = false
  const geteld = new Set(), getoond = new Set()
  let klokVoor = ''
  let potjeNr = 0                // telt de potjes (de handen beginnen elk potje weer bij 1)

  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[poker]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: solo ? T('Computer') : (vriendNaam || T('vriend')),
    magSpelen: () => false, onSpeel() {}, onPak() {},
    onReactie: emoji => { if (!solo) spelKanaal.send({ type: 'broadcast', event: 'kaartreactie', payload: { emoji, zetel: ik } }) },
  })
  // 28 nov 2026 (Marcel): in de groep spelen de anderen door als jij eruit ligt. Dan een knop "🎰 Snel een gokje" met
  // Hoger of lager en de Fruitautomaat (wachtspellen.js); tokens alleen als iedereen in de groep 18+ is.
  const gokje = Array.isArray(groep) && groep.length > 2 ? wachtspelKnop(tafel.element, { groep: groepId }) : null
  const ligtEruit = s => Boolean(s) && s.fase !== 'klaar' && s.fiches[ik] === 0 && (s.fase === 'uitslag' || !mijnHand(s).length)
  const middenEl = document.createElement('div')
  middenEl.className = 'pk-midden'
  tafel.element.querySelector('.kt-midden').appendChild(middenEl)
  for (const e of tafel.element.querySelectorAll('.kt-stapel-groep, .kt-stapel, .kt-afleg')) e.style.display = 'none'

  // ── Wat de tafel laat zien ──
  const handKlaar = s => s && s.fase !== 'spel'
  const mijnHand = s => (s && s.handen[ik]) || []
  // tegen de computer is het voor jou voorbij als je fiches op zijn (de computers spelen dan niet verder)
  const voorbij = s => s && (s.fase === 'klaar' || (solo && s.fase === 'uitslag' && s.fiches[ik] === 0))
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.fase === 'klaar' || voorbij(s)) return ''
    if (s.fase === 'uitslag') return s.fiches[ik] === 0 ? T('Je ligt eruit. Kijk nog even mee!')
      : spel && spel.gastheer ? T('De volgende hand wordt gedeeld...') : T('Wachten tot {naam} de volgende hand deelt...', { naam: naamVan(1) })
    if (!mijnHand(s).length) return T('Je ligt eruit. Kijk nog even mee!')
    if (s.gepast[ik]) return T('Je hebt gepast. Kijk mee!')
    if (P.aanDeBeurt(s, ik)) { const b = P.teBetalen(s, ik); return b ? T('Je bent aan de beurt: {n} om mee te gaan', { n: getal(b) }) : T('Je bent aan de beurt') }
    if (s.fiches[ik] === 0) return T('Je bent all-in!')
    if (s.aanZet && isComputer(s.aanZet) && spelers.length === 2) return T('De computer denkt na...')
    return spelers && spelers.length > 2 ? T('{naam} is aan de beurt', { naam: naamVan(s.aanZet) }) : T('Wachten op {naam}...', { naam: naamVan(s.aanZet) })
  }
  function beeld(s, extra = {}) {
    return { hand: mijnHand(s), anderAantal: 0, stapelAantal: 0, afleg: [], mijnBeurt: false, speelbaar: [], status: statusTekst(s), ...extra }
  }
  // de anderen in de rondte, te beginnen na mij
  const anderen = s => P.zetels(s).map((_, i) => ((ik - 1 + i + 1) % s.n) + 1).filter(z => z !== ik)
  const actieTekst = (s, z) => {
    if (!s.handen[z].length) return s.fiches[z] > 0 ? '' : '✖'
    if (s.gepast[z]) return T('Fold')
    if (s.fiches[z] === 0 && s.fase === 'spel') return T('All-in!')
    return s.inzet[z] ? '· ' + getal(s.inzet[z]) : ''
  }
  function tekenTegenstanders(s) {
    tafel.tegenstanders(anderen(s).map(z => ({
      zetel: z, naam: (z === s.knop ? 'Ⓓ ' : '') + naamVan(z), icoon: isComputer(z) ? '🤖' : '',
      info: '💰 ' + getal(s.fiches[z]) + ' ' + actieTekst(s, z),
      beurt: s.fase === 'spel' && s.aanZet === z, uit: !s.handen[z].length || s.gepast[z] })))
  }
  const kaartHtml = (id, klas = '') => '<span class="pk-kaart ' + klas + '" data-id="' + id + '" aria-label="' + esc(kaartNaam(id)) + '">' + kaartSvg(id) + '</span>'
  function tekenMidden(s = staat, { verbergBord = 0 } = {}) {
    if (!s) { middenEl.innerHTML = ''; return }
    const u = handKlaar(s) ? s.uitslag : null
    const winKaarten = new Set()
    if (u && u.getoond) for (const p of u.potten) for (const z of p.winnaars) for (const k of (u.handen[z]?.kaarten || [])) winKaarten.add(k)
    const pil = (t, k = '') => '<span class="pk-pil ' + k + '">' + t + '</span>'
    const potNu = u ? u.potten.reduce((t, p) => t + p.bedrag, 0) : P.pot(s)
    const bordZicht = s.bord.slice(0, s.bord.length - verbergBord)
    const bord = Array.from({ length: 5 }, (_, i) => bordZicht[i] ? kaartHtml(bordZicht[i], winKaarten.has(bordZicht[i]) ? 'winst' : '') : '<span class="pk-kaart leeg"></span>').join('')
    const mijn = mijnHand(s)
    const ikInfo = [pil(T('Jij') + (ik === s.knop ? ' Ⓓ' : '') + ' 💰 ' + getal(s.fiches[ik]))]
    if (s.inzet[ik]) ikInfo.push(pil(T('Inzet {n}', { n: getal(s.inzet[ik]) })))
    if (mijn.length && !s.gepast[ik] && bordZicht.length) ikInfo.push(pil(T('Je hebt: {hand}', { hand: T(P.huidigeHand([...mijn, ...bordZicht])) }), 'goud'))
    if (pot.inzet) ikInfo.push(pil('🪙 ' + pot.inzet, 'goud'))
    let uitslagHtml = ''
    if (u && u.getoond) {
      const winnaars = new Set(u.potten.flatMap(p => p.winnaars))
      uitslagHtml = '<div class="pk-uitslag">' + Object.keys(u.handen).map(Number).sort((a, b) => (u.gewonnen[b] || 0) - (u.gewonnen[a] || 0)).map(z =>
        '<div class="pk-rij' + (winnaars.has(z) ? ' winst' : '') + '"><span class="pk-naam">' + esc(naamVan(z)) + ' · ' + esc(T(u.handen[z].naam)) + '</span>'
        + '<span class="pk-mini">' + s.handen[z].map(k => '<span>' + kaartSvg(k) + '</span>').join('') + '</span>'
        + '<span class="pk-plus">' + (u.gewonnen[z] ? '+' + getal(u.gewonnen[z]) : '') + '</span></div>').join('') + '</div>'
    }
    middenEl.innerHTML = '<div class="pk-pillen">' + pil(T('Hand {n}', { n: s.hand })) + pil(T('Blinds {a}/{b}', { a: s.blinds[0], b: s.blinds[1] }))
      + pil(T('Pot {n}', { n: getal(potNu) }), 'pot') + '</div>'
      + '<div class="pk-bord">' + bord + '</div>' + uitslagHtml
      + '<div class="pk-pillen">' + ikInfo.join('') + '</div>'
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); return }
    tafel.toon(beeld(staat))
    tekenTegenstanders(staat)
    const k = []
    if (P.aanDeBeurt(staat, ik)) {
      const b = P.teBetalen(staat, ik)
      k.push({ naam: 'fold', tekst: T('✖ Fold'), opKlik: () => doe({ soort: 'fold' }) })
      k.push(b ? { naam: 'call', tekst: T('Call {n}', { n: getal(b) }), nadruk: true, opKlik: () => doe({ soort: 'call' }) }
        : { naam: 'check', tekst: T('✔ Check'), nadruk: true, opKlik: () => doe({ soort: 'check' }) })
      if (P.magRaisen(staat, ik)) k.push({ naam: 'raise', tekst: staat.hoogste ? T('⬆ Raise') : T('⬆ Bet'), opKlik: kiesRaise })
    }
    k.push({ naam: 'uitleg', tekst: '❓', opKlik: toonRegels })
    tafel.knoppen(k)
    tekenMidden(staat)
    const klok = staat.fase !== 'spel' ? '' : staat.hand + ':' + staat.beurten + ':' + staat.aanZet
    if (klok !== klokVoor) {
      klokVoor = klok
      tafel.beurtKlok(staat.fase !== 'spel' ? null : staat.aanZet === ik ? 'ik' : 'zetel:' + staat.aanZet, BEURT_SECONDEN)
    }
  }
  function toonRegels() {
    tafel.element.querySelector('.pk-regels')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze pk-regels'
    d.innerHTML = '<div class="kt-keuzekaart" role="dialog" aria-modal="true" style="max-width:440px;text-align:left;max-height:80vh;overflow:auto">'
      + '<div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels van Poker')) + '</div>'
      + '<ul style="margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px">' + REGELS.filter(t => volwassen || !/tokens/.test(t)).map(t => '<li>' + esc(T(t)) + '</li>').join('') + '</ul>'
      + '<button type="button" class="kt-knop kt-nadruk">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    tafel.element.appendChild(d)
  }

  // ── Jij speelt ──
  function doe(stap) {
    if (bezig || !spel || !P.aanDeBeurt(staat, ik)) return
    if (spel.doe(stap)) tafel.knoppen([])
  }
  // Raise: kies hoeveel (minimaal, ½ pot, pot, 2× pot, all-in)
  async function kiesRaise() {
    if (bezig || !P.magRaisen(staat, ik)) return
    const s = staat, min = P.minRaiseTot(s, ik), max = P.maxRaiseTot(s, ik), potNu = P.pot(s) + P.teBetalen(s, ik)
    const opties = [[T('Minimaal'), min], [T('½ pot'), s.hoogste + Math.round(potNu / 2)], [T('Pot'), s.hoogste + potNu], ['2× ' + T('Pot'), s.hoogste + 2 * potNu]]
    const gezien = new Set(), keuzes = []
    for (const [naam, tot] of opties) {
      if (tot < min || tot >= max || gezien.has(tot)) continue
      gezien.add(tot); keuzes.push({ html: esc(naam) + '<br><b>' + getal(tot) + '</b>', waarde: tot, label: naam + ' ' + tot })
    }
    keuzes.push({ html: esc(T('All-in ({n})', { n: getal(max) })), waarde: 'allin', label: T('All-in ({n})', { n: max }) })
    keuzes.push({ html: '✕', waarde: null, label: T('Terug') })
    const k = await tafel.kiesUit(staat.hoogste ? T('⬆ Raise') : T('⬆ Bet'), keuzes)
    if (k === 'allin') doe({ soort: 'allin' })
    else if (Number.isInteger(k)) doe({ soort: 'raise', tot: k })
  }

  // ── Een nieuwe stand (van jezelf, de gastheer of de computer) ──
  function actieEffect(l) {
    const naam = naamVan(l.wie)
    const t = l.soort === 'fold' ? T('{naam}: fold', { naam }) : l.soort === 'check' ? T('{naam}: check', { naam })
      : l.soort === 'call' ? T('{naam}: call {n}', { naam, n: getal(l.bedrag) }) : l.soort === 'bet' ? T('{naam}: bet {n}', { naam, n: getal(l.tot) })
      : l.soort === 'raise' ? T('{naam}: raise naar {n}', { naam, n: getal(l.tot) }) : l.soort === 'allin' ? T('{naam}: all-in!', { naam }) : ''
    if (t) tafel.effect(t, { gloed: l.soort === 'allin', geluid: l.soort === 'allin' || l.soort === 'raise' })
  }
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    const nieuweHand = !oud || oud.hand !== nieuw.hand
    if (nieuweHand) {
      tafel.sluitEinde()
      tafel.toon(beeld(nieuw, { hand: [], status: '' }))
      tekenTegenstanders(nieuw)
      tekenMidden(nieuw, { verbergBord: nieuw.bord.length })
      await tafel.deelAnimatie({ mijnKaarten: mijnHand(nieuw), anderAantal: 0, open: null })
    } else if (l.wie && l.wie !== ik && l.soort) {
      tekenTegenstanders(nieuw)
      actieEffect(l)
      if (l.soort === 'allin') tafel.tril(25)
      await wacht(l.soort === 'fold' || l.soort === 'check' ? 380 : 560)
    }
    // nieuwe tafelkaarten: één voor één omdraaien
    const voor = nieuweHand ? 0 : oud.bord.length
    if (nieuw.bord.length > voor) {
      tafel.toon(beeld(nieuw, { status: '' }))
      for (let i = voor; i < nieuw.bord.length; i++) {
        tekenMidden(nieuw, { verbergBord: nieuw.bord.length - i - 1 })
        const el = middenEl.querySelector('.pk-kaart[data-id="' + nieuw.bord[i] + '"]')
        el?.animate([{ transform: 'rotateY(90deg) scale(.8)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 320 })
        tafel.geluid.deel?.()
        await wacht(i >= 3 || nieuw.bord.length - voor > 1 ? 380 : 300)
      }
    }
    if (handKlaar(nieuw)) await handUitslag(nieuw)
  }
  // Einde van een hand: wie krijgt de pot (en met welke hand)
  async function handUitslag(s) {
    const sleutel = potjeNr + ':' + s.hand
    if (getoond.has(sleutel)) return
    getoond.add(sleutel)
    tafel.beurtKlok(null)
    tafel.toon(beeld(s, { status: '' }))
    tekenTegenstanders(s)
    tekenMidden(s)
    const u = s.uitslag
    for (const p of u.potten) {
      const wie = p.winnaars
      const hand = u.getoond && p.hand ? ' ' + T('met {hand}', { hand: T(p.hand) }) : ''
      const tekst = wie.length > 1 ? T('Gedeelde pot') + ': ' + wie.map(naamVan).join(', ') + hand
        : wie[0] === ik ? T('Jij wint {n}', { n: getal(p.bedrag) }) + hand : T('{naam} wint {n}', { naam: naamVan(wie[0]), n: getal(p.bedrag) }) + hand
      tafel.effect(tekst, { gloed: wie.includes(ik) })
      if (wie.includes(ik)) tafel.tril([30, 40, 30])
      await wacht(1100)
    }
    if (s.fiches[ik] === 0 && mijnHand(s).length) { meldGeslagen('ik', 1, { geluid: false }); tafel.tril([40, 60, 40]) }
  }
  function controleerEinde() {
    if (!voorbij(staat)) return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(potjeNr)) {
      geteld.add(potjeNr)
      if (casino && pot.inzet && pot.runId && !pot.uitslag) {
        pot.uitslag = gewonnen ? 'winst' : 'verlies'
        casino.uitslag(pot.runId, pot.uitslag).catch(() => {})
      }
    }
    let tokens = ''
    if (pot.inzet && pot.uitslag) {
      const v = verschil(pot.inzet, pot.uitslag)
      tokens = '  ·  ' + (v > 0 ? T('+{n} tokens', { n: v }) : T('−{n} tokens', { n: -v })) + '  ·  ' + T('Saldo: 🪙 {n}', { n: pot.saldo + uitbetaling(pot.inzet, pot.uitslag) })
    }
    const sub = (staat.hand === 1 ? T('Na 1 hand') : T('Na {n} handen', { n: staat.hand })) + '  ·  ' + P.zetels(staat).map(z => naamVan(z) + ' ' + getal(staat.fiches[z])).join(' · ') + tokens
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint de tafel!') : staat.fiches[ik] === 0 ? T('😢 Je fiches zijn op') : T('😢 {naam} wint de tafel!', { naam: naamVan(staat.winnaar) }),
      sub, opnieuw: spel && spel.gastheer ? nieuwSpelStarten : null })
  }
  function naStand(oud) {
    teken()
    gokje?.zichtbaar(ligtEruit(staat) && !voorbij(staat))
    if (voorbij(staat)) controleerEinde()
    else if (P.aanDeBeurt(staat, ik) && (!oud || !P.aanDeBeurt(oud, ik) || oud.hand !== staat.hand)) { tafel.geluid.beurt(); tafel.tril(15) }
  }

  spelKanaal.on('broadcast', { event: 'kaartreactie' }, msg => {
    const e = msg.payload && msg.payload.emoji, z = Number(msg.payload && msg.payload.zetel)
    if (REACTIES.includes(e)) tafel.reactie(e, z ? 'zetel:' + z : 'ander')
  })

  async function nieuwSpelStarten() {
    if (!spel || !spel.gastheer || kiest) return
    if (casino) {
      kiest = true
      tafel.sluitEinde()
      try { pot = await casino.kiesInzet(tafel.element, { T }) } catch (e) { pot = { inzet: 0 } } finally { kiest = false }
      if (!tafel.element.isConnected) return
    }
    const knop = staat ? staat.knop : spelers.length      // de dealer schuift per potje één plek op
    spel.start(P.nieuwSpel({ spelers: spelers.length, knop }))
  }
  function begin() {
    spel = maakGroepSpel({ kanaal: spelKanaal, zetel: ik, spelers, niveau, beurtMs: BEURT_SECONDEN * 1000, rondePauze: VOLGENDE_MS,
      denkMs: () => 700 + Math.floor(Math.random() * 900),
      regels: { aanZet: s => (s && s.fase === 'spel' ? s.aanZet : 0), doeStap: P.doeStap, computerStap: P.computerStap, geldigeStand: P.geldigeStand,
        // tegen de computer: zijn je fiches op, dan geen nieuwe hand meer (het potje is voor jou voorbij)
        volgendeRonde: s => (s && s.fase === 'uitslag' && !voorbij(s) ? P.volgendeRonde(s) : null) },
      onStand: (oud, nieuw) => { if (!oud || nieuw.hand < oud.hand) potjeNr++; staat = nieuw; inRij(async () => { await verwerk(oud, nieuw); naStand(oud) }) },
      onGastheerWeg: () => { tafel.beurtKlok(null); tafel.knoppen([]); tafel.einde({ gewonnen: false, titel: T('Het spel is gestopt.'), sub: T('{naam} heeft het spel verlaten.', { naam: naamVan(1) }) }) } })
    const weg = setInterval(() => { if (!tafel.element.isConnected) { clearInterval(weg); spel.stop() } }, 1000)
    teken()
    if (spel.gastheer) nieuwSpelStarten()
  }
  if (spelers) begin()
  else {
    // tegen de computer: eerst kiezen met hoeveel computers
    tafel.status('')
    tafel.kiesUit(T('Tegen hoeveel computers wil je spelen?'), [1, 2, 3, 4, 5].map(n => ({ html: String(n), waarde: n, label: String(n) }))).then(n => {
      spelers = [{ zetel: 1, naam: T('Jij') }, ...Array.from({ length: n }, (_, i) => ({ zetel: i + 2, naam: n === 1 ? T('Computer') : T('Computer {n}', { n: i + 1 }), computer: true }))]
      begin()
    })
  }
}
