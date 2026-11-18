// peertube.js (v1, 18 nov 2026) - de PeerTube-widget: een video van PeerTube op je profiel.
// v2 (18 nov 2026): drie servers erbij: spectra.video (veel gaming), makertube.net (makers, retro-techniek en -gaming)
// en peertube.beeldengeluid.nl (het open archief van Beeld & Geluid).
// v3 (18 nov 2026): titel en miniatuur ophalen bij het opslaan (haalInfo, voorbeeldplaatje.js). Alleen op het toestel
// van de eigenaar; de miniatuur wordt de achtergrond van het kaartje en gaat via sync naar vrienden.
//
// In gewone woorden: je plakt een link naar een PeerTube-video. Op je profiel (en bij je vrienden) staat dan een
// rustig kaartje met "▶ Afspelen". Pas als iemand daarop tikt, maakt zijn toestel verbinding met de PeerTube-server.
// Zonder tik gaat er dus niets naar buiten. Verder:
//  - alleen video's van een vaste lijst goedgekeurde servers (SERVERS hieronder). Die lijst staat ook in de huisregel
//    (frame-src in index.html en vriend-profiel.html); een test controleert dat ze gelijk zijn.
//  - het delen tussen kijkers (p2p) staat uit: andere kijkers zien je internetadres dan niet.
//  - de speler zit in een afgesloten kader (sandbox zonder allow-popups): de link naar PeerTube doet niets, net als
//    andere externe links in Stekky. Ook de link onder in de speler staat uit (peertubeLink=0).
//  - er gaat geen "van welke pagina kom je"-informatie mee (referrerpolicy no-referrer).
//
// Opslag: localStorage 'peertube_<uid>' = JSON { server, id, titel }. Vrienden krijgen hem via sync.js
// ('klein:peertube'), net als de quote. Wat binnenkomt van een vriend gaat altijd eerst door normaliseer().
//
// Gebruik:
//   leesLink(tekst)                          -> { server, id } of { fout }
//   normaliseer(cfg)                         -> { server, id, titel } of null
//   speelUrl(cfg)                            -> de embed-link met alle privacy-instellingen
//   tekenPeertubeWidget(el, { cfg, eigen, bewaar })

import { haalJson, plaatjeOpServer, maakPlaatje } from './voorbeeldplaatje.js?v=1'

Object.assign(window.FIBRO_EN ||= {}, {
  'Ophalen…': 'Fetching…',
  'PeerTube-video': 'PeerTube video', 'van {server}': 'from {server}', '▶ Afspelen': '▶ Play',
  'Pas als je op afspelen tikt, maakt je toestel verbinding met {server}.': 'Only when you tap play does your device connect to {server}.',
  'Plak een link naar een PeerTube-video': 'Paste a link to a PeerTube video', 'Titel (mag leeg)': 'Title (optional)',
  'Opslaan ✓': 'Save ✓', 'Annuleren': 'Cancel', '✏️ Wijzigen': '✏️ Change', '🗑 Weghalen': '🗑 Remove', '✕ Stoppen': '✕ Stop',
  'Nog geen video': 'No video yet', '➕ Video kiezen': '➕ Choose a video',
  'Toegestane servers: {lijst}': 'Allowed servers: {lijst}',
  'Plak eerst een link.': 'Paste a link first.',
  'Dit is geen geldige link.': 'This is not a valid link.',
  'Deze server staat (nog) niet in de lijst: {server}': 'This server is not on the list (yet): {server}',
  'Dit is geen link naar één video.': 'This is not a link to a single video.',
  'Afspeellijsten kunnen nog niet, kies één video.': 'Playlists are not supported yet, choose a single video.',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

// De goedgekeurde PeerTube-servers. Zet je er een bij, zet hem dan ook in frame-src van index.html en vriend-profiel.html.
export const SERVERS = ['framatube.org', 'tilvids.com', 'video.blender.org', 'tube.tchncs.de', 'diode.zone',
  'spectra.video', 'makertube.net', 'peertube.beeldengeluid.nl'] // v2

const MAX_TITEL = 80
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KORT = /^[1-9A-HJ-NP-Za-km-z]{16,24}$/ // de korte code uit /w/... (base58)
const goedId = id => typeof id === 'string' && (UUID.test(id) || KORT.test(id))
const goedeServer = s => typeof s === 'string' && SERVERS.includes(s)
const tekst = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)

// Uit een geplakte link: welke server en welke video?
// Goed: https://<server>/w/<code>, /videos/watch/<id>, /videos/embed/<id>
export function leesLink(invoer) {
  const t = String(invoer == null ? '' : invoer).trim()
  if (!t) return { fout: T('Plak eerst een link.') }
  let u
  try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t) } catch (e) { return { fout: T('Dit is geen geldige link.') } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { fout: T('Dit is geen geldige link.') }
  if (u.username || u.password || u.port) return { fout: T('Dit is geen geldige link.') }
  const server = u.hostname.toLowerCase().replace(/\.$/, '')
  if (!goedeServer(server)) return { fout: T('Deze server staat (nog) niet in de lijst: {server}', { server }) }
  const delen = u.pathname.split('/').filter(Boolean)
  let id = null
  if (delen[0] === 'w' && delen[1] === 'p') return { fout: T('Afspeellijsten kunnen nog niet, kies één video.') }
  if (delen[0] === 'w' && delen.length === 2) id = delen[1]
  else if (delen[0] === 'videos' && (delen[1] === 'watch' || delen[1] === 'embed') && delen.length === 3) {
    if (delen[2] === 'playlist') return { fout: T('Afspeellijsten kunnen nog niet, kies één video.') }
    id = delen[2]
  } else if (delen[0] === 'videos' && delen[1] === 'watch' && delen[2] === 'playlist') {
    return { fout: T('Afspeellijsten kunnen nog niet, kies één video.') }
  }
  if (!goedId(id)) return { fout: T('Dit is geen link naar één video.') }
  return { server, id }
}

