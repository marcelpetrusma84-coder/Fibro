// rsswidget.js (v3, 19 nov 2026) - de RSS-widget: de nieuwste berichten van je favoriete sites op je profiel.
//
// In gewone woorden: je zet tot 3 RSS-feeds op de widget (een link plakken, of een voorbeeld kiezen). JOUW toestel
// vraagt de server van Stekky (edge function rss-ophalen) om de berichten; die haalt de feed op en geeft alleen tekst
// terug (kop, link, datum, korte samenvatting). De nieuwssite ziet dus de server, niet jou. De berichten worden op dit
// toestel bewaard en gaan via de gewone synchronisatie naar je vrienden (sync.js, 'klein:rss'): vrienden praten met
// niemand. Pas als iemand op een bericht tikt, opent het artikel op de site zelf (nieuw tabblad, zonder referrer).
//  - Home ververst vanzelf als de berichten ouder zijn dan een uur (en met de knop ↻).
//  - wat van een vriend komt gaat door normaliseer(): alleen tekst, links alleen http(s) zonder inlog.
//
// v3 (19 nov 2026): maakOphaler geeft ook het plaatje en de link van de feed door (voor de Mastodon-widget).
// v2 (19 nov 2026): plaatjes en een samenvatting, en een mooier uiterlijk (het nieuwste bericht groot met plaatje).
//  - De server haalt een plaatje alleen op voor NIEUWE berichten, hoogstens 6 per keer, hoogstens 300 KB, en rekent er
//    niet mee: JOUW telefoon maakt er kleine fotootjes van (maakFotos) en onthoudt ze (rssfotos_<uid>).
//  - Alle fotootjes samen worden één plaatje (bouwSprite: bovenaan het grote, daaronder 11 vierkantjes). Dat gaat als
//    'achtergrond' van de widget via P2P naar vrienden (sync.js WBG_WIDGETS, widgetbg_rss_<uid>), zoals de miniatuur
//    van PeerTube. Bij een vriend maakt dus niemand contact met de nieuwssite, ook niet voor plaatjes.
//  - fotoId (in de berichten) en de pos van dat plaatje moeten gelijk zijn; anders hoort het plaatje nog bij oudere
//    berichten en tonen we geen plaatjes (dan nooit een verkeerd plaatje bij een bericht).
//  - schakelaar "Plaatjes tonen": uit = de server haalt ook geen plaatjes op.
//
// Opslag: localStorage 'rss_<uid>' = JSON { feeds: [{ url, naam }], berichten: [{ titel, link, datum, feed, tekst, vak }],
// bijgewerkt, fotoId, plaatjes } (hoogstens 3 feeds en 12 berichten; vak = plek in het fotoplaatje, of geen).
//
// Gebruik:
//   normaliseer(cfg)                          -> cfg of null
//   maakOphaler(geefPas)                      -> async url => { titel, berichten } of { fout }; .plaatje(url) -> Blob of null
//   samenvoegen(feeds, uitslagen, oud)        -> berichten (nieuwste eerst)
//   tekenRssWidget(el, { cfg, eigen, bewaar, ophalen, sprite, spriteId, fotos })

