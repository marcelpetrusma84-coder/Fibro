// weer.js (v1, 19 nov 2026) - de weer-widget: het weer van nu en de komende dagen voor een plaats die je kiest.
//
// In gewone woorden: je typt een plaats (bijvoorbeeld Utrecht) en kiest hem uit de lijst. JOUW toestel vraagt het
// weer aan Open-Meteo (gratis, zonder account, zonder reclame). Dat is heel weinig data: een paar KB per keer, en
// hoogstens één keer per half uur (VERS_MS). Het weer wordt op dit toestel bewaard en gaat via de gewone
// synchronisatie naar je vrienden (sync.js, 'klein:weer'): vrienden praten met niemand, ook niet met Open-Meteo.
//  - alleen de plaats die je zelf kiest; nooit de echte locatie (GPS) van je telefoon
//  - Home ververst vanzelf als het weer ouder is dan een half uur (en met de knop ↻)
//  - wat van een vriend komt gaat door normaliseer(): alleen getallen binnen redelijke grenzen en korte tekst
//  - huisregel: alleen index.html mag Open-Meteo vragen (connect-src); vriend-profiel.html niet
//
// Opslag: localStorage 'weer_<uid>' = JSON { plaats: { naam, gebied, land, lat, lon }, nu: { temp, code, wind, dag },
// dagen: [{ datum: 'JJJJ-MM-DD', code, max, min, regen }], bijgewerkt } (hoogstens 5 dagen).
//
// Gebruik:
//   normaliseer(cfg)                                   -> cfg of null
//   zoekPlaatsen(naam, { fetch })                      -> [{ naam, gebied, land, lat, lon }] of null (mislukt)
//   haalWeer(plaats, { fetch })                        -> { nu, dagen } of null (mislukt)
//   tekenWeerWidget(el, { cfg, eigen, bewaar, zoek, ophalen })

const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const ZOEK_URL = 'https://geocoding-api.open-meteo.com/v1/search'
export const WEER_URL = 'https://api.open-meteo.com/v1/forecast'
export const VERS_MS = 30 * 60 * 1000 // ouder dan een half uur: Home haalt nieuw weer
export const NU_OUD_MS = 6 * 60 * 60 * 1000 // "nu" van een vriend ouder dan 6 uur: niet meer als "nu" tonen
export const MAX_DAGEN = 5

// eslint-disable-next-line no-control-regex
const tekst = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const getal = (n, min, max) => { const x = Number(n); return n !== null && n !== '' && Number.isFinite(x) && x >= min && x <= max ? x : null }
const rond = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f }

// De weercodes van Open-Meteo (WMO). Pas bij het tekenen vertalen (de taal kan veranderen).
export const CODES = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]
export function weerbeeld(code, dag = true) {
  switch (code) {
    case 0: return { icoon: dag ? '☀️' : '🌙', tekst: T('Helder') }
    case 1: return { icoon: dag ? '🌤️' : '🌙', tekst: T('Overwegend helder') }
    case 2: return { icoon: '⛅', tekst: T('Half bewolkt') }
    case 3: return { icoon: '☁️', tekst: T('Bewolkt') }
    case 45: case 48: return { icoon: '🌫️', tekst: T('Mist') }
    case 51: case 53: case 55: return { icoon: '🌦️', tekst: T('Motregen') }
    case 56: case 57: case 66: case 67: return { icoon: '🧊', tekst: T('IJzel') }
    case 61: case 63: return { icoon: '🌧️', tekst: T('Regen') }
    case 65: return { icoon: '🌧️', tekst: T('Zware regen') }
    case 71: case 73: case 77: return { icoon: '🌨️', tekst: T('Sneeuw') }
    case 75: return { icoon: '❄️', tekst: T('Zware sneeuw') }
    case 80: case 81: case 82: return { icoon: '🌦️', tekst: T('Buien') }
    case 85: case 86: return { icoon: '🌨️', tekst: T('Sneeuwbuien') }
    case 95: return { icoon: '⛈️', tekst: T('Onweer') }
    case 96: case 99: return { icoon: '⛈️', tekst: T('Onweer met hagel') }
    default: return { icoon: '🌡️', tekst: '' }
  }
}
const netteCode = c => (Number.isInteger(c) && CODES.includes(c) ? c : null)

