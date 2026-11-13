// solo.js - alleen spelen tegen de computer.
// De spellen praten normaal via een Supabase-kanaal met een vriend. Hier krijgen
// ze een nagemaakt kanaal; aan de andere kant zit een computerspeler die precies
// hetzelfde terugstuurt als een vriend zou doen. De spelbestanden zelf hoeven
// daardoor niet te veranderen. Alleen Ultra-schaken vraagt openbare Lichess-analyses op.

import { schaakBot } from './solo-bord.js?v=4'
import { damBot } from './dam-bot.js?v=1'   // v253: sterkere damcomputer (met expert), rekent in een worker
import { schaakUltraBot } from './schaak-ultra.js?v=4'
import { computerStap as pestenComputerStap, doeStap as pestenDoeStap, geldigeStand as pestenGeldig } from './pesten.js?v=1'
import * as Toepen from './toepen.js?v=1'                   // 11 nov 2026: tweede en derde kaartspel
import * as Eenentwintigen from './eenentwintigen.js?v=1'

export const NIVEAUS = ['makkelijk', 'normaal', 'moeilijk']

// Nagemaakt kanaal: dezelfde on/send/subscribe als een Supabase-kanaal.
export function maakSoloKanaal(maakBot, niveau, motor) {
  const luisteraars = {}
  let dicht = false
  const kanaal = {
    isSolo: true,
    niveau,
    on(soort, filter, fn) {
      const ev = filter && filter.event
      if (ev) (luisteraars[ev] = luisteraars[ev] || []).push(fn)
      return kanaal
    },
    send(bericht) {
      if (!dicht && bericht && bericht.event) {
        const { event, payload } = bericht
        setTimeout(() => { if (!dicht) bot.ontvang(event, payload || {}) }, 0)
      }
      return Promise.resolve('ok')
    },
    subscribe(fn) { if (fn) setTimeout(() => fn('SUBSCRIBED'), 0); return kanaal },
    unsubscribe() { dicht = true; return Promise.resolve('ok') },
  }
  // De computer stuurt iets naar het spel, alsof het van een vriend komt.
  const stuur = (event, payload) => {
    if (dicht) return
    for (const fn of (luisteraars[event] || [])) {
      try { fn({ type: 'broadcast', event, payload }) } catch (e) { console.error('[solo]', e) }
    }
  }
  const bot = maakBot({ stuur, niveau, isDicht: () => dicht, motor })
  kanaal.sluit = () => { dicht = true; if (bot.stop) bot.stop() }
  return kanaal
}

const willekeurig = lijst => lijst[Math.floor(Math.random() * lijst.length)]
// Even wachten voor de zet, anders voelt het niet als een tegenstander.
const bedenktijd = () => 450 + Math.floor(Math.random() * 400)

// ─────────────────────────────────────────────
// Boter-kaas-en-eieren. Mens = X (speler 1), computer = O.
// ─────────────────────────────────────────────
const BKE_LIJNEN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

export function bkeWinnaar(b) {
  for (const [a, c, d] of BKE_LIJNEN) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  return b.every(x => x) ? 'gelijk' : null
}

function bkeMinimax(b, aanZet, ik, diepte) {
  const w = bkeWinnaar(b)
  if (w === ik) return 10 - diepte
  if (w === 'gelijk') return 0
  if (w) return diepte - 10
  const ander = aanZet === 'X' ? 'O' : 'X'
  let beste = aanZet === ik ? -Infinity : Infinity
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue
    b[i] = aanZet
    const s = bkeMinimax(b, ander, ik, diepte + 1)
    b[i] = null
    beste = aanZet === ik ? Math.max(beste, s) : Math.min(beste, s)
  }
  return beste
}