Object.assign(window.FIBRO_EN ||= {}, {
  'RSS-feed': 'RSS feed', 'Nog geen feed': 'No feed yet', '📰 Feed kiezen': '📰 Choose a feed', '✏️ Feeds': '✏️ Feeds',
  'Jouw feeds ({n}/{max})': 'Your feeds ({n}/{max})', 'Nog geen feeds. Plak hieronder een link of kies een voorbeeld.': 'No feeds yet. Paste a link below or choose an example.',
  'Link naar een RSS-feed (https)': 'Link to an RSS feed (https)', 'Controleren…': 'Checking…', 'Voorbeelden:': 'Examples:',
  'Je hebt al 3 feeds.': 'You already have 3 feeds.', 'Staat er al op.': 'Already on it.',
  'Dit is geen RSS-feed.': 'This is not an RSS feed.', 'Deze feed is nu niet te bereiken.': 'This feed cannot be reached right now.',
  'Alleen https-links kunnen.': 'Only https links work.', 'Dit is geen geldige link.': 'This is not a valid link.',
  'Ophalen lukt nu niet. Probeer het later nog eens.': 'Fetching does not work right now. Please try again later.',
  'Ophalen…': 'Fetching…', 'Vernieuwen': 'Refresh', 'Bijgewerkt: {wanneer}': 'Updated: {wanneer}', 'Nog geen berichten.': 'No posts yet.',
  'Tik op een kop om het artikel te openen.': 'Tap a headline to open the article.',
  'De koppen haalt de server van Stekky op, niet jouw toestel. Pas als je op een kop tikt, ga je naar de site zelf.': 'The headlines are fetched by the Stekky server, not your device. Only when you tap a headline do you go to the site itself.',
  'Plaatjes tonen': 'Show pictures', 'Plaatjes ophalen…': 'Fetching pictures…',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const MAX_FEEDS = 3
export const MAX_BERICHTEN = 12
export const VERS_MS = 60 * 60 * 1000 // ouder dan een uur: Home haalt nieuwe berichten (v2: was een half uur)
export const MAX_PLAATJES = 6 // hoogstens zoveel plaatjes per keer aan de server vragen
export const FUNCTIE_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/rss-ophalen'
const ANON_KEY = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
// Voorbeelden om snel te kiezen
export const VOORBEELDEN = () => [
  { naam: 'NOS Nieuws', url: 'https://feeds.nos.nl/nosnieuwsalgemeen' },
  { naam: 'NOS Sport', url: 'https://feeds.nos.nl/nossportalgemeen' },
  { naam: 'NU.nl', url: 'https://www.nu.nl/rss/Algemeen' },
]
// eslint-disable-next-line no-control-regex
const tekst = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

// Namen van een eigen netwerk (ook in supabase/functions/rss-ophalen/feed.js; de server kijkt nog een keer)
function privéNaam(host) {
  const h = host.toLowerCase().replace(/\.$/, '')
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') ||
    h.endsWith('.lan') || h.endsWith('.home.arpa') || !h.includes('.')
}
// Een feed-adres: https op poort 443, met een naam (geen IP-adres), geen inlog. Geeft het adres of null.
export function netteFeedUrl(url) {
  if (typeof url !== 'string' || url.length > 500) return null
  let u
  try { u = new URL(url.trim()) } catch (e) { return null }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null
  const h = u.hostname.toLowerCase()
  if (!h || privéNaam(h) || h.includes(':') || h.startsWith('[') || /^[\d.]+$/.test(h)) return null
  u.hash = ''
  return u.href
}
// Een link naar een artikel: http of https, zonder inlog
export function netteLink(url) {
  if (typeof url !== 'string' || url.length > 500) return ''
  let u
  try { u = new URL(url.trim()) } catch (e) { return '' }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !u.hostname) return ''
  return u.href
}
export const host = url => { try { return new URL(url).hostname.replace(/^www\./, '') } catch (e) { return '' } }
const netteDatum = d => { const n = Number(d); return Number.isFinite(n) && n > 0 && n < 8.64e15 ? Math.round(n) : 0 }

// ── het fotoplaatje (sprite): bovenaan het grote plaatje (vak 0), daaronder 11 vierkantjes van 80 x 80 ──
export const SPRITE_B = 480, SPRITE_H = 400
export function vak(i) {
  if (i === 0) return { x: 0, y: 0, w: 480, h: 240 }
  if (!Number.isInteger(i) || i < 1 || i >= MAX_BERICHTEN) return null
  return { x: ((i - 1) % 6) * 80, y: 240 + Math.floor((i - 1) / 6) * 80, w: 80, h: 80 }
}
// CSS om één vak van het fotoplaatje te tonen (background-size en -position in procenten: werkt op elke maat)
export function vakStijl(i) {
  const v = vak(i)
  if (!v) return null
  const pct = (p, ruimte) => (ruimte > 0 ? Math.round(p / ruimte * 10000) / 100 : 0) + '%'
  return {
    size: Math.round(SPRITE_B / v.w * 10000) / 100 + '% ' + Math.round(SPRITE_H / v.h * 10000) / 100 + '%',
    pos: pct(v.x, SPRITE_B - v.w) + ' ' + pct(v.y, SPRITE_H - v.h),
  }
}
// Alleen een echt plaatje als data-URL (komt van een vriend: niets anders in CSS laten komen)
export function netteSprite(d) {
  return typeof d === 'string' && d.length < 600000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(d)
}
// Een korte vingerafdruk van het fotoplaatje (om te zien of plaatje en berichten bij elkaar horen)
export function fotoHash(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x5bd1e995) >>> 0
  }
  return (h1.toString(36) + h2.toString(36)).slice(0, 14)
}

