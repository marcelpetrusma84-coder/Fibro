// spelbericht.js (v1, 6 nov 2026, v275): een spreekwolkje bovenin het spel als je een berichtje krijgt (Marcel).
//
// Het eerste berichtje tijdens het spelen: een wolkje "💬 Je hebt een berichtje" (net onder de ✕) dat na een paar
// seconden klein wordt. Daarna blijft er een klein wolkje naast de ✕ staan met het aantal (💬 3), zonder steeds opnieuw te storen.
// Tik je erop, dan vraagt hij eerst of je het spel wilt verlaten (Naar de chat / Verder spelen).
// Alleen het wolkje: geen naam of tekst van het bericht (berichten zijn versleuteld, en niemand kijkt mee op je scherm).
// Het luistert op het lijntje 'ongelezen-<ik>', hetzelfde als het bolletje bij Chat (ongelezen.js) op de andere
// pagina's; de pushmelding van de server blijft gewoon komen.

import { supabase } from './supabase.js?v=95'
import { houOpen } from './lijntjes.js?v=1'

export const GROOT_MS = 4000   // zo lang staat het grote wolkje er

// Telt dit berichtje mee? Net als ongelezen.js: van een oproep alleen een gemiste.
export function telt(m, ik) {
  if (!m || m.receiver_id !== ik || !m.sender_id || m.sender_id === ik) return false
  const c = m.content
  return typeof c !== 'string' || !c.startsWith('oproep:') || c.startsWith('oproep:gemist:')
}

const t = (zin, w) => (typeof window.T === 'function' ? window.T(zin, w) : zin)

function stijl() {
  if (document.getElementById('spelbericht-stijl')) return
  const s = document.createElement('style')
  s.id = 'spelbericht-stijl'
  s.textContent = `
#spelbericht { position:fixed; top:62px; right:16px; z-index:28; display:flex;
  align-items:center; gap:6px; min-height:36px; padding:7px 14px; border:none; border-radius:18px 4px 18px 18px;
  background:#8b3fd1; color:#fff; font:600 15px/1.2 system-ui,-apple-system,sans-serif; box-shadow:0 6px 18px rgba(0,0,0,0.45);
  cursor:pointer; -webkit-tap-highlight-color:transparent; transition:top .3s, right .3s, padding .25s, font-size .25s; animation:spelbericht-in .3s ease-out; }
#spelbericht.klein { top:17px; right:62px; padding:6px 11px; font-size:14px; } /* naast de ✕ van het spel (spel.html) */
#spelbericht.wip { animation:spelbericht-wip .35s ease-out; }
#spelbericht .sb-tekst { white-space:nowrap; }
#spelbericht.klein .sb-tekst { display:none; }
#spelbericht .sb-getal { display:none; min-width:12px; text-align:center; }
#spelbericht.klein .sb-getal { display:inline; }
#spelbericht-vraag { position:fixed; top:62px; right:16px; z-index:29; width:min(260px, calc(100vw - 24px));
  padding:14px; border-radius:14px; background:rgba(26,10,46,0.97); color:#fff; border:1px solid rgba(192,132,252,0.5);
  font:15px/1.4 system-ui,-apple-system,sans-serif; box-shadow:0 10px 30px rgba(0,0,0,0.55); }
#spelbericht-vraag .sb-rij { display:flex; gap:8px; margin-top:12px; }
#spelbericht-vraag button { flex:1; min-height:42px; border:none; border-radius:21px; font:inherit; font-weight:700; cursor:pointer; }
#spelbericht-vraag .sb-ja { background:#8b3fd1; color:#fff; }
#spelbericht-vraag .sb-nee { background:rgba(255,255,255,0.14); color:#fff; }
@keyframes spelbericht-in { from { transform:translateY(-16px); opacity:0 } to { transform:none; opacity:1 } }
@keyframes spelbericht-wip { 0% { transform:scale(1) } 40% { transform:scale(1.18) } 100% { transform:scale(1) } }`
  document.head.appendChild(s)
}

// Toont het wolkje; geeft functies terug om een berichtje erbij te tellen (los te testen in de browser).
export function maakWolkje(naarChat) {
  stijl()
  let aantal = 0
  const van = new Set()
  let knop = null, kleinTimer = null

  function vraag() {
    if (document.getElementById('spelbericht-vraag')) return
    const v = document.createElement('div')
    v.id = 'spelbericht-vraag'
    v.setAttribute('role', 'dialog')
    const zin = document.createElement('div')
    zin.textContent = t('Naar de chat? Dan verlaat je het spel.')
    const rij = document.createElement('div'); rij.className = 'sb-rij'
    const nee = document.createElement('button'); nee.type = 'button'; nee.className = 'sb-nee'; nee.textContent = t('Verder spelen')
    const ja = document.createElement('button'); ja.type = 'button'; ja.className = 'sb-ja'; ja.textContent = t('Naar de chat')
    nee.onclick = () => v.remove()
    ja.onclick = () => { v.remove(); naarChat(van.size === 1 ? [...van][0] : null) }
    rij.append(nee, ja)
    v.append(zin, rij)
    document.body.appendChild(v)
  }

  function erbij(vanId) {
    aantal++
    if (vanId) van.add(vanId)
    if (!knop) {
      knop = document.createElement('button')
      knop.type = 'button'
      knop.id = 'spelbericht'
      knop.innerHTML = '<span aria-hidden="true">💬</span><span class="sb-tekst"></span><span class="sb-getal"></span>'
      knop.querySelector('.sb-tekst').textContent = t('Je hebt een berichtje')
      knop.onclick = vraag
      document.body.appendChild(knop)
      kleinTimer = setTimeout(() => knop.classList.add('klein'), GROOT_MS)
    } else {
      knop.classList.remove('wip'); void knop.offsetWidth; knop.classList.add('wip') // klein wipje, verder niets
    }
    knop.querySelector('.sb-getal').textContent = String(aantal)
    knop.setAttribute('aria-label', aantal === 1 ? t('Je hebt een berichtje') : t('Je hebt {n} berichtjes', { n: aantal }))
    return aantal
  }
  return { erbij, get aantal() { return aantal }, stop() { clearTimeout(kleinTimer) } }
}

// In spel.html: luisteren naar nieuwe berichtjes zolang het spel open is.
export async function startSpelBericht() {
  let session = null
  try { ({ data: { session } } = await supabase.auth.getSession()) } catch (e) {}
  if (!session || !session.user) return null   // zonder account (proberen zonder inloggen): niets
  const ik = session.user.id
  const naarChat = (vriendId) => {
    const adres = 'chat.html' + (vriendId ? '?vriend=' + encodeURIComponent(vriendId) : '')
    let doel = window
    try { if (window.top && window.top !== window && window.top.location.origin === location.origin) doel = window.top } catch (e) {}
    doel.location.href = adres
  }
  const wolk = maakWolkje(naarChat)
  window.__fibroSpelBericht = wolk
  houOpen('ongelezen-' + ik, () => supabase
    .channel('ongelezen-' + ik, { config: { private: true } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'receiver_id=eq.' + ik }, (p) => {
      const m = p && p.new
      if (telt(m, ik)) wolk.erbij(m.sender_id)
    }))
  return wolk
}
