// muziekwidget.js (v1, 18 nov 2026) - de muziek-widget: een album of nummer van Bandcamp of Funkwhale op je profiel.
// v2 (18 nov 2026): titel vanzelf. Bandcamp: uit de insluitcode ("Album van Artiest"). Funkwhale: titel, artiest en
// albumhoes via de API (haalInfo, voorbeeldplaatje.js), alleen bij het opslaan op het toestel van de eigenaar; de hoes
// wordt de achtergrond van het kaartje en gaat via sync naar vrienden.
//
// In gewone woorden: je plakt de insluitcode van Bandcamp, of een link naar een nummer of album op Funkwhale. Op je
// profiel (en bij je vrienden) staat dan een rustig kaartje met "▶ Luisteren". Pas als iemand daarop tikt, maakt zijn
// toestel verbinding met Bandcamp of de Funkwhale-server. Net als de PeerTube-widget (peertube.js):
//  - alleen goedgekeurde bronnen (BANDCAMP en FUNKWHALE hieronder). Ze staan ook in de huisregel (frame-src van
//    index.html en vriend-profiel.html); een test controleert dat dat gelijk blijft.
//  - de speler zit in een afgesloten kader (sandbox zonder allow-popups): links in de speler (bijv. "kopen") doen niets,
//    zoals andere externe links in Stekky. Er gaat geen "van welke pagina kom je" mee (referrerpolicy no-referrer).
//  - Bandcamp: luisterbeurten via de officiële speler tellen mee voor de artiest.
// Bandcamp zet zijn nummer (album=1234567890) niet in de gewone link, alleen in de insluitcode. Daarom plak je die code
// (Bandcamp: Share / Embed > Embed this album). Een gewone Bandcamp-link geeft een melding met uitleg.
//
// Opslag: localStorage 'muziekwidget_<uid>' = JSON. Vrienden krijgen hem via sync.js ('klein:muziekwidget'), net als
// de quote. Wat binnenkomt van een vriend gaat altijd eerst door normaliseer().
//   Bandcamp:  { bron: 'bandcamp', soort: 'album'|'track', id: '123', nummer: '456'?, titel }
//   Funkwhale: { bron: 'funkwhale', server: 'open.audio', soort: 'album'|'track', id: '123', titel }
//
// Gebruik:
//   leesInvoer(tekst)   -> config zonder titel, of { fout }
//   normaliseer(cfg)    -> config of null
//   speelUrl(cfg)       -> { src, hoogte } of null
//   tekenMuziekWidget(el, { cfg, eigen, bewaar })

import { haalJson, plaatjeOpServer, maakPlaatje } from './voorbeeldplaatje.js?v=1'

