// meldingen.js — buzz en online-meldingen op elke pagina (4 september 2026)
import { supabase } from './supabase.js?v=14'

const BUZZ_UIT = 'fibro_buzz_uit'
const ONLINE_UIT = 'fibro_online_melding_uit'
let laatsteBuzz = 0
let mKanaal = null
let pKanaal = null
let eigenId = null
let bekend = new Set()
let eersteRonde = true

function aan(sleutel) {
  try { return localStorage.getItem(sleutel) !== '1' } catch(e) { return true }
}

// Kleine melding onderin beeld, verdwijnt vanzelf.
export function toonMelding(tekst, kleur, opKlik) {
  let bak = document.getElementById('fibro-meldingen')
  if (!bak) {
    bak = document.createElement('div')
    bak.id = 'fibro-meldingen'
    bak.style.cssText = 'position:fixed;left:0;right:0;bottom:78px;z-index:9998;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none'
    document.body.appendChild(bak)
  }
  const m = document.createElement('div')
  m.textContent = tekst
  m.style.cssText = 'background:rgba(26,10,46,0.94);color:#fff;border:0.5px solid ' + (kleur || 'rgba(192,132,252,0.5)')
    + ';border-radius:20px;padding:8px 16px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transform:translateY(8px);transition:opacity 0.25s,transform 0.25s;max-width:90vw;text-align:center;pointer-events:auto;cursor:pointer'
  m.onclick = () => {
    if (opKlik) opKlik()
    else window.location.href = 'chat.html'
  }
  bak.appendChild(m)
  requestAnimationFrame(() => { m.style.opacity = '1'; m.style.transform = 'translateY(0)' })
  setTimeout(() => {
    m.style.opacity = '0'
    m.style.transform = 'translateY(8px)'
    setTimeout(() => m.remove(), 300)
  }, 6500)
}

// iOS/Safari laat geluid alleen toe na een aanraking. We openen de
// audiocontext daarom bij de eerste tik en houden hem open.
let gedeeldeCtx = null
function ontgrendelAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!gedeeldeCtx) gedeeldeCtx = new AC()
    if (gedeeldeCtx.state === 'suspended') gedeeldeCtx.resume()
    // Stil toontje van 1 sample: ontgrendelt de context op iOS
    const b = gedeeldeCtx.createBuffer(1, 1, 22050)
    const s = gedeeldeCtx.createBufferSource()
    s.buffer = b
    s.connect(gedeeldeCtx.destination)
    s.start(0)
  } catch(e) {}
}
document.addEventListener('touchstart', ontgrendelAudio, { once: true, passive: true })
document.addEventListener('click', ontgrendelAudio, { once: true })

// Buzzgeluid: lage zaagtand die snel aan-uit pulseert.
function speelBuzz() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!gedeeldeCtx) gedeeldeCtx = new AC()
    const ctx = gedeeldeCtx
    if (ctx.state === 'suspended') ctx.resume()
    const nu = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(95, nu)
    osc.frequency.setValueAtTime(78, nu + 0.35)
    osc.frequency.setValueAtTime(95, nu + 0.7)
    g.gain.setValueAtTime(0, nu)
    for (let i = 0; i < 15; i++) {
      const s = nu + i * 0.07
      g.gain.setValueAtTime(0.28, s)
      g.gain.setValueAtTime(0.02, s + 0.035)
    }
    g.gain.setValueAtTime(0, nu + 1.05)
    osc.connect(g); g.connect(ctx.destination)
    osc.start(nu); osc.stop(nu + 1.1)
  } catch(e) {}
}

function zorgVoorSchudStijl() {
  if (document.getElementById('fibro-buzz-stijl')) return
  const s = document.createElement('style')
  s.id = 'fibro-buzz-stijl'
  s.textContent = '@keyframes fibroSchud{0%,100%{transform:translate(0,0) rotate(0)}8%{transform:translate(-13px,5px) rotate(-1.2deg)}16%{transform:translate(12px,-6px) rotate(1.2deg)}24%{transform:translate(-12px,-4px) rotate(-1deg)}32%{transform:translate(11px,5px) rotate(1deg)}42%{transform:translate(-9px,3px) rotate(-.7deg)}52%{transform:translate(8px,-3px) rotate(.7deg)}64%{transform:translate(-6px,2px) rotate(-.4deg)}76%{transform:translate(4px,-2px) rotate(.3deg)}88%{transform:translate(-2px,1px)}}.fibro-schudt{animation:fibroSchud .7s ease}'
  document.head.appendChild(s)
}

