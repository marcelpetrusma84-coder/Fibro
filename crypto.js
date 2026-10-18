// crypto.js — Fibro E2E encryptie via Web Crypto API (ECDH + AES-GCM)
// v181 (18 oktober 2026): versleuteling v2 voor nieuwe berichten en reacties: 'e2e:2:<tijd>:<sleutel-id>:<data>'.
//  - De gesprekssleutel komt via HKDF uit de ECDH-uitkomst (was: de ECDH-uitkomst zelf als AES-sleutel).
//  - Afzender, ontvanger (bij een reactie: het bericht) en de verzendtijd zitten vast aan de versleuteling
//    (AES-GCM 'additional data'). Draait iemand onderweg afzender en ontvanger om, of verandert hij iets,
//    dan gaat het openen mis: status 'vervalst'.
//  - De verzendtijd staat leesbaar in het bericht (de server kent de tijd toch al). Wijkt hij meer dan
//    15 minuten af van de tijd van de server, dan is het waarschijnlijk een oud bericht dat opnieuw is
//    neergezet: status 'tijd' (de tekst komt wel mee).
//  - Het sleutel-id (6 bytes uit dezelfde HKDF) vertelt of de sleutels nog bij elkaar passen: zo is
//    'past niet meer' (bijv. de vriend begon opnieuw) te onderscheiden van 'onderweg veranderd'.
//  Oude berichten ('e2e:<data>') blijven gewoon leesbaar. Een oudere app ziet een v2-bericht als 🔒.
//  De sleutelparen (P-256) blijven dezelfde: niemand hoeft opnieuw te beginnen.

const SLEUTEL_PREFIX = 'fibro_privkey_'
const V2 = 'e2e:2:'
const TIJD_MARGE = 15 * 60 * 1000
const ZOUT = new TextEncoder().encode('fibro-e2e-v2')

// Wat ontsleutel() teruggeeft als het niet lukt
export const ONLEESBAAR = '\u{1F512} [versleuteld bericht — kan niet lezen]'
export const VERVALST = '⚠️ [bericht klopt niet — onderweg veranderd]'

// ─── Keypair genereren bij registratie ───
export async function genereerKeypair() {
  const keypair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  )
  const publicKeyRaw = await crypto.subtle.exportKey('spki', keypair.publicKey)
  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keypair.privateKey)
  return {
    publicKeyB64: bufferNaarB64(publicKeyRaw),
    privateKeyB64: bufferNaarB64(privateKeyRaw)
  }
}

// ─── Sla private key op in localStorage (gekoppeld aan user ID) ───
export function slaPrivateKeyOp(userId, privateKeyB64) {
  localStorage.setItem(SLEUTEL_PREFIX + userId, privateKeyB64)
}

// ─── Haal private key op uit localStorage ───
export function haalPrivateKeyOp(userId) {
  return localStorage.getItem(SLEUTEL_PREFIX + userId)
}

// ─── Importeer public key van ontvanger (uit Supabase, base64 string) ───
async function importeerPublicKey(b64) {
  const raw = b64NaarBuffer(b64)
  return crypto.subtle.importKey(
    'spki',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
}

// ─── Importeer eigen private key (uit localStorage, base64 string) ───
async function importeerPrivateKey(b64, gebruik) {
  const raw = b64NaarBuffer(b64)
  return crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [gebruik || 'deriveKey']
  )
}

// ─── v1: afleiden van gedeelde AES sleutel via ECDH (alleen nog om oude berichten te openen) ───
async function leidAesAfVan(privateKey, publicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ─── v2: ECDH-uitkomst door HKDF: de berichtsleutel en een sleutel-id ───
const _v2Cache = new Map()
function v2SleutelsVoor(mijnPrivKeyB64, andermansPubKeyB64) {
  const k = mijnPrivKeyB64 + '|' + andermansPubKeyB64
  let p = _v2Cache.get(k)
  if (!p) {
    p = (async () => {
      const priv = await importeerPrivateKey(mijnPrivKeyB64, 'deriveBits')
      const pub = await importeerPublicKey(andermansPubKeyB64)
      const gedeeld = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256)
      const basis = await crypto.subtle.importKey('raw', gedeeld, 'HKDF', false, ['deriveKey', 'deriveBits'])
      const aes = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: ZOUT, info: new TextEncoder().encode('fibro-v2 berichtsleutel') },
        basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      const id = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: ZOUT, info: new TextEncoder().encode('fibro-v2 sleutel-id') },
        basis, 48)
      return { aes, id: hex(id) }
    })()
    _v2Cache.set(k, p)
    p.catch(() => _v2Cache.delete(k))
  }
  return p
}

