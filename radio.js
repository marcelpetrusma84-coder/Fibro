// radio.js (v1, 18 nov 2026) - de radio-widget: internetradio op je profiel, in een vintage radio.
//
// In gewone woorden: je zet tot 6 zenders op je radio (zoeken in Radio Browser, een open database met tienduizenden
// zenders, of zelf een stream-link plakken). Op je profiel (en bij je vrienden) staat een ouderwetse radio met een
// gloeiend schermpje, een zenderschaal, voorkeuzeknoppen 1 tot 6 en een draaiknop. Pas als iemand op ▶ tikt, maakt
// zijn toestel verbinding met de zender. Er is geen embed: de stream speelt in een gewone <audio>.
//  - alleen https-streams (http werkt niet in een https-app), geen HLS, alleen MP3 en AAC (die spelen overal).
//  - zoeken gebeurt alleen op het toestel van de eigenaar (Radio Browser, servers in ZOEK_SERVERS; ook in de huisregel
//    connect-src van index.html). We sturen geen "klik" naar Radio Browser: vrienden praten alleen met de zender.
//  - wat van een vriend komt gaat door normaliseer(): https, geen inlog, geen adressen in je eigen netwerk.
//  - speelt de radio, dan is je profielmuziek stil ('fibro-spel-open' / 'fibro-spel-dicht', zie profielmuziek.js).
//
// Opslag: localStorage 'radio_<uid>' = JSON { zenders: [{ naam, url, land }] } (hoogstens 6). Vrienden krijgen hem via
// sync.js ('klein:radio').
//
// Gebruik:
//   normaliseer(cfg)                     -> { zenders } of null
//   zenderUitLink(url, naam)             -> zender of { fout }
//   zoekZenders({ naam, land, tag })     -> [zenders] (owner, Radio Browser)
//   tekenRadioWidget(el, { cfg, eigen, bewaar })

Object.assign(window.FIBRO_EN ||= {}, {
  'Radio': 'Radio', 'Nog geen zender': 'No station yet', '📻 Zenders kiezen': '📻 Choose stations', '✏️ Zenders': '✏️ Stations',
  'Zender {n} van {totaal}': 'Station {n} of {totaal}', 'Aan': 'On', 'Uit': 'Off', 'Andere zender': 'Next station',
  'Pas als je op ▶ tikt, maakt je toestel verbinding met {host}.': 'Only when you tap ▶ does your device connect to {host}.',
  'Verbinden…': 'Connecting…', 'Je luistert via {host}.': 'You are listening via {host}.', 'Deze zender speelt nu niet.': 'This station is not playing right now.',
  'Jouw zenders ({n}/{max})': 'Your stations ({n}/{max})', 'Nog geen zenders. Zoek er hieronder een.': 'No stations yet. Search for one below.',
  'Zoek een zender': 'Search for a station', '🔍 Zoeken': '🔍 Search', 'Zoeken…': 'Searching…', 'Niets gevonden.': 'Nothing found.',
  'Zoeken lukt nu niet. Probeer het later nog eens.': 'Searching does not work right now. Please try again later.',
  '📌 Vastzetten': '📌 Pin', 'Je radio is vol (6 zenders).': 'Your radio is full (6 stations).', 'Staat er al op.': 'Already on it.',
  'Eigen stream-link (https)': 'Your own stream link (https)', 'Naam van de zender': 'Station name', '➕ Toevoegen': '➕ Add',
  'Klaar ✓': 'Done ✓', 'Annuleren': 'Cancel', 'Weghalen': 'Remove',
  'Alleen https-links kunnen (http werkt niet in de app).': 'Only https links work (http does not work in the app).',
  'Dit is geen geldige link.': 'This is not a valid link.', 'Geef de zender een naam.': 'Give the station a name.',
  'Nederland': 'Netherlands', 'Nieuws': 'News', 'Chill': 'Chill', 'Lofi': 'Lofi', '80s': '80s', 'Jazz': 'Jazz', 'Klassiek': 'Classical',
  'Zenders uit Radio Browser, een open database zonder tracking.': 'Stations from Radio Browser, an open database without tracking.',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const MAX_ZENDERS = 6
// De servers van Radio Browser (ook in connect-src van index.html). We proberen ze in willekeurige volgorde.
export const ZOEK_SERVERS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info']
// Snelle zoekknoppen (een functie: de teksten worden vertaald op het moment dat ze getekend worden)
export const SNEL = () => [
  { label: '🇳🇱 ' + T('Nederland'), zoek: { land: 'NL' } }, { label: '📰 ' + T('Nieuws'), zoek: { tag: 'news' } },
  { label: '😌 ' + T('Chill'), zoek: { tag: 'chillout' } }, { label: '🎧 ' + T('Lofi'), zoek: { tag: 'lofi' } },
  { label: '🕺 ' + T('80s'), zoek: { tag: '80s' } }, { label: '🎷 ' + T('Jazz'), zoek: { tag: 'jazz' } }, { label: '🎻 ' + T('Klassiek'), zoek: { tag: 'classical' } },
]
const CODECS = new Set(['MP3', 'AAC', 'AAC+'])
const tekst = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)

// Adressen in je eigen netwerk (router, printer) of op je eigen toestel: nooit (een vriend kan zo'n link sturen)
function privéAdres(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home.arpa')) return true
  if (h.includes(':')) return true // IPv6-adressen: niet nodig voor radio
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

// Een stream-adres netjes maken: https, geen inlog, geen eigen netwerk. Geeft het adres of null.
export function netteStream(url) {
  if (typeof url !== 'string' || url.length > 500) return null
  let u
  try { u = new URL(url.trim()) } catch (e) { return null }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname || privéAdres(u.hostname)) return null
  u.hash = ''
  return u.href
}
const nettLand = l => typeof l === 'string' && /^[A-Za-z]{2}$/.test(l) ? l.toUpperCase() : ''

// Uit opslag of van een vriend: altijd netjes. Geen enkele goede zender = null.
export function normaliseer(cfg) {
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.zenders)) return null
  const zenders = []
  for (const z of cfg.zenders.slice(0, MAX_ZENDERS * 2)) {
    if (!z || typeof z !== 'object') continue
    const url = netteStream(z.url), naam = tekst(z.naam, 60)
    if (!url || !naam || zenders.some(x => x.url === url)) continue
    zenders.push({ naam, url, land: nettLand(z.land) })
    if (zenders.length === MAX_ZENDERS) break
  }
  return zenders.length ? { zenders } : null
}