function buzzBinnen(vanNaam, vanId) {
  const nu = Date.now()
  if (nu - laatsteBuzz < 5000) return   // rem: max 1 buzz per 5 sec
  laatsteBuzz = nu
  zorgVoorSchudStijl()
  speelBuzz()
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
  document.body.classList.add('fibro-schudt')
  setTimeout(() => document.body.classList.remove('fibro-schudt'), 700)
  toonMelding('\u26a1 ' + (vanNaam || 'Iemand') + ' buzzt je!', 'rgba(250,204,21,0.7)', vanId ? () => { window.location.href = 'chat.html?vriend=' + vanId } : null)
}

// Naam van een vriend ophalen (kort gecachet)
const naamCache = {}
async function haalNaam(id) {
  if (naamCache[id]) return naamCache[id]
  try {
    const { data } = await supabase.from('profiles').select('username').eq('id', id).single()
    naamCache[id] = data?.username || 'Een vriend'
  } catch(e) { naamCache[id] = 'Een vriend' }
  return naamCache[id]
}

function startBuzzLuisteraar() {
  if (mKanaal) supabase.removeChannel(mKanaal)
  mKanaal = supabase
    .channel('meldingen-berichten-' + eigenId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'receiver_id=eq.' + eigenId },
      async (payload) => {
        const msg = payload.new
        if (!msg || msg.sender_id === eigenId) return
        if (msg.content !== 'buzz:') return
        if (!aan(BUZZ_UIT)) return
        buzzBinnen(await haalNaam(msg.sender_id), msg.sender_id)
      })
    .subscribe()
}

async function startOnlineLuisteraar() {
  // Alleen vrienden melden, niet iedereen
  let vrienden = new Set()
  try {
    const { data } = await supabase.from('friendships')
      .select('user_id,friend_id')
      .or('user_id.eq.' + eigenId + ',friend_id.eq.' + eigenId)
      .eq('status', 'accepted')
    for (const r of (data || [])) {
      vrienden.add(r.user_id === eigenId ? r.friend_id : r.user_id)
    }
  } catch(e) { console.warn('[meldingen] vrienden ophalen mislukt:', e) }
  console.log('[meldingen] vrienden voor online-melding:', [...vrienden])

  if (pKanaal) supabase.removeChannel(pKanaal)
  pKanaal = supabase
    .channel('fibro-online-meldingen', { config: { presence: { key: eigenId } } })
    .on('presence', { event: 'sync' }, async () => {
      const nu = new Set(Object.keys(pKanaal.presenceState()).filter(i => i !== eigenId))
      console.log('[meldingen] presence:', [...nu], 'eerste ronde:', eersteRonde)
      if (eersteRonde) { bekend = nu; eersteRonde = false; return }
      for (const id of nu) {
        if (!bekend.has(id) && vrienden.has(id) && aan(ONLINE_UIT)) {
          toonMelding('\u{1F7E2} ' + (await haalNaam(id)) + ' is online', 'rgba(74,222,128,0.6)', () => { window.location.href = 'chat.html?vriend=' + id })
        }
      }
      bekend = nu
    })
    .subscribe(async (st) => {
      if (st === 'SUBSCRIBED') await pKanaal.track({ online_sinds: new Date().toISOString() })
    })
}

export async function startMeldingen() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    eigenId = session.user.id
    startBuzzLuisteraar()
    startOnlineLuisteraar()
    console.log('[meldingen] actief')
  } catch(e) { console.warn('[meldingen] start mislukt:', e) }
}

window.toonMelding = toonMelding
window.testBuzz = () => buzzBinnen('Test')
