// passkey-kluis.js - dichte doos: de geheime sleutel versleuteld met een passkey-geheim (WebAuthn PRF)
// De server bewaart alleen de doos (tabel passkey_kluis). Openen kan alleen met de passkey
// (Face ID, vingerafdruk of toestelpincode). Gezicht en vingerafdruk verlaten het toestel nooit.
// Alle functies krijgen de Supabase-client mee (sb), zodat elke pagina zijn eigen client kan gebruiken.

const TABEL = 'passkey_kluis'
const INFO = new TextEncoder().encode('fibro-passkey-kluis-v2')
const WACHTTIJD = 120000

function fout(code, tekst) {
  const e = new Error(tekst)
  e.code = code
  return e
}

function b64url(buf) {
  const b = new Uint8Array(buf); let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function vanB64url(t) {
  t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='
  const s = atob(t), b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
  return b
}
function vanB64(t) {
  const s = atob(String(t).trim()), b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
  return b
}
function willekeurig(n) { return crypto.getRandomValues(new Uint8Array(n)) }

function prfUit(cred) {
  const ext = cred && cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}
  const first = ext && ext.prf && ext.prf.results && ext.prf.results.first
  return first ? new Uint8Array(first) : null
}

async function aesSleutel(geheim, zout) {
  const basis = await crypto.subtle.importKey('raw', geheim, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: zout, info: INFO },
    basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

function leesBlob(tekst) {
  try {
    const b = JSON.parse(tekst)
    if (b && b.v === 2 && b.z && b.iv && b.ct) return b
  } catch (e) {}
  return null
}

// --- Wat kan dit toestel? ---
export async function passkeyStatus() {
  const s = { passkeys: false, ingebouwd: false, prf: null }
  if (!window.PublicKeyCredential || !navigator.credentials) return s
  s.passkeys = true
  try { s.ingebouwd = !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) } catch (e) {}
  try {
    if (PublicKeyCredential.getClientCapabilities) {
      const c = await PublicKeyCredential.getClientCapabilities()
      if (c && 'extension:prf' in c) s.prf = !!c['extension:prf']
    }
  } catch (e) {}
  return s
}