export function bkeKies(bord, ik, niveau) {
  const b = bord.slice()
  const ander = ik === 'X' ? 'O' : 'X'
  const vrij = []
  for (let i = 0; i < 9; i++) if (!b[i]) vrij.push(i)
  if (!vrij.length) return -1
  const wintMet = sym => vrij.find(i => { b[i] = sym; const w = bkeWinnaar(b) === sym; b[i] = null; return w })
  const perfect = () => {
    let beste = -Infinity, kandidaten = []
    for (const i of vrij) {
      b[i] = ik
      const s = bkeMinimax(b, ander, ik, 1)
      b[i] = null
      if (s > beste) { beste = s; kandidaten = [i] } else if (s === beste) kandidaten.push(i)
    }
    return willekeurig(kandidaten)
  }
  if (niveau === 'moeilijk') return perfect()
  const winst = wintMet(ik)
  if (niveau === 'makkelijk') {
    if (winst !== undefined && Math.random() < 0.6) return winst
    const blok = wintMet(ander)
    if (blok !== undefined && Math.random() < 0.4) return blok
    return willekeurig(vrij)
  }
  // normaal: altijd winnen of blokkeren, verder half slim, half gokken
  if (winst !== undefined) return winst
  const blok = wintMet(ander)
  if (blok !== undefined) return blok
  return Math.random() < 0.5 ? perfect() : willekeurig(vrij)
}

export function bkeBot({ stuur, niveau, isDicht }) {
  const IK = 'O'
  let bord = Array(9).fill(null)
  let mensBegint = true
  let ronde = 0
  let timer = null
  function zet() {
    const r = ronde
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (isDicht() || r !== ronde || bkeWinnaar(bord)) return
      const i = bkeKies(bord, IK, niveau)
      if (i < 0) return
      bord[i] = IK
      stuur('zet', { i, symbool: IK })
    }, bedenktijd())
  }
  return {
    ontvang(event, p) {
      if (event === 'zet') {
        if (p.symbool === IK || typeof p.i !== 'number' || bord[p.i]) return
        bord[p.i] = p.symbool
        if (!bkeWinnaar(bord)) zet()
      } else if (event === 'opnieuw') {
        ronde++
        bord = Array(9).fill(null)
        mensBegint = !mensBegint
        if (!mensBegint) zet()
      }
    },
    stop() { clearTimeout(timer) },
  }
}

// ─────────────────────────────────────────────
// Vier op een rij. Mens = rood (speler 1), computer = geel.
// bord[rij][kolom], rij 0 is boven.
// ─────────────────────────────────────────────
const VR = 6, VK = 7
const VOLGORDE = [3, 2, 4, 1, 5, 0, 6]

function vorVrijeRij(b, k) {
  for (let r = VR - 1; r >= 0; r--) if (!b[r][k]) return r
  return -1
}

function vorWintZet(b, r, k) {
  const kl = b[r][k]
  for (const [dr, dk] of [[0,1],[1,0],[1,1],[1,-1]]) {
    let n = 1
    for (const t of [1, -1]) {
      let rr = r + dr * t, kk = k + dk * t
      while (rr >= 0 && rr < VR && kk >= 0 && kk < VK && b[rr][kk] === kl) { n++; rr += dr * t; kk += dk * t }
    }
    if (n >= 4) return true
  }
  return false
}

export function vorWinnaar(b) {
  for (let r = 0; r < VR; r++) for (let k = 0; k < VK; k++) if (b[r][k] && vorWintZet(b, r, k)) return b[r][k]
  return b.every(rij => rij.every(c => c)) ? 'gelijk' : null
}

function vorWaardeer(b, ik, ander) {
  let s = 0
  for (let r = 0; r < VR; r++) if (b[r][3] === ik) s += 3; else if (b[r][3] === ander) s -= 3
  const raam = (a, c, d, e) => {
    let mij = 0, hem = 0
    for (const x of [a, c, d, e]) { if (x === ik) mij++; else if (x === ander) hem++ }
    if (mij && hem) return 0
    if (mij === 3) return 5
    if (mij === 2) return 2
    if (hem === 3) return -4
    if (hem === 2) return -2
    return 0
  }
  for (let r = 0; r < VR; r++) for (let k = 0; k < VK; k++) {
    if (k + 3 < VK) s += raam(b[r][k], b[r][k+1], b[r][k+2], b[r][k+3])
    if (r + 3 < VR) s += raam(b[r][k], b[r+1][k], b[r+2][k], b[r+3][k])
    if (r + 3 < VR && k + 3 < VK) s += raam(b[r][k], b[r+1][k+1], b[r+2][k+2], b[r+3][k+3])
    if (r + 3 < VR && k - 3 >= 0) s += raam(b[r][k], b[r+1][k-1], b[r+2][k-2], b[r+3][k-3])
  }
  return s
}