// Een plaats: naam, gebied (provincie), landcode, en de coördinaten (afgerond op 2 decimalen, ongeveer 1 km)
export function nettePlaats(p) {
  if (!p || typeof p !== 'object') return null
  const naam = tekst(p.naam, 60), lat = getal(p.lat, -90, 90), lon = getal(p.lon, -180, 180)
  if (!naam || lat === null || lon === null) return null
  const land = /^[A-Z]{2}$/.test(String(p.land || '').toUpperCase()) ? String(p.land).toUpperCase() : ''
  return { naam, gebied: tekst(p.gebied, 60), land, lat: rond(lat, 2), lon: rond(lon, 2) }
}

// Uit opslag of van een vriend: altijd netjes. Geen goede plaats = null.
export function normaliseer(cfg) {
  if (!cfg || typeof cfg !== 'object') return null
  const plaats = nettePlaats(cfg.plaats)
  if (!plaats) return null
  const uit = { plaats, dagen: [], bijgewerkt: 0 }
  const n = cfg.nu
  if (n && typeof n === 'object') {
    const temp = getal(n.temp, -90, 65), code = netteCode(n.code)
    if (temp !== null && code !== null) {
      uit.nu = { temp: rond(temp, 1), code, dag: n.dag !== false && n.dag !== 0 }
      const wind = getal(n.wind, 0, 400)
      if (wind !== null) uit.nu.wind = Math.round(wind)
    }
  }
  for (const d of Array.isArray(cfg.dagen) ? cfg.dagen.slice(0, MAX_DAGEN * 2) : []) {
    if (!d || typeof d !== 'object' || typeof d.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.datum)) continue
    const code = netteCode(d.code), max = getal(d.max, -90, 65), min = getal(d.min, -90, 65)
    if (code === null || max === null || min === null || uit.dagen.some(x => x.datum === d.datum)) continue
    const dag = { datum: d.datum, code, max: Math.round(max), min: Math.round(min) }
    const regen = getal(d.regen, 0, 100)
    if (regen !== null) dag.regen = Math.round(regen)
    uit.dagen.push(dag)
    if (uit.dagen.length === MAX_DAGEN) break
  }
  uit.dagen.sort((a, b) => (a.datum < b.datum ? -1 : 1))
  const b = Number(cfg.bijgewerkt)
  if (Number.isFinite(b) && b > 0 && b < 8.64e15) uit.bijgewerkt = Math.round(b)
  return uit
}

async function vraag(url, f, ms) {
  const c = typeof AbortController === 'function' ? new AbortController() : null
  const klok = c ? setTimeout(() => c.abort(), ms) : null
  try {
    const r = await f(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: c ? c.signal : undefined })
    if (!r || !r.ok) return null
    return await r.json()
  } catch (e) { return null } finally { if (klok) clearTimeout(klok) }
}

// Plaatsen zoeken bij Open-Meteo (alleen de naam die je typt gaat mee). [] = niets gevonden, null = mislukt.
export async function zoekPlaatsen(naam, { fetch: f = globalThis.fetch, ms = 10000, taal = 'nl' } = {}) {
  const q = tekst(naam, 60)
  if (q.length < 2) return []
  const u = new URL(ZOEK_URL)
  u.searchParams.set('name', q); u.searchParams.set('count', '6'); u.searchParams.set('language', taal === 'en' ? 'en' : 'nl'); u.searchParams.set('format', 'json')
  const d = await vraag(u.href, f, ms)
  if (!d || typeof d !== 'object') return null
  const lijst = []
  for (const r of Array.isArray(d.results) ? d.results : []) {
    const p = nettePlaats({ naam: r && r.name, gebied: r && r.admin1, land: r && r.country_code, lat: r && r.latitude, lon: r && r.longitude })
    if (p && !lijst.some(x => x.lat === p.lat && x.lon === p.lon)) lijst.push(p)
  }
  return lijst
}

