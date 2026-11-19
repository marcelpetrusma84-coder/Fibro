// rsswidget.js (v1, 19 nov 2026) - de RSS-widget: de nieuwste koppen van je favoriete sites op je profiel.
//
// In gewone woorden: je zet tot 3 RSS-feeds op de widget (een link plakken, of een voorbeeld kiezen). JOUW toestel
// vraagt de server van Stekky (edge function rss-ophalen) om de koppen; die haalt de feed op en geeft alleen tekst
// terug (kop, link, datum). De nieuwssite ziet dus de server, niet jou. De koppen worden op dit toestel bewaard en gaan
// via de gewone synchronisatie naar je vrienden (sync.js, 'klein:rss'): vrienden praten met niemand. Pas als iemand op
// een kop tikt, opent het artikel op de site zelf (nieuw tabblad, zonder referrer).
//  - Home ververst vanzelf als de koppen ouder zijn dan een half uur (en met de knop ↻).
//  - wat van een vriend komt gaat door normaliseer(): alleen tekst, links alleen http(s) zonder inlog.
//  - geen plaatjes: die zouden het toestel van een vriend alsnog met de nieuwssite laten praten.
//
// Opslag: localStorage 'rss_<uid>' = JSON { feeds: [{ url, naam }], berichten: [{ titel, link, datum, feed }],
// bijgewerkt } (hoogstens 3 feeds en 12 berichten; feed = nummer van de feed in de lijst).
//
// Gebruik:
//   normaliseer(cfg)                          -> cfg of null
//   maakOphaler(geefPas)                      -> async url => { titel, berichten } of { fout }
//   samenvoegen(feeds, uitslagen, oud)        -> berichten (nieuwste eerst)
//   tekenRssWidget(el, { cfg, eigen, bewaar, ophalen })

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
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const MAX_FEEDS = 3
export const MAX_BERICHTEN = 12
export const VERS_MS = 30 * 60 * 1000 // ouder dan een half uur: Home haalt nieuwe koppen
export const FUNCTIE_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/rss-ophalen'
const ANON_KEY = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
// Voorbeelden om snel te kiezen (een functie: de teksten worden vertaald op het moment dat ze getekend worden)
export const VOORBEELDEN = () => [
  { naam: 'NOS Nieuws', url: 'https://feeds.nos.nl/nosnieuwsalgemeen' },
  { naam: 'NOS Sport', url: 'https://feeds.nos.nl/nossportalgemeen' },
  { naam: 'NU.nl', url: 'https://www.nu.nl/rss/Algemeen' },
]
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
    berichten.push({ titel, link, datum: netteDatum(b.datum), feed })
    if (berichten.length === MAX_BERICHTEN) break
  }
  return { feeds, berichten, bijgewerkt: netteDatum(cfg.bijgewerkt) }
}

// Nieuwe koppen erbij: per feed de nieuwste, samen hoogstens 12 (nieuwste eerst, zonder datum achteraan).
// Lukte een feed niet (uitslag null), dan blijven zijn oude koppen staan.
export function samenvoegen(feeds, uitslagen, oud = []) {
  const alles = []
  feeds.forEach((f, i) => {
    const u = uitslagen[i]
    const lijst = u && Array.isArray(u.berichten) ? u.berichten.map(b => ({ titel: b.titel, link: b.link, datum: b.datum, feed: i }))
      : oud.filter(b => b.feed === i)
    alles.push(...lijst.slice(0, MAX_BERICHTEN).map((b, volg) => ({ ...b, volg })))
  })
  const schoon = normaliseer({ feeds, berichten: alles.sort((a, b) => (netteDatum(b.datum) - netteDatum(a.datum)) || (a.volg - b.volg)) })
  return schoon ? schoon.berichten : []
}

