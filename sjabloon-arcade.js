// sjabloon-arcade.js - SJABLOON: de spelwereld van een arcadespel (v1, 27 nov 2026). Hoort bij sjabloon-arcade-ui.js.
// Stekky Studio kopieert allebei naar <id>.js en <id>-ui.js voor een arcadespel; daarna komt hier het echte spel.
//
// Het voorbeeld "Ontwijk": er vallen blokken naar beneden; schuif je poppetje opzij zodat ze je niet raken. Hoe langer
// je het volhoudt, hoe meer punten (en hoe sneller de blokken). Eén keer geraakt = game over.
// Alles is gewoon rekenen (geen scherm), zodat het te testen is. De wereld is 1 breed en 1 hoog (het scherm schaalt).
//   nieuweWereld()                     de beginstand
//   stap(wereld, dt, invoer, rng)      een nieuwe stand na dt seconden; invoer: { links, rechts } of { doelX } (vinger)
//   punten(wereld)                     de score (10 per seconde)
export const SPELER = { breed: 0.12, hoog: 0.05, y: 0.9, snelheid: 1.1 }

export function nieuweWereld() {
  return { tijd: 0, x: 0.5, blokken: [], tot: 0.6, over: false }
}
export const punten = w => Math.floor(w.tijd * 10)
const tempo = t => 1 + t / 20               // na 20 seconden gaat alles twee keer zo snel

export function stap(oud, dt, invoer = {}, rng = Math.random) {
  if (!oud || oud.over) return oud
  dt = Math.max(0, Math.min(0.05, Number(dt) || 0))   // nooit grote sprongen (bijvoorbeeld na een pauze)
  const w = { ...oud, blokken: oud.blokken.map(b => ({ ...b })) }
  w.tijd += dt
  // het poppetje
  const half = SPELER.breed / 2
  if (Number.isFinite(invoer.doelX)) {
    const naar = Math.max(half, Math.min(1 - half, invoer.doelX))
    const max = SPELER.snelheid * 1.6 * dt
    w.x += Math.max(-max, Math.min(max, naar - w.x))
  } else w.x += ((invoer.rechts ? 1 : 0) - (invoer.links ? 1 : 0)) * SPELER.snelheid * dt
  w.x = Math.max(half, Math.min(1 - half, w.x))
  // de blokken
  const t = tempo(w.tijd)
  for (const b of w.blokken) b.y += b.v * t * dt
  w.blokken = w.blokken.filter(b => b.y - b.h < 1)
  w.tot -= dt
  if (w.tot <= 0) {
    const breed = 0.08 + rng() * 0.14
    w.blokken.push({ x: breed / 2 + rng() * (1 - breed), y: -0.05, w: breed, h: 0.05, v: 0.35 + rng() * 0.25 })
    w.tot = Math.max(0.18, 0.7 - w.tijd / 60) * (0.6 + rng() * 0.8)
  }
  // geraakt?
  const py = SPELER.y
  for (const b of w.blokken) {
    if (Math.abs(b.x - w.x) < (b.w + SPELER.breed) / 2 && Math.abs(b.y - py) < (b.h + SPELER.hoog) / 2) { w.over = true; break }
  }
  return w
}

// Een arcadespel speel je alleen: geen computerspeler voor het kanaal nodig.
export function bot() { return { ontvang() {}, stop() {} } }