// Het weer voor een plaats: nu en de komende 5 dagen. null = mislukt.
export async function haalWeer(plaats, { fetch: f = globalThis.fetch, ms = 10000 } = {}) {
  const p = nettePlaats(plaats)
  if (!p) return null
  const u = new URL(WEER_URL)
  u.searchParams.set('latitude', String(p.lat)); u.searchParams.set('longitude', String(p.lon))
  u.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,is_day')
  u.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
  u.searchParams.set('timezone', 'auto'); u.searchParams.set('forecast_days', String(MAX_DAGEN))
  const d = await vraag(u.href, f, ms)
  if (!d || typeof d !== 'object') return null
  const c = d.current || {}, dl = d.daily || {}
  const dagen = (Array.isArray(dl.time) ? dl.time : []).map((datum, i) => ({
    datum, code: (dl.weather_code || [])[i], max: (dl.temperature_2m_max || [])[i], min: (dl.temperature_2m_min || [])[i],
    regen: (dl.precipitation_probability_max || [])[i],
  }))
  const schoon = normaliseer({ plaats: p, nu: { temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m, dag: c.is_day }, dagen })
  if (!schoon || (!schoon.nu && !schoon.dagen.length)) return null
  return { nu: schoon.nu, dagen: schoon.dagen }
}

