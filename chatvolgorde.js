// chatvolgorde.js (23 nov 2026, Marcel): de volgorde van de vrienden in de chatlijst.
// Bovenaan staan de vrienden die online zijn, daaronder de rest. In beide groepen komt de vriend met wie je het
// laatst een bericht wisselde (van jou of van hem) eerst. Vrienden zonder bericht blijven in de volgorde waarin de
// lijst geladen werd. Geen scherm: chat.html zet de rijen om; hier staat alleen het rekenwerk en wat we onthouden.
// We onthouden alleen WANNEER het laatste bericht was (een getal per vriend), nooit wat erin stond.

const laatste = new Map()   // vriend-id -> tijd van het laatste bericht (ms)
let sleutel = null, opslag = null

const getal = v => { const n = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(n) ? n : 0 }

// Haalt de tijden van de vorige keer op, zodat ook de bewaarde lijst al in de goede volgorde staat.
export function startLaatste(uid, ruimte = globalThis.localStorage) {
  laatste.clear()
  sleutel = uid ? 'fibro_chatlaatste_' + uid : null
  opslag = ruimte || null
  if (!sleutel || !opslag) return
  try {
    const b = JSON.parse(opslag.getItem(sleutel) || 'null')
    if (b && typeof b === 'object' && !Array.isArray(b)) for (const [id, t] of Object.entries(b)) if (getal(t) > 0) laatste.set(String(id), getal(t))
  } catch (e) {}
}

function bewaar() {
  if (!sleutel || !opslag) return
  try { opslag.setItem(sleutel, JSON.stringify(Object.fromEntries(laatste))) } catch (e) {}
}

// Een bericht met deze vriend op dit moment (of op dit tijdstip). Geeft true als de volgorde hierdoor kan veranderen.
export function noteerLaatste(vriendId, tijd = Date.now()) {
  const id = vriendId == null ? '' : String(vriendId), t = getal(tijd)
  if (!id || !t || t <= (laatste.get(id) || 0)) return false
  laatste.set(id, t)
  bewaar()
  return true
}

// Uit een rij berichten van de server (sender_id, receiver_id, created_at): per vriend het nieuwste.
export function noteerUitBerichten(rijen, mijnId) {
  let veranderd = false
  const nu = laatste.size
  for (const m of Array.isArray(rijen) ? rijen : []) {
    if (!m || !mijnId) continue
    const ander = m.sender_id === mijnId ? m.receiver_id : m.receiver_id === mijnId ? m.sender_id : null
    if (!ander || ander === mijnId) continue
    const t = getal(m.created_at), id = String(ander)
    if (t > (laatste.get(id) || 0)) { laatste.set(id, t); veranderd = true }
  }
  if (veranderd || laatste.size !== nu) bewaar()
  return veranderd
}

export const laatsteTijden = () => laatste

// ids: de vrienden-ids in de volgorde waarin ze nu staan. online: Set met ids van wie online is.
// basis: ids in de volgorde waarin de lijst geladen werd (bepaalt wie eerst komt bij gelijk spel).
export function sorteerVrienden(ids, { online = new Set(), laatste: tijden = laatste, basis = [] } = {}) {
  const plek = id => { const i = basis.indexOf(id); return i < 0 ? 9999 : i }
  return [...ids].sort((a, b) =>
    (online.has(b) ? 1 : 0) - (online.has(a) ? 1 : 0) ||
    (tijden.get(b) || 0) - (tijden.get(a) || 0) ||
    plek(a) - plek(b))
}
