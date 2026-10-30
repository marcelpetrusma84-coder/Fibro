// neopaddle.js - de gedeelde kern van Neo Paddle (30 okt 2026): blokjes, power-ups en levels.
// Gebruikt door pong-ui.js (samen of tegen de computer: blokjes in het midden) en neopaddle-levels.js
// (alleen spelen: levels waarin je alle blokjes weg moet halen). Geen DOM: alles hier is te testen in Node,
// behalve de teken-functies (die krijgen een canvas-context mee).
// Maten zoals in pong-ui.js: het veld is 280 x 380, de bal 8, de paddle 60 x 10.

export const NP = { B: 280, H: 380, BAL: 8, PB: 60, PH: 10 }

// ── Power-ups ──
// Een gebroken blokje laat soms een capsule vallen. Vang je hem met je paddle, dan krijg je het effect.
// goed: true = groen randje (pakken!), false = rood randje (ontwijken!). duur in beeldjes (60 per seconde).
// alleenLevels: bestaat alleen in de levelmodus (een extra leven heeft samen geen zin).
export const POWERUPS = {
  groot:     { icoon: '➕', naam: ['Grote paddle!', 'Big paddle!'],        goed: true,  duur: 600, kans: 5 },
  klein:     { icoon: '➖', naam: ['Kleine paddle…', 'Small paddle…'], goed: false, duur: 600, kans: 4 },
  omgekeerd: { icoon: '🔄', naam: ['Alles omgekeerd!', 'Controls reversed!'], goed: false, duur: 480, kans: 3 },
  schild:    { icoon: '🛡️', naam: ['Krachtveld!', 'Force field!'],         goed: true,  duur: 0,   kans: 4 },
  traag:     { icoon: '🐢', naam: ['Slow motion', 'Slow motion'],          goed: true,  duur: 480, kans: 3 },
  multibal:  { icoon: '🔮', naam: ['Drie ballen!', 'Triple ball!'],         goed: true,  duur: 0,   kans: 3 },
  vuur:      { icoon: '🔥', naam: ['Vuurbal!', 'Fireball!'],                goed: true,  duur: 420, kans: 2 },
  leven:     { icoon: '❤️', naam: ['Extra leven!', 'Extra life!'],          goed: true,  duur: 0,   kans: 1, alleenLevels: true },
}
export const GROOT_FACTOR = 1.5, KLEIN_FACTOR = 0.6, TRAAG_FACTOR = 0.6
export const DROPKANS_SAMEN = 0.3, DROPKANS_LEVELS = 0.18

// Welke power-ups mogen vallen in deze modus
export function powerupLijst(modus) {
  return Object.keys(POWERUPS).filter(k => modus === 'levels' || !POWERUPS[k].alleenLevels)
}
// Kies er een, gewogen met 'kans'. rnd: een getal van 0 tot 1 (Math.random()).
export function kiesPowerup(modus, rnd) {
  const lijst = powerupLijst(modus)
  const totaal = lijst.reduce((s, k) => s + POWERUPS[k].kans, 0)
  let r = rnd * totaal
  for (const k of lijst) { r -= POWERUPS[k].kans; if (r < 0) return k }
  return lijst[lijst.length - 1]
}
export const powerupNaam = soort => {
  const p = POWERUPS[soort]; if (!p) return ''
  return (typeof window !== 'undefined' && window.T && window.T.taal === 'en') ? p.naam[1] : p.naam[0]
}

