// speluitnodiging.js — globale spel-uitnodiging op elke pagina
//
// v98: wat er via het kanaal binnenkomt (naam, speltype, ids) kan van iedereen
// komen. Het gaat daarom alleen als tekst de pagina in, nooit als HTML, en
// wordt netjes gecodeerd in het adres van de chat gezet. Namen van de spellen
// gelijk aan die in de chat, met Ghost Tag en Twin Snakes erbij.
import { supabase } from './supabase.js?v=95'

const SPEL_INFO = {
  botkaaseiren: { icon: '⭕', naam: 'Boter-Kaas-Eieren' },
  vieroprij: { icon: '🔴', naam: 'Vier op een rij' },
  schaken: { icon: '♟️', naam: 'Schaken' },
  dammen: { icon: '⚫', naam: 'Dammen' },
  pong: { icon: '🏓', naam: 'Neo Paddle' },
  flappybird: { icon: '🦇', naam: 'Flappy Friends' },
  spaceinvaders: { icon: '👾', naam: 'Space Invaders' },
  endlessrunner: { icon: '🏃', naam: 'Runner & Gunner' },
  breakout: { icon: '🟪', naam: 'Block It' },
  pacman: { icon: '👻', naam: 'Ghost Tag' },
  pinball: { icon: '🐍', naam: 'Twin Snakes' }
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
      const p = (msg && msg.payload) || {}
      toonPopup(p.van, p.vanNaam, p.vanAvatar, p.spelType, p.sessieId)
    })
    .subscribe()
}

// Een id of sessienummer: tekst of getal, niet leeg en niet absurd lang.
function alsId(v) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v)
  if (typeof v !== 'string') return null
  v = v.trim()
  return v && v.length <= 100 ? v : null
}

function maak(tag, stijl, tekst) {
  const el = document.createElement(tag)
  if (stijl) el.style.cssText = stijl
  if (tekst != null) el.textContent = tekst
  return el
}

function toonPopup(vanId, vanNaam, vanAvatar, spelType, sessieId) {
  vanId = alsId(vanId)
  sessieId = alsId(sessieId)
  if (!vanId || !sessieId) return
  if (typeof spelType !== 'string' || !/^[a-z0-9]{1,30}$/.test(spelType)) return
  const naam = String(vanNaam || 'Iemand').slice(0, 40)
  const oud = document.getElementById('globaalSpelPopup')
  if (oud) oud.remove()
  if (timer) clearTimeout(timer)
  const info = SPEL_INFO[spelType] || { icon: '🎮', naam: spelType }
  const popup = maak('div', 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#1e1e2e;border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;gap:10px;max-width:90%;min-width:260px;')
  popup.id = 'globaalSpelPopup'
  const regel = maak('div', 'color:white;font-size:15px;text-align:center;')
  regel.append(maak('strong', '', naam), ' nodigt je uit!')
  const knoppen = maak('div', 'display:flex;gap:10px;margin-top:6px;')
  const ja = maak('button', 'background:#4caf50;color:white;border:none;border-radius:16px;padding:8px 18px;font-size:14px;font-weight:bold;cursor:pointer;', 'Spelen')
  const nee = maak('button', 'background:rgba(255,255,255,0.1);color:#aaa;border:none;border-radius:16px;padding:8px 18px;font-size:14px;cursor:pointer;', 'Weigeren')
  ja.id = 'gspAccepteer'; nee.id = 'gspWeiger'
  knoppen.append(ja, nee)
  popup.append(maak('div', 'font-size:40px;', info.icon), regel, maak('div', 'color:#aaa;font-size:13px;', info.naam), knoppen)
  document.body.appendChild(popup)
  ja.onclick = () => {
    const q = new URLSearchParams({ spelVriend: vanId, spelType, sessieId, starterId: vanId })
    window.location.href = 'chat.html?' + q.toString()
  }
  nee.onclick = () => popup.remove()
  timer = setTimeout(() => { const p = document.getElementById('globaalSpelPopup'); if (p) p.remove() }, 30000)
}