// Wat er vast aan het bericht zit (AES-GCM additional data). Een bericht: van wie, aan wie, wanneer.
// Een reactie: van wie, bij welk bericht, wanneer.
function extraGegevens(ctx, tijd36) {
  const soort = ctx && ctx.soort
  const van = ctx && ctx.van != null ? String(ctx.van) : ''
  const naar = soort === 'reactie' ? (ctx && ctx.bij != null ? String(ctx.bij) : '') : (ctx && ctx.naar != null ? String(ctx.naar) : '')
  if ((soort !== 'bericht' && soort !== 'reactie') || !van || !naar) return null
  return new TextEncoder().encode(['fibro-v2', soort, van, naar, tijd36].join('|'))
}

// ─── Versleutel een bericht of reactie (plaintext string → 'e2e:2:...') ───
// ctx: { soort: 'bericht', van, naar } of { soort: 'reactie', van, bij }. Zonder ctx gaat er niets de deur uit.
export async function versleutel(plaintext, mijnPrivKeyB64, ontvangerPubKeyB64, ctx) {
  try {
    const tijd36 = Date.now().toString(36)
    const extra = extraGegevens(ctx, tijd36)
    if (!extra) throw new Error('afzender of ontvanger ontbreekt')
    const s = await v2SleutelsVoor(mijnPrivKeyB64, ontvangerPubKeyB64)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: extra },
      s.aes,
      new TextEncoder().encode(plaintext)
    )
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.byteLength)
    return V2 + tijd36 + ':' + s.id + ':' + bufferNaarB64(combined)
  } catch (e) {
    console.error('Versleutelen mislukt:', e)
    throw new Error('Versleutelen mislukt')
  }
}

// ─── Ontsleutel, met uitleg ───
// Geeft { tekst, status } terug. status:
//   'open'       niet versleuteld (tekst = zoals het binnenkwam; de chat beslist wat ermee gebeurt)
//   'v1'         oud bericht, goed geopend
//   'v2'         nieuw bericht, goed geopend, afzender/ontvanger/tijd kloppen
//   'tijd'       nieuw bericht, goed geopend, maar de verzendtijd wijkt af van serverTijd (ms)
//   'onleesbaar' sleutels passen niet (meer), of er ontbreekt iets
//   'vervalst'   sleutels passen wel, maar het bericht of wat erbij hoort is onderweg veranderd
export async function ontsleutelBericht(blob, mijnPrivKeyB64, andermansPubKeyB64, ctx) {
  if (typeof blob !== 'string' || !blob.startsWith('e2e:')) return { tekst: blob, status: 'open' }
  if (!mijnPrivKeyB64 || !andermansPubKeyB64) return { tekst: ONLEESBAAR, status: 'onleesbaar' }
  if (blob.startsWith(V2)) {
    const m = /^e2e:2:([0-9a-z]{1,12}):([0-9a-f]{12}):([A-Za-z0-9+/]+={0,2})$/.exec(blob)
    if (!m) return { tekst: VERVALST, status: 'vervalst' }
    const extra = extraGegevens(ctx, m[1])
    if (!extra) return { tekst: ONLEESBAAR, status: 'onleesbaar' }
    let s
    try { s = await v2SleutelsVoor(mijnPrivKeyB64, andermansPubKeyB64) } catch (e) { return { tekst: ONLEESBAAR, status: 'onleesbaar' } }
    if (s.id !== m[2]) return { tekst: ONLEESBAAR, status: 'onleesbaar' }
    let tekst
    try {
      const combined = b64NaarBuffer(m[3])
      if (combined.byteLength < 12 + 16) return { tekst: VERVALST, status: 'vervalst' }
      const plat = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12), additionalData: extra }, s.aes, combined.slice(12))
      tekst = new TextDecoder().decode(plat)
    } catch (e) {
      return { tekst: VERVALST, status: 'vervalst' }
    }
    const verstuurd = parseInt(m[1], 36)
    const server = Number(ctx && ctx.serverTijd)
    if (server > 0 && !(Math.abs(server - verstuurd) <= TIJD_MARGE)) return { tekst, status: 'tijd', verstuurd }
    return { tekst, status: 'v2', verstuurd }
  }
  // v1 (oud): zonder extra gegevens
  try {
    const aesKey = await aesSleutelVoor(mijnPrivKeyB64, andermansPubKeyB64)
    const combined = b64NaarBuffer(blob.slice(4))
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      aesKey,
      combined.slice(12)
    )
    return { tekst: new TextDecoder().decode(decrypted), status: 'v1' }
  } catch (e) {
    return { tekst: ONLEESBAAR, status: 'onleesbaar' }
  }
}

