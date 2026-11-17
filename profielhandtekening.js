// profielhandtekening.js (17 nov 2026, stap 1 van "profiel via vrienden", zie docs/profiel-via-vrienden.md)
//
// In gewone woorden: een profiel kan later via een gezamenlijke vriend bij je komen, als je de eigenaar zelf niet
// tegelijk online treft. Dan moet je zeker weten dat die tussenpersoon er niets aan veranderd heeft. Daarom zet de
// eigenaar een digitale handtekening onder een lijstje van zijn profielonderdelen:
//   { v: 1, eigenaar, versie (tijd in ms), items: { <onderdeel>: <SHA-256 van de inhoud> } }
// Elke ontvanger controleert de handtekening met de publieke sleutel van de eigenaar (profiles.public_key, dezelfde
// sleutel als de chat, met dezelfde vingerafdrukcontrole) en daarna van elk onderdeel de SHA-256.
//
// Welke sleutel: de bestaande P-256 sleutel van de chat (crypto.js). Die wordt hier als ECDSA-sleutel gebruikt
// (dezelfde kromme, dezelfde geheime waarde), zodat er geen nieuwe sleutel en geen nieuwe databasekolom nodig is, en
// herstel (Face ID / herstelsleutel) ook deze handtekening terugbrengt. Om verwarring met iets anders uit te sluiten
// begint wat ondertekend wordt altijd met 'fibro-profiel-v1|'.
//
// Dit bestand doet zelf niets met het netwerk of de opslag; sync.js gebruikt het (stap 3).

const CONTEXT = 'fibro-profiel-v1|'
const ONDERDEEL = /^[A-Za-z0-9_.:-]{1,80}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA = /^[0-9a-f]{64}$/
export const MAX_ONDERDELEN = 500
const TOEKOMST_MARGE = 10 * 60 * 1000 // een klok die iets voorloopt mag, een versie ver in de toekomst niet

const subtle = () => globalThis.crypto.subtle
function b64NaarBytes(b64) {
  const s = atob(b64); const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
  return b
}
function bytesNaarB64(buf) {
  const b = new Uint8Array(buf); let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192))
  return btoa(s)
}
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('')

// SHA-256 van een tekst (de inhoud van een onderdeel zoals de ontvanger hem bewaart), als 64 hex-tekens
export async function inhoudHash(tekst) {
  return hex(await subtle().digest('SHA-256', new TextEncoder().encode(String(tekst))))
}

// Altijd dezelfde tekst voor hetzelfde lijstje (sleutels gesorteerd), zodat ondertekenen en controleren kloppen
function vasteTekst(m) {
  const items = {}
  for (const k of Object.keys(m.items).sort()) items[k] = m.items[k]
  return CONTEXT + JSON.stringify({ v: 1, eigenaar: String(m.eigenaar).toLowerCase(), versie: m.versie, items })
}

function isGoedLijstje(m) {
  if (!m || typeof m !== 'object' || m.v !== 1) return false
  if (!UUID.test(String(m.eigenaar || ''))) return false
  if (!Number.isSafeInteger(m.versie) || m.versie <= 0) return false
  if (!m.items || typeof m.items !== 'object' || Array.isArray(m.items)) return false
  const keys = Object.keys(m.items)
  if (keys.length > MAX_ONDERDELEN) return false
  return keys.every(k => ONDERDEEL.test(k) && SHA.test(String(m.items[k])))
}

// Ondertekenen (op het toestel van de eigenaar). onderdelen: { naam: inhoud (tekst) }. Geeft het ondertekende lijstje.
export async function ondertekenProfiel({ eigenaar, privateKeyB64, onderdelen, versie = Date.now() }) {
  const items = {}
  for (const [k, inhoud] of Object.entries(onderdelen || {})) {
    if (!ONDERDEEL.test(k)) throw new Error('ongeldige onderdeelnaam: ' + k)
    items[k] = await inhoudHash(inhoud)
  }
  return ondertekenLijst({ eigenaar, privateKeyB64, items, versie })
}

// Hetzelfde, maar met de SHA-256 per onderdeel al uitgerekend (profielbundel.js onthoudt ze voor grote onderdelen)
export async function ondertekenLijst({ eigenaar, privateKeyB64, items, versie = Date.now() }) {
  const m = { v: 1, eigenaar: String(eigenaar).toLowerCase(), versie: Math.floor(versie), items: { ...(items || {}) } }
  if (!isGoedLijstje(m)) throw new Error('ongeldig profiel-lijstje')
  const sleutel = await subtle().importKey('pkcs8', b64NaarBytes(privateKeyB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, sleutel, new TextEncoder().encode(vasteTekst(m)))
  return { ...m, handtekening: bytesNaarB64(sig) }
}

// Controleren (op het toestel van de ontvanger). Geeft true alleen als alles klopt: het juiste formaat, de verwachte
// eigenaar, geen versie ver in de toekomst, en een geldige handtekening met de publieke sleutel van die eigenaar.
export async function controleerProfiel(m, { eigenaar, publicKeyB64, nu = Date.now() }) {
  try {
    if (!isGoedLijstje(m) || typeof m.handtekening !== 'string') return false
    if (String(m.eigenaar).toLowerCase() !== String(eigenaar || '').toLowerCase()) return false
    if (m.versie > nu + TOEKOMST_MARGE) return false
    const sleutel = await subtle().importKey('spki', b64NaarBytes(publicKeyB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    return await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, sleutel, b64NaarBytes(m.handtekening), new TextEncoder().encode(vasteTekst(m)))
  } catch (e) { return false }
}

// Klopt één onderdeel (de inhoud die een tussenpersoon stuurde) met het gecontroleerde lijstje?
export async function controleerOnderdeel(m, naam, inhoud) {
  if (!m || !m.items || !Object.prototype.hasOwnProperty.call(m.items, naam)) return false
  return (await inhoudHash(inhoud)) === m.items[naam]
}

// Is lijstje a nieuwer dan b (b mag ontbreken)? Een oudere versie wordt nooit aangenomen, ook niet als hij klopt.
export const isNieuwer = (a, b) => !!a && (!b || a.versie > b.versie)