// Het effect op een paddle: hoe breed, omgekeerd of niet, en of er een krachtveld voor het doel staat.
// vuur: zolang > 0 gaan ballen die deze paddle het laatst raakte dwars door blokjes heen (en breken ze meteen).
export const nieuwEffect = () => ({ breed: 1, breedTijd: 0, omgekeerd: 0, schild: false, vuur: 0 })
// Geeft true als het effect bij de paddle hoort (groot, klein, omgekeerd, schild, vuur); anders (traag, multibal,
// leven) regelt het spel het zelf.
export function pasEffectToe(eff, soort) {
  if (soort === 'groot') { eff.breed = GROOT_FACTOR; eff.breedTijd = POWERUPS.groot.duur }
  else if (soort === 'klein') { eff.breed = KLEIN_FACTOR; eff.breedTijd = POWERUPS.klein.duur }
  else if (soort === 'omgekeerd') eff.omgekeerd = POWERUPS.omgekeerd.duur
  else if (soort === 'schild') eff.schild = true
  else if (soort === 'vuur') eff.vuur = POWERUPS.vuur.duur
  else return false
  return true
}
// Een beeldje verder: de tijd van groot/klein en omgekeerd loopt af
export function tikEffect(eff) {
  if (eff.breedTijd > 0 && --eff.breedTijd === 0) eff.breed = 1
  if (eff.omgekeerd > 0) eff.omgekeerd--
  if (eff.vuur > 0) eff.vuur--
}
export const paddleBreedte = eff => Math.round(NP.PB * ((eff && eff.breed) || 1))
// Kort voor de netwerkberichten: { b: breedte, o: omgekeerd (0/1), s: schild (0/1), v: vuur (0/1) }
export const effectKort = eff => ({ b: paddleBreedte(eff), o: eff.omgekeerd > 0 ? 1 : 0, s: eff.schild ? 1 : 0, v: eff.vuur > 0 ? 1 : 0 })

// ── Blokjes ──
// Een raster van 10 kolommen. Elk blokje is 25 x 12 met 3 px ertussen (opzij) en 4 px (boven/onder).
export const RASTER = { kol: 10, bw: 25, bh: 12, gx: 3, gy: 4 }
const X0 = (NP.B - (RASTER.kol * RASTER.bw + (RASTER.kol - 1) * RASTER.gx)) / 2
export function blokRect(rij, kol, y0) {
  return { x: X0 + kol * (RASTER.bw + RASTER.gx), y: y0 + rij * (RASTER.bh + RASTER.gy), w: RASTER.bw, h: RASTER.bh }
}
// Van tekst naar blokjes. '.' = leeg, '1'/'2'/'3' = zoveel keer raken, 'X' = metaal (onbreekbaar).
// hp: -1 = metaal. Volgorde: rij voor rij, van links naar rechts.
export function leesPatroon(rijen, y0) {
  const uit = []
  rijen.forEach((rij, r) => {
    for (let k = 0; k < RASTER.kol; k++) {
      const c = rij[k] || '.'
      if (c === '.') continue
      uit.push({ ...blokRect(r, k, y0), rij: r, kol: k, hp: c === 'X' ? -1 : Number(c), max: c === 'X' ? -1 : Number(c) })
    }
  })
  return uit
}

// Samen spelen (en tegen de computer): golven van blokjes in het midden. Regels (zie tests/ui/test-neopaddle.mjs):
// - 4 rijen, precies in het midden, en van boven en onder gezien hetzelfde (rij 1 = rij 4, rij 2 = rij 3): eerlijk;
// - minstens twee kolommen helemaal leeg: er is ALTIJD een doorgang naar de tegenstander;
// - geen metaal (anders zou een golf nooit op gaan).
// Is een golf helemaal weg, dan komt na even de volgende.
export const SAMEN_RIJEN = 4
export const SAMEN_Y0 = NP.H / 2 - (SAMEN_RIJEN * RASTER.bh + (SAMEN_RIJEN - 1) * RASTER.gy) / 2
export const SAMEN_GOLVEN = [
  ['11.1111.11', '11.1221.11', '11.1221.11', '11.1111.11'],
  ['2111..1112', '1111..1111', '1111..1111', '2111..1112'],
  ['.11.22.11.', '.1.1..1.1.', '.1.1..1.1.', '.11.22.11.'],
  ['111....111', '.21....12.', '.21....12.', '111....111'],
  ['1.2.11.2.1', '1.1.11.1.1', '1.1.11.1.1', '1.2.11.2.1'],
  ['..111111..', '.1.2112.1.', '.1.2112.1.', '..111111..'],
]
export const samenGolf = nr => leesPatroon(SAMEN_GOLVEN[((nr % SAMEN_GOLVEN.length) + SAMEN_GOLVEN.length) % SAMEN_GOLVEN.length], SAMEN_Y0)

