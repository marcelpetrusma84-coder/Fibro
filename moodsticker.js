// moodsticker.js - een sticker als mood (v171, 16 oktober 2026)
// In Profiel kies je bij Mood een sticker in plaats van een emoji. Hij gaat als code mee in de mood op de server:
// mood = 'fxsticker:f2-04 Blij vandaag' en offline_emoji = 'fxsticker:f2-04' (beide gewone tekst, geen limiet).
// De Mood-widget op Home en de Mood op het profiel van een vriend tonen de sticker; een tik (of Enter) laat hem
// bewegen en geluid maken. Op de kleine plekken (onder je naam, de vriendenlijst) staat alleen de tekst.
// De sticker is een <span> met een achtergrondplaatje, geen <img>: zo opent fotoviewer.js hem niet als foto.
// Een eigen sticker van een vriend komt via de sync (sync.js); tot dan een zandlopertje dat vanzelf bijwerkt.
import { zoekSticker } from './stickervellen.js?v=235'
import { zoekEigenSticker, zoekVriendSticker, vriendStickerSleutel } from './eigenstickers.js?v=162'
import { speel } from './stickerfx.js?v=235'

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
export const MOOD_STICKER = /^fxsticker:((?:f[1-6]|e[12])-(?:0[1-9]|1[0-2]))(?:\s+|$)/
// 'fxsticker:f2-04 Blij' -> { code: 'f2-04', tekst: 'Blij' }; anders { code: null, tekst: de hele tekst }
export function leesMood(s) {
  const t = String(s || ''), m = MOOD_STICKER.exec(t)
  return m ? { code: m[1], tekst: t.slice(m[0].length) } : { code: null, tekst: t }
}
export const isMoodSticker = s => MOOD_STICKER.test(String(s || ''))
const naamVan = st => !st ? T('Sticker') : Array.isArray(st.naam) ? ((window.T && window.T.taal === 'en' ? st.naam[1] : st.naam[0]) || T('Sticker')) : (String(st.naam || '').trim() || T('Sticker'))

// Zoek de sticker: van Fibro, van jezelf (uid) of van een vriend (vriendId)
export async function zoekMoodSticker(code, { uid = null, vriendId = null } = {}) {
  if (!code) return null
  if (code[0] === 'f') return zoekSticker(code)
  try { return await (vriendId ? zoekVriendSticker(vriendId, code) : zoekEigenSticker(uid, code)) } catch (e) { return null }
}

// Teken de sticker in 'houder' (de plek van de emoji). grootte in px.
// tik = false: alleen het plaatje (het knopje in Profiel, waar een tik de keuze opent)
export async function tekenMoodSticker(houder, code, { uid = null, vriendId = null, grootte = 56, tik = true } = {}) {
  if (!houder || !code) return
  const st = await zoekMoodSticker(code, { uid, vriendId })
  if (!st) {
    if (code[0] === 'e' && vriendId) {
      // eigen sticker van de vriend, nog niet binnen: zandlopertje, en bijwerken zodra hij er is
      houder.textContent = '⏳'
      houder.setAttribute('aria-label', T('Sticker komt eraan'))
      try {
        const k = new BroadcastChannel('fibro-vriend-data')
        k.onmessage = e => { if (e && e.data && e.data.id === vriendStickerSleutel(vriendId, code)) { k.close(); tekenMoodSticker(houder, code, { uid, vriendId, grootte, tik }) } }
      } catch (e) {}
    } else houder.textContent = '\u{1F5BC}️' // weggegooid of onbekend
    return
  }
  const s = document.createElement('span')
  s.className = 'mood-sticker'
  if (tik) {
    s.setAttribute('role', 'button')
    s.setAttribute('tabindex', '0')
    s.setAttribute('aria-label', T('Speel sticker {naam}', { naam: naamVan(st) }))
  } else s.setAttribute('aria-hidden', 'true')
  s.style.cssText = 'display:inline-block;width:' + grootte + 'px;height:' + grootte + 'px;flex-shrink:0;' + (tik ? 'cursor:pointer;' : 'pointer-events:none;') +
    'background:center/contain no-repeat;-webkit-tap-highlight-color:transparent;vertical-align:middle;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
  s.style.backgroundImage = 'url("' + String(st.src).replace(/["\\\n]/g, '') + '")'
  if (tik) {
    const speelAf = (e) => { if (e) e.stopPropagation(); speel(s, st) }
    s.addEventListener('click', speelAf)
    s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); speelAf(e) } })
  }
  houder.replaceChildren(s)
  houder.removeAttribute('aria-label')
  return s
}
