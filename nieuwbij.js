// nieuwbij.js (v263, 4 nov 2026): de strook "✨ Nieuw bij je vrienden" bovenaan Home.
//
// Een rij ronde fotootjes van vrienden die iets nieuws op hun profiel hebben gezet, met een teken voor wat:
// 📷 foto, 🎬 video, 🎵 muziek, 🖼️ achtergrond. Tik = naar zijn profiel; daar telt het als gezien (vriend-profiel.html
// zet 'nieuw' uit) en verdwijnt hij uit de strook. Niets nieuws = geen strook.
//
// Alles komt van dit toestel; de server doet niets:
//   fibro_syncbij_<ik>_<vriend>       { nieuw, w: [soorten], nt: wanneer }   (sync.js, als zijn profiel rechtstreeks binnenkwam)
//   fibro_achtergrondbij_<ik>_<vriend> { nieuw }                              (vrienden.html, een andere profielachtergrond)
//   fibro_vriendenpagina_<ik> of fibro_chatvrienden_<ik>                      (wie er nu je vriend is, naam en emoji)
//   vriend_naam_<vriend>_<ik>                                                 (de naam die hij zelf koos, via sync)
//   de avatarfoto's van dit toestel (vriendfotos.js, zonder iets op te halen)
import { haalVriendFotos, zetAvatar } from './vriendfotos.js?v=2'

const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const TEKEN = { foto: '\u{1F4F7}', video: '\u{1F3AC}', muziek: '\u{1F3B5}', achtergrond: '\u{1F5BC}️' }
const VOLGORDE = ['foto', 'video', 'muziek', 'achtergrond']
const ID = /^[0-9a-f-]{36}$/i
const MAX = 20

const lees = (sl) => { try { return JSON.parse(localStorage.getItem(sl) || 'null') } catch (e) { return null } }

// Wie zijn nu mijn vrienden (id -> { naam, emoji })? null = onbekend (dan niet filteren)
function mijnVrienden(ik) {
  const uit = new Map()
  const pagina = lees('fibro_vriendenpagina_' + ik)
  if (pagina && Array.isArray(pagina.data)) {
    for (const f of pagina.data) {
      const p = f && f.profiles
      if (p && ID.test(String(p.id))) uit.set(p.id, { naam: p.display_name || p.username || '', emoji: p.avatar_url || '' })
    }
    return uit
  }
  const chat = lees('fibro_chatvrienden_' + ik)
  if (Array.isArray(chat)) {
    for (const v of chat) if (v && ID.test(String(v.id))) uit.set(v.id, { naam: v.username || '', emoji: v.avatar_url || '' })
    return uit
  }
  return null
}

// De lijst: [{ id, naam, emoji, wat: [soorten], tijd }], nieuwste eerst
export function nieuwBijLijst(ik) {
  if (!ID.test(String(ik))) return []
  const vrienden = mijnVrienden(ik)
  const per = new Map()
  const pre1 = 'fibro_syncbij_' + ik + '_', pre2 = 'fibro_achtergrondbij_' + ik + '_'
  for (let i = 0; i < localStorage.length; i++) {
    const sl = localStorage.key(i) || ''
    const pre = sl.startsWith(pre1) ? pre1 : sl.startsWith(pre2) ? pre2 : null
    if (!pre) continue
    const id = sl.slice(pre.length)
    if (!ID.test(id) || (vrienden && !vrienden.has(id))) continue
    const b = lees(sl)
    if (!b || typeof b !== 'object' || !b.nieuw) continue
    const r = per.get(id) || { id, wat: new Set(), tijd: 0 }
    if (pre === pre1) {
      for (const w of Array.isArray(b.w) ? b.w : []) if (TEKEN[w]) r.wat.add(w)
      r.tijd = Math.max(r.tijd, Number(b.nt) || Number(b.t) || 0)
    } else r.wat.add('achtergrond')
    per.set(id, r)
  }
  const uit = []
  for (const r of per.values()) {
    const v = vrienden && vrienden.get(r.id)
    let eigen = ''
    try { eigen = String(localStorage.getItem('vriend_naam_' + r.id + '_' + ik) || '').trim() } catch (e) {}
    uit.push({ id: r.id, naam: eigen || (v && v.naam) || T('Vriend'), emoji: (v && v.emoji && v.emoji.length <= 8) ? v.emoji : '\u{1F464}',
      wat: VOLGORDE.filter(w => r.wat.has(w)), tijd: r.tijd })
  }
  return uit.sort((a, b) => b.tijd - a.tijd).slice(0, MAX)
}

function watTekst(wat) {
  const namen = { foto: T('nieuwe foto'), video: T('nieuwe video'), muziek: T('nieuwe muziek'), achtergrond: T('nieuwe achtergrond') }
  return wat.length ? wat.map(w => namen[w]).join(', ') : T('profiel bijgewerkt')
}