// Alleen spelen: levels. Haal alle blokjes weg (metaal hoeft niet). Bovenaan, vanaf y = 48.
export const LEVEL_Y0 = 48
export const LEVELS = [
  { naam: ['Opwarmen', 'Warm-up'], rijen: ['1111111111', '1111111111', '1111111111'] },
  { naam: ['Dubbel', 'Double'], rijen: ['2222222222', '1111111111', '1111111111', '1111111111'] },
  { naam: ['Piramide', 'Pyramid'], rijen: ['....22....', '...1111...', '..111111..', '.11111111.', '1111111111'] },
  { naam: ['Dambord', 'Checkers'], rijen: ['1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.'] },
  { naam: ['Hartje', 'Heart'], rijen: ['.22....22.', '2112..2112', '2111111112', '.21111112.', '..211112..', '...2112...', '....22....'] },
  { naam: ['De muur', 'The wall'], rijen: ['3333333333', '2222222222', 'XXXX..XXXX', '1111111111'] },
  { naam: ['Ruimte-invaller', 'Space invader'], rijen: ['..1....1..', '...1..1...', '..222222..', '.22.22.22.', '2222222222', '2.222222.2', '2.2....2.2', '...2..2...'] },
  { naam: ['Strepen', 'Stripes'], rijen: ['3333333333', 'X.XX..XX.X', '2222222222', '.X..XX..X.', '1111111111', '1111111111'] },
  { naam: ['Kasteel', 'Castle'], rijen: ['3.3.33.3.3', '3333333333', '2X222222X2', '2X2.22.2X2', '2X222222X2', '1111111111'] },
  { naam: ['Diamant', 'Diamond'], rijen: ['....33....', '...3223...', '..321123..', '.32111123.', '..321123..', '...3223...', '....33....'] },
  { naam: ['Doolhof', 'Maze'], rijen: ['3333333333', '..........', '.X.2222.X.', '.X.2XX2.X.', '.X.2112.X.', '.X......X.', 'XXXX..XXXX'] },
  { naam: ['Eindbaas', 'Final boss'], rijen: ['3333333333', '3XX3333XX3', '3333333333', '2222XX2222', '2222222222', '1X1X11X1X1', '1111111111'] },
]
export const levelNaam = i => {
  const l = LEVELS[i]; if (!l) return ''
  return (typeof window !== 'undefined' && window.T && window.T.taal === 'en') ? l.naam[1] : l.naam[0]
}
export const levelBlokken = i => leesPatroon(LEVELS[i].rijen, LEVEL_Y0)
// Klaar als er geen breekbaar blokje meer over is
export const allesWeg = blokken => !blokken.some(b => b.hp > 0)

// ── Botsen ──
// De bal (rondje met straal BAL/2) tegen een blokje (rechthoek). Kaatst terug langs de kant waar hij het minst
// diep in zit, en duwt de bal eruit. Geeft true bij een botsing. Botst niet als de bal al wegvliegt.
export function botsBalBlok(bal, r) {
  const straal = NP.BAL / 2
  const dx = bal.x - Math.max(r.x, Math.min(bal.x, r.x + r.w))
  const dy = bal.y - Math.max(r.y, Math.min(bal.y, r.y + r.h))
  if (dx * dx + dy * dy > straal * straal) return false
  const overX = Math.min(bal.x + straal - r.x, r.x + r.w - (bal.x - straal))
  const overY = Math.min(bal.y + straal - r.y, r.y + r.h - (bal.y - straal))
  if (overX < overY) {
    const links = bal.x < r.x + r.w / 2
    if (links ? bal.vx < 0 : bal.vx > 0) return false
    bal.vx = links ? -Math.abs(bal.vx) : Math.abs(bal.vx)
    bal.x = links ? r.x - straal : r.x + r.w + straal
  } else {
    const boven = bal.y < r.y + r.h / 2
    if (boven ? bal.vy < 0 : bal.vy > 0) return false
    bal.vy = boven ? -Math.abs(bal.vy) : Math.abs(bal.vy)
    bal.y = boven ? r.y - straal : r.y + r.h + straal
  }
  return true
}
// Zit de bal (een beetje) in dit blokje? Voor de vuurbal: die gaat er dwars doorheen.
export function raaktBlok(bal, r) {
  const straal = NP.BAL / 2
  const dx = bal.x - Math.max(r.x, Math.min(bal.x, r.x + r.w))
  const dy = bal.y - Math.max(r.y, Math.min(bal.y, r.y + r.h))
  return dx * dx + dy * dy <= straal * straal
}
// Raakt een vallende capsule (20 x 12, midden op c.x, c.y) de paddle (links px, op hoogte py, breedte pb)?
export const CAPSULE = { b: 22, h: 14 }
export function vangtCapsule(c, px, py, pb) {
  return c.x + CAPSULE.b / 2 > px && c.x - CAPSULE.b / 2 < px + pb && c.y + CAPSULE.h / 2 > py && c.y - CAPSULE.h / 2 < py + NP.PH
}