// Korte naam voor dit toestel, zodat je in de lijst ziet welke doos waar gemaakt is
export function toestelNaam() {
  const ua = navigator.userAgent || ''
  let t = 'Toestel'
  if (/iPhone/.test(ua)) t = 'iPhone'
  else if (/iPad/.test(ua)) t = 'iPad'
  else if (/Android/.test(ua)) t = 'Android'
  else if (/Windows/.test(ua)) t = 'Windows-pc'
  else if (/Mac OS X/.test(ua)) t = 'Mac'
  else if (/Linux/.test(ua)) t = 'Linux-pc / Deck'
  let b = ''
  if (/CriOS|Chrome\//.test(ua) && !/Edg/.test(ua)) b = 'Chrome'
  else if (/FxiOS|Firefox\//.test(ua)) b = 'Firefox'
  else if (/Edg/.test(ua)) b = 'Edge'
  else if (/Safari\//.test(ua)) b = 'Safari'
  return (b ? t + ' (' + b + ')' : t).slice(0, 60)
}

// --- Dozen van dit account ---
export async function lijstDozen(sb, userId) {
  const { data, error } = await sb.from(TABEL)
    .select('cred_id, naam, gemaakt_op, blob')
    .eq('user_id', userId)
    .order('gemaakt_op', { ascending: true })
  if (error) throw fout('ophalen', 'Dozen ophalen mislukt: ' + error.message)
  return (data || []).filter(r => leesBlob(r.blob))
}

export async function verwijderDoos(sb, userId, credId) {
  const { error } = await sb.from(TABEL).delete().eq('user_id', userId).eq('cred_id', credId)
  if (error) throw fout('weggooien', 'Weggooien mislukt: ' + error.message)
}

// --- Doos maken: nieuwe passkey + geheime sleutel erin ---
export async function maakDoos(sb, { userId, gebruikersnaam, privateKeyB64 }) {
  if (!userId) throw fout('niet-ingelogd', 'Niet ingelogd')
  if (!privateKeyB64) throw fout('geen-sleutel', 'Geen sleutel op dit toestel')
  const bestaand = await lijstDozen(sb, userId)
  const zout = willekeurig(32)
  const naam = String(gebruikersnaam || 'Fibro').slice(0, 60)
  let cred
  try {
    cred = await navigator.credentials.create({ publicKey: {
      rp: { name: 'Fibro' },
      user: { id: new TextEncoder().encode(userId), name: naam, displayName: 'Fibro - ' + naam },
      challenge: willekeurig(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      excludeCredentials: bestaand.map(r => ({ type: 'public-key', id: vanB64url(r.cred_id) })),
      timeout: WACHTTIJD,
      extensions: { prf: { eval: { first: zout } } }
    } })
  } catch (e) {
    if (e && e.name === 'InvalidStateError') throw fout('bestaat-al', 'Voor dit account bestaat hier al een Fibro-passkey')
    if (e && e.name === 'NotAllowedError') throw fout('geannuleerd', 'Geannuleerd of niet toegestaan')
    throw e
  }
  const credId = b64url(cred.rawId)
  let geheim = prfUit(cred)
  if (!geheim) {
    const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}
    if (ext && ext.prf && ext.prf.enabled === false) throw fout('geen-prf', 'Deze passkey kan geen geheim geven (PRF)')
    // Sommige browsers geven het geheim pas bij het ophalen
    let g
    try {
      g = await navigator.credentials.get({ publicKey: {
        challenge: willekeurig(32),
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(cred.rawId) }],
        userVerification: 'required',
        timeout: WACHTTIJD,
        extensions: { prf: { eval: { first: zout } } }
      } })
    } catch (e) {
      if (e && e.name === 'NotAllowedError') throw fout('geannuleerd', 'Geannuleerd of niet toegestaan')
      throw e
    }
    geheim = prfUit(g)
    if (!geheim) throw fout('geen-prf', 'Deze browser of passkey kan geen geheim geven (PRF)')
  }
  const iv = willekeurig(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesSleutel(geheim, zout),
    new TextEncoder().encode(privateKeyB64))
  const blob = JSON.stringify({ v: 2, z: b64url(zout), iv: b64url(iv), ct: b64url(ct) })
  const { error } = await sb.from(TABEL)
    .upsert({ user_id: userId, cred_id: credId, blob, naam: toestelNaam() }, { onConflict: 'user_id,cred_id' })
  if (error) throw fout('opslaan', 'Doos opslaan mislukt: ' + error.message)
  return { credId }
}

// --- Doos openen: kies een passkey van dit account, krijg de geheime sleutel terug ---
export async function openDoos(sb, userId) {
  if (!userId) throw fout('niet-ingelogd', 'Niet ingelogd')
  const dozen = await lijstDozen(sb, userId)
  if (!dozen.length) throw fout('geen-doos', 'Er is nog geen Face ID-herstel voor dit account')
  const perCred = {}
  const toegestaan = []
  for (const r of dozen) {
    const b = leesBlob(r.blob)
    perCred[r.cred_id] = { first: vanB64url(b.z) }
    toegestaan.push({ type: 'public-key', id: vanB64url(r.cred_id) })
  }
  let cred
  try {
    cred = await navigator.credentials.get({ publicKey: {
      challenge: willekeurig(32),
      allowCredentials: toegestaan,
      userVerification: 'required',
      timeout: WACHTTIJD,
      extensions: { prf: { evalByCredential: perCred } }
    } })
  } catch (e) {
    if (e && e.name === 'NotAllowedError') throw fout('geannuleerd', 'Geannuleerd of niet toegestaan')
    throw e
  }
  const credId = b64url(cred.rawId)
  const rij = dozen.find(r => r.cred_id === credId)
  if (!rij) throw fout('onbekend', 'Deze passkey hoort niet bij dit account')
  const geheim = prfUit(cred)
  if (!geheim) throw fout('geen-prf', 'Deze browser gaf geen geheim terug (PRF)')
  const b = leesBlob(rij.blob)
  let plat
  try {
    plat = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vanB64url(b.iv) },
      await aesSleutel(geheim, vanB64url(b.z)), vanB64url(b.ct))
  } catch (e) {
    throw fout('kapot', 'De doos kon niet worden geopend')
  }
  return { privateKeyB64: new TextDecoder().decode(plat), credId, naam: rij.naam }
}

// --- Controle: hoort deze geheime sleutel bij de openbare sleutel in het profiel? ---
export async function sleutelPastBij(privateKeyB64, publicKeyB64) {
  if (!privateKeyB64 || !publicKeyB64) return false
  let priv, pub
  try { priv = vanB64(privateKeyB64); pub = vanB64(publicKeyB64) } catch (e) { return false }
  for (const curve of ['P-256', 'P-384', 'P-521']) {
    try {
      const k = await crypto.subtle.importKey('pkcs8', priv, { name: 'ECDH', namedCurve: curve }, true, ['deriveKey', 'deriveBits'])
      const p = await crypto.subtle.importKey('spki', pub, { name: 'ECDH', namedCurve: curve }, true, [])
      const jk = await crypto.subtle.exportKey('jwk', k)
      const jp = await crypto.subtle.exportKey('jwk', p)
      return !!jk.x && jk.x === jp.x && jk.y === jp.y
    } catch (e) {}
  }
  return false
}
