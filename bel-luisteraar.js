// bel-luisteraar.js — luistert op elke pagina naar inkomende oproepen
// Toont een oproepvenster met beltoon op de pagina zelf (zoals in de chat).
// Op de iPhone mag geluid alleen na een tik op déze pagina; daarom niet meer
// meteen doorsturen naar bellen.html, maar pas bij Opnemen.
import { supabase } from './supabase.js?v=95'
import { initBellen, weigerooproep } from './bellen.js?v=95'

// beltoon.js laden (klassiek script, zet window.FibroBeltoon)
function laadBeltoon() {
  if (window.FibroBeltoon || document.querySelector('script[data-fibro-beltoon]')) return
  const s = document.createElement('script')
  s.src = 'beltoon.js?v=6'
  s.dataset.fibroBeltoon = '1'
  document.head.appendChild(s)
}

let venster = null, verloop = null, huidig = null

function knop(tekst, kleur, titel, actie) {
  const b = document.createElement('button')
  b.textContent = tekst
  b.title = titel
  b.style.cssText = 'width:64px;height:64px;border-radius:50%;border:none;font-size:26px;cursor:pointer;' +
    'display:flex;align-items:center;justify-content:center;background:' + kleur + ';'
  b.addEventListener('click', actie)
  return b
}

function maakVenster() {
  if (venster) return venster
  const v = document.createElement('div')
  v.style.cssText = 'position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:10px;background:rgba(10,4,20,0.88);color:#f3e8ff;font-family:inherit;text-align:center;padding:24px;'
  const avatar = document.createElement('div')
  avatar.style.cssText = 'width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,#c084fc,#f0abfc);' +
    'display:flex;align-items:center;justify-content:center;font-size:48px;overflow:hidden;' +
    'animation:blPuls 1.2s ease-in-out infinite;'
  const naam = document.createElement('div')
  naam.style.cssText = 'font-size:26px;font-weight:600;margin-top:12px;'
  const type = document.createElement('div')
  type.style.cssText = 'font-size:16px;opacity:0.6;'
  const rij = document.createElement('div')
  rij.style.cssText = 'display:flex;gap:20px;margin-top:24px;'
  const weiger = knop('📵', '#f87171', 'Weigeren', weigeren)
  const neem = knop('📞', '#22c55e', 'Opnemen', () => opnemen(false))
  const video = knop('📹', '#22c55e', 'Opnemen met video', () => opnemen(true))
  rij.append(weiger, neem, video)
  v.append(avatar, naam, type, rij)
  const stijl = document.createElement('style')
  stijl.textContent = '@keyframes blPuls{0%,100%{box-shadow:0 0 0 0 rgba(192,132,252,0.5)}50%{box-shadow:0 0 0 20px rgba(192,132,252,0)}}'
  document.head.appendChild(stijl)
  document.body.appendChild(v)
  venster = { v, avatar, naam, type, video }
  return venster
}

function zetAvatar(el, plaatje) {
  el.textContent = ''
  if (typeof plaatje === 'string' && plaatje.startsWith('data:image')) {
    const img = document.createElement('img')
    img.src = plaatje
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
    el.appendChild(img)
  } else {
    el.textContent = (plaatje && plaatje.length <= 8) ? plaatje : '👤'
  }
}

function toonOproep(info, naam, plaatje) {
  const w = maakVenster()
  zetAvatar(w.avatar, plaatje)
  w.naam.textContent = naam
  w.type.textContent = info.videoModus ? '📹 Videogesprek...' : '📞 Belt je op...'
  w.video.style.display = info.videoModus ? 'flex' : 'none'
  w.v.style.display = 'flex'
  clearTimeout(verloop)
  verloop = setTimeout(sluitOproep, 47000) // vangnet: beller geeft het na 45 s op
}

function sluitOproep() {
  window.FibroBeltoon?.stop()
  clearTimeout(verloop)
  huidig = null
  if (venster) venster.v.style.display = 'none'
}

async function weigeren() {
  sluitOproep()
  try { await weigerooproep() } catch (e) {}
}

function opnemen(video) {
  if (!huidig) return
  window.FibroBeltoon?.stop()
  clearTimeout(verloop)
  if (venster) venster.type.textContent = 'Verbinding maken...'
  window.location.href = 'bellen.html?vriend=' + encodeURIComponent(huidig.van) +
    '&naam=' + encodeURIComponent(huidig.naam) + '&inkomend=1&opnemen=1' + (video ? '&video=1' : '')
}

export async function startBelLuisteraar() {
  // Niet op de bellen-pagina zelf (die handelt het gesprek af)
  if (window.location.pathname.includes('bellen.html')) return
  laadBeltoon()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  initBellen(session.user.id, {
    onOproep: async (info) => {
      window.FibroBeltoon?.start() // meteen, niet pas na het ophalen van de naam
      huidig = { van: info.van, naam: 'Onbekend' }
      let v = null
      try {
        const r = await supabase.from('profiles')
          .select('display_name,username,avatar_url,avatar_data')
          .eq('id', info.van).single()
        v = r.data
      } catch (e) {}
      if (!huidig || huidig.van !== info.van) return // ondertussen al opgehangen
      huidig.naam = v?.display_name || v?.username || 'Onbekend'
      toonOproep(info, huidig.naam, v?.avatar_data || v?.avatar_url || '')
    },
    // Beller hing op (of gaf het op) voordat er werd opgenomen
    onEind: () => sluitOproep()
  })
}