// ── Tekenen ──
const BLOK_KLEUR = { 1: '#00f0ff', 2: '#ff00cc', 3: '#ffe066' }
// spiegel: true = van de andere kant bekeken (de gast ziet het veld omgekeerd)
export function tekenBlokken(ctx, blokken, spiegel) {
  for (const b of blokken) {
    if (b.hp === 0) continue
    const y = spiegel ? NP.H - b.y - b.h : b.y
    ctx.save()
    if (b.hp < 0) {
      const g = ctx.createLinearGradient(b.x, y, b.x, y + b.h)
      g.addColorStop(0, '#c9cede'); g.addColorStop(1, '#5d6278')
      ctx.fillStyle = g; ctx.shadowColor = 'rgba(200,210,255,0.5)'; ctx.shadowBlur = 4
      ctx.fillRect(b.x, y, b.w, b.h)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, y + 0.5, b.w - 1, b.h - 1)
    } else {
      const kleur = BLOK_KLEUR[Math.min(3, b.hp)] || BLOK_KLEUR[1]
      ctx.shadowColor = kleur; ctx.shadowBlur = 10
      ctx.fillStyle = kleur; ctx.globalAlpha = 0.28
      ctx.fillRect(b.x, y, b.w, b.h)
      ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.strokeStyle = kleur
      ctx.strokeRect(b.x + 0.75, y + 0.75, b.w - 1.5, b.h - 1.5)
      // al eens geraakt: een barstje
      if (b.max > b.hp) {
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(b.x + 6, y + 2); ctx.lineTo(b.x + 11, y + 7); ctx.lineTo(b.x + 9, y + 10); ctx.stroke()
      }
    }
    ctx.restore()
  }
}
export function tekenCapsule(ctx, c, spiegel) {
  const p = POWERUPS[c.soort]; if (!p) return
  const y = spiegel ? NP.H - c.y : c.y
  const kleur = p.goed ? '#39ff88' : '#ff3b5c'
  ctx.save()
  ctx.shadowColor = kleur; ctx.shadowBlur = 12
  ctx.fillStyle = 'rgba(5,5,16,0.85)'; ctx.strokeStyle = kleur; ctx.lineWidth = 2
  const x0 = c.x - CAPSULE.b / 2, y0 = y - CAPSULE.h / 2, r = CAPSULE.h / 2
  ctx.beginPath()
  ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + CAPSULE.b - r, y0); ctx.arc(x0 + CAPSULE.b - r, y0 + r, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(x0 + r, y0 + CAPSULE.h); ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.shadowBlur = 0; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(p.icoon, c.x, y + 1)
  ctx.restore()
}
// Het krachtveld: een gloeiende lijn net voor het doel (y = de lijn)
export function tekenSchild(ctx, y, tijd) {
  ctx.save()
  const puls = 0.6 + 0.4 * Math.sin((tijd || 0) / 120)
  ctx.strokeStyle = 'rgba(57,255,136,' + (0.55 + 0.35 * puls) + ')'; ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 14
  ctx.lineWidth = 3; ctx.setLineDash([10, 5])
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(NP.B, y); ctx.stroke()
  ctx.restore()
}
// Even een tekst laten oplichten (bij het vangen van een power-up)
export function tekenMelding(ctx, tekst, leven, y) {
  if (!tekst || leven <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, leven / 20)
  ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ff00cc'; ctx.shadowBlur = 14
  ctx.fillText(tekst, NP.B / 2, y)
  ctx.restore()
}
