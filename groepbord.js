// groepbord.js (10 nov 2026, groepschat; v2: wit bord): een whiteboard voor de groep, waar iedereen tegelijk op tekent.
//
// Zoals de groepsmuziek: niets op de server. Elke lijn gaat versleuteld (groepsleutel.js, soort 'media', voor alle
// leden) over het live-kanaal van de groep (broadcast 'bord'), en elk toestel bewaart het bord zelf (localStorage,
// per groep). Open je het bord, dan vraag je wie de groep open heeft om zijn bord; alles wordt samengevoegd
// (elke lijn heeft een eigen id). Zo blijft het bord bewaard zolang iemand het heeft.
//   { soort: 'lijn', van, t, d, k }      een nieuwe lijn { id, kleur, dikte, p: [[x, y], ...], tijd } (0..1)
//   { soort: 'weg', van, t, d, k }       ongedaan maken van mijn eigen lijn { id }
//   { soort: 'wis', van, t, d, k }       alles wissen { tijd }: lijnen van daarvoor verdwijnen
//   { soort: 'vraag', van }              wie heeft het bord? (iedereen met lijnen antwoordt)
//   { soort: 'staat', van, naar, i, n, d, kop }  het hele bord in stukjes, alleen voor de vrager
import { versleutelGroepsBytes, openGroepsBytes } from './groepsleutel.js?v=2'

// v2: een wit bord. De kleuren om mee te tekenen; wit is de gum. (Oude kleuren blijven geldig voor bestaande lijnen.)
export const KLEUREN = ['#1a0a2e', '#8b3fd1', '#ec4899', '#eab308', '#22c55e', '#0ea5e9', '#ef4444', '#ffffff']
const OUDE_KLEUREN = ['#c084fc', '#f472b6', '#facc15', '#4ade80', '#38bdf8', '#f87171']
export const ACHTERGROND = '#ffffff'
export const DIKTES = [3, 7, 14]
const STUK = 60000, MAX_LIJNEN = 3000, MAX_PUNTEN = 600
const GELDIG_ID = /^[a-z0-9]{8,24}$/
const naarB64 = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s) }
const vanB64 = t => { const bin = atob(t); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o }
export const nieuwId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('')

