// groepmuziek.js (10 nov 2026, groepschat): een gezamenlijke playlist in een groep, met de muziek van iedereen.
//
// Zoals Marcel koos: de nummers staan alleen op de telefoons zelf (je profielnummer en de muziekspeler op Home), niet op
// de server. Je kiest per groep welke nummers je deelt. Tikt iemand op jouw nummer, dan haalt zijn telefoon het
// versleuteld bij de jouwe, als jij de groep open hebt. Daarna staat het 31 dagen op zijn toestel (groepmedia.js).
//
// Alles gaat over het live-kanaal van de groep (broadcast 'muziek'), versleuteld met groepsleutel.js (soort 'media'):
//   { soort: 'wie', van }                          wie heeft er muziek? (iedereen die de groep open heeft antwoordt)
//   { soort: 'lijst', van, t, d, k }               mijn gedeelde nummers (versleuteld voor alle leden)
//   { soort: 'vraag', van, naar, id }              mag ik dit nummer?
//   { soort: 'stuk', van, naar, id, i, n, d, kop } het nummer in stukjes (versleuteld voor alleen de vrager)
//   { soort: 'nee', van, naar, id }                dat nummer heb ik niet (meer)
import { versleutelGroepsBytes, openGroepsBytes } from './groepsleutel.js?v=2'
import { bewaarMedia, leesMedia } from './groepmedia.js?v=1'

export const STUK = 60000                    // tekens per stukje (zoals groepmedia.js)
export const MAX_BYTES = 15 * 1024 * 1024    // hoogstens 15 MB per nummer
const MAX_STUKKEN = Math.ceil(MAX_BYTES * 4 / 3 / STUK) + 2
const GELDIG_ID = /^[a-z0-9]{8,24}$/
const GELDIG_MIME = /^audio\/[a-z0-9.+-]{1,30}$/i
const WACHT_MS = 90000

const naarB64 = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s) }
const vanB64 = t => { const bin = atob(t); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o }
export const nieuwId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('')
const tekst = (s, max) => typeof s === 'string' ? s.trim().slice(0, max) : ''

// ── De muziek op dit toestel (dezelfde plekken als Home en Profiel) ──
function db() {
  return new Promise((ok, nee) => {
    const r = indexedDB.open('FibroDB', 2)
    r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }
    r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error); r.onblocked = () => nee(new Error('geblokkeerd'))
  })
}
async function lees(sleutel) {
  try {
    const d = await db()
    const r = await new Promise(ok => { const q = d.transaction('fotos').objectStore('fotos').get(sleutel); q.onsuccess = () => ok(q.result ? q.result.data : null); q.onerror = () => ok(null) })
    d.close()
    return r
  } catch (e) { return null }
}
// Wat kan ik delen? Mijn profielnummer en de nummers van de muziekspeler op Home.
export async function eigenNummers(uid) {
  const uit = []
  if (await lees('muziek_track')) uit.push({ bron: 'profiel', titel: tekst(await lees('muziek_titel'), 80) || 'Profielnummer', artiest: '' })
  let idx = []
  try { idx = JSON.parse((await lees('muziek_index_' + uid)) || '[]') || [] } catch (e) {}
  idx.forEach((t, i) => { if (t && t.naam) uit.push({ bron: 'nr', i, titel: tekst(t.naam, 80), artiest: tekst(t.artiest, 60) }) })
  return uit
}
// De data van een eigen nummer, als { bytes, mime } (de plek kan verschoven zijn: dan op naam zoeken)
async function eigenData(uid, n) {
  let data = null
  if (n.bron === 'profiel') data = await lees('muziek_track')
  else {
    let idx = []
    try { idx = JSON.parse((await lees('muziek_index_' + uid)) || '[]') || [] } catch (e) {}
    let i = idx[n.i] && idx[n.i].naam === n.titel ? n.i : idx.findIndex(t => t && t.naam === n.titel)
    if (i >= 0) data = await lees('muziek_nr_' + uid + '_' + i)
  }
  if (typeof data !== 'string') return null
  const m = /^data:([^;,]+)(;base64)?,/.exec(data)
  if (!m || !m[2]) return null
  const mime = GELDIG_MIME.test(m[1]) ? m[1] : 'audio/mpeg'
  try { return { bytes: vanB64(data.slice(m[0].length)), mime } } catch (e) { return null }
}

