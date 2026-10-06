// paren.js - een afgeschermd realtime-kanaal per vriendenpaar (stap B deel 4, v121)
//
// Elk vriendenpaar heeft een eigen kamer met een slot: paar_<kleinste id>_<grootste id>,
// geopend met private: true. Alleen die twee mogen erin, en alleen zolang ze vrienden
// zijn (database: public.realtime_toegang in sql/realtime-kanalen.sql). Dit vervangt de
// openbare kanalen fibro-online (sync.js), fibro-aanwezigheid (p2pfoto.js) en
// fibro-online-meldingen (meldingen.js): daar kon iedereen zien wie er online was en
// berichten sturen.
//
// Een pagina opent per vriend precies een kanaal, gedeeld door alle modules.
// supabase.channel(naam) geeft bij dezelfde naam hetzelfde object terug; als elke module
// zelf zou openen, zaten ze elkaar in de weg.
//
// Aanwezigheid (presence): sleutel = eigen id, met deze gegevens:
//   pagina - willekeurig per geladen pagina (zo is een nieuwe pagina te herkennen)
//   stil   - true als 'helemaal offline' aan staat: vrienden krijgen geen "is online"
//   foto   - true als deze pagina foto's via p2p kan ontvangen (p2pfoto.js)
// Berichten (broadcast): event 'paar', payload { soort, van, data }. Alleen de vriend en
// jijzelf (een ander tabblad) kunnen op het kanaal sturen; van onderscheidt die twee.

import { supabase } from './supabase.js?v=95'

const MAX_VRIENDEN = 90                       // Supabase: ongeveer 100 kanalen per verbinding
const GEWEIGERD_WACHT = [5000, 60000, 600000] // geweigerd kanaal: daarna niet meer proberen
const PAGINA = Math.random().toString(36).slice(2, 10)

let ikId = null
let startBelofte = null
let vriendenLijst = []
let ladenPogingen = 0
let ladenTimer = null
let trackTimer = null
const eigenMeta = {}
const kamers = new Map()       // vriendId -> { naam, kanaal, open, eerste, metas, weigeringen, timer }
const online = new Set()
const wegSinds = new Map()     // vriendId -> tijd waarop hij offline ging
const paginas = new Map()      // vriendId -> pagina-ids die we van hem kennen
const onlineLuisteraars = new Set()
const paginaLuisteraars = new Set()
const berichtLuisteraars = new Map()

function wacht(ms) { return new Promise((r) => setTimeout(r, ms)) }
function kamerNaam(vriendId) { return 'paar_' + [ikId, vriendId].sort().join('_') }
function roep(set, ...args) {
  for (const fn of [...set]) {
    try { fn(...args) } catch (e) { console.warn('[paren] luisteraar fout:', e) }
  }
}

// ── Starten: een keer per pagina; elke module mag dit aanroepen ──
export function startParen(uid) {
  if (!uid) return Promise.resolve([])
  if (startBelofte && uid === ikId) return startBelofte
  if (ikId && uid !== ikId) stopParen()
  ikId = uid
  startBelofte = laadVrienden()
  return startBelofte
}

async function laadVrienden() {
  const mij = ikId
  let data = null, error = null
  try {
    ({ data, error } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', mij)
      .eq('status', 'accepted'))
  } catch (e) { error = e }
  if (mij !== ikId) return []
  if (error || !Array.isArray(data)) {
    console.warn('[paren] vrienden laden mislukt:', error && (error.message || error))
    if (ladenPogingen++ < 5) {
      clearTimeout(ladenTimer)
      ladenTimer = setTimeout(() => {
        if (mij !== ikId) return
        startBelofte = laadVrienden()
      }, 30000)
    }
    return vriendenLijst.slice()
  }
  let lijst = [...new Set(data.map((r) => r && r.friend_id).filter((id) => typeof id === 'string' && id !== mij))]
  if (lijst.length > MAX_VRIENDEN) {
    console.warn('[paren] ' + lijst.length + ' vrienden; alleen de eerste ' + MAX_VRIENDEN + ' krijgen een kanaal')
    lijst = lijst.slice(0, MAX_VRIENDEN)
  }
  vriendenLijst = lijst
  for (const id of lijst) openKamer(id)
  console.log('[paren] ' + lijst.length + ' vriend(en), elk een eigen afgeschermd kanaal')
  roep(onlineLuisteraars, { id: null, online: false, gelijk: true })
  return lijst.slice()
}

