// peertube.js (v1, 18 nov 2026) - de PeerTube-widget: een video van PeerTube op je profiel.
// v2 (18 nov 2026): drie servers erbij: spectra.video (veel gaming), makertube.net (makers, retro-techniek en -gaming)
// en peertube.beeldengeluid.nl (het open archief van Beeld & Geluid).
// v3 (18 nov 2026): titel en miniatuur ophalen bij het opslaan (haalInfo, voorbeeldplaatje.js). Alleen op het toestel
// van de eigenaar; de miniatuur wordt de achtergrond van het kaartje en gaat via sync naar vrienden.
// v4 (25 nov 2026): categorieën. In plaats van één video kies je een server en vink je categorieën aan (bijvoorbeeld
// Gaming). JOUW toestel vraagt die server om de nieuwste video's in die categorieën (alleen video's van de server zelf,
// geen 18+), en bewaart de titels in de widget. Die lijst gaat via sync naar vrienden: vrienden praten met niemand tot
// ze op een video tikken, net als bij één video. Op Home ververst de lijst vanzelf als hij ouder is dan een uur.
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
// Opslag: localStorage 'peertube_<uid>' = JSON { server, id, titel }, of (v4) { server, soort: 'categorie', cats: [7],
// videos: [{ id, titel, duur, kanaal }], id (= de eerste video, voor de miniatuur en voor oudere versies), titel, bijgewerkt }. Vrienden krijgen hem via sync.js
// ('klein:peertube'), net als de quote. Wat binnenkomt van een vriend gaat altijd eerst door normaliseer().
//
// Gebruik:
//   leesLink(tekst)                          -> { server, id } of { fout }
//   normaliseer(cfg)                         -> { server, id, titel } of null
//   speelUrl(cfg)                            -> de embed-link met alle privacy-instellingen
//   categorieUrl(server, cats)               -> het API-adres voor de nieuwste video's in die categorieën (v4)
//   haalCategorie(cfg, { fetch })            -> { videos } of { fout } (v4)
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
  // v4: categorieën
  '🎮 Categorie kiezen': '🎮 Choose a category', 'Eén video': 'One video', 'Categorieën': 'Categories',
  'Server': 'Server', 'Vink een of meer categorieën aan': 'Tick one or more categories',
  'Vink eerst een categorie aan.': 'Tick a category first.',
  'Hoogstens {n} categorieën.': 'At most {n} categories.',
  'De server gaf geen antwoord. Probeer het later nog eens.': 'The server did not answer. Please try again later.',
  'Nog geen video\'s in deze categorie op {server}.': 'No videos in this category on {server} yet.',
  'Nieuwste video\'s van {server}': 'Latest videos from {server}',
  '← Terug naar de lijst': '← Back to the list',
  'Muziek': 'Music', 'Films': 'Films', 'Voertuigen': 'Vehicles', 'Kunst': 'Art', 'Sport': 'Sports', 'Reizen': 'Travel',
  'Gaming': 'Gaming', 'Mensen': 'People', 'Humor': 'Comedy', 'Vermaak': 'Entertainment', 'Nieuws en politiek': 'News & politics',
  'Hoe doe je dat': 'How to', 'Onderwijs': 'Education', 'Actie en protest': 'Activism', 'Wetenschap en techniek': 'Science & technology',
  'Dieren': 'Animals', 'Kinderen': 'Kids', 'Eten': 'Food',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

// De goedgekeurde PeerTube-servers. Zet je er een bij, zet hem dan ook in frame-src van index.html en vriend-profiel.html.
export const SERVERS = ['framatube.org', 'tilvids.com', 'video.blender.org', 'tube.tchncs.de', 'diode.zone',
  'spectra.video', 'makertube.net', 'peertube.beeldengeluid.nl'] // v2

const MAX_TITEL = 80
// v4: de vaste categorieën van PeerTube (nummer, plaatje, naam). Elke PeerTube-server gebruikt deze nummers.
export const CATEGORIEEN = [[7, '🎮', 'Gaming'], [1, '🎵', 'Muziek'], [10, '🎉', 'Vermaak'], [9, '😂', 'Humor'], [2, '🎞️', 'Films'],
  [4, '🎨', 'Kunst'], [15, '🔬', 'Wetenschap en techniek'], [13, '📚', 'Onderwijs'], [12, '🛠️', 'Hoe doe je dat'], [11, '📰', 'Nieuws en politiek'],
  [5, '⚽', 'Sport'], [6, '✈️', 'Reizen'], [3, '🚗', 'Voertuigen'], [8, '🙂', 'Mensen'], [14, '✊', 'Actie en protest'], [16, '🐾', 'Dieren'],
  [17, '🧸', 'Kinderen'], [18, '🍳', 'Eten']]
