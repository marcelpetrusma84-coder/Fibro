// ongelezen.js — hoeveel berichten je nog niet gelezen hebt, en van wie.
//
// Op elke pagina: een bolletje met het totaal op het tabblad Chat, en het
// aantal vooraan in de titel. In de chat ook een bolletje bij elke vriend.
// Open je een gesprek, dan telt alles van die vriend als gelezen. Dat staat
// in de database (tabel laatst_gelezen), dus je telefoon en je pc zijn het
// met elkaar eens. De tabel en de twee functies staan in sql/ongelezen.sql.
import { supabase } from './supabase.js?v=95'

const aantallen = new Map()      // vriend-id → aantal ongelezen
const bezig = new Map()          // vriend-id → 'loopt' | 'nogEens'
let mijnId = null, openVriend = null, gestart = false, werkt = false

export async function startOngelezen() {
  if (gestart) return
  gestart = true
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  mijnId = session.user.id
  werkt = await haalOp()
  if (!werkt) return               // functie ontbreekt (nog) in Supabase: niets tonen
  supabase
    .channel('ongelezen-' + mijnId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'receiver_id=eq.' + mijnId }, (p) => {
      const m = p && p.new
      if (!m || m.receiver_id !== mijnId || !m.sender_id || m.sender_id === mijnId) return
      if (leestNu(m.sender_id)) { markeer(m.sender_id); return }
      aantallen.set(m.sender_id, (aantallen.get(m.sender_id) || 0) + 1)
      toon()
    })
    .subscribe()
  // Terug naar de app: opnieuw tellen (misschien heb je elders gelezen).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    kijkOpenVriend(true)
    haalOp()
  })
  // In de chat: welk gesprek staat er open? (chat.html zet window.geselecteerdeVriend)
  setInterval(() => kijkOpenVriend(false), 700)
  const lijst = document.getElementById('vriendenLijst')
  if (lijst && window.MutationObserver) new MutationObserver(toon).observe(lijst, { childList: true })
  kijkOpenVriend(false)
  toon()
}

function openGesprek() {
  const v = window.geselecteerdeVriend
  return v && typeof v.id === 'string' ? v.id : null
}

function leestNu(vriendId) {
  return openGesprek() === vriendId && document.visibilityState === 'visible'
}

function kijkOpenVriend(altijd) {
  const id = openGesprek()
  const nieuw = id !== openVriend
  openVriend = id
  if (id && (nieuw || altijd) && document.visibilityState === 'visible') markeer(id)
}

async function haalOp() {
  try {
    const { data, error } = await supabase.rpc('ongelezen_per_vriend')
    if (error || !Array.isArray(data)) { if (error) console.warn('[ongelezen]', error.message); return false }
    aantallen.clear()
    for (const r of data) {
      const n = Number(r.aantal)
      if (r.vriend_id && n > 0) aantallen.set(r.vriend_id, n)
    }
    const open = openGesprek()
    if (open && aantallen.has(open) && document.visibilityState === 'visible') markeer(open)
    toon()
    return true
  } catch (e) {
    console.warn('[ongelezen]', e)
    return false
  }
}

// Gelezen tot nu (de tijd van de server, dus de klok van je toestel doet er niet toe).
// Komen er snel meer berichten binnen, dan gaat er hooguit één verzoek tegelijk.
function markeer(vriendId) {
  if (aantallen.has(vriendId)) { aantallen.delete(vriendId); toon() }
  if (!werkt) return
  if (bezig.has(vriendId)) { bezig.set(vriendId, 'nogEens'); return }
  bezig.set(vriendId, 'loopt')
  const klaar = () => {
    const nogEens = bezig.get(vriendId) === 'nogEens'
    bezig.delete(vriendId)
    if (nogEens) markeer(vriendId)
  }
  supabase.rpc('markeer_gelezen', { p_vriend: vriendId })
    .then(({ error }) => { if (error) console.warn('[ongelezen]', error.message) }, e => console.warn('[ongelezen]', e))
    .then(klaar)
}

const BOL = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;' +
  'border-radius:999px;background:#ef4444;color:#fff;font-weight:700;font-family:system-ui,-apple-system,sans-serif;' +
  'text-shadow:none;pointer-events:none;line-height:1;'

function zetBol(ouder, n, stijl, vooraan) {
  let b = null
  for (const k of ouder.children) if (k.classList.contains('fo-bol')) b = k
  if (!n) { if (b) b.remove(); return }
  if (!b) {
    b = document.createElement('span')
    b.className = 'fo-bol'
    if (vooraan && ouder.firstChild) ouder.insertBefore(b, ouder.firstChild); else ouder.appendChild(b)
  }
  const tekst = n > 99 ? '99+' : String(n)
  if (b.textContent !== tekst) b.textContent = tekst
  if (b.style.cssText !== stijl) b.style.cssText = stijl
}

function toon() {
  let totaal = 0
  for (const n of aantallen.values()) totaal += n

  // Tabblad Chat in de menubalk
  for (const item of document.querySelectorAll('.nav-item')) {
    if (!item.textContent.trim().endsWith('Chat')) continue
    const icoon = item.querySelector('.nav-icon') || item
    const pos = getComputedStyle(icoon).position
    if (!pos || pos === 'static') icoon.style.position = 'relative'
    zetBol(icoon, totaal, BOL + 'position:absolute;top:-5px;right:-12px;min-width:18px;height:18px;padding:0 5px;' +
      'font-size:11px;box-shadow:0 0 0 2px rgba(0,0,0,0.45);')
  }

  // Vrienden in de chat
  for (const item of document.querySelectorAll('.vriend-item[data-vid]')) {
    const n = aantallen.get(item.dataset.vid) || 0
    const knop = item.querySelector('.bel-knop')
    const plek = (knop && knop.parentElement) || item
    zetBol(plek, n, BOL + 'min-width:22px;height:22px;padding:0 7px;font-size:12px;', true)
    const naam = item.querySelector('.vriend-naam')
    if (naam) naam.style.fontWeight = n ? '700' : ''
  }

  // Titel van het tabblad in de browser
  const kaal = document.title.replace(/^\(\d+\+?\) /, '')
  const titel = totaal ? '(' + (totaal > 99 ? '99+' : totaal) + ') ' + kaal : kaal
  if (document.title !== titel) document.title = titel
}