// Zelf een stream-link toevoegen
export function zenderUitLink(url, naam) {
  const ruw = String(url || '').trim()
  if (/^http:\/\//i.test(ruw)) return { fout: T('Alleen https-links kunnen (http werkt niet in de app).') }
  const nette = netteStream(ruw)
  if (!nette) return { fout: T('Dit is geen geldige link.') }
  const n = tekst(naam, 60)
  if (!n) return { fout: T('Geef de zender een naam.') }
  return { naam: n, url: nette, land: '' }
}

// Wat Radio Browser teruggeeft: alleen werkende https-streams in MP3 of AAC, zonder HLS; dubbele eruit
export function filterResultaten(lijst) {
  const uit = []
  for (const s of Array.isArray(lijst) ? lijst : []) {
    if (!s || typeof s !== 'object' || Number(s.lastcheckok) !== 1 || Number(s.hls) === 1) continue
    if (!CODECS.has(String(s.codec || '').toUpperCase())) continue
    const url = netteStream(s.url_resolved || s.url)
    const naam = tekst(s.name, 60)
    if (!url || !naam || uit.some(x => x.url === url)) continue
    uit.push({ naam, url, land: nettLand(s.countrycode), codec: String(s.codec).toUpperCase().slice(0, 6), bitrate: Number(s.bitrate) > 0 ? Math.min(9999, Math.round(Number(s.bitrate))) : 0 })
  }
  return uit
}

// Zoeken in Radio Browser (alleen op het toestel van de eigenaar). Geeft een lijst, of null als het niet lukt.
export async function zoekZenders({ naam = '', land = '', tag = '' } = {}, { fetch: f = globalThis.fetch, servers = ZOEK_SERVERS, ms = 7000 } = {}) {
  const p = new URLSearchParams({ hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '40' })
  const n = tekst(naam, 60), l = nettLand(land), t = tekst(tag, 30).toLowerCase()
  if (n) p.set('name', n)
  if (l) p.set('countrycode', l)
  if (t) p.set('tag', t)
  const volgorde = [...servers].sort(() => Math.random() - 0.5)
  for (const s of volgorde) {
    const c = typeof AbortController === 'function' ? new AbortController() : null
    const klok = c ? setTimeout(() => c.abort(), ms) : null
    try {
      const r = await f('https://' + s + '/json/stations/search?' + p, { credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', signal: c ? c.signal : undefined })
      if (r && r.ok) return filterResultaten(await r.json()).slice(0, 25)
    } catch (e) {} finally { if (klok) clearTimeout(klok) }
  }
  return null
}

export const vlag = land => /^[A-Z]{2}$/.test(land || '') ? String.fromCodePoint(...[...land].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '📻'
export const host = url => { try { return new URL(url).hostname } catch (e) { return '' } }

// ── uiterlijk: een vintage radio (één keer in de pagina) ──
const CSS = `
.rd-radio{width:100%;height:100%;min-height:200px;display:flex;flex-direction:column;gap:8px;padding:10px;box-sizing:border-box;border-radius:14px;
  background:linear-gradient(160deg,#5b2a86,#2a1240 72%);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -4px 10px rgba(0,0,0,.45);color:#fff;position:relative;z-index:2;text-align:left;font-family:inherit}
.rd-boven{display:flex;gap:10px;flex:1;min-height:0}
.rd-luidspreker{width:32%;min-width:70px;border-radius:10px;background:radial-gradient(circle,#1a0a2e 1.7px,transparent 2px) 0 0/8px 8px,#41205f;box-shadow:inset 0 2px 7px rgba(0,0,0,.65)}
.rd-radio.rd-speelt .rd-luidspreker{animation:rd-bonk .9s ease-in-out infinite}
@keyframes rd-bonk{50%{box-shadow:inset 0 2px 7px rgba(0,0,0,.65),0 0 0 2px rgba(255,207,138,.18)}}
.rd-paneel{flex:1;display:flex;flex-direction:column;gap:7px;min-width:0}
.rd-scherm{background:#120720;border-radius:8px;padding:7px 9px;box-shadow:inset 0 0 14px rgba(255,170,60,.22);min-height:40px}
.rd-naam{color:#ffcf8a;font-weight:700;font-size:14px;line-height:1.25;text-shadow:0 0 7px rgba(255,170,60,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-sub{color:#e9b878;font-size:11px;opacity:.85;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-schaal{position:relative;height:22px;border-radius:6px;background:repeating-linear-gradient(90deg,rgba(255,207,138,.55) 0 1px,transparent 1px 9px) center/92% 45% no-repeat,#120720}
.rd-naald{position:absolute;top:3px;bottom:3px;width:2px;margin-left:-1px;border-radius:1px;background:#ff5a5a;box-shadow:0 0 6px #ff5a5a;transition:left .45s cubic-bezier(.3,1.4,.5,1)}
.rd-onder{display:flex;align-items:center;gap:8px}
.rd-presets{display:flex;gap:5px;flex:1;flex-wrap:wrap}
.rd-preset{min-width:27px;height:27px;padding:0 4px;border-radius:6px;border:none;background:#e8dcc8;color:#2a1240;font-weight:800;font-size:12px;box-shadow:0 3px 0 #8a7a62;cursor:pointer;font-family:inherit}
.rd-preset[aria-pressed="true"]{transform:translateY(2px);box-shadow:0 1px 0 #8a7a62;background:#ffcf8a}
.rd-aan{width:42px;height:42px;flex:none;border-radius:50%;border:none;background:#8b3fd1;color:#fff;font-size:16px;box-shadow:0 3px 0 #4b1f75;cursor:pointer}
.rd-aan[aria-pressed="true"]{background:#c0392b;box-shadow:0 3px 0 #6d1f17}
.rd-draai{width:42px;height:42px;flex:none;border-radius:50%;border:none;padding:0;cursor:pointer;position:relative;
  background:conic-gradient(#e2d2b4,#8a7a62,#e2d2b4,#8a7a62,#e2d2b4,#8a7a62,#e2d2b4);box-shadow:0 3px 7px rgba(0,0,0,.55);transition:transform .35s}
.rd-draai::after{content:'';position:absolute;top:5px;left:50%;width:3px;height:12px;margin-left:-1.5px;border-radius:2px;background:#2a1240}
.rd-uitleg{font-size:10.5px;color:rgba(255,255,255,.62);line-height:1.3}
.rd-rij{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rd-knopje{border:none;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.14);color:#fff}
.rd-knopje.rd-hoofd{background:#8b3fd1}
.rd-veld{flex:1;min-width:0;box-sizing:border-box;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.2);border-radius:8px;padding:7px 9px;color:#fff;font-size:13px;font-family:inherit;outline:none}
.rd-lijst{display:flex;flex-direction:column;gap:4px}
.rd-item{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.22);border-radius:8px;padding:5px 7px;font-size:12.5px}
.rd-item .rd-in{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-item .rd-klein{font-size:10.5px;opacity:.65}
.rd-melding{font-size:12px;color:#ffcf8a;min-height:0}
.rd-bewerk{overflow-y:auto;gap:7px}
`
function zetCss() {
  if (document.getElementById('rd-css')) return
  const s = document.createElement('style'); s.id = 'rd-css'; s.textContent = CSS
  document.head.appendChild(s)
}
function el(tag, cls, inhoud) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (inhoud != null) e.textContent = inhoud
  return e
}
const stop = f => e => { e.stopPropagation(); f(e) }
const meld = open => { try { window.dispatchEvent(new CustomEvent(open ? 'fibro-spel-open' : 'fibro-spel-dicht')) } catch (e) {} }

// ── De widget ──
export function tekenRadioWidget(c, { cfg = null, eigen = false, bewaar = null, zoek = zoekZenders } = {}) {
  zetCss()
  const v = normaliseer(cfg)
  c.querySelectorAll('.rd-radio').forEach(x => { const a = x.querySelector('audio'); if (a) { try { a.pause() } catch (e) {} } x.remove() })
  const radio = el('div', 'rd-radio')
  c.appendChild(radio)
  let nr = 0, audio = null, aan = false

  function uitzetten() {
    if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load() } catch (e) {} audio.remove(); audio = null }
    if (aan) meld(false)
    aan = false
    radio.classList.remove('rd-speelt')
  }

  function leeg() {
    uitzetten()
    radio.textContent = ''
    radio.style.alignItems = 'center'; radio.style.justifyContent = 'center'; radio.style.textAlign = 'center'
    const icoon = el('div', null, '📻')
    icoon.style.fontSize = '30px'
    radio.append(icoon, el('div', 'rd-sub', T('Nog geen zender')))
    if (eigen && bewaar) {
      const k = el('button', 'rd-knopje rd-hoofd rd-kies', T('📻 Zenders kiezen'))
      k.type = 'button'; k.onclick = stop(() => bewerk([]))
      radio.appendChild(k)
    }
  }

  function toon() {
    radio.textContent = ''
    radio.removeAttribute('style')
    const z = () => v.zenders[nr]
    const boven = el('div', 'rd-boven'), paneel = el('div', 'rd-paneel')
    const scherm = el('div', 'rd-scherm'), naam = el('div', 'rd-naam'), sub = el('div', 'rd-sub')
    scherm.append(naam, sub)
    const schaal = el('div', 'rd-schaal'), naald = el('div', 'rd-naald')
    schaal.appendChild(naald)
    paneel.append(scherm, schaal)
    boven.append(el('div', 'rd-luidspreker'), paneel)
    const onder = el('div', 'rd-onder'), presets = el('div', 'rd-presets')
    v.zenders.forEach((x, i) => {
      const b = el('button', 'rd-preset', String(i + 1))
      b.type = 'button'; b.title = x.naam; b.setAttribute('aria-label', x.naam)
      b.onclick = stop(() => kies(i))
      presets.appendChild(b)
    })
    const knop = el('button', 'rd-aan', '▶')
    knop.type = 'button'
    knop.onclick = stop(() => { if (aan) { uitzetten(); werkBij() } else speel() })
    const draai = el('button', 'rd-draai')
    draai.type = 'button'; draai.title = T('Andere zender'); draai.setAttribute('aria-label', T('Andere zender'))
    let hoek = 0
    draai.onclick = stop(() => { hoek += 60; draai.style.transform = 'rotate(' + hoek + 'deg)'; kies((nr + 1) % v.zenders.length) })
    onder.append(presets, knop, draai)
    const uitleg = el('div', 'rd-uitleg')
    radio.append(boven, onder, uitleg)
    if (eigen && bewaar) {
      const w = el('button', 'rd-knopje rd-wijzig', T('✏️ Zenders'))
      w.type = 'button'; w.onclick = stop(() => { uitzetten(); bewerk(v.zenders.slice()) })
      w.style.alignSelf = 'flex-start'
      radio.appendChild(w)
    }

    function werkBij(status) {
      naam.textContent = z().naam
      sub.textContent = status || (vlag(z().land) + '  ' + T('Zender {n} van {totaal}', { n: nr + 1, totaal: v.zenders.length }))
      naald.style.left = (v.zenders.length === 1 ? 50 : 8 + nr * (84 / (v.zenders.length - 1))) + '%'
      presets.querySelectorAll('.rd-preset').forEach((b, i) => b.setAttribute('aria-pressed', String(i === nr)))
      knop.textContent = aan ? '■' : '▶'
      knop.setAttribute('aria-pressed', String(aan)); knop.setAttribute('aria-label', aan ? T('Uit') : T('Aan'))
      uitleg.textContent = aan ? T('Je luistert via {host}.', { host: host(z().url) }) : T('Pas als je op ▶ tikt, maakt je toestel verbinding met {host}.', { host: host(z().url) })
    }
    function kies(i) {
      nr = i
      if (aan) speel()
      else werkBij()
    }
    // Pas hier wordt er iets van buiten geladen
    function speel() {
      if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load() } catch (e) {} audio.remove(); audio = null }
      audio = document.createElement('audio')
      audio.className = 'rd-audio'
      audio.preload = 'none'
      audio.style.display = 'none'
      audio.src = z().url
      radio.appendChild(audio) // in de pagina: haalt Home de widget weg, dan stopt de radio vanzelf
      const ditAudio = audio
      audio.onplaying = () => { if (audio === ditAudio) { radio.classList.add('rd-speelt'); werkBij() } }
      audio.onerror = () => { if (audio !== ditAudio) return; uitzetten(); werkBij(T('Deze zender speelt nu niet.')) }
      if (!aan) meld(true)
      aan = true
      werkBij(T('Verbinden…'))
      try { const p = audio.play(); if (p && p.catch) p.catch(() => { if (audio === ditAudio) { uitzetten(); werkBij(T('Deze zender speelt nu niet.')) } }) } catch (e) {}
    }
    werkBij()
  }

  // ── zenders kiezen (alleen de eigenaar) ──
  function bewerk(lijst) {
    radio.textContent = ''
    radio.removeAttribute('style')
    radio.classList.add('rd-bewerk')
    const kop = el('div', 'rd-naam'), mijn = el('div', 'rd-lijst')
    function tekenMijn() {
      kop.textContent = T('Jouw zenders ({n}/{max})', { n: lijst.length, max: MAX_ZENDERS })
      mijn.textContent = ''
      if (!lijst.length) mijn.appendChild(el('div', 'rd-uitleg', T('Nog geen zenders. Zoek er hieronder een.')))
      lijst.forEach((x, i) => {
        const r = el('div', 'rd-item')
        r.append(el('span', null, (i + 1) + '.'), el('span', 'rd-in', vlag(x.land) + ' ' + x.naam))
        const weg = el('button', 'rd-knopje rd-weg', '✕')
        weg.type = 'button'; weg.title = T('Weghalen'); weg.setAttribute('aria-label', T('Weghalen') + ': ' + x.naam)
        weg.onclick = stop(() => { lijst.splice(i, 1); tekenMijn() })
        r.appendChild(weg)
        mijn.appendChild(r)
      })
    }
    const melding = el('div', 'rd-melding')
    const zoekRij = el('div', 'rd-rij'), veld = el('input', 'rd-veld rd-zoekveld')
    veld.placeholder = T('Zoek een zender'); veld.maxLength = 60; veld.autocomplete = 'off'
    const zoekKnop = el('button', 'rd-knopje rd-hoofd rd-zoek', T('🔍 Zoeken'))
    zoekKnop.type = 'button'
    zoekRij.append(veld, zoekKnop)
    const snel = el('div', 'rd-rij')
    for (const s of SNEL()) {
      const b = el('button', 'rd-knopje rd-snel', s.label)
      b.type = 'button'; b.onclick = stop(() => zoeken(s.zoek))
      snel.appendChild(b)
    }
    const uitkomst = el('div', 'rd-lijst rd-uitkomst')
    async function zoeken(vraag) {
      melding.textContent = T('Zoeken…'); uitkomst.textContent = ''
      const r = await zoek(vraag)
      if (!radio.isConnected) return
      if (r === null) { melding.textContent = T('Zoeken lukt nu niet. Probeer het later nog eens.'); return }
      melding.textContent = r.length ? '' : T('Niets gevonden.')
      for (const x of r) {
        const rij = el('div', 'rd-item')
        const tekstje = el('span', 'rd-in', vlag(x.land) + ' ' + x.naam)
        const info = el('span', 'rd-klein', x.codec + (x.bitrate ? ' ' + x.bitrate : ''))
        const pin = el('button', 'rd-knopje rd-pin', T('📌 Vastzetten'))
        pin.type = 'button'
        pin.onclick = stop(() => {
          if (lijst.some(y => y.url === x.url)) { melding.textContent = T('Staat er al op.'); return }
          if (lijst.length >= MAX_ZENDERS) { melding.textContent = T('Je radio is vol (6 zenders).'); return }
          lijst.push({ naam: x.naam, url: x.url, land: x.land }); melding.textContent = ''; tekenMijn()
        })
        rij.append(tekstje, info, pin)
        uitkomst.appendChild(rij)
      }
    }
    zoekKnop.onclick = stop(() => { const t = veld.value.trim(); if (t) zoeken({ naam: t }) })
    veld.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') zoekKnop.click() }
    veld.onclick = e => e.stopPropagation()
    // eigen stream-link
    const eigenRij = el('div', 'rd-rij'), link = el('input', 'rd-veld rd-link'), naamVeld = el('input', 'rd-veld rd-linknaam')
    link.placeholder = T('Eigen stream-link (https)'); link.type = 'url'; link.inputMode = 'url'; link.autocomplete = 'off'
    link.style.flexBasis = '100%' // de link op een eigen regel, naam en knop eronder
    naamVeld.placeholder = T('Naam van de zender'); naamVeld.maxLength = 60
    const erbij = el('button', 'rd-knopje rd-erbij', T('➕ Toevoegen'))
    erbij.type = 'button'
    erbij.onclick = stop(() => {
      const r = zenderUitLink(link.value, naamVeld.value)
      if (r.fout) { melding.textContent = r.fout; return }
      if (lijst.some(y => y.url === r.url)) { melding.textContent = T('Staat er al op.'); return }
      if (lijst.length >= MAX_ZENDERS) { melding.textContent = T('Je radio is vol (6 zenders).'); return }
      lijst.push(r); link.value = ''; naamVeld.value = ''; melding.textContent = ''; tekenMijn()
    })
    for (const x of [link, naamVeld]) { x.onclick = e => e.stopPropagation(); x.onkeydown = e => e.stopPropagation() }
    eigenRij.append(link, naamVeld, erbij)
    const knoppen = el('div', 'rd-rij')
    const klaar = el('button', 'rd-knopje rd-hoofd rd-klaar', T('Klaar ✓'))
    klaar.type = 'button'
    klaar.onclick = stop(() => { radio.classList.remove('rd-bewerk'); bewaar(lijst.length ? { zenders: lijst } : null) })
    const terug = el('button', 'rd-knopje', T('Annuleren'))
    terug.type = 'button'
    terug.onclick = stop(() => { radio.classList.remove('rd-bewerk'); if (v) toon(); else leeg() })
    knoppen.append(klaar, terug)
    radio.append(kop, mijn, zoekRij, snel, melding, uitkomst, eigenRij, knoppen,
      el('div', 'rd-uitleg', T('Zenders uit Radio Browser, een open database zonder tracking.')))
    tekenMijn()
  }

  if (v) toon()
  else leeg()
  return { uitzetten }
}