const CAT_NRS = new Set(CATEGORIEEN.map(c => c[0]))
export const MAX_CATS = 6
export const MAX_VIDEOS = 8
const MAX_KANAAL = 40
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
  if (cfg.soort === 'categorie') return normaliseerCategorie(cfg, server)
  if (!goedeServer(server) || !goedId(cfg.id)) return null
  return { server, id: cfg.id, titel: tekst(cfg.titel, MAX_TITEL) }
}
// v4: een lijst met video's uit categorieën. Alleen bekende categorienummers, alleen nette video-codes.
function normaliseerCategorie(cfg, server) {
  if (!goedeServer(server) || !Array.isArray(cfg.cats)) return null
  const cats = [...new Set(cfg.cats.filter(n => Number.isInteger(n) && CAT_NRS.has(n)))].slice(0, MAX_CATS)
  if (!cats.length) return null
  const videos = (Array.isArray(cfg.videos) ? cfg.videos : []).filter(v => v && typeof v === 'object' && goedId(v.id)).slice(0, MAX_VIDEOS)
    .map(v => ({ id: v.id, titel: tekst(v.titel, MAX_TITEL), duur: Number.isInteger(v.duur) && v.duur >= 0 && v.duur < 360000 ? v.duur : 0, kanaal: tekst(v.kanaal, MAX_KANAAL) }))
  const uit = { server, soort: 'categorie', cats, videos, titel: tekst(cfg.titel, MAX_TITEL), bijgewerkt: Number.isFinite(cfg.bijgewerkt) ? cfg.bijgewerkt : 0 }
  if (videos.length) uit.id = videos[0].id // de miniatuur van de nieuwste video; oudere versies tonen die als één video
  return uit
}
export const isCategorie = cfg => !!cfg && cfg.soort === 'categorie'
export function categorieNaam(cats) {
  return (cats || []).map(n => CATEGORIEEN.find(c => c[0] === n)).filter(Boolean).map(c => c[1] + ' ' + T(c[2])).join(' · ')
}