// Uit opslag of van een vriend: altijd netjes. Geen enkele goede feed = null.
export function normaliseer(cfg) {
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.feeds)) return null
  const feeds = []
  for (const f of cfg.feeds.slice(0, MAX_FEEDS * 2)) {
    if (!f || typeof f !== 'object') continue
    const url = netteFeedUrl(f.url)
    if (!url || feeds.some(x => x.url === url)) continue
    feeds.push({ url, naam: tekst(f.naam, 40) || host(url) })
    if (feeds.length === MAX_FEEDS) break
  }
  if (!feeds.length) return null
  const berichten = []
  for (const b of Array.isArray(cfg.berichten) ? cfg.berichten.slice(0, MAX_BERICHTEN * 2) : []) {
    if (!b || typeof b !== 'object') continue
    const titel = tekst(b.titel, 160), link = netteLink(b.link), feed = Number(b.feed)
    if (!titel || !link || !Number.isInteger(feed) || feed < 0 || feed >= feeds.length) continue
    if (berichten.some(x => x.link === link)) continue
    const nb = { titel, link, datum: netteDatum(b.datum), feed }
    const t = tekst(b.tekst, 200)
    if (t) nb.tekst = t
    if (Number.isInteger(b.vak) && vak(b.vak) && !berichten.some(x => x.vak === b.vak)) nb.vak = b.vak
    berichten.push(nb)
    if (berichten.length === MAX_BERICHTEN) break
  }
  const uit = { feeds, berichten, bijgewerkt: netteDatum(cfg.bijgewerkt) }
  if (typeof cfg.fotoId === 'string' && /^[a-z0-9]{1,16}$/.test(cfg.fotoId)) uit.fotoId = cfg.fotoId
  if (cfg.plaatjes === false) uit.plaatjes = false
  return uit
}

// Nieuwe berichten erbij: per feed de nieuwste, samen hoogstens 12 (nieuwste eerst, zonder datum achteraan).
// Lukte een feed niet (uitslag null), dan blijven zijn oude berichten staan.
export function samenvoegen(feeds, uitslagen, oud = []) {
  const alles = []
  feeds.forEach((f, i) => {
    const u = uitslagen[i]
    const lijst = u && Array.isArray(u.berichten) ? u.berichten.map(b => ({ titel: b.titel, link: b.link, datum: b.datum, feed: i, tekst: b.tekst }))
      : oud.filter(b => b.feed === i).map(b => ({ titel: b.titel, link: b.link, datum: b.datum, feed: i, tekst: b.tekst }))
    alles.push(...lijst.slice(0, MAX_BERICHTEN).map((b, volg) => ({ ...b, volg })))
  })
  const schoon = normaliseer({ feeds, berichten: alles.sort((a, b) => (netteDatum(b.datum) - netteDatum(a.datum)) || (a.volg - b.volg)) })
  return schoon ? schoon.berichten : []
}

// ── plaatjes (alleen op het toestel van de eigenaar) ──
// Welke plaatjes moeten we vragen? Alleen voor berichten die nog geen fotootje hebben (en waar het niet al eens
// mislukte), het eerste bericht het grote plaatje, de rest het kleinste. Hoogstens max per keer.
export function kiesPlaatjes(berichten, bronnen, cache = {}, max = MAX_PLAATJES) {
  const lijst = []
  berichten.forEach((b, i) => {
    if (lijst.length >= max) return
    const c = cache[b.link] || {}, bron = bronnen[b.link] || {}
    if (c.mis) return
    const groot = i === 0
    if (groot ? c.g : (c.k || c.g)) return
    const url = groot ? (bron.plaatjeGroot || bron.plaatje) : (bron.plaatje || bron.plaatjeGroot)
    if (typeof url === 'string' && url.startsWith('https://')) lijst.push({ link: b.link, url, groot })
  })
  return lijst
}
// Maak de nieuwe fotootjes: vraag de server (haal: url -> Blob of null) en verklein hier (verklein: (blob, b, h) -> data-URL).
// Geeft de nieuwe cache terug: alleen van de huidige berichten.
export async function maakFotos({ berichten, bronnen, cache = {}, haal, verklein, max = MAX_PLAATJES }) {
  const nieuw = {}
  for (const b of berichten) if (cache[b.link]) nieuw[b.link] = { ...cache[b.link] }
  for (const p of kiesPlaatjes(berichten, bronnen, nieuw, max)) {
    const c = nieuw[p.link] || (nieuw[p.link] = {})
    let blob = null
    try { blob = await haal(p.url) } catch (e) {}
    if (!blob) { c.mis = 1; continue }
    try {
      if (!c.k) c.k = await verklein(blob, 80, 80)
      if (p.groot) c.g = await verklein(blob, 480, 240)
    } catch (e) { c.mis = 1 }
  }
  return nieuw
}
// Welk fotootje komt in welk vak? (vak i = bericht i; voor vak 0 liefst het grote)
export function spriteDelen(berichten, cache) {
  const delen = []
  berichten.forEach((b, i) => {
    const c = cache[b.link]
    if (!c || !vak(i)) return
    const data = i === 0 ? (c.g || c.k) : (c.k || c.g)
    if (typeof data === 'string' && data.startsWith('data:image/')) delen.push({ i, data })
  })
  return delen
}