class TijdOp extends Error {}

function vorNegamax(b, diepte, alfa, beta, aanZet, ander, stopOm, teller) {
  if ((++teller.n & 1023) === 0 && Date.now() > stopOm) throw new TijdOp()
  let vrij = false
  for (const k of VOLGORDE) {
    const r = vorVrijeRij(b, k)
    if (r < 0) continue
    vrij = true
    b[r][k] = aanZet
    const wint = vorWintZet(b, r, k)
    b[r][k] = null
    if (wint) return 100000 + diepte
  }
  if (!vrij) return 0
  if (diepte === 0) return vorWaardeer(b, aanZet, ander)
  let beste = -Infinity
  for (const k of VOLGORDE) {
    const r = vorVrijeRij(b, k)
    if (r < 0) continue
    b[r][k] = aanZet
    const s = -vorNegamax(b, diepte - 1, -beta, -alfa, ander, aanZet, stopOm, teller)
    b[r][k] = null
    if (s > beste) beste = s
    if (beste > alfa) alfa = beste
    if (alfa >= beta) break
  }
  return beste
}

function vorZoek(b, ik, ander, maxDiepte, tijd) {
  const stopOm = Date.now() + tijd
  const kolommen = VOLGORDE.filter(k => vorVrijeRij(b, k) >= 0)
  let gekozen = kolommen[0]
  for (let d = 1; d <= maxDiepte; d++) {
    try {
      let beste = -Infinity, kandidaten = []
      const teller = { n: 0 }
      for (const k of kolommen) {
        const r = vorVrijeRij(b, k)
        b[r][k] = ik
        let s
        try {
          s = vorWintZet(b, r, k) ? 1000000 : -vorNegamax(b, d - 1, -Infinity, Infinity, ander, ik, stopOm, teller)
        } finally { b[r][k] = null }
        if (s > beste) { beste = s; kandidaten = [k] } else if (s === beste) kandidaten.push(k)
      }
      gekozen = kandidaten[0]
      if (beste >= 100000) break   // winst gevonden, niet verder zoeken
    } catch (e) {
      if (e instanceof TijdOp) break
      throw e
    }
  }
  return gekozen
}

export function vorKies(bord, ik, niveau) {
  const b = bord.map(rij => rij.slice())
  const ander = ik === 'rood' ? 'geel' : 'rood'
  const kolommen = VOLGORDE.filter(k => vorVrijeRij(b, k) >= 0)
  if (!kolommen.length) return -1
  const wintIn = sym => kolommen.find(k => {
    const r = vorVrijeRij(b, k); b[r][k] = sym
    const w = vorWintZet(b, r, k); b[r][k] = null; return w
  })
  if (niveau === 'makkelijk') {
    const w = wintIn(ik)
    if (w !== undefined && Math.random() < 0.7) return w
    const blok = wintIn(ander)
    if (blok !== undefined && Math.random() < 0.5) return blok
    // liefst een beetje naar het midden
    const gewogen = []
    for (const k of kolommen) for (let n = 0; n < 4 - Math.abs(3 - k); n++) gewogen.push(k)
    return willekeurig(gewogen)
  }
  if (niveau === 'normaal') return vorZoek(b, ik, ander, 4, 400)
  return vorZoek(b, ik, ander, 9, 900)
}

export function vorBot({ stuur, niveau, isDicht }) {
  const IK = 'geel'
  const leeg = () => Array(VR).fill(null).map(() => Array(VK).fill(null))
  let bord = leeg()
  let mensBegint = true
  let ronde = 0
  let timer = null
  function zet() {
    const r0 = ronde
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (isDicht() || r0 !== ronde || vorWinnaar(bord)) return
      const kolom = vorKies(bord, IK, niveau)
      if (kolom < 0) return
      const rij = vorVrijeRij(bord, kolom)
      bord[rij][kolom] = IK
      stuur('zet', { kolom, rij, kleur: IK })
    }, bedenktijd())
  }
  return {
    ontvang(event, p) {
      if (event === 'zet') {
        if (p.kleur === IK) return
        const { rij, kolom } = p
        if (!(rij >= 0 && rij < VR && kolom >= 0 && kolom < VK) || bord[rij][kolom]) return
        bord[rij][kolom] = p.kleur
        if (!vorWinnaar(bord)) zet()
      } else if (event === 'opnieuw') {
        ronde++
        bord = leeg()
        mensBegint = !mensBegint
        if (!mensBegint) zet()
      }
    },
    stop() { clearTimeout(timer) },
  }
}

