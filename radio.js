// radio.js (v5, 19 nov 2026: het spelertje op het vergrendelscherm (vergrendelscherm.js); v4: vier skins erbij (radioskins.js v2); v3: skins van Marcel, zie radioskins.js; v2: pijltjes ‹ › om te zappen; Klaar vast bovenaan) - de radio-widget: internetradio op je profiel, in een vintage radio.
//
// In gewone woorden: je zet tot 4 zenders op je radio (zoeken in Radio Browser, een open database met tienduizenden
// zenders, of zelf een stream-link plakken). Op je profiel (en bij je vrienden) staat een ouderwetse radio met een
// gloeiend schermpje, een zenderschaal, voorkeuzeknoppen 1 tot 6, pijltjes ‹ › om te zappen en een draaiknop. Pas als iemand op ▶ tikt, maakt
// zijn toestel verbinding met de zender. Er is geen embed: de stream speelt in een gewone <audio>.
//  - alleen https-streams (http werkt niet in een https-app), geen HLS, alleen MP3 en AAC (die spelen overal).
//  - zoeken gebeurt alleen op het toestel van de eigenaar (Radio Browser, servers in ZOEK_SERVERS; ook in de huisregel
//    connect-src van index.html). We sturen geen "klik" naar Radio Browser: vrienden praten alleen met de zender.
//  - wat van een vriend komt gaat door normaliseer(): https, geen inlog, geen adressen in je eigen netwerk.
//  - speelt de radio, dan is je profielmuziek stil ('fibro-spel-open' / 'fibro-spel-dicht', zie profielmuziek.js).
//
// Opslag: localStorage 'radio_<uid>' = JSON { zenders: [{ naam, url, land }], skin } (hoogstens 4 zenders; skin is
// een naam uit radioskins.js, of niets voor de gewone paarse radio). Vrienden krijgen hem via sync.js ('klein:radio').
//
// v3 (19 nov 2026): skins. Het plaatje van de skin (uit de app zelf, radioskins/) is de achtergrond; daaroverheen het
// schermpje met de echte zender, een naaldje dat meeloopt, en onzichtbare knoppen precies op de getekende knoppen
// (‹ ›, 1-4, ▶ en de draaiknop, die meedraait). De radio heeft vier zenders, net zoveel als de knoppen op de skin.
//
// Gebruik:
//   normaliseer(cfg)                     -> { zenders } of null
//   zenderUitLink(url, naam)             -> zender of { fout }
//   zoekZenders({ naam, land, tag })     -> [zenders] (owner, Radio Browser)
//   tekenRadioWidget(el, { cfg, eigen, bewaar })

import { SKINS, SKIN_NAMEN, skinPlaatje } from './radioskins.js?v=2'
import { nuSpeelt, nuWeg } from './vergrendelscherm.js?v=1'

