// wachtspellen.js (v1, 28 nov 2026, Marcel) - snel een gokje terwijl je wacht: Hoger of lager en de Fruitautomaat als
// wachtspelletje bij de casinospellen (Black Jack en Poker).
//
// In gewone woorden: waar je wacht op je medespelers (de wachtkamer van de groepschat, het wachtscherm met een vriend)
// en als je bij Poker uit het spel ligt terwijl de anderen doorspelen, staan twee knoppen: 🃏 Hoger of lager en
// 🍒 Fruitautomaat. Een tik zet het spelletje op die plek; ✕ brengt je terug naar de knoppen.
//  - Met tokens alleen als jij 18+ bent én iedereen in de chat ook (casinoMagHier in leeftijd.js vraagt het aan de server:
//    met een vriend die vriend, in een groep alle leden). Anders speel je dezelfde spelletjes zonder tokens.
//  - Gaat de wachtkamer dicht (het spel begint), dan gaat het spelletje mee weg. Een lopende inzet wordt gewoon
//    afgerond (Hoger of lager: casino.js onthoudt de uitslag; de Fruitautomaat: de server draait in één keer).
//
//   isCasinoSpel(id)                        true voor de spellen die wachtspelletjes krijgen (Black Jack, Poker)
//   wachtspelKnoppen(houder, { vriend, groep, supabase })   zet de knoppen in houder; geeft { el }
//       el = het hele blok: zet het na het opnieuw tekenen gewoon weer terug (een lopend spelletje gaat mee)
import { casinoMagHier } from './leeftijd.js?v=1'
import { maakCasino } from './casino.js?v=5'