Object.assign(window.FIBRO_EN ||= {}, {
  'Ophalen…': 'Fetching…',
  'Nog geen muziek': 'No music yet', '➕ Muziek kiezen': '➕ Choose music', '▶ Luisteren': '▶ Listen',
  'Bandcamp-album': 'Bandcamp album', 'Bandcamp-nummer': 'Bandcamp track',
  'Funkwhale-album': 'Funkwhale album', 'Funkwhale-nummer': 'Funkwhale track', 'van {bron}': 'from {bron}',
  'Pas als je op luisteren tikt, maakt je toestel verbinding met {bron}.': 'Only when you tap listen does your device connect to {bron}.',
  'Plak de insluitcode van Bandcamp of een Funkwhale-link': 'Paste the Bandcamp embed code or a Funkwhale link',
  'Titel (mag leeg)': 'Title (optional)', 'Opslaan ✓': 'Save ✓', 'Annuleren': 'Cancel', '✏️ Wijzigen': '✏️ Change',
  '🗑 Weghalen': '🗑 Remove', '✕ Stoppen': '✕ Stop',
  'Bandcamp: tik bij het album op Share / Embed, kies Embed this album en kopieer de code.': 'Bandcamp: on the album, tap Share / Embed, choose Embed this album and copy the code.',
  'Funkwhale ({servers}): plak de link van een nummer of album.': 'Funkwhale ({servers}): paste the link of a track or album.',
  'Plak eerst een link of code.': 'Paste a link or code first.',
  'Dit is een gewone Bandcamp-link. Kopieer bij Bandcamp de insluitcode: Share / Embed, dan Embed this album.': 'This is a regular Bandcamp link. Copy the embed code on Bandcamp: Share / Embed, then Embed this album.',
  'Deze Funkwhale-server staat (nog) niet in de lijst: {server}': 'This Funkwhale server is not on the list (yet): {server}',
  'Dit is geen link naar een nummer of album.': 'This is not a link to a track or album.',
  'Alleen Bandcamp en Funkwhale kunnen.': 'Only Bandcamp and Funkwhale are supported.',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

// De goedgekeurde bronnen. Zet je er een bij, zet hem dan ook in frame-src van index.html en vriend-profiel.html.
export const BANDCAMP = 'bandcamp.com'
export const FUNKWHALE = ['open.audio'] // de server van The Funkwhale Collective zelf (vrij gelicentieerde muziek)

const MAX_TITEL = 80
const NUM = /^\d{1,12}$/
const FW_ID = /^(\d{1,10}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const SOORT = new Set(['album', 'track'])
const tekst = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)
const entities = s => String(s).replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/&quot;/g, '"')
// v2: tekst uit html (de link in Bandcamps insluitcode): tekens terug, geen tags
const htmlTekst = s => {
  // in de browser: de html-lezer (voert niets uit, geeft alleen de tekst); anders de eenvoudige tekens hieronder
  if (typeof DOMParser === 'function') { try { return tekst(new DOMParser().parseFromString(String(s), 'text/html').documentElement.textContent, MAX_TITEL) } catch (e) {} }
  return htmlTekstEenvoudig(s)
}
const htmlTekstEenvoudig = s => tekst(String(s).replace(/<[^>]*>/g, '').replace(/&#(\d{1,6});/g, (m, n) => { const c = Number(n); return c > 31 && c < 0x110000 ? String.fromCodePoint(c) : '' })
  .replace(/&#x([0-9a-f]{1,6});/gi, (m, n) => { const c = parseInt(n, 16); return c > 31 && c < 0x110000 ? String.fromCodePoint(c) : '' })
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), MAX_TITEL)

// Wat is er geplakt? Een Bandcamp-insluitcode (of de link daaruit), of een Funkwhale-link of -insluitcode.
export function leesInvoer(invoer) {
  const t = entities(String(invoer == null ? '' : invoer).trim()).slice(0, 4000)
  if (!t) return { fout: T('Plak eerst een link of code.') }

  // Bandcamp: .../EmbeddedPlayer/album=123/.../track=456/... of de korte vorm [bandcamp album=123 track=456]
  const bc = /bandcamp\.com\/EmbeddedPlayer(?:\.html)?\/([^"'\s<>]*)/i.exec(t)
  const bcDeel = bc ? bc[1] : (/^\[?\s*bandcamp\b/i.test(t) || /^(album|track)\s*=\s*\d/i.test(t) ? t : null)
  if (bcDeel !== null) {
    const album = /(?:^|[\s/[])album\s*=\s*(\d{1,12})/i.exec(bcDeel)
    const track = /(?:^|[\s/[])track\s*=\s*(\d{1,12})/i.exec(bcDeel)
    // v2: Bandcamp zet "Album van Artiest" als link in de code (<a href=...>Titel by Artiest</a>)
    const a = /<a\b[^>]*>([\s\S]{1,300}?)<\/a>/i.exec(String(invoer))
    const titel = a ? htmlTekst(a[1]) : ''
    const extra = titel ? { titel } : {}
    if (album) return { bron: 'bandcamp', soort: 'album', id: album[1], ...(track ? { nummer: track[1] } : {}), ...extra }
    if (track) return { bron: 'bandcamp', soort: 'track', id: track[1], ...extra }
    return { fout: T('Dit is geen link naar een nummer of album.') }
  }

  // Een iframe-code: neem de src eruit
  const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(t)
  const ruw = src ? src[1] : t
  let u
  try { u = new URL(/^https?:\/\//i.test(ruw) ? ruw : 'https://' + ruw) } catch (e) { return { fout: T('Alleen Bandcamp en Funkwhale kunnen.') } }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || u.port) return { fout: T('Alleen Bandcamp en Funkwhale kunnen.') }
  const host = u.hostname.toLowerCase().replace(/\.$/, '')

  if (host === BANDCAMP || host.endsWith('.bandcamp.com')) return { fout: T('Dit is een gewone Bandcamp-link. Kopieer bij Bandcamp de insluitcode: Share / Embed, dan Embed this album.') }

  // Funkwhale: /library/tracks/123, /library/albums/123, of /front/embed.html?type=album&id=123 (ook /embed.html)
  const delen = u.pathname.split('/').filter(Boolean)
  let soort = null, id = null
  if (/^(front\/)?embed\.html$/.test(delen.join('/'))) {
    soort = u.searchParams.get('type'); id = u.searchParams.get('id')
  } else if (delen[0] === 'library' && (delen[1] === 'tracks' || delen[1] === 'albums') && delen.length === 3) {
    soort = delen[1] === 'tracks' ? 'track' : 'album'; id = delen[2]
  } else {
    return { fout: FUNKWHALE.includes(host) ? T('Dit is geen link naar een nummer of album.') : T('Alleen Bandcamp en Funkwhale kunnen.') }
  }
  if (!FUNKWHALE.includes(host)) return { fout: T('Deze Funkwhale-server staat (nog) niet in de lijst: {server}', { server: host }) }
  if (!SOORT.has(soort) || !FW_ID.test(id || '')) return { fout: T('Dit is geen link naar een nummer of album.') }
  return { bron: 'funkwhale', server: host, soort, id }
}

// Uit opslag of van een vriend: altijd netjes. Kapot of niet toegestaan = null.
export function normaliseer(cfg) {
  if (!cfg || typeof cfg !== 'object' || !SOORT.has(cfg.soort)) return null
  const titel = tekst(cfg.titel, MAX_TITEL)
  if (cfg.bron === 'bandcamp') {
    if (!NUM.test(String(cfg.id || ''))) return null
    const nummer = cfg.soort === 'album' && NUM.test(String(cfg.nummer || '')) ? String(cfg.nummer) : null
    return { bron: 'bandcamp', soort: cfg.soort, id: String(cfg.id), ...(nummer ? { nummer } : {}), titel }
  }
  if (cfg.bron === 'funkwhale') {
    const server = typeof cfg.server === 'string' ? cfg.server.toLowerCase() : ''
    if (!FUNKWHALE.includes(server) || !FW_ID.test(String(cfg.id || ''))) return null
    return { bron: 'funkwhale', server, soort: cfg.soort, id: String(cfg.id), titel }
  }
  return null
}

// De speler: link en hoogte (in px). Bandcamp in de kleuren van Stekky, compact (klein plaatje, zonder lijst).
export function speelUrl(cfg) {
  const c = normaliseer(cfg)
  if (!c) return null
  if (c.bron === 'bandcamp') {
    return {
      src: 'https://bandcamp.com/EmbeddedPlayer/' + c.soort + '=' + c.id + (c.nummer ? '/track=' + c.nummer : '') +
        '/size=large/bgcol=1a0a2e/linkcol=c084fc/tracklist=false/artwork=small/transparent=true/',
      hoogte: 120,
    }
  }
  return {
    src: 'https://' + c.server + '/front/embed.html?&type=' + c.soort + '&id=' + encodeURIComponent(c.id),
    hoogte: c.soort === 'album' ? 330 : 150,
  }
}

// v2: titel, artiest en hoes van Funkwhale, via de API (alleen bij het opslaan, op het toestel van de eigenaar).
// Bandcamp: niets ophalen (de titel komt al uit de insluitcode). Geeft { titel, plaatje }; wat niet lukt, ontbreekt.
export async function haalInfo(cfg, opties = {}) {
  const c = normaliseer(cfg)
  if (!c || c.bron !== 'funkwhale') return {}
  const d = await haalJson('https://' + c.server + '/api/v1/' + (c.soort === 'album' ? 'albums' : 'tracks') + '/' + encodeURIComponent(c.id) + '/', opties)
  if (!d || typeof d !== 'object') return {}
  const naam = tekst(d.title, MAX_TITEL)
  const credits = Array.isArray(d.artist_credit) ? d.artist_credit.map(x => (x && (x.credit || (x.artist && x.artist.name)) || '') + (x && x.joinphrase || '')).join('') : ''
  const artiest = tekst((d.artist && d.artist.name) || credits, 60)
  const uit = {}
  if (naam) uit.titel = tekst(artiest ? naam + ' – ' + artiest : naam, MAX_TITEL)
  const hoes = (d.cover && d.cover.urls) || (d.album && d.album.cover && d.album.cover.urls) || null
  const adres = hoes && (plaatjeOpServer(hoes.large_square_crop, c.server) || plaatjeOpServer(hoes.medium_square_crop, c.server) || plaatjeOpServer(hoes.original, c.server))
  if (adres) { const p = await maakPlaatje(adres, opties); if (p) uit.plaatje = p }
  return uit
}

const bronNaam = c => c.bron === 'bandcamp' ? 'Bandcamp' : c.server
const standaardTitel = c => c.bron === 'bandcamp' ? (c.soort === 'album' ? T('Bandcamp-album') : T('Bandcamp-nummer'))
  : (c.soort === 'album' ? T('Funkwhale-album') : T('Funkwhale-nummer'))

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
export function tekenMuziekWidget(c, { cfg = null, eigen = false, bewaar = null } = {}) {
  const v = normaliseer(cfg)
  c.querySelectorAll('.mwkaart').forEach(x => x.remove())
  const kaart = el('div', 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;min-height:120px;text-align:center;position:relative;z-index:2')
  kaart.className = 'mwkaart'
  c.appendChild(kaart)

  function leeg() {
    kaart.textContent = ''
    kaart.appendChild(el('div', 'font-size:30px', '🎧'))
    kaart.appendChild(el('div', 'font-size:13px;color:rgba(255,255,255,0.75)', T('Nog geen muziek')))
    if (eigen && bewaar) {
      const k = el('button', HOOFDKNOP, T('➕ Muziek kiezen'))
      k.className = 'mw-kies'
      k.onclick = stop(invoer)
      kaart.appendChild(k)
    }
  }

  function invoer() {
    kaart.textContent = ''
    kaart.style.alignItems = 'stretch'
    kaart.style.justifyContent = 'flex-start'
    kaart.style.gap = '6px'
    kaart.style.overflowY = 'auto' // past het niet in het vak, dan kun je scrollen (de uitleg valt niet weg)
    const veld = el('textarea', VELD + ';resize:none;min-height:44px;flex-shrink:0')
    veld.className = 'mw-invoer'; veld.rows = 2; veld.autocomplete = 'off'; veld.spellcheck = false
    veld.placeholder = T('Plak de insluitcode van Bandcamp of een Funkwhale-link')
    if (v) veld.value = v.bron === 'bandcamp'
      ? 'https://bandcamp.com/EmbeddedPlayer/' + v.soort + '=' + v.id + (v.nummer ? '/track=' + v.nummer : '') + '/'
      : 'https://' + v.server + '/library/' + (v.soort === 'album' ? 'albums' : 'tracks') + '/' + v.id
    const titel = el('input', VELD)
    titel.className = 'mw-titel'; titel.maxLength = MAX_TITEL
    titel.placeholder = T('Titel (mag leeg)')
    if (v) titel.value = v.titel
    const melding = el('div', 'font-size:12px;color:#fca5a5;line-height:1.35')
    melding.className = 'mw-melding'
    const uitleg = el('div', 'font-size:11px;color:rgba(255,255,255,0.6);line-height:1.4;text-align:left')
    uitleg.append(el('div', null, T('Bandcamp: tik bij het album op Share / Embed, kies Embed this album en kopieer de code.')),
      el('div', null, T('Funkwhale ({servers}): plak de link van een nummer of album.', { servers: FUNKWHALE.join(', ') })))
    const rij = el('div', 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center')
    const ok = el('button', HOOFDKNOP, T('Opslaan ✓'))
    ok.className = 'mw-opslaan'
    ok.onclick = stop(async () => {
      const r = leesInvoer(veld.value)
      if (r.fout) { melding.textContent = r.fout; return }
      // v2: zelf getypte titel gaat voor; anders die uit de Bandcamp-code (of later die van Funkwhale)
      ok.disabled = true; ok.textContent = T('Ophalen…')
      try { await bewaar({ ...r, titel: tekst(titel.value, MAX_TITEL) || r.titel || '' }) }
      finally { if (ok.isConnected) { ok.disabled = false; ok.textContent = T('Opslaan ✓') } }
    })
    rij.appendChild(ok)
    if (v) {
      const terug = el('button', GRIJSKNOP, T('Annuleren'))
      terug.onclick = stop(toon)
      const weg = el('button', GRIJSKNOP, T('🗑 Weghalen'))
      weg.className = 'mw-weg'
      weg.onclick = stop(() => bewaar(null))
      rij.append(terug, weg)
    }
    for (const x of [veld, titel]) {
      x.onclick = e => e.stopPropagation()
      x.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && x === titel) ok.click() }
      x.oninput = () => { melding.textContent = '' }
    }
    kaart.append(veld, titel, melding, rij, uitleg)
  }

  function toon() {
    kaart.textContent = ''
    kaart.style.justifyContent = 'center'
    kaart.style.alignItems = 'center'
    kaart.style.gap = '8px'
    kaart.style.overflowY = ''
    kaart.appendChild(el('div', 'font-size:28px;line-height:1', '🎧'))
    kaart.appendChild(el('div', 'font-size:15px;font-weight:700;line-height:1.25;word-break:break-word;text-shadow:0 1px 4px rgba(0,0,0,0.7)', v.titel || standaardTitel(v)))
    kaart.appendChild(el('div', 'font-size:12px;color:rgba(255,255,255,0.7)', T('van {bron}', { bron: bronNaam(v) })))
    const rij = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center')
    const speel = el('button', HOOFDKNOP + ';padding:9px 18px;font-size:14px', T('▶ Luisteren'))
    speel.className = 'mw-speel'
    speel.onclick = stop(speler)
    rij.appendChild(speel)
    if (eigen && bewaar) {
      const w = el('button', GRIJSKNOP, T('✏️ Wijzigen'))
      w.className = 'mw-wijzig'
      w.onclick = stop(invoer)
      rij.appendChild(w)
    }
    kaart.appendChild(rij)
    kaart.appendChild(el('div', 'font-size:11px;color:rgba(255,255,255,0.55);line-height:1.35;max-width:300px',
      T('Pas als je op luisteren tikt, maakt je toestel verbinding met {bron}.', { bron: bronNaam(v) })))
  }

  // Pas hier wordt er iets van buiten geladen
  function speler() {
    const s = speelUrl(v)
    if (!s) return
    kaart.textContent = ''
    kaart.style.justifyContent = 'flex-start'
    const f = document.createElement('iframe')
    f.className = 'mw-speler'
    f.title = v.titel || standaardTitel(v)
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    f.setAttribute('allow', 'autoplay')
    f.setAttribute('referrerpolicy', 'no-referrer')
    f.style.cssText = 'flex-shrink:0;width:100%;height:' + s.hoogte + 'px;border:0;border-radius:10px;background:#1a0a2e'
    f.src = s.src
    kaart.appendChild(f)
    const dicht = el('button', GRIJSKNOP + ';padding:6px 12px;font-size:12px', T('✕ Stoppen'))
    dicht.className = 'mw-stop'
    dicht.onclick = stop(toon) // speler weg = verbinding weg
    kaart.appendChild(dicht)
  }

  if (v) toon()
  else leeg()
}