// ─── Ontsleutel een bericht (blob → plaintext string), zoals vroeger ───
// Niet versleuteld: zoals het is. Lukt het niet: ONLEESBAAR of VERVALST.
export async function ontsleutel(blob, mijnPrivKeyB64, afzenderPubKeyB64, ctx) {
  return (await ontsleutelBericht(blob, mijnPrivKeyB64, afzenderPubKeyB64, ctx)).tekst
}

// ─── Vingerafdruk van een publieke sleutel (om te zien of de sleutel van een vriend veranderde) ───
export async function sleutelVingerafdruk(publicKeyB64) {
  return hex(await crypto.subtle.digest('SHA-256', b64NaarBuffer(publicKeyB64)))
}

// ─── Hulpfuncties ───
function bufferNaarB64(buffer) {
  // in stukjes: Safari kan hoogstens 65536 argumenten aan (een sticker met plaatje is groter)
  const b = new Uint8Array(buffer)
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192))
  return btoa(s)
}

function b64NaarBuffer(b64) {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ═══════════════════════════════════════════════════════════
// SLEUTELKLUIS — private key versleutelen met de herstelcode
// ═══════════════════════════════════════════════════════════

const HERSTEL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PBKDF2_RONDES = 600000

export function maakHerstelSleutel() {
  const deel = n => Array.from(
    crypto.getRandomValues(new Uint8Array(n)),
    b => HERSTEL_CHARS[b % HERSTEL_CHARS.length]
  ).join('')
  return 'FIBRO-' + deel(4) + '-' + deel(4) + '-' + deel(4)
}

export function normaliseerHerstelSleutel(invoer) {
  const schoon = (invoer || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const kern = schoon.startsWith('FIBRO') ? schoon.slice(5) : schoon
  if (kern.length !== 12) return null
  for (const c of kern) if (!HERSTEL_CHARS.includes(c)) return null
  return 'FIBRO-' + kern.slice(0,4) + '-' + kern.slice(4,8) + '-' + kern.slice(8,12)
}

async function leidKluisSleutelAf(code, salt) {
  const basis = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_RONDES, hash: 'SHA-256' },
    basis,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt','decrypt']
  )
}

export async function versleutelPrivateKey(privateKeyB64, herstelCode) {
  const code = normaliseerHerstelSleutel(herstelCode)
  if (!code) throw new Error('Ongeldige herstelsleutel')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await leidKluisSleutelAf(code, salt)
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(privateKeyB64)
  ))
  const alles = new Uint8Array(1 + 16 + 12 + ct.length)
  alles[0] = 1
  alles.set(salt, 1)
  alles.set(iv, 17)
  alles.set(ct, 29)
  return bufferNaarB64(alles.buffer)
}

export async function ontsleutelPrivateKey(blobB64, herstelCode) {
  const code = normaliseerHerstelSleutel(herstelCode)
  if (!code) throw new Error('Ongeldige herstelsleutel')
  const alles = new Uint8Array(b64NaarBuffer(blobB64))
  if (alles[0] !== 1) throw new Error('Onbekende kluisversie')
  const salt = alles.slice(1, 17)
  const iv = alles.slice(17, 29)
  const ct = alles.slice(29)
  const aesKey = await leidKluisSleutelAf(code, salt)
  try {
    const plat = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct)
    return new TextDecoder().decode(plat)
  } catch (e) {
    throw new Error('Herstelsleutel klopt niet')
  }
}

// ─── v1: gedeelde gesprekssleutel onthouden ───
// Uitrekenen (ECDH) is het dure deel; voor hetzelfde sleutelpaar is de uitkomst altijd gelijk.
const _aesCache = new Map()
function aesSleutelVoor(mijnPrivKeyB64, andermansPubKeyB64) {
    const k = mijnPrivKeyB64 + '|' + andermansPubKeyB64
    let p = _aesCache.get(k)
    if (!p) {
        p = (async () => {
            const priv = await importeerPrivateKey(mijnPrivKeyB64)
            const pub = await importeerPublicKey(andermansPubKeyB64)
            return leidAesAfVan(priv, pub)
        })()
        _aesCache.set(k, p)
        p.catch(() => _aesCache.delete(k))
    }
    return p
}