// Uit opslag of van een vriend: altijd netjes. Kapot of niet toegestaan = null.
export function normaliseer(cfg) {
  if (!cfg || typeof cfg !== 'object') return null
  const server = typeof cfg.server === 'string' ? cfg.server.toLowerCase() : ''
  if (!goedeServer(server) || !goedId(cfg.id)) return null
  return { server, id: cfg.id, titel: tekst(cfg.titel, MAX_TITEL) }
}

// De link voor de speler: zonder delen tussen kijkers, zonder link naar PeerTube, meteen spelen (er is net getikt)
export function speelUrl(cfg) {
  const c = normaliseer(cfg)
  if (!c) return null
  return 'https://' + c.server + '/videos/embed/' + encodeURIComponent(c.id) + '?p2p=0&peertubeLink=0&warningTitle=0&autoplay=1'
}

// v3: titel en miniatuur van de video, via de API van de server (die staat dat toe voor andere sites, CORS op /api
// en /lazy-static). Alleen bij het opslaan, op het toestel van de eigenaar. Geeft { titel, plaatje } (plaatje =
// { data, breedte, hoogte }); wat niet lukt, ontbreekt.
export async function haalInfo(cfg, opties = {}) {
  const c = normaliseer(cfg)
  if (!c) return {}
  const d = await haalJson('https://' + c.server + '/api/v1/videos/' + encodeURIComponent(c.id), opties)
  if (!d || typeof d !== 'object') return {}
  const uit = {}
  const titel = tekst(d.name, MAX_TITEL)
  if (titel) uit.titel = titel
  const adres = plaatjeOpServer(d.previewPath, c.server) || plaatjeOpServer(d.thumbnailPath, c.server)
  if (adres) { const p = await maakPlaatje(adres, opties); if (p) uit.plaatje = p }
  return uit
}