function openKamer(vriendId) {
  if (kamers.has(vriendId)) return
  const kamer = { vriendId, naam: kamerNaam(vriendId), kanaal: null, open: false, eerste: true, metas: [], weigeringen: 0, timer: null }
  kamers.set(vriendId, kamer)
  bouwKanaal(kamer).catch((e) => console.warn('[paren] kanaal openen mislukt:', e))
}

async function bouwKanaal(kamer) {
  // Een kanaal met dezelfde naam dat nog aan het sluiten is eerst helemaal laten sluiten,
  // anders geeft supabase.channel() dat sluitende kanaal terug (zie bellen.js).
  for (const k of supabase.getChannels()) {
    if (k.topic === 'realtime:' + kamer.naam) await Promise.race([supabase.removeChannel(k), wacht(3000)])
  }
  if (kamers.get(kamer.vriendId) !== kamer) return
  const k = supabase.channel(kamer.naam, { config: { private: true, broadcast: { self: false }, presence: { key: ikId } } })
  kamer.kanaal = k
  kamer.open = false
  k.on('presence', { event: 'join' }, (p) => nieuweAanwezigheid(kamer, k, p))
    .on('presence', { event: 'sync' }, () => aanwezigheidBijwerken(kamer, k))
    .on('broadcast', { event: 'paar' }, (msg) => berichtBinnen(kamer, k, msg && msg.payload))
    .subscribe((status, fout) => {
      if (kamer.kanaal !== k) return
      if (status === 'SUBSCRIBED') {
        kamer.open = true
        kamer.weigeringen = 0
        volgen(kamer)
        return
      }
      kamer.open = false
      if (status !== 'CHANNEL_ERROR') return
      const tekst = String((fout && fout.message) || fout || '')
      if (/unauthori[sz]ed|permission/i.test(tekst)) geweigerd(kamer)
      // anders: verbinding weg; Supabase probeert zelf opnieuw
    })
}

function geweigerd(kamer) {
  const k = kamer.kanaal
  kamer.kanaal = null
  kamer.open = false
  if (k) supabase.removeChannel(k).catch(() => {})
  zetOffline(kamer)
  const n = kamer.weigeringen++
  if (n >= GEWEIGERD_WACHT.length) {
    console.log('[paren] kanaal met een vriend geweigerd - niet meer opnieuw')
    return
  }
  console.log('[paren] kanaal met een vriend geweigerd - nieuwe poging over ' + Math.round(GEWEIGERD_WACHT[n] / 1000) + ' s')
  clearTimeout(kamer.timer)
  kamer.timer = setTimeout(() => {
    if (kamers.get(kamer.vriendId) !== kamer || kamer.kanaal) return
    kamer.eerste = true
    bouwKanaal(kamer).catch((e) => console.warn('[paren] kanaal openen mislukt:', e))
  }, GEWEIGERD_WACHT[n])
}

function huidigeMeta() {
  let stil = false
  try { stil = localStorage.getItem('fibro_ik_offline') === '1' } catch (e) {}
  const meta = Object.assign({ pagina: PAGINA }, eigenMeta)
  if (stil) meta.stil = true
  return meta
}

function volgen(kamer) {
  const k = kamer.kanaal
  if (!k || !kamer.open) return
  k.track(huidigeMeta()).catch(() => {})
}

// ── Aanwezigheid ──
function nieuweAanwezigheid(kamer, k, p) {
  if (kamer.kanaal !== k || !p || p.key !== kamer.vriendId) return
  let bekend = paginas.get(kamer.vriendId)
  if (!bekend) { bekend = new Set(); paginas.set(kamer.vriendId, bekend) }
  let nieuw = false
  for (const m of p.newPresences || []) {
    const pag = m && typeof m.pagina === 'string' ? m.pagina : null
    if (pag && bekend.has(pag)) continue
    nieuw = true
    if (pag) bekend.add(pag)
  }
  if (bekend.size > 20) paginas.set(kamer.vriendId, new Set([...bekend].slice(-10)))
  // De eerste stand na het openen is geen nieuwe pagina: die was er al.
  if (nieuw && !kamer.eerste) roep(paginaLuisteraars, kamer.vriendId)
}

