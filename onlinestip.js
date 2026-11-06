// onlinestip.js (v1, 6 nov 2026, v274): het groene bolletje bij een vriend, nauwkeuriger (op verzoek van Marcel).
//
// Vroeger keek het bolletje alleen naar de server: elke telefoon zegt daar om de 2 minuten "ik ben er nog"
// (heartbeat.js), en groen = dat laatste seintje is minder dan 5 minuten oud. Dat liep achter (Vrienden en een
// vriend-profiel haalden het maar een keer op) en in een spel of gesprek stond je meteen op offline.
//
// Nu, per vriend:
//  1. Is hij via de live verbinding (paren.js) in Stekky en heeft hij de app in beeld ('actief'), dan GROEN.
//     Dat weet je binnen een paar seconden.
//  2. Heeft hij de app weggezet ('verborgen', bijvoorbeeld een andere app of telefoon op slot) of staat hij op
//     'helemaal offline' ('stil'), dan GRIJS, meteen.
//  3. Anders de server: groen als zijn laatste seintje minder dan 5 minuten oud is. Zo tel je ook mee in een spel
//     of gesprek (daar loopt alleen het seintje). Zagen we hem hier uit de live verbinding gaan en kwam er daarna
//     geen nieuw seintje, dan is hij echt weg (bijvoorbeeld telefoon uit): GRIJS.
// Kosten: hoogstens een kleine vraag (ongeveer 2 KB) per 2 minuten, alleen voor vrienden die niet live zijn, en een
// enkele vraag als iemand de live verbinding verlaat.

import { startParen, isOnline as inKamer, heeftKenmerk, opOnline, zetKenmerk } from './paren.js?v=2'
import { supabase } from './supabase.js?v=95'

export const VERS_MS = 5 * 60 * 1000   // seintje van de server telt 5 minuten (heartbeat elke 2 min)
export const POLL_MS = 2 * 60 * 1000   // de server hoogstens elke 2 minuten opnieuw vragen
export const MARGE_MS = 20 * 1000      // klokken van telefoons lopen nooit precies gelijk
export const NA_WEG_MS = 6000          // even wachten na het verlaten: misschien opent hij net een spel

// De regel zelf (los te testen).
//  live: in de live verbinding met de app in beeld; verborgen: in de live verbinding, app weggezet; stil: helemaal offline
//  server: { online_status, laatst } (laatst in ms); wegOp: wanneer hij hier de live verbinding verliet (of null)
export function beslisOnline({ nu, live, verborgen, stil, server, wegOp }) {
  if (stil || verborgen) return false
  if (live) return true
  if (!server || !server.online_status || !server.laatst) return false
  if (nu - server.laatst >= VERS_MS) return false
  if (wegOp && server.laatst < wegOp - MARGE_MS) return false
  return true
}

const stand = new Map()        // vriendId -> { online_status, laatst, haal }
const wegOp = new Map()        // vriendId -> tijd waarop hij hier de live verbinding verliet
const luisteraars = new Set()
let geefIds = () => []
let gestart = false
let roepTimer = null

function ikOffline() { try { return localStorage.getItem('fibro_ik_offline') === '1' } catch (e) { return false } }
function tijd(t) { const n = t ? Date.parse(t) : 0; return Number.isFinite(n) ? n : 0 }

// Verse rijen van de server ({ id, online_status, laatst_gezien }) onthouden.
export function bewaarServerStand(rijen) {
  const nu = Date.now()
  for (const r of rijen || []) {
    if (!r || typeof r.id !== 'string' || !('online_status' in r)) continue
    stand.set(r.id, { online_status: !!r.online_status, laatst: tijd(r.laatst_gezien), haal: nu })
  }
}

// Is deze vriend nu online? profiel (mag ontbreken): wat de pagina zelf van hem weet; het nieuwste telt.
export function isVriendOnline(id, profiel) {
  if (!id || ikOffline()) return false
  let server = stand.get(id) || null
  if (profiel && 'online_status' in profiel) {
    const p = { online_status: !!profiel.online_status, laatst: tijd(profiel.laatst_gezien) }
    if (!server || p.laatst > server.laatst) server = p
  }
  const k = inKamer(id)
  const actief = k && heeftKenmerk(id, 'actief')
  return beslisOnline({
    nu: Date.now(),
    live: actief,
    verborgen: k && !actief && heeftKenmerk(id, 'verborgen'),
    stil: k && heeftKenmerk(id, 'stil'),
    server,
    wegOp: k ? null : (wegOp.get(id) || null),
  })
}

function roep() {
  clearTimeout(roepTimer)
  roepTimer = setTimeout(() => { for (const fn of [...luisteraars]) { try { fn() } catch (e) { console.warn('[onlinestip]', e) } } }, 60)
}

async function haal(alles, alleen) {
  if (document.hidden || ikOffline() || !navigator.onLine) return
  const nu = Date.now()
  let ids = (alleen || geefIds() || []).filter(id => typeof id === 'string')
  if (!alleen) {
    ids = ids.filter(id => !(inKamer(id) && heeftKenmerk(id, 'actief')))              // live: de server is niet nodig
      .filter(id => alles || !stand.has(id) || nu - stand.get(id).haal > POLL_MS - 20000) // net opgehaald: niet nog eens
  }
  if (!ids.length) return
  try {
    const { data, error } = await supabase.from('profiles').select('id, online_status, laatst_gezien').in('id', ids.slice(0, 100))
    if (!error && data) bewaarServerStand(data)
  } catch (e) {}
}

// Een pagina met bolletjes: uid = jijzelf, ids = functie die de vrienden-ids geeft, opWijziging = opnieuw tekenen.
// Ook zonder ids (bijvoorbeeld Profiel): dan laat je vrienden alleen zien of jij de app in beeld hebt.
export function volgOnline(uid, ids, opWijziging) {
  if (typeof ids === 'function') geefIds = ids
  if (typeof opWijziging === 'function') luisteraars.add(opWijziging)
  if (gestart || !uid) return
  gestart = true
  startParen(uid)
  const zetZichtbaar = () => {
    const zichtbaar = !document.hidden
    zetKenmerk('actief', zichtbaar ? true : undefined)
    zetKenmerk('verborgen', zichtbaar ? undefined : true)
  }
  zetZichtbaar()
  document.addEventListener('visibilitychange', () => {
    zetZichtbaar()
    if (!document.hidden) haal(true).then(roep)
  })
  opOnline((w) => {
    if (!w || !w.id || w.online || w.gelijk) {
      if (w && w.id && w.online) wegOp.delete(w.id)
      roep()
      return
    }
    // Hij verliet de live verbinding: naar een spel of gesprek (daar alleen het seintje), of echt weg.
    wegOp.set(w.id, Date.now())
    setTimeout(() => { if (!inKamer(w.id)) haal(false, [w.id]).then(roep); else roep() }, NA_WEG_MS)
  })
  setInterval(() => { haal(false).then(roep) }, POLL_MS)
  setTimeout(() => { haal(false).then(roep) }, 1500)
}