// Vraagt de server om één feed. geefPas() geeft de inlogpas (access_token) of null.
export function maakOphaler(geefPas, { fetch: f = globalThis.fetch, ms = 12000 } = {}) {
  return async url => {
    const nette = netteFeedUrl(url)
    if (!nette) return { fout: T('Dit is geen geldige link.') }
    let pas = null
    try { pas = await geefPas() } catch (e) {}
    if (!pas) return { fout: T('Ophalen lukt nu niet. Probeer het later nog eens.') }
    const c = typeof AbortController === 'function' ? new AbortController() : null
    const klok = c ? setTimeout(() => c.abort(), ms) : null
    try {
      const r = await f(FUNCTIE_URL, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', signal: c ? c.signal : undefined,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pas, apikey: ANON_KEY },
        body: JSON.stringify({ url: nette }),
      })
      let d = null
      try { d = await r.json() } catch (e) {}
      if (r.ok && d && d.ok && Array.isArray(d.berichten)) return { titel: tekst(d.titel, 40), berichten: d.berichten }
      if (d && d.reden === 'geen feed') return { fout: T('Dit is geen RSS-feed.') }
      if (d && (d.reden === 'niet bereikbaar' || d.reden === 'te langzaam' || d.reden === 'te groot' || d.reden === 'adres')) return { fout: T('Deze feed is nu niet te bereiken.') }
      return { fout: T('Ophalen lukt nu niet. Probeer het later nog eens.') }
    } catch (e) {
      return { fout: T('Ophalen lukt nu niet. Probeer het later nog eens.') }
    } finally { if (klok) clearTimeout(klok) }
  }
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
.rs-widget{width:100%;height:100%;min-height:180px;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;color:inherit;text-align:left;position:relative;z-index:2;font-family:inherit}
.rs-lijst{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px;overscroll-behavior:contain}
.rs-bericht{display:block;text-decoration:none;color:inherit;background:rgba(0,0,0,.2);border-radius:9px;padding:7px 9px;border-left:3px solid #8b3fd1}
.rs-bericht:focus-visible{outline:2px solid #c084fc;outline-offset:1px}
.rs-kop{font-size:13px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rs-sub{font-size:10.5px;opacity:.7;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
.rs-naam{font-weight:700;font-size:14px}
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

// ── De widget ──
export function tekenRssWidget(c, { cfg = null, eigen = false, bewaar = null, ophalen = null, nu = () => Date.now() } = {}) {
  zetCss()
  const v = normaliseer(cfg)
  c.querySelectorAll('.rs-widget').forEach(x => x.remove())
  const w = el('div', 'rs-widget')
  c.appendChild(w)
  const magBewerken = eigen && typeof bewaar === 'function'
  const magOphalen = magBewerken && typeof ophalen === 'function'

  function leeg() {
    w.textContent = ''
    w.style.alignItems = 'center'; w.style.justifyContent = 'center'; w.style.textAlign = 'center'
    const icoon = el('div', null, '📰')
    icoon.style.fontSize = '30px'
    w.append(icoon, el('div', 'rs-sub', T('Nog geen feed')))
    if (magBewerken) {
      const k = el('button', 'rs-knopje rs-hoofd rs-kies', T('📰 Feed kiezen'))
      k.type = 'button'; k.onclick = stop(() => bewerk([]))
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
    bewaar({ feeds: v.feeds, berichten: samenvoegen(v.feeds, uitslagen, v.berichten), bijgewerkt: nu() })
  }

  function toon() {
    w.textContent = ''
    w.removeAttribute('style')
    const lijst = el('div', 'rs-lijst')
    if (!v.berichten.length) lijst.appendChild(el('div', 'rs-uitleg', T('Nog geen berichten.')))
    for (const b of v.berichten) {
      const a = el('a', 'rs-bericht')
      a.href = b.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer'
      a.onclick = e => e.stopPropagation()
      const sub = [v.feeds[b.feed].naam, wanneer(b.datum, nu())].filter(Boolean).join(' · ')
      a.append(el('div', 'rs-kop', b.titel), el('div', 'rs-sub', sub))
      lijst.appendChild(a)
    }
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
      const wijzig = el('button', 'rs-knopje rs-wijzig', T('✏️ Feeds'))
      wijzig.type = 'button'; wijzig.onclick = stop(() => bewerk(v.feeds.slice()))
      voet.appendChild(wijzig)
    }
    w.append(lijst, melding, voet)
    // Home: zijn de koppen ouder dan een half uur, dan vanzelf nieuwe (niet steeds opnieuw als het net mislukte)
    if (magOphalen && nu() - (v.bijgewerkt || 0) > VERS_MS) {
      const mis = geprobeerd.get(JSON.stringify(v.feeds))
      if (!mis || nu() - mis > 5 * 60 * 1000) vernieuw(melding, null)
    }
  }

  // ── feeds kiezen (alleen de eigenaar) ──
  function bewerk(feeds) {
    w.textContent = ''
    w.removeAttribute('style')
    w.classList.add('rs-bewerk')
    const knoppen = el('div', 'rs-rij')
    const klaar = el('button', 'rs-knopje rs-hoofd rs-klaar', T('Klaar ✓'))
    klaar.type = 'button'
    klaar.onclick = stop(() => {
      w.classList.remove('rs-bewerk')
      if (!feeds.length) { bewaar(null); return }
      const zelfde = v && JSON.stringify(v.feeds.map(f => f.url)) === JSON.stringify(feeds.map(f => f.url))
      // andere feeds: de oude koppen weg en meteen nieuwe ophalen (bijgewerkt 0); dezelfde: alleen de namen
      bewaar(zelfde ? { feeds, berichten: v.berichten, bijgewerkt: v.bijgewerkt } : { feeds, berichten: [], bijgewerkt: 0 })
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
      link.value = ''; melding.textContent = ''; tekenMijn()
    }
    const rij = el('div', 'rs-rij'), link = el('input', 'rs-veld rs-link')
    link.placeholder = T('Link naar een RSS-feed (https)'); link.type = 'url'; link.inputMode = 'url'; link.autocomplete = 'off'; link.maxLength = 500
    const erbij = el('button', 'rs-knopje rs-hoofd rs-erbij', T('➕ Toevoegen'))
    erbij.type = 'button'; erbij.onclick = stop(() => voegToe(link.value))
    link.onclick = e => e.stopPropagation()
    link.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') erbij.click() }
    rij.append(link, erbij)
    const voorbeelden = el('div', 'rs-rij')
    voorbeelden.appendChild(el('span', 'rs-uitleg', T('Voorbeelden:')))
    voorbeelden.firstChild.style.flex = 'none'
    for (const x of VOORBEELDEN()) {
      const b = el('button', 'rs-knopje rs-voorbeeld', x.naam)
      b.type = 'button'; b.onclick = stop(() => voegToe(x.url, x.naam))
      voorbeelden.appendChild(b)
    }
    w.append(knoppen, kop, mijn, rij, voorbeelden, melding,
      el('div', 'rs-uitleg', T('De koppen haalt de server van Stekky op, niet jouw toestel. Pas als je op een kop tikt, ga je naar de site zelf.')))
    tekenMijn()
  }

  if (v) toon()
  else leeg()
}
