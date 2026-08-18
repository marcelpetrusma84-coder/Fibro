// crypto.js — Fibro E2E encryptie via Web Crypto API (ECDH + AES-GCM)

const SLEUTEL_PREFIX = 'fibro_privkey_'

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
async function importeerPrivateKey(b64) {
  const raw = b64NaarBuffer(b64)
  return crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  )
}

// ─── Afleiden van gedeelde AES sleutel via ECDH ───
async function leidAesAfVan(privateKey, publicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ─── Versleutel een bericht (plaintext string → base64 blob) ───
export async function versleutel(plaintext, mijnPrivKeyB64, ontvangerPubKeyB64) {
  try {
    const mijnPrivKey = await importeerPrivateKey(mijnPrivKeyB64)
    const ontvangerPubKey = await importeerPublicKey(ontvangerPubKeyB64)
    const aesKey = await leidAesAfVan(mijnPrivKey, ontvangerPubKey)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoded
    )

    // Combineer IV + ciphertext → base64
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.byteLength)
    return 'e2e:' + bufferNaarB64(combined)
  } catch (e) {
    console.error('Versleutelen mislukt:', e)
    throw new Error('Versleutelen mislukt')
  }
}

// ─── Ontsleutel een bericht (base64 blob → plaintext string) ───
export async function ontsleutel(blob, mijnPrivKeyB64, afzenderPubKeyB64) {
  if (!blob.startsWith('e2e:')) return blob // Niet versleuteld (oud bericht)
  try {
    const mijnPrivKey = await importeerPrivateKey(mijnPrivKeyB64)
    const afzenderPubKey = await importeerPublicKey(afzenderPubKeyB64)
    const aesKey = await leidAesAfVan(mijnPrivKey, afzenderPubKey)

    const combined = b64NaarBuffer(blob.replace('e2e:', ''))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    )
    return new TextDecoder().decode(decrypted)
  } catch (e) {
    console.error('Ontsleutelen mislukt:', e)
    return '🔒 [versleuteld bericht — kan niet lezen]'
  }
}

// ─── Hulpfuncties ───
function bufferNaarB64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function b64NaarBuffer(b64) {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
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

export async function hashHerstelSleutel(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('')
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