// ── kleine hulpjes ──
function el(tag, stijl, inhoud) {
  const e = document.createElement(tag)
  if (stijl) e.style.cssText = stijl
  if (inhoud != null) e.textContent = inhoud
  return e
}
const KNOP = 'border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit'
const HOOFDKNOP = KNOP + ';background:var(--knop,#8b3fd1);color:#fff'
const GRIJSKNOP = KNOP + ';background:rgba(255,255,255,0.12);color:#fff'
const VELD = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:0.5px solid var(--border,rgba(255,255,255,0.18));border-radius:8px;padding:8px 10px;color:var(--text,#fff);font-size:13px;font-family:inherit;outline:none'
const stop = f => e => { e.stopPropagation(); f() }

// ── De widget ──
// cfg: wat er bewaard is (of van de vriend kwam). eigen: je eigen widget (dan kun je kiezen/wijzigen).
// bewaar(cfgOfNull): slaat op (null = weghalen) en tekent opnieuw.
export function tekenPeertubeWidget(c, { cfg = null, eigen = false, bewaar = null } = {}) {
  const v = normaliseer(cfg)
  c.querySelectorAll('.ptkaart').forEach(x => x.remove())
  const kaart = el('div', 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;min-height:120px;text-align:center;position:relative;z-index:2')
  kaart.className = 'ptkaart'
  c.appendChild(kaart)

  function leeg() {
    kaart.textContent = ''
    kaart.appendChild(el('div', 'font-size:30px', '🎬'))
    kaart.appendChild(el('div', 'font-size:13px;color:rgba(255,255,255,0.75)', T('Nog geen video')))
    if (eigen && bewaar) {
      const k = el('button', HOOFDKNOP, T('➕ Video kiezen'))
      k.className = 'pt-kies'
      k.onclick = stop(invoer)
      kaart.appendChild(k)
    }
  }

  function invoer() {
    kaart.textContent = ''
    kaart.style.alignItems = 'stretch'
    const link = el('input', VELD)
    link.className = 'pt-link'; link.type = 'url'; link.inputMode = 'url'; link.autocomplete = 'off'
    link.placeholder = T('Plak een link naar een PeerTube-video')
    if (v) link.value = 'https://' + v.server + '/w/' + v.id
    const titel = el('input', VELD)
    titel.className = 'pt-titel'; titel.maxLength = MAX_TITEL
    titel.placeholder = T('Titel (mag leeg)')
    if (v) titel.value = v.titel
    const melding = el('div', 'font-size:12px;color:#fca5a5;min-height:0')
    melding.className = 'pt-melding'
    const uitleg = el('div', 'font-size:11px;color:rgba(255,255,255,0.6);line-height:1.35', T('Toegestane servers: {lijst}', { lijst: SERVERS.join(', ') }))
    const rij = el('div', 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center')
    const ok = el('button', HOOFDKNOP, T('Opslaan ✓'))
    ok.className = 'pt-opslaan'
    ok.onclick = stop(async () => {
      const r = leesLink(link.value)
      if (r.fout) { melding.textContent = r.fout; return }
      // v3: bewaar mag even duren (titel en miniatuur ophalen): zolang staat er "Ophalen…"
      ok.disabled = true; ok.textContent = T('Ophalen…')
      try { await bewaar({ server: r.server, id: r.id, titel: tekst(titel.value, MAX_TITEL) }) }
      finally { if (ok.isConnected) { ok.disabled = false; ok.textContent = T('Opslaan ✓') } }
    })
    rij.appendChild(ok)
    if (v) {
      const terug = el('button', GRIJSKNOP, T('Annuleren'))
      terug.onclick = stop(() => { kaart.style.alignItems = 'center'; toon() })
      const weg = el('button', GRIJSKNOP, T('🗑 Weghalen'))
      weg.className = 'pt-weg'
      weg.onclick = stop(() => bewaar(null))
      rij.appendChild(terug); rij.appendChild(weg)
    }
    for (const x of [link, titel]) {
      x.onclick = e => e.stopPropagation()
      x.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ok.click() }
      x.oninput = () => { melding.textContent = '' }
    }
    kaart.append(link, titel, melding, rij, uitleg)
  }

  function toon() {
    kaart.textContent = ''
    kaart.appendChild(el('div', 'font-size:28px;line-height:1', '🎬'))
    kaart.appendChild(el('div', 'font-size:15px;font-weight:700;line-height:1.25;word-break:break-word;text-shadow:0 1px 4px rgba(0,0,0,0.7)', v.titel || T('PeerTube-video')))
    kaart.appendChild(el('div', 'font-size:12px;color:rgba(255,255,255,0.7)', T('van {server}', { server: v.server })))
    const rij = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center')
    const speel = el('button', HOOFDKNOP + ';padding:9px 18px;font-size:14px', T('▶ Afspelen'))
    speel.className = 'pt-speel'
    speel.onclick = stop(speler)
    rij.appendChild(speel)
    if (eigen && bewaar) {
      const w = el('button', GRIJSKNOP, T('✏️ Wijzigen'))
      w.className = 'pt-wijzig'
      w.onclick = stop(invoer)
      rij.appendChild(w)
    }
    kaart.appendChild(rij)
    kaart.appendChild(el('div', 'font-size:11px;color:rgba(255,255,255,0.55);line-height:1.35;max-width:300px',
      T('Pas als je op afspelen tikt, maakt je toestel verbinding met {server}.', { server: v.server })))
  }

  // Pas hier wordt er iets van buiten geladen
  function speler() {
    const src = speelUrl(v)
    if (!src) return
    kaart.textContent = ''
    kaart.style.justifyContent = 'flex-start'
    const kader = el('div', 'position:relative;flex-shrink:0;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#000')
    const f = document.createElement('iframe')
    f.className = 'pt-speler'
    f.title = v.titel || T('PeerTube-video')
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture')
    f.setAttribute('allowfullscreen', '')
    f.setAttribute('referrerpolicy', 'no-referrer')
    f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0'
    f.src = src
    kader.appendChild(f)
    kaart.appendChild(kader)
    const dicht = el('button', GRIJSKNOP + ';padding:6px 12px;font-size:12px', T('✕ Stoppen'))
    dicht.className = 'pt-stop'
    dicht.onclick = stop(() => { kaart.style.justifyContent = 'center'; toon() }) // iframe weg = verbinding weg
    kaart.appendChild(dicht)
  }

  if (v) toon()
  else leeg()
}