// ─────────────────────────────────────────────
// Neo Paddle. Jij bent de host: jouw scherm rekent de bal uit en stuurt
// 'balstaat'. De computer is de gast: zijn paddle staat boven (y = 20) en hij
// stuurt alleen zijn plek ('paddle'). Maten zoals in pong-ui.js.
// Neo Paddle v2 (30 okt 2026): de computer antwoordt met v: 2, dus er komen blokjes en power-ups. Hij let op de
// bal die het eerst bij hem is, weet hoe breed zijn paddle is en pakt een goede power-up als er even geen bal komt.
// 'Omgekeerd' doet hem niets (hij is een computer).
// ─────────────────────────────────────────────
const PONG = { B: 280, PB: 60, LIJN: 34, BAL: 8 }
const PONG_NIVEAU = {
  // fout: hoe ver hij er naast kan zitten. Bal + halve paddle = 34, dus
  // boven de 34 mist hij soms; anders zou een rally nooit eindigen.
  makkelijk: { snel: 5,  fout: 55, rust: 0.02 },
  normaal:   { snel: 8,  fout: 44, rust: 0.04 },
  moeilijk:  { snel: 12, fout: 37, rust: 0.08 },
}

// Waar komt de bal aan op de lijn van de computer? Kaatst tegen de zijkanten.
export function pongVoorspel(bal, lijnY) {
  if (!bal || !(bal.vy < 0)) return null
  const frames = (bal.y - lijnY) / -bal.vy
  if (!(frames >= 0)) return null
  const min = PONG.BAL / 2, max = PONG.B - PONG.BAL / 2, w = max - min
  let x = bal.x + bal.vx * frames - min
  x = ((x % (2 * w)) + 2 * w) % (2 * w)
  return min + (x > w ? 2 * w - x : x)
}

export function pongBot({ stuur, niveau, isDicht }) {
  const n = PONG_NIVEAU[niveau] || PONG_NIVEAU.normaal
  let x = PONG.B / 2 - PONG.PB / 2
  let ballen = [], balTijd = 0
  let capsules = []
  let breedte = PONG.PB
  let richting = 0, afwijking = 0
  let vorigeX = null
  const tik = setInterval(() => {
    if (isDicht()) { clearInterval(tik); return }
    let doel = PONG.B / 2
    if (ballen.length) {
      // Ballen doorrekenen sinds het laatste bericht (60 beelden per seconde).
      const f = Math.min((Date.now() - balTijd) / 16.7, 6)
      const nu = ballen.map(b => ({ x: b.x + b.vx * f, y: b.y + b.vy * f, vx: b.vx, vy: b.vy }))
      // Neo Paddle v2: er kunnen meer ballen zijn. Let op de bal die het eerst bij mij is.
      let eerst = null, frames = Infinity
      for (const b of nu) if (b.vy < 0) { const fr = (b.y - PONG.LIJN) / -b.vy; if (fr >= 0 && fr < frames) { frames = fr; eerst = b } }
      const r = eerst ? -1 : 1
      if (r !== richting) {
        richting = r
        // Elke keer dat de bal eraan komt een nieuwe kleine misser.
        afwijking = (Math.random() * 2 - 1) * n.fout
      }
      const aan = eerst ? pongVoorspel(eerst, PONG.LIJN) : null
      // Een goede power-up die naar mij toe valt, terwijl er even geen bal aankomt: die pakken
      const goed = capsules.find(c => c.vy < 0 && c.goed)
      if (aan !== null && !(goed && frames > 70)) doel = aan + afwijking
      else if (goed) doel = goed.x
      else doel = PONG.B / 2 + (nu[0].x - PONG.B / 2) * n.rust * 5
    }
    const gewenst = Math.max(0, Math.min(PONG.B - breedte, doel - breedte / 2))
    const stap = Math.max(-n.snel, Math.min(n.snel, gewenst - x))
    x += stap
    const afgerond = Math.round(x * 10) / 10
    if (afgerond !== vorigeX) { vorigeX = afgerond; stuur('paddle', { x: afgerond }) }
  }, 50)
  return {
    ontvang(event, p) {
      if (event === 'pong-klaar') stuur('pong-klaar-terug', { v: 2 })
      else if (event === 'balstaat') {
        if (Array.isArray(p.ballen) && p.ballen.length) ballen = p.ballen.map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3] }))
        else if (p.bal) ballen = [p.bal]
        // Neo Paddle v2: mijn paddle (boven) kan breder of smaller zijn; goede power-ups vang ik graag
        breedte = (p.eff && p.eff.boven && p.eff.boven.b) || PONG.PB
        capsules = Array.isArray(p.caps) ? p.caps.map(c => ({ x: c[0], vy: c[2], goed: ['groot', 'schild', 'traag', 'multibal', 'vuur'].includes(c[3]) })) : []
        balTijd = Date.now()
      }
      else if (event === 'opnieuw') { ballen = []; richting = 0 }
    },
    stop() { clearInterval(tik) },
  }
}

