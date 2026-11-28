// casinowidget.js (v1, 27 nov 2026, Marcel) - de widget 🎰 Casino op Home: je tokens, wanneer de volgende 500 komen,
// je rijkste vrienden en knoppen naar Black Jack, Poker, Video Poker, Hoger of lager en de Fruitautomaat (28 nov 2026).
// Alleen voor 18+ (widgets.js: alleenVolwassen).
//
// Waar het vandaan komt: casino_overzicht (sql/casino-tokens.sql, via casino.js). Alleen echte vrienden (van twee
// kanten), zonder wie geblokkeerd is. Zonder internet of account: een regel dat je online moet zijn.
// Persoonlijk: alleen op je eigen Home. Op het profiel van een vriend staat hij niet (vriend-profiel.html).
import { maakCasino, WEEKBEDRAG, MINIMUM } from './casino.js?v=5'

const kort = v => typeof v === 'string' ? v.trim().slice(0, 40) : ''

function zetStijl() {
  if (document.getElementById('csw-css')) return
  const s = document.createElement('style'); s.id = 'csw-css'
  s.textContent = `.csw{display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-height:0;font-size:13px;text-align:left}
.csw-kop{display:flex;align-items:center;justify-content:space-between;gap:10px}
.csw-saldo{font-size:28px;font-weight:900;color:#fde68a;font-variant-numeric:tabular-nums;line-height:1.1}
.csw-saldo.min{color:#ff8fa3}
.csw-sub{font-size:11px;opacity:.75}
.csw-knoppen{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.csw-speel{padding:7px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:0;border-radius:12px;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.csw-speel:active{transform:scale(.96)}
.csw-lijst{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:0;list-style:none}
.csw-rij{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;align-items:center;padding:5px 2px;border-top:1px solid #ffffff14}
.csw-rij:first-child{border-top:0}
.csw-rij.ik{color:#c084fc;font-weight:800}
.csw-plek{text-align:center;opacity:.8}
.csw-naam{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.csw-tokens{font-variant-numeric:tabular-nums;font-weight:700}
.csw-leeg{margin:auto;padding:10px;text-align:center;opacity:.8;line-height:1.5}`
  document.head.append(s)
}

// "over 3 dagen", "morgen", "vandaag" tot de volgende 500
function wanneer(tt, volgende, nu) {
  if (!volgende) return ''
  const dagen = Math.ceil((volgende - nu) / 86400000)
  if (dagen <= 1) { const uren = Math.max(1, Math.ceil((volgende - nu) / 3600000)); return tt('+{n} over {u} uur', { n: WEEKBEDRAG, u: uren }) }
  return tt('+{n} over {d} dagen', { n: WEEKBEDRAG, d: dagen })
}

export async function tekenCasinoWidget(c, { supabase, uid, openSpel, open = openSpel || (() => {}), T = globalThis.T || (s => s), storage = globalThis.localStorage,
  casino, nu = () => Date.now() } = {}) {
  zetStijl()
  const tt = (s, w) => { try { return T(s, w) } catch (e) { return s } }
  c.replaceChildren()
  const doos = document.createElement('div'); doos.className = 'csw'
  const laden = document.createElement('div'); laden.className = 'csw-leeg'; laden.textContent = tt('Tokens laden…')
  doos.append(laden); c.append(doos)

  let ov = null
  try { ov = await (casino || maakCasino({ supabase, spel: 'eenentwintigen', storage })).overzicht() } catch (e) { ov = null }

  const naamVan = v => {
    if (v.isSelf) return tt('Jij')
    try { const n = kort(storage?.getItem('vriend_naam_' + uid + '_' + v.id)); if (n) return n } catch (e) {}
    return kort(v.username) || tt('Vriend')
  }
  doos.replaceChildren()
  const kop = document.createElement('div'); kop.className = 'csw-kop'
  const links = document.createElement('div')
  const saldo = document.createElement('div'); saldo.className = 'csw-saldo'
  const sub = document.createElement('div'); sub.className = 'csw-sub'
  links.append(saldo, sub)
  const speel = document.createElement('button'); speel.type = 'button'; speel.className = 'csw-speel'; speel.textContent = tt('♠️ Black Jack')
  speel.onclick = e => { e.stopPropagation(); open('eenentwintigen') }
  // 27 nov 2026: ook Poker
  const poker = document.createElement('button'); poker.type = 'button'; poker.className = 'csw-speel'; poker.dataset.spel = 'pokertexasholdem'; poker.textContent = tt('🎲 Poker')
  poker.onclick = e => { e.stopPropagation(); open('pokertexasholdem') }
  speel.dataset.spel = 'eenentwintigen'
  // 27 nov 2026: ook Video Poker
  const vp = document.createElement('button'); vp.type = 'button'; vp.className = 'csw-speel'; vp.dataset.spel = 'videopoker'; vp.textContent = tt('🎰 Video Poker')
  vp.onclick = e => { e.stopPropagation(); open('videopoker') }
  // 28 nov 2026: ook Hoger of lager en de Fruitautomaat
  const extra = [['hogerlager', '🃏 ' + tt('Hoger of lager')], ['fruitautomaat', '🍒 ' + tt('Fruitautomaat')]].map(([id, tekst]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'csw-speel'; b.dataset.spel = id; b.textContent = tekst
    b.onclick = e => { e.stopPropagation(); open(id) }
    return b
  })
  const knoppen = document.createElement('div'); knoppen.className = 'csw-knoppen'; knoppen.append(speel, poker, vp, ...extra)
  kop.append(links)
  doos.append(kop, knoppen)

  if (!ov) {
    saldo.textContent = '🪙 –'
    sub.textContent = tt('Tokens')
    const leeg = document.createElement('div'); leeg.className = 'csw-leeg'
    leeg.textContent = tt('Met internet en een account krijg je elke week {n} tokens om mee te spelen.', { n: WEEKBEDRAG })
    doos.append(leeg)
    return { ov }
  }
  saldo.textContent = '🪙 ' + ov.saldo
  saldo.classList.toggle('min', ov.saldo < 0)
  saldo.setAttribute('aria-label', tt('Saldo: {n} tokens', { n: ov.saldo }))
  sub.textContent = [wanneer(tt, ov.volgende, nu()), ov.saldo <= MINIMUM ? tt('je staat op het minimum') : ''].filter(Boolean).join(' · ')

  if (ov.vrienden.length <= 1) {
    const leeg = document.createElement('div'); leeg.className = 'csw-leeg'
    leeg.textContent = tt('Nog geen vrienden met tokens. Wie wordt de rijkste?')
    doos.append(leeg)
    return { ov }
  }
  const lijst = document.createElement('ul'); lijst.className = 'csw-lijst'
  ov.vrienden.forEach((v, i) => {
    const li = document.createElement('li'); li.className = 'csw-rij' + (v.isSelf ? ' ik' : '')
    const plek = document.createElement('span'); plek.className = 'csw-plek'; plek.textContent = i === 0 ? '👑' : String(i + 1)
    const naam = document.createElement('span'); naam.className = 'csw-naam'; naam.textContent = naamVan(v)
    const tok = document.createElement('span'); tok.className = 'csw-tokens'; tok.textContent = '🪙 ' + v.saldo
    li.append(plek, naam, tok); lijst.append(li)
  })
  doos.append(lijst)
  return { ov }
}