let stijlGedaan = false
function zetStijl() {
  if (stijlGedaan) return
  stijlGedaan = true
  const st = document.createElement('style')
  st.textContent = `
#nieuwBij { padding: 4px 16px 6px; }
#nieuwBij[hidden] { display: none; }
.nb-kop { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent, #c084fc); margin: 2px 0 8px; }
.nb-rij { display: flex; gap: 14px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.nb-rij::-webkit-scrollbar { display: none; }
.nb-vriend { flex: 0 0 auto; width: 66px; display: flex; flex-direction: column; align-items: center; gap: 5px; background: none; border: none;
  color: var(--text, #fff); font-family: inherit; cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; }
.nb-ring { position: relative; width: 60px; height: 60px; border-radius: 50%; padding: 3px; box-sizing: border-box;
  background: conic-gradient(from 200deg, var(--accent, #c084fc), #f472b6, #facc15, var(--accent, #c084fc)); }
.nb-av { width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--bg, #12061f); box-sizing: border-box; display: flex;
  align-items: center; justify-content: center; font-size: 24px; background: #2a1450 center/cover no-repeat; overflow: hidden; }
.nb-teken { position: absolute; right: -4px; bottom: -3px; min-width: 22px; height: 22px; padding: 0 3px; border-radius: 11px; display: flex;
  align-items: center; justify-content: center; gap: 1px; font-size: 12px; background: var(--bg, #12061f); border: 1.5px solid var(--accent, #c084fc); box-sizing: border-box; }
.nb-naam { font-size: 12px; max-width: 66px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nb-vriend:focus-visible .nb-ring { outline: 2px solid #fff; outline-offset: 2px; }`
  document.head.appendChild(st)
}

// De strook tekenen in 'vak' (een leeg <div id="nieuwBij">). Werkt zichzelf bij als er iets binnenkomt.
export function toonNieuwBij(vak, ik) {
  if (!vak || !ID.test(String(ik))) return
  zetStijl()
  let fotos = new Map(), bezig = false, nogEens = false
  const geprobeerd = new Set() // een keer per vriend op dit toestel kijken
  const teken = () => {
    const lijst = nieuwBijLijst(ik)
    vak.replaceChildren()
    vak.hidden = !lijst.length
    if (!lijst.length) return
    vak.setAttribute('role', 'region')
    vak.setAttribute('aria-label', T('Nieuw bij je vrienden'))
    const kop = document.createElement('div')
    kop.className = 'nb-kop'
    kop.textContent = T('✨ Nieuw bij je vrienden')
    const rij = document.createElement('div')
    rij.className = 'nb-rij'
    for (const v of lijst) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'nb-vriend'
      b.dataset.id = v.id
      b.setAttribute('aria-label', v.naam + ': ' + watTekst(v.wat))
      b.title = watTekst(v.wat)
      const ring = document.createElement('span'); ring.className = 'nb-ring'
      const av = document.createElement('span'); av.className = 'nb-av'
      zetAvatar(av, v.emoji, fotos.get(v.id) || null)
      const tk = document.createElement('span'); tk.className = 'nb-teken'
      tk.textContent = (v.wat.length ? v.wat.slice(0, 2) : ['✨']).map(w => TEKEN[w] || w).join('')
      ring.append(av, tk)
      const n = document.createElement('span'); n.className = 'nb-naam'; n.textContent = v.naam
      b.append(ring, n)
      b.onclick = () => { window.location.href = 'vriend-profiel.html?id=' + encodeURIComponent(v.id) }
      rij.appendChild(b)
    }
    vak.append(kop, rij)
    // de foto's van dit toestel erbij (zonder iets op te halen)
    const zonder = lijst.filter(v => !fotos.has(v.id) && !geprobeerd.has(v.id)).map(v => ({ id: v.id }))
    if (zonder.length && !bezig) {
      bezig = true
      for (const v of zonder) geprobeerd.add(v.id)
      haalVriendFotos(ik, zonder).then(m => {
        let erbij = false
        for (const [id, f] of m || []) if (f && !fotos.has(id)) { fotos.set(id, f); erbij = true }
        bezig = false
        if (erbij || nogEens) { nogEens = false; teken() }
      }, () => { bezig = false })
    } else if (bezig) nogEens = true
  }
  teken()
  window.addEventListener('fibro-sync-bijgewerkt', teken)
  window.addEventListener('storage', e => { if (!e.key || /^fibro_(syncbij|achtergrondbij)_/.test(e.key)) teken() })
  window.addEventListener('pageshow', e => { if (e.persisted) teken() }) // terug van een profiel: die is nu gezien
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') teken() })
  return { teken }
}