// ─────────────────────────────────────────────
// Pesten (11 nov 2026). Mens = speler 1 (schudt en deelt), computer = speler 2. De regels en de keuzes van de
// computer staan in pesten.js; hier alleen het wachten en het terugsturen. Soms gooit de computer een emoji.
// ─────────────────────────────────────────────
export function pestenBot({ stuur, niveau, isDicht }) {
  let staat = null, spelId = -1, nr = 0, timer = null
  const reageer = emoji => { if (Math.random() < 0.6) setTimeout(() => { if (!isDicht()) stuur('kaartreactie', { emoji }) }, 700) }
  function plan(extra = 0) {
    clearTimeout(timer)
    if (!staat || staat.winnaar || staat.aanZet !== 2) return
    timer = setTimeout(() => {
      if (isDicht() || !staat || staat.winnaar || staat.aanZet !== 2) return
      const stap = pestenComputerStap(staat, 2, niveau)
      const nieuw = pestenDoeStap(staat, 2, stap)
      if (!nieuw) return
      const voor = staat
      staat = nieuw; nr++
      stuur('zet', { staat, nr, spelId })
      if (stap.soort === 'betrap') reageer('😂')
      else if (stap.soort === 'speel' && voor.straf === 0 && nieuw.straf >= 5) reageer('😎')
      if (nieuw.winnaar === 2) reageer('🔥')
      // na een kaart die veel beweegt (pakken, meerdere kaarten) iets langer wachten
      plan(stap.soort === 'pak' ? 900 : 300 * (stap.kaarten ? stap.kaarten.length : 1))
    }, 900 + Math.floor(Math.random() * 700) + extra)
  }
  function neem(p, nieuwSpel) {
    if (!p || !pestenGeldig(p.staat)) return
    const id = p.spelId ?? spelId
    if (nieuwSpel ? id <= spelId : (id < spelId || (id === spelId && (p.nr ?? 0) <= nr))) return
    const nieuwDeel = id !== spelId
    if (staat && staat.aanZet === 2 && !staat.winnaar && p.staat.straf >= 5 && staat.straf < p.staat.straf) reageer('😱')
    if (p.staat.laatste?.soort === 'betrapt' && p.staat.laatste.wie === 2) reageer('🙈')
    staat = p.staat; spelId = id; nr = p.nr ?? 0
    plan(nieuwDeel ? 2600 : 0)   // na het delen eerst de animatie laten afspelen
  }
  return {
    ontvang(event, payload) {
      if (isDicht()) return
      if (event === 'zet' || event === 'stand') neem(payload, false)
      else if (event === 'opnieuw') neem(payload, true)
      else if (event === 'vraag-stand' && staat) {
        if (spelId > (payload.spelId ?? -1) || (spelId === (payload.spelId ?? -1) && nr > (payload.nr ?? 0))) stuur('stand', { staat, nr, spelId })
      }
    },
    stop() { clearTimeout(timer) },
  }
}