// In de browser: een plaatje (Blob) bijsnijden en verkleinen tot b x h (vullend, midden)
export async function verkleinInBrowser(blob, b, h) {
  const bron = await createImageBitmap(blob)
  try {
    const cv = document.createElement('canvas')
    cv.width = b; cv.height = h
    const schaal = Math.max(b / bron.width, h / bron.height)
    const sw = b / schaal, sh = h / schaal
    cv.getContext('2d').drawImage(bron, (bron.width - sw) / 2, (bron.height - sh) / 2, sw, sh, 0, 0, b, h)
    return cv.toDataURL('image/jpeg', 0.75)
  } finally { try { bron.close() } catch (e) {} }
}
// In de browser: de fotootjes samen in één plaatje (de sprite). Geeft een data-URL of null.
export async function tekenSprite(delen) {
  if (!delen.length) return null
  const cv = document.createElement('canvas')
  cv.width = SPRITE_B; cv.height = SPRITE_H
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#1a0a2e'; ctx.fillRect(0, 0, SPRITE_B, SPRITE_H)
  let getekend = 0
  for (const d of delen) {
    const v = vak(d.i)
    try {
      const img = new Image()
      img.src = d.data
      await img.decode()
      ctx.drawImage(img, v.x, v.y, v.w, v.h)
      getekend++
    } catch (e) {}
  }
  return getekend ? cv.toDataURL('image/jpeg', 0.72) : null
}

// Vraagt de server om één feed. geefPas() geeft de inlogpas (access_token) of null.
export function maakOphaler(geefPas, { fetch: f = globalThis.fetch, ms = 12000 } = {}) {
  async function vraag(body) {
    let pas = null
    try { pas = await geefPas() } catch (e) {}
    if (!pas) return null
    const c = typeof AbortController === 'function' ? new AbortController() : null
    const klok = c ? setTimeout(() => c.abort(), ms) : null
    try {
      return await f(FUNCTIE_URL, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', signal: c ? c.signal : undefined,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pas, apikey: ANON_KEY },
        body: JSON.stringify(body),
      })
    } finally { if (klok) clearTimeout(klok) }
  }
  const ophalen = async url => {
    const nette = netteFeedUrl(url)
    if (!nette) return { fout: T('Dit is geen geldige link.') }
    try {
      const r = await vraag({ url: nette })
      if (!r) return { fout: T('Ophalen lukt nu niet. Probeer het later nog eens.') }
      let d = null
      try { d = await r.json() } catch (e) {}
      if (r.ok && d && d.ok && Array.isArray(d.berichten)) return { titel: tekst(d.titel, 40), berichten: d.berichten, afbeelding: typeof d.afbeelding === 'string' ? d.afbeelding : '', link: typeof d.link === 'string' ? d.link : '' }
      if (d && d.reden === 'geen feed') return { fout: T('Dit is geen RSS-feed.') }
      if (d && (d.reden === 'niet bereikbaar' || d.reden === 'te langzaam' || d.reden === 'te groot' || d.reden === 'adres')) return { fout: T('Deze feed is nu niet te bereiken.') }
      return { fout: T('Ophalen lukt nu niet. Probeer het later nog eens.') }
    } catch (e) {
      return { fout: T('Ophalen lukt nu niet. Probeer het later nog eens.') }
    }
  }
  // v2: één plaatje via de server (die het alleen doorgeeft). Geeft een Blob of null.
  ophalen.plaatje = async url => {
    const nette = netteFeedUrl(url)
    if (!nette) return null
    try {
      const r = await vraag({ plaatje: nette })
      if (!r || !r.ok || !/^image\/(jpeg|png|gif|webp|avif)$/.test(r.headers.get('content-type') || '')) return null
      return await r.blob()
    } catch (e) { return null }
  }
  return ophalen
}