// Vandaag als 'JJJJ-MM-DD' (op dit toestel)
export function vandaag(nu = new Date()) {
  const z = n => String(n).padStart(2, '0')
  return nu.getFullYear() + '-' + z(nu.getMonth() + 1) + '-' + z(nu.getDate())
}
const locale = () => (window.T && window.T.locale) || 'nl-NL'
export function dagNaam(datum, nu = new Date()) {
  if (datum === vandaag(nu)) return T('Vandaag')
  try { return new Date(datum + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '') } catch (e) { return datum.slice(5) }
}
export function wanneer(ms, nu = Date.now()) {
  if (!ms) return ''
  const min = Math.floor((nu - ms) / 60000)
  if (min < 1) return T('zojuist')
  if (min < 60) return T('{n} min geleden', { n: min })
  if (min < 24 * 60) return T('{n} uur geleden', { n: Math.floor(min / 60) })
  return T('{n} dagen geleden', { n: Math.floor(min / 1440) })
}
export const vlag = land => /^[A-Z]{2}$/.test(land || '') ? String.fromCodePoint(...[...land].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : ''
const graden = n => Math.round(n) + '°'

// ── uiterlijk (één keer in de pagina) ──
const CSS = `
.wr-weer{width:100%;height:100%;min-height:200px;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border-radius:14px;color:#fff;position:relative;z-index:2;text-align:left;font-family:inherit;
  background:linear-gradient(160deg,#8b3fd1,#6a2bab 55%,#1a0a2e)}
.wr-weer.wr-nacht{background:linear-gradient(160deg,#3a1a66,#1f0d3d 55%,#0d0618)}
.wr-weer.wr-bewerk{overflow-y:auto;max-height:min(460px,72vh);gap:7px}
.wr-boven{display:flex;align-items:center;gap:12px}
.wr-icoon{font-size:46px;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}
.wr-temp{font-size:40px;font-weight:800;line-height:1;letter-spacing:-.02em}
.wr-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.wr-plaats{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr-beeld{font-size:12.5px;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr-dagen{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:auto}
.wr-dag{display:flex;flex-direction:column;align-items:center;gap:2px;background:rgba(0,0,0,.22);border-radius:10px;padding:6px 2px;min-width:0}
.wr-dag b{font-size:11px;font-weight:700;text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.wr-dag .wr-di{font-size:20px;line-height:1.1}
.wr-dag .wr-mm{font-size:12px;font-weight:700;white-space:nowrap}
.wr-dag .wr-mm span{opacity:.6;font-weight:600}
.wr-dag .wr-rg{font-size:10px;color:#c9e6ff;white-space:nowrap}
.wr-voet{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wr-uitleg{font-size:10.5px;opacity:.65;line-height:1.3;flex:1;min-width:120px}
.wr-knopje{border:none;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.16);color:#fff}
.wr-knopje.wr-hoofd{background:#8b3fd1;box-shadow:0 0 0 1px rgba(255,255,255,.18)}
.wr-knopje:disabled{opacity:.5;cursor:default}
.wr-rij{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wr-veld{flex:1;min-width:0;box-sizing:border-box;background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.25);border-radius:8px;padding:7px 9px;color:#fff;font-size:13px;font-family:inherit;outline:none}
.wr-lijst{display:flex;flex-direction:column;gap:4px}
.wr-item{display:flex;align-items:center;gap:6px;border:none;width:100%;text-align:left;background:rgba(0,0,0,.25);color:#fff;border-radius:8px;padding:8px 9px;font-size:13px;cursor:pointer;font-family:inherit}
.wr-item:active{background:rgba(192,132,252,.35)}
.wr-item small{opacity:.65;font-size:11px}
.wr-melding{font-size:12px;color:#ffcf8a}
.wr-melding:empty{display:none}
.wr-naam{font-weight:700;font-size:14px;flex:1}
`
function zetCss() {
  if (document.getElementById('wr-css')) return
  const s = document.createElement('style'); s.id = 'wr-css'; s.textContent = CSS
  document.head.appendChild(s)
}
function el(tag, cls, inhoud) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (inhoud != null) e.textContent = inhoud
  return e
}
function knop(tekstje, cls, doe) {
  const k = el('button', 'wr-knopje' + (cls ? ' ' + cls : ''), tekstje)
  k.type = 'button'
  k.onclick = e => { e.stopPropagation(); doe(e) }
  return k
}

// Hoogstens één keer per half uur vanzelf ophalen, ook als het mislukt (per plaats)
const laatstePoging = new Map()

