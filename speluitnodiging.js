// speluitnodiging.js — globale spel-uitnodiging op elke pagina
import { supabase } from './supabase.js'

const SPEL_INFO = {
  botkaaseiren: { icon: '⭕', naam: 'Boter-Kaas-Eieren' },
  vieroprij: { icon: '🔴', naam: 'Vier op een rij' },
  schaken: { icon: '♟️', naam: 'Schaken' },
  dammen: { icon: '⚫', naam: 'Dammen' },
  pong: { icon: '🏓', naam: 'Pong' },
  flappybird: { icon: '🐦', naam: 'Flappy Bird' },
  spaceinvaders: { icon: '👾', naam: 'Space Invaders' }
}

let kanaal = null
let timer = null

export async function startSpelUitnodigingLuisteraar() {
  if (window.location.pathname.includes('chat.html')) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  if (kanaal) supabase.removeChannel(kanaal)
  kanaal = supabase
    .channel('speluitnodiging-' + session.user.id, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'speluitnodiging' }, (msg) => {
      const { van, vanNaam, vanAvatar, spelType, sessieId } = msg.payload
      toonPopup(van, vanNaam, vanAvatar, spelType, sessieId)
    })
    .subscribe()
}

function toonPopup(vanId, vanNaam, vanAvatar, spelType, sessieId) {
  const oud = document.getElementById('globaalSpelPopup')
  if (oud) oud.remove()
  if (timer) clearTimeout(timer)
  const info = SPEL_INFO[spelType] || { icon: '🎮', naam: spelType }
  const popup = document.createElement('div')
  popup.id = 'globaalSpelPopup'
  popup.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#1e1e2e;border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;gap:10px;max-width:90%;min-width:260px;'
  popup.innerHTML = '<div style="font-size:40px;">' + info.icon + '</div>'
    + '<div style="color:white;font-size:15px;text-align:center;"><strong>' + vanNaam + '</strong> nodigt je uit!</div>'
    + '<div style="color:#aaa;font-size:13px;">' + info.naam + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:6px;">'
    + '<button id="gspAccepteer" style="background:#4caf50;color:white;border:none;border-radius:16px;padding:8px 18px;font-size:14px;font-weight:bold;cursor:pointer;">Spelen</button>'
    + '<button id="gspWeiger" style="background:rgba(255,255,255,0.1);color:#aaa;border:none;border-radius:16px;padding:8px 18px;font-size:14px;cursor:pointer;">Weigeren</button>'
    + '</div>'
  document.body.appendChild(popup)
  document.getElementById('gspAccepteer').onclick = () => {
    window.location.href = 'chat.html?spelVriend=' + vanId + '&spelType=' + spelType + '&sessieId=' + sessieId + '&starterId=' + vanId
  }
  document.getElementById('gspWeiger').onclick = () => popup.remove()
  timer = setTimeout(() => { const p = document.getElementById('globaalSpelPopup'); if (p) p.remove() }, 30000)
}