export function wanneer(ms, nu = Date.now()) {
  if (!ms) return ''
  const min = Math.floor((nu - ms) / 60000)
  if (min < 1) return T('zojuist')
  if (min < 60) return T('{n} min geleden', { n: min })
  if (min < 24 * 60) return T('{n} uur geleden', { n: Math.floor(min / 60) })
  return T('{n} dagen geleden', { n: Math.floor(min / 1440) })
}

// ── uiterlijk (één keer in de pagina) ──
const CSS = `
.rs-widget{width:100%;height:420px;max-height:72vh;min-height:180px;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;color:inherit;text-align:left;position:relative;z-index:2;font-family:inherit}
.rs-lijst{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain;scrollbar-width:thin}
.rs-bericht{display:flex;gap:9px;align-items:stretch;flex:none;text-decoration:none;color:inherit;background:rgba(0,0,0,.22);border-radius:12px;padding:7px;transition:background .15s}
.rs-bericht:active{background:rgba(139,63,209,.3)}
.rs-bericht:focus-visible{outline:2px solid #c084fc;outline-offset:1px}
.rs-foto{flex:none;width:58px;height:58px;border-radius:9px;background-color:#2a1450;background-repeat:no-repeat}
.rs-letter{flex:none;width:58px;height:58px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:#fff;background:linear-gradient(135deg,#8b3fd1,#6a2bab)}
.rs-tekstdeel{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px}
.rs-kop{font-size:13px;font-weight:700;line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rs-sam{font-size:11.5px;line-height:1.3;opacity:.78;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.rs-sub{font-size:10.5px;opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-bron{color:#c084fc;font-weight:700}
.rs-groot{position:relative;display:block;flex:none;min-height:160px;border-radius:14px;overflow:hidden;text-decoration:none;color:#fff;background:linear-gradient(135deg,#8b3fd1,#6a2bab 55%,#1a0a2e);background-repeat:no-repeat}
.rs-groot:focus-visible{outline:2px solid #c084fc;outline-offset:1px}
.rs-groot .rs-over{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:3px;padding:12px;background:linear-gradient(180deg,rgba(0,0,0,0) 25%,rgba(10,4,24,.55) 55%,rgba(10,4,24,.92))}
.rs-groot .rs-kop{font-size:16px;line-height:1.25;-webkit-line-clamp:3;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.rs-groot .rs-sam{-webkit-line-clamp:2;opacity:.88}
.rs-groot .rs-sub{opacity:.85}
.rs-label{position:absolute;top:9px;left:9px;background:rgba(139,63,209,.92);color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:999px;text-transform:uppercase}
.rs-voet{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rs-uitleg{font-size:10.5px;opacity:.65;line-height:1.3;flex:1;min-width:120px}
.rs-knopje{border:none;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.14);color:#fff}
.rs-knopje.rs-hoofd{background:#8b3fd1}
.rs-knopje:disabled{opacity:.5;cursor:default}
.rs-rij{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rs-veld{flex:1;min-width:0;box-sizing:border-box;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.2);border-radius:8px;padding:7px 9px;color:#fff;font-size:13px;font-family:inherit;outline:none}
.rs-item{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.22);border-radius:8px;padding:5px 7px;font-size:12.5px}
.rs-item .rs-in{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-melding{font-size:12px;color:#ffcf8a}
.rs-melding:empty{display:none}
.rs-naam{font-weight:700;font-size:14px}
.rs-schakel{display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer}
.rs-schakel input{width:18px;height:18px;accent-color:#8b3fd1}
.rs-bewerk{overflow-y:auto;gap:7px}
`
function zetCss() {
  if (document.getElementById('rs-css')) return
  const s = document.createElement('style'); s.id = 'rs-css'; s.textContent = CSS
  document.head.appendChild(s)
}
function el(tag, cls, inhoud) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (inhoud != null) e.textContent = inhoud
  return e
}
const stop = f => e => { e.stopPropagation(); f(e) }
const geprobeerd = new Map() // feeds-lijst -> tijd van de laatste mislukte poging (niet elke keer opnieuw)
function zetVak(e, sprite, i) {
  const s = vakStijl(i)
  e.style.backgroundImage = 'url("' + sprite + '")'
  e.style.backgroundSize = s.size
  e.style.backgroundPosition = s.pos
  e.style.backgroundRepeat = 'no-repeat'
}