Object.assign(window.FIBRO_EN ||= {}, {
  '🎨 Skin': '🎨 Skin', 'Kies een skin voor je radio': 'Choose a skin for your radio', 'Standaard': 'Standard', 'Gekozen': 'Selected',
  'Retro hout': 'Retro wood', 'Cyberpunk / Neon': 'Cyberpunk / Neon', 'Futuristisch / Sci-Fi': 'Futuristic / Sci-Fi', 'Natuur / Botanisch': 'Nature / Botanical',
  'Graffiti / Street Art': 'Graffiti / Street Art', 'Pixel Art (8-bit)': 'Pixel Art (8-bit)', 'Steampunk / Messing': 'Steampunk / Brass',
  'Draak & Fantasy': 'Dragon & Fantasy', 'Snoep & Candy': 'Sweets & Candy', 'Onderwater / Aquarium': 'Underwater / Aquarium', 'Space & Sci-Fi': 'Space & Sci-Fi',
  'Radio': 'Radio', 'Nog geen zender': 'No station yet', '📻 Zenders kiezen': '📻 Choose stations', '✏️ Zenders': '✏️ Stations',
  'Zender {n} van {totaal}': 'Station {n} of {totaal}', 'Aan': 'On', 'Uit': 'Off', 'Andere zender': 'Next station',
  'Pas als je op ▶ tikt, maakt je toestel verbinding met {host}.': 'Only when you tap ▶ does your device connect to {host}.',
  'Lege plek': 'Empty slot', 'Verbinden…': 'Connecting…', 'Je luistert via {host}.': 'You are listening via {host}.', 'Deze zender speelt nu niet.': 'This station is not playing right now.',
  'Jouw zenders ({n}/{max})': 'Your stations ({n}/{max})', 'Nog geen zenders. Zoek er hieronder een.': 'No stations yet. Search for one below.',
  'Zoek een zender': 'Search for a station', '🔍 Zoeken': '🔍 Search', 'Zoeken…': 'Searching…', 'Niets gevonden.': 'Nothing found.',
  'Zoeken lukt nu niet. Probeer het later nog eens.': 'Searching does not work right now. Please try again later.',
  '📌 Vastzetten': '📌 Pin', 'Je radio is vol (4 zenders).': 'Your radio is full (4 stations).', 'Staat er al op.': 'Already on it.',
  'Eigen stream-link (https)': 'Your own stream link (https)', 'Naam van de zender': 'Station name', '➕ Toevoegen': '➕ Add',
  'Klaar ✓': 'Done ✓', 'Annuleren': 'Cancel', 'Weghalen': 'Remove',
  'Alleen https-links kunnen (http werkt niet in de app).': 'Only https links work (http does not work in the app).',
  'Dit is geen geldige link.': 'This is not a valid link.', 'Geef de zender een naam.': 'Give the station a name.',
  'Nederland': 'Netherlands', 'Nieuws': 'News', 'Chill': 'Chill', 'Lofi': 'Lofi', '80s': '80s', 'Jazz': 'Jazz', 'Klassiek': 'Classical',
  'Zenders uit Radio Browser, een open database zonder tracking.': 'Stations from Radio Browser, an open database without tracking.',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const MAX_ZENDERS = 4 // 26 nov 2026: vier, net als de vier voorkeuzeknoppen op elke skin (radioskins.js)
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
  if (!zenders.length) return null
  return SKIN_NAMEN.includes(cfg.skin) ? { zenders, skin: cfg.skin } : { zenders }
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
.rd-zap{display:flex;gap:5px;align-items:stretch}
.rd-scherm{flex:1;min-width:0;background:#120720;border-radius:8px;padding:7px 9px;box-shadow:inset 0 0 14px rgba(255,170,60,.22);min-height:40px}
.rd-pijl{width:30px;flex:none;border-radius:8px;border:none;padding:0;background:#e8dcc8;color:#2a1240;font-weight:800;font-size:22px;line-height:1;box-shadow:0 3px 0 #8a7a62;cursor:pointer;font-family:inherit}
.rd-pijl:active{transform:translateY(2px);box-shadow:0 1px 0 #8a7a62;background:#ffcf8a}
.rd-naam{color:#ffcf8a;font-weight:700;font-size:14px;line-height:1.25;text-shadow:0 0 7px rgba(255,170,60,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-sub{color:#e9b878;font-size:11px;opacity:.85;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-schaal{position:relative;height:22px;border-radius:6px;background:repeating-linear-gradient(90deg,rgba(255,207,138,.55) 0 1px,transparent 1px 9px) center/92% 45% no-repeat,#120720}
.rd-naald{position:absolute;top:3px;bottom:3px;width:2px;margin-left:-1px;border-radius:1px;background:#ff5a5a;box-shadow:0 0 6px #ff5a5a;transition:left .45s cubic-bezier(.3,1.4,.5,1)}
.rd-onder{display:flex;align-items:center;gap:8px}
.rd-presets{display:flex;gap:5px;flex:1;flex-wrap:wrap}
.rd-preset{min-width:27px;height:27px;padding:0 4px;border-radius:6px;border:none;background:#e8dcc8;color:#2a1240;font-weight:800;font-size:12px;box-shadow:0 3px 0 #8a7a62;cursor:pointer;font-family:inherit}
.rd-preset:disabled{opacity:.35;cursor:default}
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
.rd-radio.rd-bewerk{overflow-y:auto;gap:7px;max-height:min(460px,72vh)} /* niet eindeloos groeien: de lijst scrolt binnen de radio */
.rd-balk{position:sticky;top:-10px;z-index:3;margin:-10px -10px 0;padding:10px 10px 7px;background:#5b2a86;border-radius:14px 14px 0 0;box-shadow:0 5px 8px -6px rgba(0,0,0,.6);flex-wrap:nowrap}
.rd-balk .rd-naam{flex:1;min-width:0}
/* v3: skins (radioskins.js): het plaatje met daarover het schermpje, het naaldje en onzichtbare knoppen */
.rd-radio.rd-metskin{background:none;box-shadow:none;padding:0;gap:6px}
.rd-skin{position:relative;width:100%;flex:none;background-size:100% 100%;background-repeat:no-repeat;border-radius:12px;container-type:inline-size;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
.rd-skin>*{position:absolute;box-sizing:border-box}
.rd-sk{border:none;background:transparent;padding:0;margin:0;cursor:pointer;border-radius:10px;-webkit-tap-highlight-color:transparent}
.rd-sk:focus-visible{outline:2px solid #fff;outline-offset:1px}
.rd-sk:active{background:rgba(255,255,255,.18)}
.rd-sk:disabled{cursor:default;background:rgba(0,0,0,.42)}
.rd-sscherm{display:flex;flex-direction:column;justify-content:center;padding:0 5cqw;overflow:hidden;container-type:size;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;pointer-events:none}
.rd-sscherm .rd-naam,.rd-sscherm .rd-sub{color:inherit;text-shadow:none}
.rd-sscherm .rd-naam{font-size:min(36cqh,11.5cqw);font-weight:800;line-height:1.2} /* past ook in een laag schermpje (graffiti) */
.rd-sscherm .rd-sub{font-size:min(26cqh,8.6cqw);margin-top:3cqh;opacity:.95}
.rd-sk.rd-preset{min-width:0;height:auto;box-shadow:none;border-radius:9px}
.rd-sk.rd-preset[aria-pressed="true"]{transform:none;background:transparent;box-shadow:0 0 0 2px var(--rd-accent),0 0 12px var(--rd-accent)}
.rd-sk.rd-aan,.rd-sk.rd-draai{border-radius:50%;width:auto;height:auto;box-shadow:none}
.rd-sk.rd-aan[aria-pressed="true"]{background:rgba(0,0,0,.5);color:#fff;font-size:5cqw;box-shadow:0 0 14px var(--rd-accent)}
.rd-sk.rd-aan:not([aria-pressed="true"]){font-size:0}
.rd-sk.rd-draai{background-repeat:no-repeat;transition:transform .35s}
.rd-sk.rd-draai::after{display:none}
.rd-snaald{position:absolute;top:12%;bottom:12%;width:.7cqw;min-width:2px;margin-left:-.35cqw;border-radius:2px;background:var(--rd-accent);box-shadow:0 0 6px var(--rd-accent);transition:left .45s cubic-bezier(.3,1.4,.5,1)}
.rd-sschaal{pointer-events:none}
.rd-sspeaker{pointer-events:none;border-radius:10px}
.rd-radio.rd-speelt .rd-sspeaker{animation:rd-gloei 1.1s ease-in-out infinite}
@keyframes rd-gloei{50%{box-shadow:0 0 0 2px var(--rd-accent),0 0 16px var(--rd-accent)}}
.rd-skinkeus{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rd-skinoptie{display:flex;flex-direction:column;gap:5px;border:none;border-radius:12px;padding:6px;background:rgba(0,0,0,.25);color:#fff;cursor:pointer;font-family:inherit;text-align:left}
.rd-skinoptie[aria-pressed="true"]{box-shadow:0 0 0 2px #c084fc}
.rd-skinoptie .rd-voorbeeld{width:100%;border-radius:9px;background-size:100% 100%;background-repeat:no-repeat}
.rd-skinoptie .rd-standaard{aspect-ratio:608/260;border-radius:9px;background:linear-gradient(160deg,#5b2a86,#2a1240 72%)}
.rd-skinoptie span{font-size:11.5px;font-weight:700;display:flex;flex-direction:column;gap:1px;line-height:1.25}
.rd-skinoptie em{font-style:normal;font-weight:600;color:#c084fc;font-size:10.5px}
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
  nuWeg('radio') // v5: een oude radio hoort niet meer op het vergrendelscherm
  const radio = el('div', 'rd-radio')
  c.appendChild(radio)
  let nr = 0, audio = null, aan = false
  let zapper = null, laatsteWerkBij = null // v5: voor het vergrendelscherm (⏮ ⏭ = vorige/volgende zender)

  // v5 (19 nov 2026): het spelertje op het vergrendelscherm (vergrendelscherm.js): naam van de zender, "Live radio",
  // ⏮ ⏭ om te zappen, ⏸ zet de radio uit en ▶ weer aan. Zonder tijdbalk en spoelen: het is live.
  function vergrendelscherm(speelt) {
    const zender = v && v.zenders[nr]
    if (!zender) return nuWeg('radio')
    const n = v.zenders.length
    nuSpeelt('radio', {
      el: speelt ? audio : null, speelt, live: true,
      titel: zender.naam, artiest: T('Live radio') + (host(zender.url) ? ' · ' + host(zender.url) : ''),
      album: n > 1 ? T('Zender {n} van {totaal}', { n: nr + 1, totaal: n }) : '',
      vorige: n > 1 ? () => zapper && zapper(-1) : null,
      volgende: n > 1 ? () => zapper && zapper(1) : null,
      pauze: () => { uitzetten(); if (laatsteWerkBij) laatsteWerkBij() },
      verder: () => { if (!aan && v.zenders[nr]) speelStream(v.zenders[nr].url, laatsteWerkBij || (() => {})) },
      stop: () => { uitzetten(); if (laatsteWerkBij) laatsteWerkBij() },
    })
  }

  function uitzetten() {
    const wasAan = aan
    if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load() } catch (e) {} audio.remove(); audio = null }
    if (aan) meld(false)
    aan = false
    radio.classList.remove('rd-speelt')
    if (wasAan) vergrendelscherm(false) // gepauzeerd in beeld laten: ▶ op het vergrendelscherm zet hem weer aan
  }

  // Pas hier wordt er iets van buiten geladen (één plek, voor de gewone radio en voor de skins)
  function speelStream(url, werkBij) {
    if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load() } catch (e) {} audio.remove(); audio = null }
    audio = document.createElement('audio')
    audio.className = 'rd-audio'
    audio.preload = 'none'
    audio.style.display = 'none'
    audio.src = url
    radio.appendChild(audio) // in de pagina: haalt Home de widget weg, dan stopt de radio vanzelf
    const ditAudio = audio
    laatsteWerkBij = werkBij
    audio.onplaying = () => { if (audio === ditAudio) { radio.classList.add('rd-speelt'); werkBij(); vergrendelscherm(true) } }
    audio.onerror = () => { if (audio !== ditAudio) return; uitzetten(); werkBij(T('Deze zender speelt nu niet.')) }
    if (!aan) meld(true)
    aan = true
    werkBij(T('Verbinden…'))
    try { const p = audio.play(); if (p && p.catch) p.catch(() => { if (audio === ditAudio) { uitzetten(); werkBij(T('Deze zender speelt nu niet.')) } }) } catch (e) {}
  }

  function leeg() {
    uitzetten()
    radio.classList.remove('rd-metskin')
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
    if (v.skin && SKINS[v.skin]) return toonSkin(SKINS[v.skin])
    radio.classList.remove('rd-metskin')
    const z = () => v.zenders[nr]
    const boven = el('div', 'rd-boven'), paneel = el('div', 'rd-paneel')
    const scherm = el('div', 'rd-scherm'), naam = el('div', 'rd-naam'), sub = el('div', 'rd-sub')
    scherm.append(naam, sub)
    // zappen: ‹ vorige en › volgende zender, naast het schermpje (pas bij 2 of meer zenders)
    const zap = el('div', 'rd-zap')
    const pijl = (cls, teken, label, stap) => {
      const b = el('button', 'rd-pijl ' + cls, teken)
      b.type = 'button'; b.title = label; b.setAttribute('aria-label', label)
      b.onclick = stop(() => zappen(stap))
      return b
    }
    if (v.zenders.length > 1) zap.append(pijl('rd-vorige', '‹', T('Vorige zender'), -1), scherm, pijl('rd-volgende', '›', T('Volgende zender'), 1))
    else zap.append(scherm)
    const schaal = el('div', 'rd-schaal'), naald = el('div', 'rd-naald')
    schaal.appendChild(naald)
    paneel.append(zap, schaal)
    boven.append(el('div', 'rd-luidspreker'), paneel)
    const onder = el('div', 'rd-onder'), presets = el('div', 'rd-presets')
    // 26 nov 2026: altijd vier knoppen, ook met minder zenders (zoals op de skins); een lege plek is uitgeschakeld
    for (let i = 0; i < MAX_ZENDERS; i++) {
      const x = v.zenders[i]
      const b = el('button', 'rd-preset', String(i + 1))
      b.type = 'button'; b.title = x ? x.naam : ''; b.setAttribute('aria-label', x ? x.naam : T('Lege plek'))
      b.disabled = !x
      if (x) b.onclick = stop(() => kies(i))
      presets.appendChild(b)
    }
    const knop = el('button', 'rd-aan', '▶')
    knop.type = 'button'
    knop.onclick = stop(() => { if (aan) { uitzetten(); werkBij() } else speel() })
    const draai = el('button', 'rd-draai')
    draai.type = 'button'; draai.title = T('Andere zender'); draai.setAttribute('aria-label', T('Andere zender'))
    let hoek = 0
    draai.onclick = stop(() => zappen(1))
    // één stap verder of terug (rond: na de laatste komt weer de eerste); de draaiknop draait mee
    function zappen(stap) {
      const n = v.zenders.length
      hoek += 60 * stap; draai.style.transform = 'rotate(' + hoek + 'deg)'
      kies((nr + stap + n) % n)
    }
    zapper = zappen
    onder.append(presets, knop, draai)
    const uitleg = el('div', 'rd-uitleg')
    radio.append(boven, onder, uitleg)
    if (eigen && bewaar) radio.appendChild(eigenKnoppen())

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
    const speel = () => speelStream(z().url, werkBij)
    werkBij()
  }

  // ── v3: de radio met een skin (het plaatje + schermpje, naaldje en knoppen erover) ──
  function toonSkin(sk) {
    radio.classList.add('rd-metskin')
    radio.style.setProperty('--rd-accent', sk.accent)
    const z = () => v.zenders[nr]
    const vlak = el('div', 'rd-skin')
    vlak.style.backgroundImage = 'url("' + skinPlaatje(v.skin) + '")'
    vlak.style.aspectRatio = sk.b + ' / ' + sk.h
    const plek = (e, r) => { e.style.left = r[0] + '%'; e.style.top = r[1] + '%'; e.style.width = r[2] + '%'; e.style.height = r[3] + '%'; return e }
    const knopje = (cls, r, label, doe) => {
      const b = plek(el('button', 'rd-sk ' + cls), r)
      b.type = 'button'; b.title = label; b.setAttribute('aria-label', label)
      b.onclick = stop(doe)
      return b
    }
    const speaker = plek(el('div', 'rd-sspeaker'), sk.speaker)
    const scherm = plek(el('div', 'rd-sscherm'), sk.scherm)
    scherm.style.color = sk.tekst
    const naam = el('div', 'rd-naam'), sub = el('div', 'rd-sub')
    sub.style.color = sk.sub
    scherm.append(naam, sub)
    const schaal = plek(el('div', 'rd-sschaal'), sk.schaal), naald = el('div', 'rd-snaald')
    schaal.appendChild(naald)
    const vorige = knopje('rd-vorige', sk.vorige, T('Vorige zender'), () => zappen(-1))
    const volgende = knopje('rd-volgende', sk.volgende, T('Volgende zender'), () => zappen(1))
    vorige.disabled = volgende.disabled = v.zenders.length < 2
    const presets = sk.p.map((r, i) => {
      const b = knopje('rd-preset', r, v.zenders[i] ? v.zenders[i].naam : '', () => kies(i))
      b.textContent = ''
      b.disabled = !v.zenders[i]
      if (sk.rond) b.style.borderRadius = '50%'
      return b
    })
    const knop = knopje('rd-aan', sk.play, T('Aan'), () => { if (aan) { uitzetten(); werkBij() } else speel() })
    const draai = knopje('rd-draai', sk.knop, T('Andere zender'), () => zappen(1))
    // de draaiknop is een stukje van het plaatje zelf, zodat hij echt kan draaien
    draai.style.backgroundImage = 'url("' + skinPlaatje(v.skin) + '")'
    draai.style.backgroundSize = (10000 / sk.knop[2]) + '% ' + (10000 / sk.knop[3]) + '%'
    draai.style.backgroundPosition = (sk.knop[0] / (100 - sk.knop[2]) * 100) + '% ' + (sk.knop[1] / (100 - sk.knop[3]) * 100) + '%'
    let hoek = 0
    function zappen(stap) {
      const n = v.zenders.length
      if (n < 2) return
      hoek += 60 * stap; draai.style.transform = 'rotate(' + hoek + 'deg)'
      kies((nr + stap + n) % n)
    }
    zapper = zappen
    vlak.append(speaker, scherm, schaal, vorige, volgende, ...presets, knop, draai)
    const uitleg = el('div', 'rd-uitleg')
    radio.append(vlak, uitleg)
    if (eigen && bewaar) radio.appendChild(eigenKnoppen())
    function werkBij(status) {
      naam.textContent = z().naam
      sub.textContent = status || (vlag(z().land) + ' ' + T('Zender {n} van {totaal}', { n: nr + 1, totaal: v.zenders.length }))
      naald.style.left = (v.zenders.length === 1 ? 50 : 6 + nr * (88 / (v.zenders.length - 1))) + '%'
      presets.forEach((b, i) => b.setAttribute('aria-pressed', String(i === nr)))
      knop.textContent = aan ? '■' : '▶'
      knop.setAttribute('aria-pressed', String(aan)); knop.setAttribute('aria-label', aan ? T('Uit') : T('Aan'))
      uitleg.textContent = aan ? T('Je luistert via {host}.', { host: host(z().url) }) : T('Pas als je op ▶ tikt, maakt je toestel verbinding met {host}.', { host: host(z().url) })
    }
    function kies(i) { nr = i; if (aan) speel(); else werkBij() }
    const speel = () => speelStream(z().url, werkBij)
    werkBij()
  }

  // de knoppen van de eigenaar onder de radio: zenders en skin
  function eigenKnoppen() {
    const rij = el('div', 'rd-rij')
    const w = el('button', 'rd-knopje rd-wijzig', T('✏️ Zenders'))
    w.type = 'button'; w.onclick = stop(() => { uitzetten(); bewerk(v.zenders.slice()) })
    const s = el('button', 'rd-knopje rd-skinknop', T('🎨 Skin'))
    s.type = 'button'; s.onclick = stop(() => { uitzetten(); kiesSkin() })
    rij.append(w, s)
    return rij
  }

  // ── v3: een skin kiezen (alleen de eigenaar); de keuze gaat mee naar vrienden (alleen de naam) ──
  function kiesSkin() {
    radio.textContent = ''
    radio.removeAttribute('style')
    radio.classList.remove('rd-metskin')
    radio.classList.add('rd-bewerk')
    const balk = el('div', 'rd-rij rd-balk')
    const terug = el('button', 'rd-knopje rd-terug', T('Annuleren'))
    terug.type = 'button'
    terug.onclick = stop(() => { radio.classList.remove('rd-bewerk'); toon() })
    balk.append(el('div', 'rd-naam', T('Kies een skin voor je radio')), terug)
    const lijst = el('div', 'rd-skinkeus')
    for (const naam of ['', ...SKIN_NAMEN]) {
      const b = el('button', 'rd-skinoptie')
      b.type = 'button'; b.dataset.skin = naam || 'standaard'
      const gekozen = (v.skin || '') === naam
      b.setAttribute('aria-pressed', String(gekozen))
      // geen <img>: de fotoviewer van de app (fotoviewer.js) zou een tik op een plaatje in een widget openen als foto
      if (naam) { const voorbeeld = el('div', 'rd-voorbeeld'); voorbeeld.style.backgroundImage = 'url("' + skinPlaatje(naam) + '")'; voorbeeld.style.aspectRatio = SKINS[naam].b + ' / ' + SKINS[naam].h; b.appendChild(voorbeeld) }
      else b.appendChild(el('div', 'rd-standaard'))
      const onder = el('span')
      onder.append(el('b', null, naam ? T(SKINS[naam].naam) : T('Standaard')), el('em', null, gekozen ? '✓ ' + T('Gekozen') : ''))
      b.appendChild(onder)
      b.onclick = stop(() => {
        radio.classList.remove('rd-bewerk')
        const nieuw = { zenders: v.zenders }
        if (naam) nieuw.skin = naam
        bewaar(nieuw)
      })
      lijst.appendChild(b)
    }
    radio.append(balk, lijst)
  }

  // ── zenders kiezen (alleen de eigenaar) ──
  function bewerk(lijst) {
    radio.textContent = ''
    radio.removeAttribute('style')
    radio.classList.remove('rd-metskin')
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
          if (lijst.length >= MAX_ZENDERS) { melding.textContent = T('Je radio is vol (4 zenders).'); return }
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
      if (lijst.length >= MAX_ZENDERS) { melding.textContent = T('Je radio is vol (4 zenders).'); return }
      lijst.push(r); link.value = ''; naamVeld.value = ''; melding.textContent = ''; tekenMijn()
    })
    for (const x of [link, naamVeld]) { x.onclick = e => e.stopPropagation(); x.onkeydown = e => e.stopPropagation() }
    eigenRij.append(link, naamVeld, erbij)
    // Klaar en Annuleren vast bovenaan (naast "Jouw zenders"), dan hoef je niet langs alle zoekresultaten te scrollen
    const knoppen = el('div', 'rd-rij rd-balk')
    const klaar = el('button', 'rd-knopje rd-hoofd rd-klaar', T('Klaar ✓'))
    klaar.type = 'button'
    klaar.onclick = stop(() => { radio.classList.remove('rd-bewerk'); bewaar(lijst.length ? (v && v.skin ? { zenders: lijst, skin: v.skin } : { zenders: lijst }) : null) })
    const terug = el('button', 'rd-knopje', T('Annuleren'))
    terug.type = 'button'
    terug.onclick = stop(() => { radio.classList.remove('rd-bewerk'); if (v) toon(); else leeg() })
    knoppen.append(kop, klaar, terug)
    radio.append(knoppen, mijn, zoekRij, snel, melding, uitkomst, eigenRij,
      el('div', 'rd-uitleg', T('Zenders uit Radio Browser, een open database zonder tracking.')))
    tekenMijn()
  }

  if (v) toon()
  else leeg()
  return { uitzetten }
}