// v4: het API-adres voor de nieuwste video's in deze categorieën. Alleen video's van de server zelf (isLocal: geen
// video's van servers die niet in onze lijst staan) en geen 18+ (nsfw=false).
export function categorieUrl(server, cats) {
  const s = String(server || '').toLowerCase()
  if (!goedeServer(s)) return null
  const nrs = (cats || []).filter(n => CAT_NRS.has(n)).slice(0, MAX_CATS)
  if (!nrs.length) return null
  const q = new URLSearchParams()
  for (const n of nrs) q.append('categoryOneOf', String(n))
  q.set('sort', '-publishedAt'); q.set('count', String(MAX_VIDEOS)); q.set('nsfw', 'false'); q.set('isLocal', 'true')
  return 'https://' + s + '/api/v1/videos?' + q.toString()
}
export async function haalCategorie(cfg, opties = {}) {
  const url = cfg && categorieUrl(cfg.server, cfg.cats)
  if (!url) return { fout: T('Vink eerst een categorie aan.') }
  const d = await haalJson(url, opties)
  if (!d || typeof d !== 'object' || !Array.isArray(d.data)) return { fout: T('De server gaf geen antwoord. Probeer het later nog eens.') }
  const videos = d.data.filter(v => v && typeof v === 'object' && !v.isLive).map(v => ({
    id: goedId(v.shortUUID) ? v.shortUUID : v.uuid, titel: v.name, duur: Math.round(Number(v.duration) || 0),
    kanaal: (v.channel && (v.channel.displayName || v.channel.name)) || '',
  }))
  const c = normaliseer({ server: cfg.server, soort: 'categorie', cats: cfg.cats, videos })
  return { videos: c ? c.videos : [] }
}
const duurTekst = s => { if (!s) return ''; const u = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return u ? u + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x }

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
  if (!c || !c.id) return {}
  const d = await haalJson('https://' + c.server + '/api/v1/videos/' + encodeURIComponent(c.id), opties)
  if (!d || typeof d !== 'object') return {}
  const uit = {}
  const titel = tekst(d.name, MAX_TITEL)
  if (titel && !isCategorie(c)) uit.titel = titel // v4: een lijst houdt zijn eigen naam
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
      const rij = el('div', 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center')
      const k = el('button', HOOFDKNOP, T('➕ Video kiezen'))
      k.className = 'pt-kies'
      k.onclick = stop(invoer)
      const kc = el('button', HOOFDKNOP, T('🎮 Categorie kiezen')) // v4
      kc.className = 'pt-kies-cat'
      kc.onclick = stop(invoerCategorie)
      rij.append(k, kc)
      kaart.appendChild(rij)
    }
  }

  // v4: bovenaan het invulscherm: kiezen tussen één video en categorieën
  function soortKeuze(actief) {
    const rij = el('div', 'display:flex;gap:4px;justify-content:center')
    for (const [soort, naam, open] of [['video', T('Eén video'), invoer], ['categorie', T('Categorieën'), invoerCategorie]]) {
      const b = el('button', (soort === actief ? HOOFDKNOP : GRIJSKNOP) + ';padding:5px 12px;font-size:12px', naam)
      b.className = 'pt-soort'; b.dataset.soort = soort
      b.setAttribute('aria-pressed', soort === actief ? 'true' : 'false')
      b.onclick = stop(open)
      rij.appendChild(b)
    }
    return rij
  }
  function terugEnWeg(rij) {
    if (!v) return
    const terug = el('button', GRIJSKNOP, T('Annuleren'))
    terug.onclick = stop(() => { kaart.style.alignItems = 'center'; teken() })
    const weg = el('button', GRIJSKNOP, T('🗑 Weghalen'))
    weg.className = 'pt-weg'
    weg.onclick = stop(() => bewaar(null))
    rij.appendChild(terug); rij.appendChild(weg)
  }

  // v4: een server kiezen en categorieën aanvinken
  function invoerCategorie() {
    kaart.textContent = ''
    kaart.style.alignItems = 'stretch'
    kaart.style.justifyContent = 'flex-start'
    const oud = isCategorie(v) ? v : null
    const server = el('select', VELD)
    server.className = 'pt-server'; server.setAttribute('aria-label', T('Server'))
    for (const s of SERVERS) { const o = el('option', '', s); o.value = s; server.appendChild(o) }
    server.value = oud ? oud.server : 'spectra.video'
    server.onclick = e => e.stopPropagation()
    const vak = el('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px;max-height:150px;overflow-y:auto;text-align:left')
    vak.className = 'pt-cats'
    const gekozen = new Set(oud ? oud.cats : [7])
    for (const [nr, icoon, naam] of CATEGORIEEN) {
      const l = el('label', 'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:3px 4px;border-radius:6px;background:rgba(255,255,255,0.05)')
      const vink = document.createElement('input')
      vink.type = 'checkbox'; vink.value = String(nr); vink.checked = gekozen.has(nr)
      vink.style.accentColor = '#8b3fd1'
      vink.onchange = () => { if (vink.checked) gekozen.add(nr); else gekozen.delete(nr); melding.textContent = '' }
      l.onclick = e => e.stopPropagation()
      l.append(vink, document.createTextNode(icoon + ' ' + T(naam)))
      vak.appendChild(l)
    }
    const melding = el('div', 'font-size:12px;color:#fca5a5;min-height:0')
    melding.className = 'pt-melding'
    const rij = el('div', 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center')
    const ok = el('button', HOOFDKNOP, T('Opslaan ✓'))
    ok.className = 'pt-opslaan'
    ok.onclick = stop(async () => {
      const cats = CATEGORIEEN.map(c => c[0]).filter(n => gekozen.has(n))
      if (!cats.length) { melding.textContent = T('Vink eerst een categorie aan.'); return }
      if (cats.length > MAX_CATS) { melding.textContent = T('Hoogstens {n} categorieën.', { n: MAX_CATS }); return }
      ok.disabled = true; ok.textContent = T('Ophalen…')
      try {
        const r = await haalCategorie({ server: server.value, cats })
        if (r.fout) { melding.textContent = r.fout; return }
        await bewaar({ server: server.value, soort: 'categorie', cats, videos: r.videos, id: r.videos[0] ? r.videos[0].id : undefined, titel: '', bijgewerkt: Date.now() })
      } finally { if (ok.isConnected) { ok.disabled = false; ok.textContent = T('Opslaan ✓') } }
    })
    rij.appendChild(ok)
    terugEnWeg(rij)
    kaart.append(soortKeuze('categorie'), server, el('div', 'font-size:12px;color:rgba(255,255,255,0.75)', T('Vink een of meer categorieën aan')), vak, melding, rij)
  }

  function invoer() {
    kaart.textContent = ''
    kaart.style.alignItems = 'stretch'
    kaart.style.justifyContent = 'center'
    if (eigen && bewaar) kaart.appendChild(soortKeuze('video')) // v4
    const link = el('input', VELD)
    link.className = 'pt-link'; link.type = 'url'; link.inputMode = 'url'; link.autocomplete = 'off'
    link.placeholder = T('Plak een link naar een PeerTube-video')
    if (v && !isCategorie(v)) link.value = 'https://' + v.server + '/w/' + v.id
    const titel = el('input', VELD)
    titel.className = 'pt-titel'; titel.maxLength = MAX_TITEL
    titel.placeholder = T('Titel (mag leeg)')
    if (v && !isCategorie(v)) titel.value = v.titel
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
    terugEnWeg(rij)
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

  // v4: de lijst met video's uit de gekozen categorieën. Nog niets van buiten: pas bij een tik op een video.
  function toonLijst() {
    kaart.textContent = ''
    kaart.style.alignItems = 'stretch'
    kaart.style.justifyContent = 'flex-start'
    const kop = el('div', 'font-size:13px;font-weight:700;text-align:left;line-height:1.3;text-shadow:0 1px 4px rgba(0,0,0,0.7)', v.titel || categorieNaam(v.cats))
    kop.className = 'pt-lijstkop'
    kaart.appendChild(kop)
    kaart.appendChild(el('div', 'font-size:11px;color:rgba(255,255,255,0.65);text-align:left;margin-top:-4px', T('Nieuwste video\'s van {server}', { server: v.server })))
    const lijst = el('div', 'display:flex;flex-direction:column;gap:4px;overflow-y:auto;min-height:0;flex:1')
    lijst.className = 'pt-lijst'
    if (!v.videos.length) lijst.appendChild(el('div', 'font-size:12px;color:rgba(255,255,255,0.7);padding:8px 0', T('Nog geen video\'s in deze categorie op {server}.', { server: v.server })))
    for (const video of v.videos) {
      const b = el('button', 'display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:rgba(0,0,0,0.45);border:0.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 8px;color:#fff;cursor:pointer;font-family:inherit')
      b.className = 'pt-video'; b.dataset.id = video.id
      b.appendChild(el('span', 'font-size:14px;color:var(--accent,#c084fc);flex:none', '▶'))
      const tk = el('span', 'flex:1;min-width:0')
      tk.appendChild(el('span', 'display:block;font-size:12px;font-weight:600;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', video.titel || T('PeerTube-video')))
      const sub = [video.kanaal, duurTekst(video.duur)].filter(Boolean).join(' · ')
      if (sub) tk.appendChild(el('span', 'display:block;font-size:11px;color:rgba(255,255,255,0.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap', sub))
      b.appendChild(tk)
      b.onclick = stop(() => speler(video))
      lijst.appendChild(b)
    }
    kaart.appendChild(lijst)
    const voet = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:center')
    voet.appendChild(el('div', 'font-size:10px;color:rgba(255,255,255,0.5);line-height:1.3;flex:1;min-width:150px;text-align:left',
      T('Pas als je op afspelen tikt, maakt je toestel verbinding met {server}.', { server: v.server })))
    if (eigen && bewaar) {
      const w = el('button', GRIJSKNOP + ';padding:6px 10px;font-size:12px', T('✏️ Wijzigen'))
      w.className = 'pt-wijzig'
      w.onclick = stop(invoerCategorie)
      voet.appendChild(w)
    }
    kaart.appendChild(voet)
  }

  // Pas hier wordt er iets van buiten geladen
  function speler(video) {
    const src = speelUrl(video ? { server: v.server, id: video.id } : v)
    if (!src) return
    const titelSpeler = (video && video.titel) || v.titel
    kaart.textContent = ''
    kaart.style.justifyContent = 'flex-start'
    const kader = el('div', 'position:relative;flex-shrink:0;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#000')
    const f = document.createElement('iframe')
    f.className = 'pt-speler'
    f.title = titelSpeler || T('PeerTube-video')
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture')
    f.setAttribute('allowfullscreen', '')
    f.setAttribute('referrerpolicy', 'no-referrer')
    f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0'
    f.src = src
    kader.appendChild(f)
    kaart.appendChild(kader)
    const dicht = el('button', GRIJSKNOP + ';padding:6px 12px;font-size:12px', video ? T('← Terug naar de lijst') : T('✕ Stoppen'))
    dicht.className = 'pt-stop'
    dicht.onclick = stop(() => { kaart.style.justifyContent = 'center'; teken() }) // iframe weg = verbinding weg
    kaart.appendChild(dicht)
  }

  function teken() { if (!v) leeg(); else if (isCategorie(v)) toonLijst(); else toon() }
  teken()
}