// een lijn van buiten controleren (en netjes maken)
export function geldigeLijn(l, van) {
  if (!l || !GELDIG_ID.test(String(l.id)) || !Array.isArray(l.p) || !l.p.length) return null
  const kleur = KLEUREN.includes(l.kleur) || OUDE_KLEUREN.includes(l.kleur) ? l.kleur : KLEUREN[0]
  const dikte = DIKTES.includes(l.dikte) ? l.dikte : DIKTES[0]
  const p = []
  for (const q of l.p.slice(0, MAX_PUNTEN)) {
    if (!Array.isArray(q) || q.length < 2) continue
    const x = Number(q[0]), y = Number(q[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    p.push([Math.min(1, Math.max(0, Math.round(x * 1000) / 1000)), Math.min(1, Math.max(0, Math.round(y * 1000) / 1000))])
  }
  if (!p.length) return null
  return { id: l.id, van, kleur, dikte, p, tijd: Number(l.tijd) || 0 }
}

// opties: { ik, groepId, kanaal(), sleutel(): { mijnPriv, mijnPub, leden, pubVan(id) } | null, opVerander() }
export function maakGroepBord({ ik, groepId, kanaal, sleutel, opVerander }) {
  const OPSLAG = 'fibro_bord_' + groepId + '_' + ik
  let staat = { lijnen: [], weg: [], wis: 0 }
  try { const s = JSON.parse(localStorage.getItem(OPSLAG) || 'null'); if (s && Array.isArray(s.lijnen)) staat = { lijnen: s.lijnen, weg: Array.isArray(s.weg) ? s.weg : [], wis: Number(s.wis) || 0 } } catch (e) {}
  let bewaarTimer = null
  const bewaar = () => { clearTimeout(bewaarTimer); bewaarTimer = setTimeout(() => { try { localStorage.setItem(OPSLAG, JSON.stringify(staat)) } catch (e) {} }, 300) }
  const verander = () => { bewaar(); try { opVerander && opVerander() } catch (e) {} }
  const bezig = new Map() // van -> stukjes van een 'staat'

  async function stuur(payload) {
    const k = kanaal()
    if (!k) return 'geen'
    return k.send({ type: 'broadcast', event: 'bord', payload: { ...payload, van: ik } })
  }
  async function stuurVersleuteld(soort, obj, voor) {
    const s = sleutel()
    if (!s) return
    const leden = (voor || s.leden.map(l => l.id === ik ? { id: ik, public_key: s.mijnPub } : l)).filter(l => l.public_key)
    const p = await versleutelGroepsBytes(new TextEncoder().encode(JSON.stringify(obj)), { groepId, van: ik, mijnPriv: s.mijnPriv, leden })
    return { t: p.t, d: naarB64(p.d), k: p.k }
  }
  async function open(van, pak) {
    const s = sleutel(), pub = s && s.pubVan(van)
    if (!pub || typeof pak.d !== 'string') return null
    let d; try { d = vanB64(pak.d) } catch (e) { return null }
    const uit = await openGroepsBytes({ t: pak.t, d, k: pak.k }, { groepId, van, ik, mijnPriv: s.mijnPriv, afzenderPub: pub })
    if (uit.status !== 'ok') return null
    try { return JSON.parse(new TextDecoder().decode(uit.bytes)) } catch (e) { return null }
  }

  // ── samenvoegen ──
  function neemLijn(l) {
    if (!l || l.tijd < staat.wis || staat.weg.includes(l.id) || staat.lijnen.some(x => x.id === l.id)) return false
    staat.lijnen.push(l)
    if (staat.lijnen.length > MAX_LIJNEN) staat.lijnen.splice(0, staat.lijnen.length - MAX_LIJNEN)
    return true
  }
  function neemWeg(id, van) {
    const i = staat.lijnen.findIndex(x => x.id === id)
    if (i >= 0 && staat.lijnen[i].van !== van) return false // alleen je eigen lijn
    if (!staat.weg.includes(id)) { staat.weg.push(id); if (staat.weg.length > MAX_LIJNEN) staat.weg.shift() }
    if (i >= 0) staat.lijnen.splice(i, 1)
    return true
  }
  function neemWis(tijd) {
    if (!(tijd > staat.wis)) return false
    staat.wis = tijd
    staat.lijnen = staat.lijnen.filter(l => l.tijd >= tijd)
    return true
  }
  function voegSamen(s, van) {
    let ander = false
    if (s && Number(s.wis) > staat.wis) ander = neemWis(Number(s.wis)) || ander
    for (const id of (s && Array.isArray(s.weg) ? s.weg : []).slice(0, MAX_LIJNEN)) if (GELDIG_ID.test(String(id)) && !staat.weg.includes(id)) {
      staat.weg.push(id); const i = staat.lijnen.findIndex(x => x.id === id); if (i >= 0) staat.lijnen.splice(i, 1); ander = true
    }
    for (const l of (s && Array.isArray(s.lijnen) ? s.lijnen : []).slice(0, MAX_LIJNEN)) {
      const g = geldigeLijn(l, typeof l.van === 'string' ? l.van : van)
      if (g) ander = neemLijn(g) || ander
    }
    return ander
  }

  // ── ontvangen ──
  async function ontvang(payload) {
    const p = payload && payload.payload ? payload.payload : payload
    if (!p || typeof p.van !== 'string' || p.van === ik) return
    if (p.soort === 'vraag') return stuurStaat(p.van)
    if (p.soort === 'staat') return stukStaat(p)
    const obj = await open(p.van, p)
    if (!obj) return
    if (p.soort === 'lijn') { const l = geldigeLijn(obj, p.van); if (l && neemLijn(l)) verander() }
    else if (p.soort === 'weg') { if (GELDIG_ID.test(String(obj.id)) && neemWeg(obj.id, p.van)) verander() }
    else if (p.soort === 'wis') { if (neemWis(Number(obj.tijd))) verander() }
  }
  async function stuurStaat(naar) {
    if (!staat.lijnen.length && !staat.weg.length && !staat.wis) return
    const s = sleutel(), pub = s && s.pubVan(naar)
    if (!pub) return
    const pak = await stuurVersleuteld('staat', staat, [{ id: ik, public_key: s.mijnPub }, { id: naar, public_key: pub }])
    if (!pak) return
    const n = Math.max(1, Math.ceil(pak.d.length / STUK))
    for (let i = 0; i < n; i++) {
      const stuk = { soort: 'staat', naar, i, n, d: pak.d.slice(i * STUK, (i + 1) * STUK) }
      if (i === 0) stuk.kop = { t: pak.t, k: pak.k }
      if ((await stuur(stuk)) !== 'ok') return
    }
  }
  async function stukStaat(p) {
    if (p.naar !== ik || typeof p.d !== 'string' || !Number.isInteger(p.i) || !Number.isInteger(p.n) || p.n < 1 || p.n > 100 || p.i < 0 || p.i >= p.n) return
    let b = bezig.get(p.van)
    if (!b || b.n !== p.n) { b = { n: p.n, delen: new Array(p.n), binnen: 0, kop: null }; bezig.set(p.van, b) }
    if (b.delen[p.i] !== undefined) return
    b.delen[p.i] = p.d; b.binnen++
    if (p.i === 0 && p.kop) b.kop = p.kop
    if (b.binnen < b.n || !b.kop) return
    bezig.delete(p.van)
    const s = await open(p.van, { t: b.kop.t, d: b.delen.join(''), k: b.kop.k })
    if (s && voegSamen(s, p.van)) verander()
  }

  return {
    ontvang,
    lijnen: () => staat.lijnen,
    vraag: () => stuur({ soort: 'vraag' }),
    async teken({ kleur, dikte, p }) {
      const l = geldigeLijn({ id: nieuwId(), kleur, dikte, p, tijd: Date.now() }, ik)
      if (!l) return
      neemLijn(l); verander()
      const pak = await stuurVersleuteld('lijn', { id: l.id, kleur: l.kleur, dikte: l.dikte, p: l.p, tijd: l.tijd })
      if (pak) await stuur({ soort: 'lijn', ...pak })
    },
    kanOngedaan: () => staat.lijnen.some(l => l.van === ik),
    async ongedaan() {
      const mijn = [...staat.lijnen].reverse().find(l => l.van === ik)
      if (!mijn) return
      neemWeg(mijn.id, ik); verander()
      const pak = await stuurVersleuteld('weg', { id: mijn.id })
      if (pak) await stuur({ soort: 'weg', ...pak })
    },
    async wisAlles() {
      const tijd = Date.now()
      neemWis(tijd); verander()
      const pak = await stuurVersleuteld('wis', { tijd })
      if (pak) await stuur({ soort: 'wis', ...pak })
    },
  }
}

// een lijn tekenen op een canvas (b x h pixels)
export function tekenLijn(ctx, l, b, h) {
  ctx.strokeStyle = l.kleur
  ctx.fillStyle = l.kleur
  ctx.lineWidth = l.dikte * (b / 360)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (l.p.length === 1) { ctx.beginPath(); ctx.arc(l.p[0][0] * b, l.p[0][1] * h, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return }
  ctx.beginPath()
  ctx.moveTo(l.p[0][0] * b, l.p[0][1] * h)
  for (let i = 1; i < l.p.length; i++) ctx.lineTo(l.p[i][0] * b, l.p[i][1] * h)
  ctx.stroke()
}