// ─────────────────────────────────────────────
// Toepen en Eenentwintigen (11 nov 2026): dezelfde computerspeler als bij Pesten, maar dan voor elk kaartspel met
// regels die computerStap, doeStap en geldigeStand hebben. isKlaar = is het spel voorbij; extraNa = hoe lang de
// animatie na een stand duurt (dan wacht de computer even, zodat jij kunt zien wat er gebeurde).
// ─────────────────────────────────────────────
function kaartspelBot(R, { isKlaar, extraNa, reacties = () => null }) {
  return function ({ stuur, niveau, isDicht }) {
    let staat = null, spelId = -1, nr = 0, timer = null
    const reageer = emoji => { if (emoji && Math.random() < 0.6) setTimeout(() => { if (!isDicht()) stuur('kaartreactie', { emoji }) }, 700) }
    function plan(extra = 0) {
      clearTimeout(timer)
      if (!staat || isKlaar(staat) || staat.aanZet !== 2) return
      timer = setTimeout(() => {
        if (isDicht() || !staat || isKlaar(staat) || staat.aanZet !== 2) return
        const stap = R.computerStap(staat, 2, niveau)
        const nieuw = R.doeStap(staat, 2, stap)
        if (!nieuw) return
        staat = nieuw; nr++
        stuur('zet', { staat, nr, spelId })
        reageer(reacties(nieuw, 2))
        plan(extraNa(nieuw))
      }, 900 + Math.floor(Math.random() * 700) + extra)
    }
    function neem(p, nieuwSpel) {
      if (!p || !R.geldigeStand(p.staat)) return
      const id = p.spelId ?? spelId
      if (nieuwSpel ? id <= spelId : (id < spelId || (id === spelId && (p.nr ?? 0) <= nr))) return
      const nieuwDeel = id !== spelId
      staat = p.staat; spelId = id; nr = p.nr ?? 0
      reageer(reacties(staat, 1))
      plan(nieuwDeel ? 2600 : extraNa(staat))
    }
    return {
      ontvang(event, payload) {
        if (isDicht()) return
        if (event === 'zet' || event === 'stand') neem(payload, false)
        else if (event === 'opnieuw') neem(payload, true)
        else if (event === 'vraag-stand' && staat) {
          if (spelId > (payload.spelId ?? -1) || (spelId === (payload.spelId ?? -1) && nr > (payload.nr ?? 0))) stuur('stand', { staat, nr, spelId })
        }
      },
      stop() { clearTimeout(timer) },
    }
  }
}
// Toepen: na een slag even laten liggen; na de laatste slag ook de uitslag en het delen afwachten
export const toepenBot = kaartspelBot(Toepen, {
  isKlaar: s => Boolean(s.winnaar),
  extraNa: s => s.laatste?.ronde ? 3800 : s.laatste?.slag ? 1300 : 0,
  reacties: (s, wie) => {
    const l = s.laatste || {}
    if (wie === 1 && l.soort === 'toep') return '😱'
    if (wie === 2 && l.ronde && l.ronde.verliezer === 1) return s.winnaar === 2 ? '🔥' : '😎'
    if (wie === 1 && l.ronde && l.ronde.verliezer === 2) return '🙈'
    return null
  },
})
export const eenentwintigenBot = kaartspelBot(Eenentwintigen, {
  isKlaar: s => s.klaar,
  extraNa: s => s.laatste?.soort === 'pak' ? 700 : 0,
  reacties: (s, wie) => {
    const l = s.laatste || {}
    if (l.soort === 'dood') return l.wie === 2 ? '🙈' : '😂'
    if (wie === 2 && s.klaar && s.winnaar === 2) return '😎'
    return null
  },
})

// Arcadespellen: daar is geen tegenstander. Het spel krijgt solo mee en speelt
// zonder vriend; het kanaal hoeft niets terug te sturen.
export function stilBot() {
  return { ontvang() {} }
}

