// Testprototype voor PrivacyLink; niet gekoppeld aan de echte Fibro-uitnodigingsknop.
const ENDPOINT = 'https://api.privacylink.nl/v1/secrets'
const GELDIGHEID = new Set(['1d', '7d', '14d'])

export async function maakPrivacyLink({ uitnodiging, apiKey, expiry = '1d', accessCode, emailAddress } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Een PrivacyLink API-sleutel is verplicht.')
  if (!GELDIGHEID.has(expiry)) throw new Error('Kies een geldigheid van 1d, 7d of 14d.')
  if (typeof uitnodiging !== 'string' || !uitnodiging.trim()) throw new Error('Een Fibro-uitnodigingslink is verplicht.')

  let url
  try { url = new URL(uitnodiging) } catch { throw new Error('De uitnodigingslink is geen geldig adres.') }
  const lokaal = ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'
  if ((url.protocol !== 'https:' && !lokaal) || !url.pathname.endsWith('/invite.html') || !url.searchParams.get('token')) {
    throw new Error('Gebruik een geldige Fibro-uitnodigingslink met token.')
  }
  if (accessCode !== undefined && (typeof accessCode !== 'string' || !accessCode.trim())) throw new Error('De toegangscode is ongeldig.')
  if (emailAddress !== undefined && (typeof emailAddress !== 'string' || !emailAddress.trim())) throw new Error('Het e-mailadres is ongeldig.')

  // Gebruik exact de ingevoerde URL: het fragment bevat de vingerafdruk van de uitnodiger.
  const payload = { message: uitnodiging, expiry }
  if (accessCode !== undefined) payload.accessCode = accessCode
  if (emailAddress !== undefined) payload.emailAddress = emailAddress

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey.trim()}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit', cache: 'no-store', redirect: 'error'
  })
  if (!response.ok) throw new Error(`PrivacyLink kon het geheim niet maken (HTTP ${response.status}).`)
  const data = await response.json()
  let link
  try { link = new URL(data.link) } catch { throw new Error('PrivacyLink gaf geen geldige link terug.') }
  if (link.protocol !== 'https:') throw new Error('PrivacyLink gaf geen beveiligde link terug.')
  return link.href
}