function aanwezigheidBijwerken(kamer, k) {
  if (kamer.kanaal !== k) return
  const staat = k.presenceState() || {}
  const metas = Array.isArray(staat[kamer.vriendId]) ? staat[kamer.vriendId] : []
  const id = kamer.vriendId
  const eerste = kamer.eerste
  kamer.eerste = false
  kamer.metas = metas
  const isEr = metas.length > 0
  const stil = isEr && metas.every((m) => m && m.stil === true)
  if (isEr && !online.has(id)) {
    online.add(id)
    const weg = wegSinds.has(id) ? Date.now() - wegSinds.get(id) : null
    wegSinds.delete(id)
    roep(onlineLuisteraars, { id, online: true, eerste, wegMs: weg, stil })
  } else if (!isEr && online.has(id)) {
    online.delete(id)
    wegSinds.set(id, Date.now())
    roep(onlineLuisteraars, { id, online: false, eerste, stil: false })
  } else {
    roep(onlineLuisteraars, { id, online: isEr, eerste, gelijk: true, stil })
  }
}

function zetOffline(kamer) {
  kamer.metas = []
  if (!online.has(kamer.vriendId)) return
  online.delete(kamer.vriendId)
  wegSinds.set(kamer.vriendId, Date.now())
  roep(onlineLuisteraars, { id: kamer.vriendId, online: false, eerste: false, stil: false })
}

// ── Berichten ──
function berichtBinnen(kamer, k, payload) {
  if (kamer.kanaal !== k || !payload || typeof payload.soort !== 'string') return
  if (payload.van !== kamer.vriendId) return // eigen bericht uit een ander tabblad
  const set = berichtLuisteraars.get(payload.soort)
  if (set) roep(set, payload.data, kamer.vriendId)
}

// Stuur een bericht naar een vriend. Geeft 'ok' terug als het verstuurd is.
export async function stuurNaar(vriendId, soort, data) {
  const kamer = kamers.get(vriendId)
  if (!kamer || !kamer.kanaal || !kamer.open) return 'niet-open'
  try {
    return await kamer.kanaal.send({ type: 'broadcast', event: 'paar', payload: { soort, van: ikId, data } })
  } catch (e) { return 'fout' }
}

// ── Voor de andere modules ──
export function vrienden() { return vriendenLijst.slice() }
export function isOnline(id) { return online.has(id) }
export function onlineVrienden() { return [...online] }
export function heeftKenmerk(id, naam) {
  const kamer = kamers.get(id)
  return !!kamer && online.has(id) && kamer.metas.some((m) => m && m[naam] === true)
}
// fn({ id, online, eerste, wegMs, stil, gelijk }); geeft een afmeldfunctie terug
export function opOnline(fn) { onlineLuisteraars.add(fn); return () => onlineLuisteraars.delete(fn) }
// fn(vriendId): de vriend opende een nieuwe pagina
export function opNieuwePagina(fn) { paginaLuisteraars.add(fn); return () => paginaLuisteraars.delete(fn) }
// fn(data, vriendId) voor berichten van deze soort
export function opBericht(soort, fn) {
  let set = berichtLuisteraars.get(soort)
  if (!set) { set = new Set(); berichtLuisteraars.set(soort, set) }
  set.add(fn)
  return () => set.delete(fn)
}
// Eigen kenmerk in de aanwezigheid zetten (bijv. foto: true)
export function zetKenmerk(naam, waarde) {
  if (eigenMeta[naam] === waarde) return
  if (waarde === undefined) delete eigenMeta[naam]
  else eigenMeta[naam] = waarde
  clearTimeout(trackTimer)
  trackTimer = setTimeout(() => { for (const kamer of kamers.values()) volgen(kamer) }, 300)
}

export function stopParen() {
  clearTimeout(ladenTimer)
  clearTimeout(trackTimer)
  for (const kamer of kamers.values()) {
    clearTimeout(kamer.timer)
    if (kamer.kanaal) supabase.removeChannel(kamer.kanaal).catch(() => {})
    kamer.kanaal = null
  }
  kamers.clear()
  online.clear()
  wegSinds.clear()
  paginas.clear()
  vriendenLijst = []
  startBelofte = null
  ikId = null
  ladenPogingen = 0
}