// ── De widget ──
// fotos (alleen eigenaar): { lees: async () => cache, bewaar: async cache, sprite: async (data|null, id) }
// v4 (25 nov 2026): wijzig = null (gewoon: "✏️ Feeds" met vrij kiezen), false (geen knop: een vast vak in een kant-en-klare
// widget) of een functie (eigen keuze, bijvoorbeeld kiezen uit de feeds van de maker; layouts.js).
export function tekenRssWidget(c, { cfg = null, eigen = false, bewaar = null, ophalen = null, sprite = null, spriteId = '', fotos = null,
  verklein = verkleinInBrowser, teken = tekenSprite, nu = () => Date.now(), wijzig: eigenWijzig = null } = {}) {
  zetCss()
  const v = normaliseer(cfg)
  c.querySelectorAll('.rs-widget').forEach(x => x.remove())
  const w = el('div', 'rs-widget')
  c.appendChild(w)
  const magBewerken = eigen && typeof bewaar === 'function'
  const magOphalen = magBewerken && typeof ophalen === 'function'
  // Hoort het fotoplaatje bij deze berichten? Anders geen plaatjes (nooit een verkeerd plaatje bij een bericht).
  const fotoplaatje = v && v.plaatjes !== false && v.fotoId && spriteId === v.fotoId && netteSprite(sprite) ? sprite : null

  function leeg() {
    w.textContent = ''
    w.style.alignItems = 'center'; w.style.justifyContent = 'center'; w.style.textAlign = 'center'
    const icoon = el('div', null, '📰')
    icoon.style.fontSize = '30px'
    w.append(icoon, el('div', 'rs-sub', T('Nog geen feed')))
    if (magBewerken) {
      const k = el('button', 'rs-knopje rs-hoofd rs-kies', T('📰 Feed kiezen'))
      k.type = 'button'; k.onclick = stop(() => bewerk([], true))
      w.appendChild(k)
    }
  }

  async function vernieuw(melding, knop) {
    if (!magOphalen) return
    if (knop) knop.disabled = true
    if (melding) melding.textContent = T('Ophalen…')
    const uitslagen = await Promise.all(v.feeds.map(f => ophalen(f.url).then(r => (r && !r.fout ? r : null), () => null)))
    if (!w.isConnected) return
    if (!uitslagen.some(Boolean)) {
      geprobeerd.set(JSON.stringify(v.feeds), nu())
      if (knop) knop.disabled = false
      if (melding) melding.textContent = T('Ophalen lukt nu niet. Probeer het later nog eens.')
      return
    }
    const berichten = samenvoegen(v.feeds, uitslagen, v.berichten)
    const nieuw = { feeds: v.feeds, berichten, bijgewerkt: nu() }
    if (v.plaatjes === false) nieuw.plaatjes = false
    if (fotos) {
      try {
        if (v.plaatjes === false || typeof ophalen.plaatje !== 'function') {
          await fotos.sprite(null, '')
          await fotos.bewaar({})
        } else {
          if (melding) melding.textContent = T('Plaatjes ophalen…')
          const bronnen = {}
          uitslagen.forEach(u => { if (u) for (const b of u.berichten || []) if (b && b.link) bronnen[netteLink(b.link)] = b })
          let cache = {}
          try { cache = (await fotos.lees()) || {} } catch (e) {}
          cache = await maakFotos({ berichten, bronnen, cache, haal: ophalen.plaatje, verklein })
          const delen = spriteDelen(berichten, cache)
          const data = await teken(delen)
          const id = data ? fotoHash(data) : ''
          await fotos.bewaar(cache)
          await fotos.sprite(data, id)
          if (data) {
            nieuw.fotoId = id
            for (const d of delen) berichten[d.i].vak = d.i
          }
        }
      } catch (e) { console.warn('[rss] plaatjes', e) }
    }
    if (!w.isConnected) return
    bewaar(nieuw)
  }

  function onderregel(b) {
    const sub = el('div', 'rs-sub')
    sub.append(el('span', 'rs-bron', v.feeds[b.feed].naam))
    const t = wanneer(b.datum, nu())
    if (t) sub.append(document.createTextNode(' · ' + t))
    return sub
  }
  function maakLink(a, b) {
    a.href = b.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer'
    a.onclick = e => e.stopPropagation()
  }

  function toon() {
    w.textContent = ''
    w.removeAttribute('style')
    const lijst = el('div', 'rs-lijst')
    if (!v.berichten.length) lijst.appendChild(el('div', 'rs-uitleg', T('Nog geen berichten.')))
    v.berichten.forEach((b, i) => {
      const metFoto = !!fotoplaatje && b.vak === i
      if (i === 0) { // het nieuwste bericht groot, met plaatje (of een kleurverloop)
        const a = el('a', 'rs-groot rs-bericht-groot')
        maakLink(a, b)
        if (metFoto) zetVak(a, fotoplaatje, 0)
        const over = el('div', 'rs-over')
        over.append(el('div', 'rs-kop', b.titel))
        if (b.tekst) over.append(el('div', 'rs-sam', b.tekst))
        over.append(onderregel(b))
        a.append(over)
        if (metFoto) a.append(el('span', 'rs-label', v.feeds[b.feed].naam))
        lijst.appendChild(a)
        return
      }
      const a = el('a', 'rs-bericht')
      maakLink(a, b)
      if (metFoto) { const f = el('div', 'rs-foto'); zetVak(f, fotoplaatje, i); a.appendChild(f) }
      else a.appendChild(el('div', 'rs-letter', (v.feeds[b.feed].naam || '?').trim().charAt(0).toUpperCase()))
      const deel = el('div', 'rs-tekstdeel')
      deel.append(el('div', 'rs-kop', b.titel))
      if (b.tekst) deel.append(el('div', 'rs-sam', b.tekst))
      deel.append(onderregel(b))
      a.appendChild(deel)
      lijst.appendChild(a)
    })
    const voet = el('div', 'rs-voet')
    const uitleg = el('div', 'rs-uitleg rs-bijgewerkt', v.bijgewerkt ? T('Bijgewerkt: {wanneer}', { wanneer: wanneer(v.bijgewerkt, nu()) }) : T('Tik op een kop om het artikel te openen.'))
    voet.appendChild(uitleg)
    const melding = el('div', 'rs-melding')
    if (magBewerken) {
      if (magOphalen) {
        const ververs = el('button', 'rs-knopje rs-ververs', '↻')
        ververs.type = 'button'; ververs.title = T('Vernieuwen'); ververs.setAttribute('aria-label', T('Vernieuwen'))
        ververs.onclick = stop(() => vernieuw(melding, ververs))
        voet.appendChild(ververs)
      }
      if (eigenWijzig !== false) {
        const wijzig = el('button', 'rs-knopje rs-wijzig', T('✏️ Feeds'))
        wijzig.type = 'button'; wijzig.onclick = stop(() => typeof eigenWijzig === 'function' ? eigenWijzig() : bewerk(v.feeds.slice(), v.plaatjes !== false))
        voet.appendChild(wijzig)
      }
    }
    w.append(lijst, melding, voet)
    // Home: zijn de berichten ouder dan een uur, dan vanzelf nieuwe (niet steeds opnieuw als het net mislukte)
    if (magOphalen && nu() - (v.bijgewerkt || 0) > VERS_MS) {
      const mis = geprobeerd.get(JSON.stringify(v.feeds))
      if (!mis || nu() - mis > 5 * 60 * 1000) vernieuw(melding, null)
    }
  }

  // ── feeds kiezen (alleen de eigenaar) ──
  function bewerk(feeds, plaatjesAan) {
    w.textContent = ''
    w.removeAttribute('style')
    w.classList.add('rs-bewerk')
    const knoppen = el('div', 'rs-rij')
    const klaar = el('button', 'rs-knopje rs-hoofd rs-klaar', T('Klaar ✓'))
    klaar.type = 'button'
    const schakel = el('input', 'rs-plaatjes')
    klaar.onclick = stop(() => {
      w.classList.remove('rs-bewerk')
      if (!feeds.length) { bewaar(null); return }
      const aan = schakel.checked
      const zelfde = v && JSON.stringify(v.feeds.map(f => f.url)) === JSON.stringify(feeds.map(f => f.url)) && (v.plaatjes !== false) === aan
      // andere feeds (of plaatjes aan/uit): de oude berichten weg en meteen nieuwe ophalen (bijgewerkt 0)
      const nieuw = zelfde ? { ...v, feeds } : { feeds, berichten: [], bijgewerkt: 0 }
      if (!aan) nieuw.plaatjes = false
      else delete nieuw.plaatjes
      bewaar(nieuw)
    })
    const terug = el('button', 'rs-knopje rs-terug', T('Annuleren'))
    terug.type = 'button'
    terug.onclick = stop(() => { w.classList.remove('rs-bewerk'); if (v) toon(); else leeg() })
    knoppen.append(klaar, terug)
    const kop = el('div', 'rs-naam'), mijn = el('div', 'rs-lijst')
    mijn.style.flex = 'none'
    function tekenMijn() {
      kop.textContent = T('Jouw feeds ({n}/{max})', { n: feeds.length, max: MAX_FEEDS })
      mijn.textContent = ''
      if (!feeds.length) mijn.appendChild(el('div', 'rs-uitleg', T('Nog geen feeds. Plak hieronder een link of kies een voorbeeld.')))
      feeds.forEach((f, i) => {
        const r = el('div', 'rs-item')
        r.append(el('span', null, (i + 1) + '.'), el('span', 'rs-in', f.naam + ' · ' + host(f.url)))
        const weg = el('button', 'rs-knopje rs-weg', '✕')
        weg.type = 'button'; weg.title = T('Weghalen'); weg.setAttribute('aria-label', T('Weghalen') + ': ' + f.naam)
        weg.onclick = stop(() => { feeds.splice(i, 1); tekenMijn() })
        r.appendChild(weg)
        mijn.appendChild(r)
      })
    }
    const melding = el('div', 'rs-melding')
    let bezig = false
    async function voegToe(url, naam) {
      if (bezig) return
      const ruw = String(url || '').trim()
      if (/^http:\/\//i.test(ruw)) { melding.textContent = T('Alleen https-links kunnen.'); return }
      const nette = netteFeedUrl(ruw)
      if (!nette) { melding.textContent = T('Dit is geen geldige link.'); return }
      if (feeds.some(f => f.url === nette)) { melding.textContent = T('Staat er al op.'); return }
      if (feeds.length >= MAX_FEEDS) { melding.textContent = T('Je hebt al 3 feeds.'); return }
      let titel = ''
      if (magOphalen) { // eerst kijken of het echt een feed is
        bezig = true; melding.textContent = T('Controleren…')
        const r = await ophalen(nette)
        bezig = false
        if (!w.isConnected) return
        if (!r || r.fout) { melding.textContent = (r && r.fout) || T('Ophalen lukt nu niet. Probeer het later nog eens.'); return }
        titel = r.titel
        if (feeds.some(f => f.url === nette) || feeds.length >= MAX_FEEDS) { melding.textContent = ''; return }
      }
      feeds.push({ url: nette, naam: tekst(naam, 40) || tekst(titel, 40) || host(nette) })
      invoer.value = ''; melding.textContent = ''; tekenMijn()
    }
    const rij = el('div', 'rs-rij'), invoer = el('input', 'rs-veld rs-link')
    invoer.placeholder = T('Link naar een RSS-feed (https)'); invoer.type = 'url'; invoer.inputMode = 'url'; invoer.autocomplete = 'off'; invoer.maxLength = 500
    const erbij = el('button', 'rs-knopje rs-hoofd rs-erbij', T('➕ Toevoegen'))
    erbij.type = 'button'; erbij.onclick = stop(() => voegToe(invoer.value))
    invoer.onclick = e => e.stopPropagation()
    invoer.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') erbij.click() }
    rij.append(invoer, erbij)
    const voorbeelden = el('div', 'rs-rij')
    voorbeelden.appendChild(el('span', 'rs-uitleg', T('Voorbeelden:')))
    voorbeelden.firstChild.style.flex = 'none'
    for (const x of VOORBEELDEN()) {
      const b = el('button', 'rs-knopje rs-voorbeeld', x.naam)
      b.type = 'button'; b.onclick = stop(() => voegToe(x.url, x.naam))
      voorbeelden.appendChild(b)
    }
    const schakelRij = el('label', 'rs-schakel')
    schakel.type = 'checkbox'; schakel.checked = plaatjesAan !== false
    schakel.onclick = e => e.stopPropagation()
    schakelRij.onclick = e => e.stopPropagation()
    schakelRij.append(schakel, el('span', null, T('Plaatjes tonen')))
    w.append(knoppen, kop, mijn, rij, voorbeelden, schakelRij, melding,
      el('div', 'rs-uitleg', T('De koppen haalt de server van Stekky op, niet jouw toestel. Pas als je op een kop tikt, ga je naar de site zelf.')))
    tekenMijn()
  }

  if (v) toon()
  else leeg()
}
