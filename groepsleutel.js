// groepsleutel.js (10 nov 2026, groepschat stap 1): berichten in een groep end-to-end versleutelen.
//
// Hoe: elk bericht krijgt een eigen, willekeurige sleutel (AES-GCM, 256 bits). Die berichtsleutel wordt voor elk lid
// apart ingepakt met de sleutel die de afzender en dat lid samen hebben (ECDH P-256, dezelfde sleutelparen als de
// gewone chat, door HKDF met een eigen 'zout' voor groepen). De server ziet alleen een rij onleesbare tekens.
//   'g1:' + JSON { t: tijd (base36), d: iv+tekst (base64), k: { <lid-id>: iv+ingepakte sleutel (base64) } }
// Vast aan de versleuteling (AES-GCM 'additional data'): de groep, de afzender en de tijd (en bij het inpakken ook
// voor wie). Zet iemand onderweg een bericht in een andere groep, of op naam van een ander: dan gaat openen mis.
//
// openGroepsbericht() geeft { tekst, status }: 'ok', 'tijd' (verzendtijd wijkt >15 min af van de server),
// 'niet-voor-mij' (je was nog geen lid toen het verstuurd werd), 'onleesbaar' (sleutels passen niet) of 'vervalst'.

const VOORVOEGSEL = 'g1:'
const ZOUT = new TextEncoder().encode('fibro-groep-v1')
const TIJD_MARGE = 15 * 60 * 1000
export const MAX_LEDEN = { chat: 50, voice: 8, webcam: 4 }

function naarB64(buf) {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192))
  return btoa(s)
}
function vanB64(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const tekst = s => new TextEncoder().encode(s)

// De sleutel die ik en een ander samen hebben, alleen voor het inpakken van groepssleutels (per groep anders).
const _paren = new Map()
function paarSleutel(mijnPriv, anderPub, groepId) {
  const k = mijnPriv + '|' + anderPub + '|' + groepId
  let p = _paren.get(k)
  if (!p) {
    p = (async () => {
      const priv = await crypto.subtle.importKey('pkcs8', vanB64(mijnPriv), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
      const pub = await crypto.subtle.importKey('spki', vanB64(anderPub), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      const gedeeld = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256)
      const basis = await crypto.subtle.importKey('raw', gedeeld, 'HKDF', false, ['deriveKey'])
      return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: ZOUT, info: tekst('groep-inpak|' + groepId) },
        basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    })()
    _paren.set(k, p)
    p.catch(() => _paren.delete(k))
  }
  return p
}

const berichtExtra = (groepId, van, t) => tekst(['fibro-groep-v1', 'bericht', groepId, van, t].join('|'))
const inpakExtra = (groepId, van, naar, t) => tekst(['fibro-groep-v1', 'sleutel', groepId, van, naar, t].join('|'))

// leden: [{ id, public_key }], ik zelf hoort erbij (zo kan ik mijn eigen bericht later ook lezen).
// Leden zonder publieke sleutel krijgen niets (ze kunnen nog niet versleutelen); die staan in 'overgeslagen'.
export async function versleutelGroepsbericht(platteTekst, { groepId, van, mijnPriv, leden, nu }) {
  if (!groepId || !van || !mijnPriv) throw new Error('groep, afzender of sleutel ontbreekt')
  const t = Math.floor(nu || Date.now()).toString(36)
  const ruw = crypto.getRandomValues(new Uint8Array(32))
  const sleutel = await crypto.subtle.importKey('raw', ruw, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: berichtExtra(groepId, van, t) }, sleutel, tekst(platteTekst)))
  const d = new Uint8Array(12 + ct.length); d.set(iv); d.set(ct, 12)
  const k = {}
  const overgeslagen = []
  for (const lid of leden || []) {
    if (!lid || !lid.id || k[lid.id]) continue
    if (!lid.public_key) { overgeslagen.push(lid.id); continue }
    try {
      const ps = await paarSleutel(mijnPriv, lid.public_key, groepId)
      const iv2 = crypto.getRandomValues(new Uint8Array(12))
      const w = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv2, additionalData: inpakExtra(groepId, van, lid.id, t) }, ps, ruw))
      const o = new Uint8Array(12 + w.length); o.set(iv2); o.set(w, 12)
      k[lid.id] = naarB64(o)
    } catch (e) { overgeslagen.push(lid.id) }
  }
  if (!k[van]) throw new Error('eigen sleutel past niet')
  return { content: VOORVOEGSEL + JSON.stringify({ t, d: naarB64(d), k }), overgeslagen }
}

export function isGroepsbericht(content) { return typeof content === 'string' && content.startsWith(VOORVOEGSEL) }

// afzenderPub: de publieke sleutel van wie het stuurde (bij een eigen bericht: mijn eigen publieke sleutel).
export async function openGroepsbericht(content, { groepId, van, ik, mijnPriv, afzenderPub, serverTijd }) {
  if (!isGroepsbericht(content)) return { tekst: '', status: 'onleesbaar' }
  let pak
  try { pak = JSON.parse(content.slice(VOORVOEGSEL.length)) } catch (e) { return { tekst: '', status: 'vervalst' } }
  if (!pak || typeof pak.t !== 'string' || !/^[0-9a-z]{1,12}$/.test(pak.t) || typeof pak.d !== 'string' || !pak.k || typeof pak.k !== 'object') return { tekst: '', status: 'vervalst' }
  const mijn = pak.k[ik]
  if (typeof mijn !== 'string') return { tekst: '', status: 'niet-voor-mij' }
  if (!mijnPriv || !afzenderPub) return { tekst: '', status: 'onleesbaar' }
  let ruw
  try {
    const ps = await paarSleutel(mijnPriv, afzenderPub, groepId)
    const w = vanB64(mijn)
    ruw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: w.slice(0, 12), additionalData: inpakExtra(groepId, van, ik, pak.t) }, ps, w.slice(12))
  } catch (e) { return { tekst: '', status: 'onleesbaar' } }
  let plat
  try {
    const sleutel = await crypto.subtle.importKey('raw', ruw, 'AES-GCM', false, ['decrypt'])
    const d = vanB64(pak.d)
    if (d.length < 28) return { tekst: '', status: 'vervalst' }
    plat = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.slice(0, 12), additionalData: berichtExtra(groepId, van, pak.t) }, sleutel, d.slice(12)))
  } catch (e) { return { tekst: '', status: 'vervalst' } }
  const verstuurd = parseInt(pak.t, 36)
  const server = Number(serverTijd)
  if (server > 0 && !(Math.abs(server - verstuurd) <= TIJD_MARGE)) return { tekst: plat, status: 'tijd', verstuurd }
  return { tekst: plat, status: 'ok', verstuurd }
}
