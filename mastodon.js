// mastodon.js (v1, 19 nov 2026) - de Mastodon-widget: je openbare Mastodon-berichten op je Stekky-profiel.
//
// Privacyregels (Marcel, 19 nov 2026):
//  - ALLEEN MEELEZEN: Stekky logt nooit in bij Mastodon en bewaart geen sleutel. De widget leest de openbare RSS-feed
//    van één account (https://server/@naam.rss). Daar staan alleen openbare eigen berichten in: geen berichten voor
//    alleen volgers, geen privéberichten, geen tijdlijn van anderen.
//  - De server van Stekky (edge function rss-ophalen, dezelfde als de RSS-widget) haalt de feed op, niet jouw toestel.
//    Alleen het toestel van de eigenaar vraagt erom (bij het kiezen en daarna hoogstens eens per uur). Vrienden
//    krijgen alles via P2P (sync.js 'klein:mastodon' en de fotootjes als 'wbg:mastodon') en praten met niemand.
//  - GEVOELIG: een plaatje met media:rating adult of een bericht met een inhoudswaarschuwing (CW) krijgt van de server
//    geen plaatje-adres; zulke plaatjes worden dus nooit opgehaald. Een bericht met een CW toont eerst alleen de
//    waarschuwing; de tekst pas na een tik op "Toon bericht".
//  - Plaatjes: de server geeft ze alleen door; jouw telefoon maakt er fotootjes van (de "small"-versie van Mastodon,
//    lichter voor de server), alleen van nieuwe berichten, hoogstens 5 per keer. Samen één plaatje (het fotoplaatje),
//    met fotoId: hoort het niet bij de berichten, dan geen plaatjes (nooit een verkeerd plaatje bij een bericht).
//  - Links (bericht openen, "Volg mij op Mastodon") openen in een nieuw tabblad zonder referrer.
//
// Opslag: localStorage 'mastodon_<uid>' = JSON { account: { naam, server }, profiel: { naam, vak }, berichten:
// [{ tekst, cw, link, datum, vak }], bijgewerkt, fotoId, plaatjes } (hoogstens 8 berichten).
import { maakOphaler, netteLink, netteFeedUrl, netteSprite, fotoHash, verkleinInBrowser, wanneer } from './rsswidget.js?v=4'
export { maakOphaler }