// ── De widget ──
// eigen: op Home (jouw toestel): plaats kiezen en vanzelf verversen. Zonder eigen (bij een vriend): alleen tonen.
export function tekenWeerWidget(c, { cfg = null, eigen = false, bewaar = null, zoek = zoekPlaatsen, ophalen = haalWeer, nu = () => Date.now() } = {}) {
  zetCss()
  const v = normaliseer(cfg)
  c.querySelectorAll('.wr-weer').forEach(x => x.remove())
  const w = el('div', 'wr-weer')
  c.appendChild(w)
  const taal = String(locale()).toLowerCase().startsWith('en') ? 'en' : 'nl'

  async function ververs(knopje) {
    if (!v || !bewaar) return
    laatstePoging.set(v.plaats.lat + ',' + v.plaats.lon, nu())
    if (knopje) { knopje.disabled = true; knopje.textContent = T('Ophalen…') }
    const r = await ophalen(v.plaats)
    if (!r) { if (knopje) { knopje.disabled = false; knopje.textContent = '↻' } meldFout(T('Het weer ophalen lukt nu niet. Probeer het later nog eens.')); return }
    bewaar({ plaats: v.plaats, nu: r.nu, dagen: r.dagen, bijgewerkt: nu() })
  }
  let meldVak = null
  const meldFout = t => { if (meldVak) meldVak.textContent = t }

  function leeg() {
    w.textContent = ''
    w.style.alignItems = 'center'; w.style.justifyContent = 'center'; w.style.textAlign = 'center'
    const icoon = el('div', null, '🌤️'); icoon.style.fontSize = '34px'
    w.append(icoon, el('div', 'wr-beeld', T('Nog geen plaats')))
    if (eigen && bewaar) w.appendChild(knop(T('📍 Plaats kiezen'), 'wr-hoofd wr-kies', () => bewerk()))
  }

  function toon() {
    w.textContent = ''
    w.removeAttribute('style')
    const t = nu(), vandaagS = vandaag(new Date(t))
    const dagen = v.dagen.filter(d => d.datum >= vandaagS)
    // "nu": op Home altijd (net opgehaald); bij een vriend alleen als het niet te oud is
    const nuOk = v.nu && (eigen || (v.bijgewerkt && t - v.bijgewerkt < NU_OUD_MS))
    const hoofd = nuOk ? v.nu : (dagen[0] ? { code: dagen[0].code, temp: dagen[0].max, dag: true } : null)
    w.classList.toggle('wr-nacht', !!(nuOk && v.nu.dag === false))
    const boven = el('div', 'wr-boven')
    const beeld = hoofd ? weerbeeld(hoofd.code, hoofd.dag !== false) : { icoon: '🌡️', tekst: '' }
    boven.appendChild(el('div', 'wr-icoon', beeld.icoon))
    if (hoofd) boven.appendChild(el('div', 'wr-temp', graden(hoofd.temp)))
    const info = el('div', 'wr-info')
    const plaats = el('div', 'wr-plaats', v.plaats.naam + (vlag(v.plaats.land) ? ' ' + vlag(v.plaats.land) : ''))
    plaats.title = [v.plaats.naam, v.plaats.gebied].filter(Boolean).join(', ')
    info.appendChild(plaats)
    let sub = beeld.tekst
    if (nuOk && v.nu.wind != null) sub += (sub ? ' · ' : '') + T('wind {n} km/u', { n: v.nu.wind })
    if (!nuOk && hoofd) sub = T('Vandaag') + (sub ? ' · ' + sub : '')
    if (sub) info.appendChild(el('div', 'wr-beeld', sub))
    boven.appendChild(info)
    w.appendChild(boven)

    if (dagen.length) {
      const rij = el('div', 'wr-dagen')
      rij.style.gridTemplateColumns = 'repeat(' + dagen.length + ',1fr)'
      for (const d of dagen) {
        const vak = el('div', 'wr-dag')
        const b = weerbeeld(d.code, true)
        vak.title = b.tekst
        vak.appendChild(el('b', null, dagNaam(d.datum, new Date(t))))
        vak.appendChild(el('div', 'wr-di', b.icoon))
        const mm = el('div', 'wr-mm', graden(d.max) + ' ')
        mm.appendChild(el('span', null, graden(d.min)))
        vak.appendChild(mm)
        if (d.regen != null && d.regen >= 10) vak.appendChild(el('div', 'wr-rg', '💧' + d.regen + '%'))
        rij.appendChild(vak)
      }
      w.appendChild(rij)
    } else if (!hoofd) {
      w.appendChild(el('div', 'wr-beeld', T('Nog geen weerbericht.')))
    }

    const voet = el('div', 'wr-voet')
    voet.appendChild(el('div', 'wr-uitleg', v.bijgewerkt ? T('Bijgewerkt: {wanneer}', { wanneer: wanneer(v.bijgewerkt, t) }) + ' · Open-Meteo' : 'Open-Meteo'))
    if (eigen && bewaar) {
      const vk = knop('↻', 'wr-ververs', () => ververs(vk))
      vk.title = T('Vernieuwen'); vk.setAttribute('aria-label', T('Vernieuwen'))
      voet.append(vk, knop(T('📍 Plaats'), 'wr-wijzig', () => bewerk()))
    }
    w.appendChild(voet)
    meldVak = el('div', 'wr-melding')
    w.appendChild(meldVak)
  }

  function bewerk() {
    w.textContent = ''
    w.removeAttribute('style')
    w.classList.remove('wr-nacht')
    w.classList.add('wr-bewerk')
    const balk = el('div', 'wr-rij')
    balk.appendChild(el('div', 'wr-naam', T('Kies een plaats')))
    balk.appendChild(knop(T('Annuleren'), 'wr-terug', () => { w.classList.remove('wr-bewerk'); v ? toon() : leeg() }))
    w.appendChild(balk)
    const rij = el('div', 'wr-rij')
    const veld = el('input', 'wr-veld wr-zoekveld')
    veld.type = 'search'; veld.maxLength = 60; veld.enterKeyHint = 'search'; veld.autocomplete = 'off'
    veld.placeholder = T('Bijvoorbeeld Utrecht')
    veld.addEventListener('click', e => e.stopPropagation())
    veld.addEventListener('pointerdown', e => e.stopPropagation())
    const zoekKnop = knop(T('Zoeken'), 'wr-hoofd wr-zoek', () => zoeken())
    rij.append(veld, zoekKnop)
    w.appendChild(rij)
    const melding = el('div', 'wr-melding')
    const lijst = el('div', 'wr-lijst wr-uitkomst')
    w.append(melding, lijst)
    w.appendChild(el('div', 'wr-uitleg', T('Alleen de plaats die je kiest. Stekky gebruikt nooit de locatie van je telefoon. Het weer komt van Open-Meteo; je vrienden krijgen het van jou.')))
    if (v && bewaar) w.appendChild(knop(T('Weer weghalen'), 'wr-weg', () => { if (confirm(T('De plaats weghalen van je weer-widget?'))) bewaar(null) }))
    veld.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zoeken() } })
    setTimeout(() => { try { veld.focus() } catch (e) {} }, 30)

    async function zoeken() {
      const q = veld.value.trim()
      lijst.textContent = ''
      if (q.length < 2) { melding.textContent = T('Typ minstens 2 letters.'); return }
      melding.textContent = T('Zoeken…'); zoekKnop.disabled = true
      const r = await zoek(q, { taal })
      zoekKnop.disabled = false
      if (r === null) { melding.textContent = T('Zoeken lukt nu niet. Probeer het later nog eens.'); return }
      if (!r.length) { melding.textContent = T('Geen plaats gevonden.'); return }
      melding.textContent = ''
      for (const p of r) {
        const item = el('button', 'wr-item')
        item.type = 'button'
        item.appendChild(el('span', null, (vlag(p.land) ? vlag(p.land) + ' ' : '📍 ') + p.naam))
        if (p.gebied) item.appendChild(el('small', null, p.gebied))
        item.onclick = async e => {
          e.stopPropagation()
          melding.textContent = T('Ophalen…')
          lijst.querySelectorAll('button').forEach(b => { b.disabled = true })
          const weer = await ophalen(p)
          if (!weer) {
            melding.textContent = T('Het weer ophalen lukt nu niet. Probeer het later nog eens.')
            lijst.querySelectorAll('button').forEach(b => { b.disabled = false })
            return
          }
          laatstePoging.set(p.lat + ',' + p.lon, nu())
          bewaar({ plaats: p, nu: weer.nu, dagen: weer.dagen, bijgewerkt: nu() })
        }
        lijst.appendChild(item)
      }
    }
  }

  if (!v) return leeg()
  toon()
  // Op Home: ouder dan een half uur, dan vanzelf nieuw weer (hoogstens één poging per half uur)
  if (eigen && bewaar && nu() - (v.bijgewerkt || 0) > VERS_MS) {
    const sl = v.plaats.lat + ',' + v.plaats.lon
    if (nu() - (laatstePoging.get(sl) || 0) > VERS_MS) ververs(w.querySelector('.wr-ververs'))
  }
}