// opties: { ik, groepId, kanaal(), sleutel(): { mijnPriv, mijnPub, leden: [{ id, public_key }] }, opVerander() }
export function maakGroepMuziek({ ik, groepId, kanaal, sleutel, opVerander }) {
  const MIJN = 'fibro_groepmuziek_' + groepId + '_' + ik      // wat ik deel: [{ id, bron, i, titel, artiest }]
  const CACHE = 'fibro_groepmuziek_cache_' + groepId + '_' + ik // wat ik van anderen heb: [{ id, van, titel, artiest }]
  const laad = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch (e) { return [] } }
  const bewaar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  let mijn = laad(MIJN)
  let cache = laad(CACHE)
  const anderen = new Map()     // van -> { lijst: [{ id, titel, artiest }], tijd }
  const wachtend = new Map()    // id -> { ok, nee, timer, delen, n, kop, binnen, van }
  const voortgang = new Map()   // id -> 0..1
  const verander = () => { try { opVerander && opVerander() } catch (e) {} }

  async function stuur(payload) {
    const k = kanaal()
    if (!k) return 'geen'
    return k.send({ type: 'broadcast', event: 'muziek', payload: { ...payload, van: ik } })
  }
  const ledenMetSleutel = s => s.leden.map(l => l.id === ik ? { id: ik, public_key: s.mijnPub } : l).filter(l => l.public_key)

  // ── mijn lijst bekendmaken ──
  async function kondig() {
    const s = sleutel()
    if (!s || !s.mijnPriv) return
    const bytes = new TextEncoder().encode(JSON.stringify({ lijst: mijn.map(n => ({ id: n.id, titel: n.titel, artiest: n.artiest })) }))
    const p = await versleutelGroepsBytes(bytes, { groepId, van: ik, mijnPriv: s.mijnPriv, leden: ledenMetSleutel(s) })
    await stuur({ soort: 'lijst', t: p.t, d: naarB64(p.d), k: p.k })
  }
  async function vraagLijsten() { await stuur({ soort: 'wie' }); await kondig() }

  // ── ontvangen ──
  async function openVan(van, pak) {
    const s = sleutel(), pub = s && s.pubVan(van)
    if (!pub || typeof pak.d !== 'string') return null
    let d; try { d = vanB64(pak.d) } catch (e) { return null }
    const uit = await openGroepsBytes({ t: pak.t, d, k: pak.k }, { groepId, van, ik, mijnPriv: s.mijnPriv, afzenderPub: pub })
    return uit.status === 'ok' ? uit.bytes : null
  }
  async function ontvang(payload) {
    const p = payload && payload.payload ? payload.payload : payload
    if (!p || typeof p.van !== 'string' || p.van === ik) return
    if (p.soort === 'wie') return kondig()
    if (p.soort === 'lijst') {
      const b = await openVan(p.van, p)
      if (!b) return
      let l; try { l = JSON.parse(new TextDecoder().decode(b)).lijst } catch (e) { return }
      if (!Array.isArray(l)) return
      const lijst = l.filter(n => n && GELDIG_ID.test(String(n.id))).slice(0, 200).map(n => ({ id: n.id, titel: tekst(n.titel, 80) || '?', artiest: tekst(n.artiest, 60) }))
      anderen.set(p.van, { lijst, tijd: Date.now() })
      // weg uit de lijst = ook weg uit wat ik onthoud van die persoon (het bestand blijft tot het verloopt)
      const ids = new Set(lijst.map(n => n.id))
      const voor = cache.length
      cache = cache.filter(c => c.van !== p.van || ids.has(c.id))
      if (cache.length !== voor) bewaar(CACHE, cache)
      return verander()
    }
    if (p.naar !== ik || !GELDIG_ID.test(String(p.id))) return
    if (p.soort === 'vraag') return stuurNummer(p.van, p.id)
    if (p.soort === 'nee') { const w = wachtend.get(p.id); if (w && w.van === p.van) klaar(p.id, new Error('weg')); return }
    if (p.soort === 'stuk') return stuk(p)
  }

  // ── een nummer sturen aan wie erom vraagt ──
  const bezigMet = new Set()
  async function stuurNummer(naar, id) {
    const n = mijn.find(x => x.id === id)
    const s = sleutel(), pub = s && s.pubVan(naar)
    if (!n || !pub) return stuur({ soort: 'nee', naar, id })
    const sleutelBezig = naar + ':' + id
    if (bezigMet.has(sleutelBezig)) return
    bezigMet.add(sleutelBezig)
    try {
      const data = await eigenData(ik, n)
      if (!data || data.bytes.length > MAX_BYTES) return stuur({ soort: 'nee', naar, id })
      const p = await versleutelGroepsBytes(data.bytes, { groepId, van: ik, mijnPriv: s.mijnPriv, leden: [{ id: ik, public_key: s.mijnPub }, { id: naar, public_key: pub }] })
      const b64 = naarB64(p.d)
      const aantal = Math.max(1, Math.ceil(b64.length / STUK))
      for (let i = 0; i < aantal; i++) {
        const stukje = { soort: 'stuk', naar, id, i, n: aantal, d: b64.slice(i * STUK, (i + 1) * STUK) }
        if (i === 0) stukje.kop = { t: p.t, k: p.k, mime: data.mime }
        let r = await stuur(stukje)
        if (r !== 'ok') r = await stuur(stukje)
        if (r !== 'ok') throw new Error('versturen mislukt (' + r + ')')
      }
    } catch (e) { console.warn('[groepmuziek] sturen', e) }
    finally { bezigMet.delete(sleutelBezig) }
  }

  // ── een nummer ophalen ──
  function klaar(id, fout, blob) {
    const w = wachtend.get(id)
    if (!w) return
    clearTimeout(w.timer); wachtend.delete(id); voortgang.delete(id)
    if (fout) w.nee(fout); else w.ok(blob)
    verander()
  }
  async function stuk(p) {
    const w = wachtend.get(p.id)
    if (!w || w.van !== p.van || typeof p.d !== 'string' || !Number.isInteger(p.i) || !Number.isInteger(p.n) || p.n < 1 || p.n > MAX_STUKKEN || p.i < 0 || p.i >= p.n) return
    if (!w.delen) { w.delen = new Array(p.n); w.n = p.n; w.binnen = 0 }
    if (w.n !== p.n || w.delen[p.i] !== undefined) return
    w.delen[p.i] = p.d; w.binnen++
    if (p.i === 0 && p.kop) w.kop = p.kop
    clearTimeout(w.timer); w.timer = setTimeout(() => klaar(p.id, new Error('te traag')), WACHT_MS)
    voortgang.set(p.id, w.binnen / w.n); verander()
    if (w.binnen < w.n || !w.kop) return
    const kop = w.kop
    const bytes = await openVan(p.van, { t: kop.t, d: w.delen.join(''), k: kop.k })
    if (!bytes) return klaar(p.id, new Error('klopt niet'))
    const mime = GELDIG_MIME.test(String(kop.mime || '')) ? kop.mime : 'audio/mpeg'
    const blob = new Blob([bytes], { type: mime })
    const info = (anderen.get(p.van)?.lijst || []).find(n => n.id === p.id) || {}
    await bewaarMedia(groepId, 'muziek' + p.id, { blob, soort: 'muziek', mime, duur: 0, van: p.van })
    cache = cache.filter(c => c.id !== p.id).concat([{ id: p.id, van: p.van, titel: info.titel || '?', artiest: info.artiest || '' }])
    bewaar(CACHE, cache)
    klaar(p.id, null, blob)
  }
  async function haal(id, van) {
    if (wachtend.has(id)) return wachtend.get(id).belofte
    let ok, nee
    const belofte = new Promise((a, b) => { ok = a; nee = b })
    wachtend.set(id, { ok, nee, van, belofte, timer: setTimeout(() => klaar(id, new Error('niet online')), 20000) })
    voortgang.set(id, 0); verander()
    const r = await stuur({ soort: 'vraag', naar: van, id })
    if (r !== 'ok') klaar(id, new Error('geen verbinding'))
    return belofte
  }

  return {
    vraagLijsten, kondig, ontvang,
    eigenNummers: () => eigenNummers(ik),
    mijnGedeeld: () => mijn.slice(),
    // de hele playlist: mijn nummers, die van wie nu online is, en wat ik al van anderen heb
    lijst() {
      const uit = mijn.map(n => ({ id: n.id, van: ik, titel: n.titel, artiest: n.artiest, mijn: true, online: true, opToestel: true }))
      const gezien = new Set(uit.map(n => n.id))
      for (const [van, a] of anderen) for (const n of a.lijst) {
        if (gezien.has(n.id)) continue
        gezien.add(n.id)
        uit.push({ ...n, van, mijn: false, online: true, opToestel: cache.some(c => c.id === n.id) })
      }
      for (const c of cache) if (!gezien.has(c.id)) { gezien.add(c.id); uit.push({ ...c, mijn: false, online: false, opToestel: true }) }
      return uit
    },
    voortgang: id => voortgang.has(id) ? voortgang.get(id) : null,
    // zet wat ik deel: [{ bron, i, titel, artiest }] (wat al gedeeld was houdt zijn id)
    async deel(keuze) {
      mijn = keuze.slice(0, 50).map(k => {
        const oud = mijn.find(m => m.bron === k.bron && (k.bron === 'profiel' || m.titel === k.titel))
        return { id: oud ? oud.id : nieuwId(), bron: k.bron, i: k.i, titel: tekst(k.titel, 80), artiest: tekst(k.artiest, 60) }
      })
      bewaar(MIJN, mijn); verander()
      await kondig()
    },
    // het nummer als Blob: van mij, van dit toestel, of opgehaald bij de eigenaar
    async blob(item) {
      if (item.mijn) {
        const n = mijn.find(x => x.id === item.id)
        const d = n && await eigenData(ik, n)
        if (!d) throw new Error('weg')
        return new Blob([d.bytes], { type: d.mime })
      }
      const opgeslagen = await leesMedia(groepId, 'muziek' + item.id)
      if (opgeslagen) return opgeslagen.blob
      if (!item.online) throw new Error('niet online')
      return haal(item.id, item.van)
    },
  }
}