Object.assign(window.FIBRO_EN ||= {}, {
  'Mastodon': 'Mastodon', 'Nog geen account': 'No account yet', '🐘 Account kiezen': '🐘 Choose an account',
  'Je Mastodon-naam, bijvoorbeeld @naam@mastodon.social': 'Your Mastodon name, for example @name@mastodon.social',
  'Dit is geen Mastodon-naam. Schrijf hem als @naam@server.': 'This is not a Mastodon name. Write it as @name@server.',
  'Dit account is niet gevonden, of laat zijn berichten niet zien.': 'This account was not found, or does not show its posts.',
  'Volg mij op Mastodon': 'Follow me on Mastodon', 'Toon bericht': 'Show post', 'Verberg bericht': 'Hide post',
  'Openen ↗': 'Open ↗', '✏️ Account': '✏️ Account', 'Nog geen openbare berichten.': 'No public posts yet.',
  'Alleen openbare berichten. Stekky logt niet in bij Mastodon; de server van Stekky leest mee, niet jouw toestel. Gevoelige plaatjes worden overgeslagen.':
    'Only public posts. {app} does not log in to Mastodon; the {app} server reads along, not your device. Sensitive pictures are skipped.',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const MAX_BERICHTEN = 8
export const VERS_MS = 60 * 60 * 1000 // hoogstens eens per uur vanzelf
export const MAX_PLAATJES = 5
// eslint-disable-next-line no-control-regex
const KAAL = /[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g
const regel = (s, max) => String(s == null ? '' : s).replace(KAAL, '').replace(/[ \t\n]+/g, ' ').trim().slice(0, max)
// tekst met witregels (hoogstens twee regeleinden achter elkaar)
const meerRegels = (s, max) => String(s == null ? '' : s).replace(KAAL, '').split('\n').map(r => r.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
const netteDatum = d => { const n = Number(d); return Number.isFinite(n) && n > 0 && n < 8.64e15 ? Math.round(n) : 0 }

// ── het account ──
// "@naam@server", "naam@server", "https://server/@naam" of "server/@naam" -> { naam, server } of null
export function leesAccount(invoer) {
  const s = String(invoer || '').trim()
  if (!s || s.length > 200) return null
  let naam, server
  let m = /^@?([A-Za-z0-9_]{1,30})@([A-Za-z0-9.-]+)$/.exec(s)
  if (m) { naam = m[1]; server = m[2] } else {
    m = /^(?:https:\/\/)?([A-Za-z0-9.-]+)\/@([A-Za-z0-9_]{1,30})\/?$/.exec(s)
    if (!m) return null
    server = m[1]; naam = m[2]
  }
  server = server.toLowerCase().replace(/\.$/, '')
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(server) || server.length > 100) return null
  if (!netteFeedUrl('https://' + server + '/')) return null // geen eigen netwerk (localhost, .local, IP-adres)
  return { naam, server }
}
export const feedUrl = a => 'https://' + a.server + '/@' + a.naam + '.rss'
export const profielUrl = a => 'https://' + a.server + '/@' + a.naam
export const handle = a => '@' + a.naam + '@' + a.server
// Mastodon bewaart elk plaatje ook kleiner ("small"); dat is veel lichter voor de server
export const kleinPlaatje = url => typeof url === 'string' ? url.replace(/\/original\/([^/]+)$/, '/small/$1') : ''

// ── het fotoplaatje: vak 0 = profielfoto (96 x 96), vak 1-8 = plaatje bij bericht 1-8 (240 x 135, twee naast elkaar) ──
export const SPRITE_B = 480, SPRITE_H = 96 + 4 * 135
export function vak(i) {
  if (i === 0) return { x: 0, y: 0, w: 96, h: 96 }
  if (!Number.isInteger(i) || i < 1 || i > MAX_BERICHTEN) return null
  return { x: ((i - 1) % 2) * 240, y: 96 + Math.floor((i - 1) / 2) * 135, w: 240, h: 135 }
}
export function vakStijl(i) {
  const v = vak(i)
  if (!v) return null
  const pct = (p, ruimte) => (ruimte > 0 ? Math.round(p / ruimte * 10000) / 100 : 0) + '%'
  return {
    size: Math.round(SPRITE_B / v.w * 10000) / 100 + '% ' + Math.round(SPRITE_H / v.h * 10000) / 100 + '%',
    pos: pct(v.x, SPRITE_B - v.w) + ' ' + pct(v.y, SPRITE_H - v.h),
  }
}

// Uit opslag of van een vriend: altijd netjes. Geen goed account = null.
export function normaliseer(cfg) {
  if (!cfg || typeof cfg !== 'object' || !cfg.account || typeof cfg.account !== 'object') return null
  const account = leesAccount(String(cfg.account.naam || '') + '@' + String(cfg.account.server || ''))
  if (!account) return null
  const p = cfg.profiel && typeof cfg.profiel === 'object' ? cfg.profiel : {}
  const profiel = { naam: regel(p.naam, 60) || account.naam }
  if (p.vak === 0) profiel.vak = 0
  const berichten = []
  // een bericht moet op de server van het account staan (geen links naar elders onder de naam van je vriend)
  const vanServer = l => { try { return new URL(l).hostname === account.server } catch (e) { return false } }
  for (const b of Array.isArray(cfg.berichten) ? cfg.berichten.slice(0, MAX_BERICHTEN * 2) : []) {
    if (!b || typeof b !== 'object') continue
    const link = netteLink(b.link), tekst = meerRegels(b.tekst, 500), cw = regel(b.cw, 120)
    if (!link || !vanServer(link) || (!tekst && !cw) || berichten.some(x => x.link === link)) continue
    const nb = { tekst, link, datum: netteDatum(b.datum) }
    if (cw) nb.cw = cw
    const plek = berichten.length + 1
    if (b.vak === plek && !cw) nb.vak = plek // een bericht met een waarschuwing heeft nooit een plaatje
    berichten.push(nb)
    if (berichten.length === MAX_BERICHTEN) break
  }
  const uit = { account, profiel, berichten, bijgewerkt: netteDatum(cfg.bijgewerkt) }
  if (typeof cfg.fotoId === 'string' && /^[a-z0-9]{1,16}$/.test(cfg.fotoId)) uit.fotoId = cfg.fotoId
  if (cfg.plaatjes === false) uit.plaatjes = false
  return uit
}

// Van wat de server gaf naar onze berichten (hoogstens 8, nieuwste eerst zoals de feed)
export function berichtenUit(uitslag) {
  const lijst = []
  for (const b of (uitslag && Array.isArray(uitslag.berichten) ? uitslag.berichten : [])) {
    if (!b || typeof b !== 'object') continue
    const tekst = meerRegels(b.inhoud != null ? b.inhoud : b.titel, 500), cw = regel(b.cw, 120)
    const link = netteLink(b.link)
    if (!link || (!tekst && !cw)) continue
    const nb = { tekst, link, datum: netteDatum(b.datum) }
    if (cw) nb.cw = cw
    lijst.push(nb)
    if (lijst.length === MAX_BERICHTEN) break
  }
  return lijst
}

// Welke plaatjes vragen? Alleen nieuwe (niet in het geheugen, niet eerder mislukt), nooit gevoelig, hoogstens max.
// bronnen: link -> adres van het plaatje (al zonder gevoelige, die geeft de server niet). profielfoto: adres of ''.
export function kiesPlaatjes(berichten, bronnen, profielfoto, cache = {}, max = MAX_PLAATJES) {
  const lijst = []
  const wil = (sleutel, url, b, h) => {
    if (lijst.length >= max || !url || !url.startsWith('https://')) return
    const c = cache[sleutel]
    if (c && (c.d || c.mis)) return
    lijst.push({ sleutel, url, b, h })
  }
  wil('profiel:' + profielfoto, profielfoto, 96, 96)
  berichten.forEach(x => { if (!x.cw && bronnen[x.link]) wil(x.link, kleinPlaatje(bronnen[x.link]), 240, 135) })
  return lijst
}
export async function maakFotos({ berichten, bronnen, profielfoto, cache = {}, haal, verklein, max = MAX_PLAATJES }) {
  const nieuw = {}
  const houd = k => { if (cache[k]) nieuw[k] = { ...cache[k] } }
  if (profielfoto) houd('profiel:' + profielfoto)
  for (const b of berichten) houd(b.link)
  for (const p of kiesPlaatjes(berichten, bronnen, profielfoto, nieuw, max)) {
    let blob = null
    try { blob = await haal(p.url) } catch (e) {}
    try { nieuw[p.sleutel] = blob ? { d: await verklein(blob, p.b, p.h) } : { mis: 1 } } catch (e) { nieuw[p.sleutel] = { mis: 1 } }
  }
  return nieuw
}
// Welk fotootje in welk vak (vak 0 = profielfoto, vak i = bericht i)
export function spriteDelen(berichten, profielfoto, cache) {
  const delen = []
  const pf = profielfoto && cache['profiel:' + profielfoto]
  if (pf && pf.d) delen.push({ i: 0, data: pf.d })
  berichten.forEach((b, n) => { const c = cache[b.link]; if (!b.cw && c && c.d) delen.push({ i: n + 1, data: c.d }) })
  return delen.filter(d => typeof d.data === 'string' && d.data.startsWith('data:image/'))
}
export async function tekenSprite(delen) {
  if (!delen.length) return null
  const cv = document.createElement('canvas')
  cv.width = SPRITE_B; cv.height = SPRITE_H
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#1a0a2e'; ctx.fillRect(0, 0, SPRITE_B, SPRITE_H)
  let getekend = 0
  for (const d of delen) {
    const v = vak(d.i)
    try { const img = new Image(); img.src = d.data; await img.decode(); ctx.drawImage(img, v.x, v.y, v.w, v.h); getekend++ } catch (e) {}
  }
  return getekend ? cv.toDataURL('image/jpeg', 0.75) : null
}

// ── uiterlijk ──
const CSS = `
.md-tekst[hidden]{display:none!important}
.md-widget{width:100%;height:420px;max-height:72vh;min-height:180px;display:flex;flex-direction:column;gap:7px;box-sizing:border-box;color:inherit;text-align:left;position:relative;z-index:2;font-family:inherit}
.md-kop{display:flex;align-items:center;gap:10px;flex:none}
.md-foto{flex:none;width:44px;height:44px;border-radius:50%;background-color:#563acc;background-repeat:no-repeat;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 0 2px rgba(192,132,252,.5)}
.md-wie{flex:1;min-width:0}
.md-naam{font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.md-handle{font-size:11px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.md-volg{flex:none;display:inline-block;text-decoration:none;background:#563acc;color:#fff;font-size:11.5px;font-weight:700;padding:6px 10px;border-radius:999px}
.md-volg:focus-visible,.md-open:focus-visible{outline:2px solid #c084fc;outline-offset:1px}
.md-lijst{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:7px;overscroll-behavior:contain;scrollbar-width:thin}
.md-bericht{flex:none;background:rgba(0,0,0,.22);border-radius:13px;padding:10px 11px;display:flex;flex-direction:column;gap:7px;border-left:3px solid #563acc}
.md-tekst{font-size:13px;line-height:1.4;white-space:pre-line;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.md-plaatje{width:100%;aspect-ratio:16/9;border-radius:10px;background-color:#2a1450;background-repeat:no-repeat}
.md-cw{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;font-weight:700;background:rgba(255,207,138,.12);border:1px solid rgba(255,207,138,.35);color:#ffdca8;border-radius:9px;padding:7px 9px}
.md-cw span{flex:1;min-width:120px}
.md-onder{display:flex;align-items:center;gap:8px;font-size:10.5px;opacity:.7}
.md-onder .md-open{margin-left:auto;color:#c084fc;text-decoration:none;font-weight:700;opacity:1}
.md-voet{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none}
.md-uitleg{font-size:10.5px;opacity:.65;line-height:1.3;flex:1;min-width:120px}
.md-knopje{border:none;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.14);color:#fff}
.md-knopje.md-hoofd{background:#8b3fd1}
.md-knopje:disabled{opacity:.5;cursor:default}
.md-rij{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.md-veld{flex:1;min-width:0;box-sizing:border-box;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.2);border-radius:8px;padding:7px 9px;color:#fff;font-size:13px;font-family:inherit;outline:none}
.md-melding{font-size:12px;color:#ffcf8a}
.md-melding:empty{display:none}
.md-schakel{display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer}
.md-schakel input{width:18px;height:18px;accent-color:#8b3fd1}
.md-bewerk{overflow-y:auto}
`
function zetCss() {
  if (document.getElementById('md-css')) return
  const s = document.createElement('style'); s.id = 'md-css'; s.textContent = CSS
  document.head.appendChild(s)
}
function el(tag, cls, inhoud) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (inhoud != null) e.textContent = inhoud
  return e
}
const stop = f => e => { e.stopPropagation(); f(e) }
function buitenLink(a, url) {
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer'
  a.onclick = e => e.stopPropagation()
}
function zetVak(e, sprite, i) {
  const s = vakStijl(i)
  e.style.backgroundImage = 'url("' + sprite + '")'
  e.style.backgroundSize = s.size
  e.style.backgroundPosition = s.pos
}
const geprobeerd = new Map()

// fotos (alleen eigenaar): { lees, bewaar, sprite } zoals bij de RSS-widget
export function tekenMastodonWidget(c, { cfg = null, eigen = false, bewaar = null, ophalen = null, sprite = null, spriteId = '', fotos = null,
  verklein = verkleinInBrowser, teken = tekenSprite, nu = () => Date.now() } = {}) {
  zetCss()
  const v = normaliseer(cfg)
  c.querySelectorAll('.md-widget').forEach(x => x.remove())
  const w = el('div', 'md-widget')
  c.appendChild(w)
  const magBewerken = eigen && typeof bewaar === 'function'
  const magOphalen = magBewerken && typeof ophalen === 'function'
  const fotoplaatje = v && v.plaatjes !== false && v.fotoId && spriteId === v.fotoId && netteSprite(sprite) ? sprite : null

  function leeg() {
    w.textContent = ''
    w.style.alignItems = 'center'; w.style.justifyContent = 'center'; w.style.textAlign = 'center'
    const icoon = el('div', null, '🐘'); icoon.style.fontSize = '30px'
    w.append(icoon, el('div', 'md-handle', T('Nog geen account')))
    if (magBewerken) {
      const k = el('button', 'md-knopje md-hoofd md-kies', T('🐘 Account kiezen'))
      k.type = 'button'; k.onclick = stop(() => bewerk(''))
      w.appendChild(k)
    }
  }

  async function vernieuw(melding, knop) {
    if (!magOphalen) return
    if (knop) knop.disabled = true
    if (melding) melding.textContent = T('Ophalen…')
    let r = null
    try { r = await ophalen(feedUrl(v.account)) } catch (e) {}
    if (!w.isConnected) return
    if (!r || r.fout) {
      geprobeerd.set(handle(v.account), nu())
      if (knop) knop.disabled = false
      if (melding) melding.textContent = T('Ophalen lukt nu niet. Probeer het later nog eens.')
      return
    }
    const berichten = berichtenUit(r)
    const nieuw = { account: v.account, profiel: { naam: regel(r.titel, 60) || v.account.naam }, berichten, bijgewerkt: nu() }
    if (v.plaatjes === false) nieuw.plaatjes = false
    if (fotos) {
      try {
        if (v.plaatjes === false || typeof ophalen.plaatje !== 'function') {
          await fotos.sprite(null, ''); await fotos.bewaar({})
        } else {
          const bronnen = {}
          for (const b of r.berichten || []) if (b && b.link && !b.gevoelig && !b.cw && b.plaatje) bronnen[netteLink(b.link)] = b.plaatjeGroot || b.plaatje
          const profielfoto = typeof r.afbeelding === 'string' && r.afbeelding.startsWith('https://') ? r.afbeelding : ''
          let cache = {}
          try { cache = (await fotos.lees()) || {} } catch (e) {}
          cache = await maakFotos({ berichten, bronnen, profielfoto, cache, haal: ophalen.plaatje, verklein })
          const delen = spriteDelen(berichten, profielfoto, cache)
          const data = await teken(delen)
          const id = data ? fotoHash(data) : ''
          await fotos.bewaar(cache)
          await fotos.sprite(data, id)
          if (data) {
            nieuw.fotoId = id
            for (const d of delen) { if (d.i === 0) nieuw.profiel.vak = 0; else berichten[d.i - 1].vak = d.i }
          }
        }
      } catch (e) { console.warn('[mastodon] plaatjes', e) }
    }
    if (!w.isConnected) return
    bewaar(nieuw)
  }

  function toon() {
    w.textContent = ''
    w.removeAttribute('style')
    const kop = el('div', 'md-kop')
    const foto = el('div', 'md-foto')
    if (fotoplaatje && v.profiel.vak === 0) zetVak(foto, fotoplaatje, 0)
    else foto.textContent = '🐘'
    const wie = el('div', 'md-wie')
    wie.append(el('div', 'md-naam', v.profiel.naam), el('div', 'md-handle', handle(v.account)))
    const volg = el('a', 'md-volg', T('Volg mij op Mastodon'))
    buitenLink(volg, profielUrl(v.account))
    kop.append(foto, wie, volg)
    const lijst = el('div', 'md-lijst')
    if (!v.berichten.length) lijst.appendChild(el('div', 'md-uitleg', T('Nog geen openbare berichten.')))
    v.berichten.forEach((b, n) => {
      const k = el('div', 'md-bericht')
      const tekst = el('div', 'md-tekst', b.tekst)
      if (b.cw) { // eerst alleen de waarschuwing; de tekst pas na een tik
        const cw = el('div', 'md-cw')
        cw.append(el('span', null, '⚠️ ' + b.cw))
        const toonKnop = el('button', 'md-knopje md-toon', T('Toon bericht'))
        toonKnop.type = 'button'
        tekst.hidden = true
        toonKnop.onclick = stop(() => { tekst.hidden = !tekst.hidden; toonKnop.textContent = tekst.hidden ? T('Toon bericht') : T('Verberg bericht') })
        cw.appendChild(toonKnop)
        k.append(cw, tekst)
      } else {
        k.appendChild(tekst)
        if (fotoplaatje && b.vak === n + 1) { const p = el('div', 'md-plaatje'); zetVak(p, fotoplaatje, n + 1); k.appendChild(p) }
      }
      const onder = el('div', 'md-onder')
      onder.appendChild(el('span', null, wanneer(b.datum, nu())))
      const open = el('a', 'md-open', T('Openen ↗'))
      buitenLink(open, b.link)
      onder.appendChild(open)
      k.appendChild(onder)
      lijst.appendChild(k)
    })
    const voet = el('div', 'md-voet')
    voet.appendChild(el('div', 'md-uitleg', v.bijgewerkt ? T('Bijgewerkt: {wanneer}', { wanneer: wanneer(v.bijgewerkt, nu()) }) : ''))
    const melding = el('div', 'md-melding')
    if (magBewerken) {
      if (magOphalen) {
        const ververs = el('button', 'md-knopje md-ververs', '↻')
        ververs.type = 'button'; ververs.title = T('Vernieuwen'); ververs.setAttribute('aria-label', T('Vernieuwen'))
        ververs.onclick = stop(() => vernieuw(melding, ververs))
        voet.appendChild(ververs)
      }
      const wijzig = el('button', 'md-knopje md-wijzig', T('✏️ Account'))
      wijzig.type = 'button'; wijzig.onclick = stop(() => bewerk(handle(v.account), v.plaatjes !== false))
      voet.appendChild(wijzig)
    }
    w.append(kop, lijst, melding, voet)
    if (magOphalen && nu() - (v.bijgewerkt || 0) > VERS_MS) {
      const mis = geprobeerd.get(handle(v.account))
      if (!mis || nu() - mis > 5 * 60 * 1000) vernieuw(melding, null)
    }
  }

  // ── account kiezen (alleen de eigenaar) ──
  function bewerk(begin, plaatjesAan = true) {
    w.textContent = ''
    w.removeAttribute('style')
    w.classList.add('md-bewerk')
    const knoppen = el('div', 'md-rij')
    const klaar = el('button', 'md-knopje md-hoofd md-klaar', T('Klaar ✓'))
    klaar.type = 'button'
    const terug = el('button', 'md-knopje md-terug', T('Annuleren'))
    terug.type = 'button'
    terug.onclick = stop(() => { w.classList.remove('md-bewerk'); if (v) toon(); else leeg() })
    knoppen.append(klaar, terug)
    const invoer = el('input', 'md-veld md-naamveld')
    invoer.placeholder = T('Je Mastodon-naam, bijvoorbeeld @naam@mastodon.social'); invoer.value = begin || ''
    invoer.autocomplete = 'off'; invoer.autocapitalize = 'off'; invoer.spellcheck = false; invoer.maxLength = 200
    invoer.onclick = e => e.stopPropagation()
    invoer.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') klaar.click() }
    const schakelRij = el('label', 'md-schakel')
    const schakel = el('input', 'md-plaatjes')
    schakel.type = 'checkbox'; schakel.checked = plaatjesAan !== false
    schakel.onclick = e => e.stopPropagation(); schakelRij.onclick = e => e.stopPropagation()
    schakelRij.append(schakel, el('span', null, T('Plaatjes tonen')))
    const melding = el('div', 'md-melding')
    let bezig = false
    klaar.onclick = stop(async () => {
      if (bezig) return
      const ruw = invoer.value.trim()
      if (!ruw) { w.classList.remove('md-bewerk'); bewaar(null); return }
      const account = leesAccount(ruw)
      if (!account) { melding.textContent = T('Dit is geen Mastodon-naam. Schrijf hem als @naam@server.'); return }
      const aan = schakel.checked
      const zelfde = v && handle(v.account) === handle(account) && (v.plaatjes !== false) === aan
      if (zelfde) { w.classList.remove('md-bewerk'); toon(); return }
      if (magOphalen) { // eerst kijken of het account er is en berichten laat zien
        bezig = true; klaar.disabled = true; melding.textContent = T('Controleren…')
        let r = null
        try { r = await ophalen(feedUrl(account)) } catch (e) {}
        bezig = false; klaar.disabled = false
        if (!w.isConnected) return
        if (!r || r.fout) { melding.textContent = T('Dit account is niet gevonden, of laat zijn berichten niet zien.'); return }
      }
      w.classList.remove('md-bewerk')
      const nieuw = { account, profiel: { naam: account.naam }, berichten: [], bijgewerkt: 0 } // meteen ophalen
      if (!aan) nieuw.plaatjes = false
      bewaar(nieuw)
    })
    w.append(knoppen, el('div', 'md-naam', '🐘 Mastodon'), invoer, schakelRij, melding,
      el('div', 'md-uitleg', T('Alleen openbare berichten. Stekky logt niet in bij Mastodon; de server van Stekky leest mee, niet jouw toestel. Gevoelige plaatjes worden overgeslagen.')))
    try { invoer.focus({ preventScroll: true }) } catch (e) {}
  }

  if (v) toon()
  else leeg()
}
