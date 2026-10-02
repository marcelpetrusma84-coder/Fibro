// solo.js - alleen spelen tegen de computer.
// De spellen praten normaal via een Supabase-kanaal met een vriend. Hier krijgen
// ze een nagemaakt kanaal; aan de andere kant zit een computerspeler die precies
// hetzelfde terugstuurt als een vriend zou doen. De spelbestanden zelf hoeven
// daardoor niet te veranderen. Er gaat niets over het internet.

export const NIVEAUS = ['makkelijk', 'normaal', 'moeilijk']

// Nagemaakt kanaal: dezelfde on/send/subscribe als een Supabase-kanaal.
export function maakSoloKanaal(maakBot, niveau) {
  const luisteraars = {}
  let dicht = false
  const kanaal = {
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
  const bot = maakBot({ stuur, niveau, isDicht: () => dicht })
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

// Welke spellen alleen te spelen zijn, met hun bestand en computerspeler.
// Het bestand heeft dezelfde ?v= als in chat.html, zodat de service worker
// het al in zijn cache heeft.
export const SOLO_SPELLEN = {
  botkaaseiren: { naam: 'Tic-Tac-Toe',   icon: '⭕', bestand: './bke-ui.js?v=96',      bot: bkeBot },
  vieroprij:    { naam: 'Four in a Row', icon: '🔴', bestand: './vieroprij-ui.js?v=96', bot: vorBot },
}