// Welke spellen alleen te spelen zijn, met hun bestand en computerspeler.
// Het bestand heeft dezelfde ?v= als in chat.html, zodat de service worker
// het al in zijn cache heeft.
export const SOLO_SPELLEN = {
  botkaaseiren: { naam: 'Tic-Tac-Toe',   icon: '⭕', bestand: './bke-ui.js?v=239',      bot: bkeBot },
  vieroprij:    { naam: 'Four in a Row', icon: '🔴', bestand: './vieroprij-ui.js?v=240', bot: vorBot },
  pesten:       { naam: 'Pesten',        icon: '🃏', bestand: './pesten-ui.js?v=5',     bot: pestenBot, store: true },   // 11 nov 2026: het eerste kaartspel; alleen via de Store (niet meesturen met een uitnodiging)
  toepen:       { naam: 'Toepen',        icon: '✊', bestand: './toepen-ui.js?v=4',     bot: toepenBot, store: true },          // 11 nov 2026: kaartspel uit de Store
  eenentwintigen: { naam: 'Eenentwintigen', icon: '♠️', bestand: './eenentwintigen-ui.js?v=4', bot: eenentwintigenBot, store: true },   // 11 nov 2026: kaartspel uit de Store
  // 13 nov 2026: Koningsjacht, alleen tegen het kasteel (geen computerspeler en geen spelkanaal), uit de Store
  koningsjacht: { naam: 'Koningsjacht', icon: '👑', bestand: './koningsjacht-ui.js?v=1', zonderKanaal: true, store: true },
  schaken:      { naam: 'Chess',         icon: '♟️', bestand: './schaken-ui.js?v=275',  niveaus:[...NIVEAUS, 'ultra'], bot: opties => opties.niveau === 'ultra' ? schaakUltraBot(opties) : schaakBot(opties), motor: './schaak.js?v=95', motorNaam: 'Schaak' },
  dammen:       { naam: 'Draughts',      icon: '⚫', bestand: './dammen-ui.js?v=151',   niveaus:[...NIVEAUS, 'expert'], bot: damBot,    motor: './dammen.js?v=95', motorNaam: 'Dammen' },
  // 30 okt 2026: Neo Paddle v2 (blokjes en power-ups) en levels voor alleen (spel.html toont een knop 🧱 Levels).
  pong:         { naam: 'Neo Paddle',    icon: '🏓', bestand: './pong-ui.js?v=242',     bot: pongBot, levels: './neopaddle-levels.js?v=1' },
  // Ghost Tag heeft zelf al een computerspookje: zonder kanaal speel je daartegen.
  // gewoneScherpte: op telefoons niet op dubbele scherpte tekenen (4x minder beeldpunten). Sinds v177 gebruikt
  // geen spel het meer (spel.html kent het nog).
  // v177: Ghost Tag alleen spelen net als samen spelen: volle scherpte en geen grens van 30 beeldjes (zie ecto-ui.js v12).
  pacman:       { naam: 'Ghost Tag',     icon: '👻', bestand: './ecto-ui.js?v=178',    zonderKanaal: true, meetFps: true },
  // v150 (2 nov 2026): Block It kan alleen ook tegen de computer; die zit in het spel zelf (blockit-computer.js), dus stilBot blijft.
  breakout:     { naam: 'Block It',      icon: '🟪', bestand: './blockit-ui.js?v=151',  bot: stilBot, arcade: true },
  swarm:        { naam: 'The Swarm',     icon: '🪲', bestand: './swarm-ui.js?v=148',    bot: stilBot, arcade: true },
  // Twin Snakes heeft net als Ghost Tag al een eigen computerslang.
  pinball:      { naam: 'Twin Snakes',   icon: '🐍', bestand: './twin-snakes-ui.js?v=150', zonderKanaal: true },
  // Runner & Gunner start zonder kanaal meteen alleen: geen vriend nodig om te starten.
  endlessrunner: { naam: 'Runner & Gunner', icon: '🏃', bestand: './runner-gunner-ui.js?v=149', zonderKanaal: true },
  flappybird:   { naam: 'Flapper',       icon: '🦇', bestand: './flappy-ui.js?v=147',   bot: stilBot, arcade: true },
  // v192: Neon Raiders start zonder kanaal meteen alleen, met een eigen startscherm; arcade: het record komt van spel.html.
  // v193: het hele spel (7 levels). v194: ook samen vanuit de chat (daar met spelKanaal).
  // Let op: versie 194 van dit bestand was al gebruikt (de schaak-PR van valentijnpeters, 21 okt 2026); daarom laadt
  // spel.html in v193 versie 193 en in v194 versie 195. v195 (schaken weer in twee talen): versie 196. Een volgende
  // aanpassing aan solo.js neemt 197 of hoger.
  shmup:        { naam: 'Neon Raiders',  icon: '🚀', bestand: './neon-raiders-ui.js?v=225', zonderKanaal: true, arcade: true },
}