export const CASINO_WACHT = ['eenentwintigen', 'pokertexasholdem']
export const isCasinoSpel = id => CASINO_WACHT.includes(id)
export const WACHTSPELLEN = [
  { id: 'hogerlager', icoon: '🃏', naam: 'Hoger of lager', bestand: './hogerlager-ui.js?v=2', maak: 'maakHogerLager' },
  { id: 'fruitautomaat', icoon: '🍒', naam: 'Fruitautomaat', bestand: './fruitautomaat-ui.js?v=2', maak: 'maakFruitautomaat' },
]
const T = (s, v) => (typeof window !== 'undefined' && window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
if (typeof window !== 'undefined') Object.assign(window.FIBRO_EN ||= {}, {
  '🎰 Snel een gokje terwijl je wacht': '🎰 A quick bet while you wait', 'Hoger of lager': 'Higher or lower', 'Fruitautomaat': 'Fruit machine',
  'Terug naar de keuze': 'Back to the choice', '🎰 Snel een gokje': '🎰 A quick bet', 'Sluiten': 'Close',
})

function zetStijl() {
  if (document.getElementById('ws-css')) return
  const s = document.createElement('style'); s.id = 'ws-css'
  s.textContent = `.ws{width:100%;margin-top:10px;color:#fff;text-align:center}
.ws-titel{font-size:13px;font-weight:700;opacity:.8;margin-bottom:6px}
.ws-knoppen{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ws-knop{min-height:48px;padding:10px 8px;border:0;border-radius:14px;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
.ws-knop:active{transform:scale(.97)}
.ws-spel{position:relative;padding:10px 6px 8px;border:1px solid #c084fc55;border-radius:16px;background:#1a0a2ecc}
.ws-spel[hidden],.ws-knoppen[hidden],.ws-titel[hidden]{display:none}
.ws-dicht{position:absolute;top:6px;right:6px;z-index:6;width:34px;height:34px;border:0;border-radius:50%;background:#ffffff1f;color:#fff;font-size:16px;cursor:pointer}
.ws-paneel{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;width:min(94vw,380px);max-height:72%;overflow:auto;padding:12px;border:1px solid #c084fc88;border-radius:20px;background:#160a26f2;box-shadow:0 18px 50px #000a}
.ws-paneel[hidden]{display:none}
.ws-open{position:absolute;left:50%;top:64px;transform:translateX(-50%);z-index:59;padding:10px 16px;border:0;border-radius:999px;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;box-shadow:0 6px 18px #0008;cursor:pointer}
.ws-open[hidden]{display:none}
.ws-sluit{width:100%;margin-top:8px;min-height:40px;background:#ffffff1f}`
  document.head.append(s)
}

export function wachtspelKnoppen(houder, { vriend = null, groep = null, supabase = null } = {}) {
  zetStijl()
  const el = document.createElement('div'); el.className = 'ws'
  el.innerHTML = '<div class="ws-titel"></div><div class="ws-knoppen"></div><div class="ws-spel" hidden><button type="button" class="ws-dicht">✕</button><div class="ws-vak"></div></div>'
  el.querySelector('.ws-titel').textContent = T('🎰 Snel een gokje terwijl je wacht')
  const dicht = el.querySelector('.ws-dicht'); dicht.setAttribute('aria-label', T('Terug naar de keuze')); dicht.title = dicht.getAttribute('aria-label')
  let mag = null   // Promise<boolean>: met tokens? (één keer vragen)
  async function sb() {
    if (supabase) return supabase
    try { return (await import('./supabase.js?v=95')).supabase } catch (e) { return null }
  }
  const tokensMogen = () => (mag ||= sb().then(c => casinoMagHier({ supabase: c, vriend, groep })).catch(() => false))
  function knoppen(aan) {
    el.querySelector('.ws-knoppen').hidden = !aan; el.querySelector('.ws-titel').hidden = !aan
    el.querySelector('.ws-spel').hidden = aan
  }
  async function open(w) {
    knoppen(false)
    const vak = el.querySelector('.ws-vak'); vak.replaceChildren()
    let m
    try { m = await import(w.bestand) } catch (e) { knoppen(true); return }
    const metTokens = await tokensMogen()
    const c = metTokens ? await sb() : null
    let casino = null
    try { casino = metTokens && c ? maakCasino({ supabase: c, spel: w.id }) : null } catch (e) { casino = null }
    if (el.querySelector('.ws-spel').hidden) return   // al teruggegaan
    m[w.maak](vak, { casino })
  }
  for (const w of WACHTSPELLEN) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ws-knop'; b.dataset.spel = w.id
    b.textContent = w.icoon + ' ' + T(w.naam)
    b.onclick = () => open(w)
    el.querySelector('.ws-knoppen').append(b)
  }
  dicht.onclick = () => { el.querySelector('.ws-vak').replaceChildren(); knoppen(true) }
  houder?.appendChild(el)
  return { el }
}

// Voor een spel dat doorloopt terwijl jij niets meer kunt (Poker: je ligt eruit). Een knop "🎰 Snel een gokje" bovenin
// tafel; een tik opent een paneel met de wachtspelletjes. zichtbaar(true/false) zet de knop aan of uit.
export function wachtspelKnop(tafel, opties = {}) {
  zetStijl()
  const knop = document.createElement('button'); knop.type = 'button'; knop.className = 'ws-open'; knop.hidden = true
  knop.textContent = T('🎰 Snel een gokje')
  const paneel = document.createElement('div'); paneel.className = 'ws-paneel'; paneel.hidden = true
  paneel.setAttribute('role', 'dialog')
  const sluit = document.createElement('button'); sluit.type = 'button'; sluit.className = 'ws-knop ws-sluit'; sluit.textContent = T('Sluiten')
  sluit.onclick = () => { paneel.hidden = true; knop.hidden = !aan }
  let aan = false, blok = null
  knop.onclick = () => {
    if (!blok) { blok = wachtspelKnoppen(paneel, opties); paneel.append(sluit) }
    paneel.hidden = false; knop.hidden = true
  }
  tafel.append(knop, paneel)
  return {
    zichtbaar(ja) { aan = Boolean(ja); if (paneel.hidden) knop.hidden = !aan; if (!aan) { paneel.hidden = true; knop.hidden = true } },
    get open() { return !paneel.hidden },
  }
}
