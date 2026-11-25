// regels.js (25 nov 2026) - de controles van de edge function fediverse (index.ts), los zodat Node ze kan testen.
//
// In gewone woorden: wat mag de functie doorsturen naar iemands eigen fediverse-server (Mastodon en servers die net zo
// werken), en wat geeft hij terug? Alles wat binnenkomt wordt hier gecontroleerd; alles wat teruggaat wordt hier
// klein gemaakt (alleen de paar velden die de app nodig heeft, nooit een heel antwoord van de server).

// De PeerTube-servers die de app toelaat (dezelfde lijst als SERVERS in peertube.js; een test controleert dat).
export const PEERTUBE = ['framatube.org', 'tilvids.com', 'video.blender.org', 'tube.tchncs.de', 'diode.zone',
  'spectra.video', 'makertube.net', 'peertube.beeldengeluid.nl']

// Wat de inlogsleutel mag: zoeken, liken en reageren. Geen privéberichten lezen, geen volgers beheren.
export const SCOPES = 'read:search read:accounts read:statuses write:favourites write:statuses'
export const MAX_TEKST = 500
export const APP_NAAM = 'Stekky'
export const WEBSITE = 'https://marcelpetrusma84-coder.github.io/Fibro/'

// Waar de server na het inloggen naar terugstuurt: alleen de echte app en de testversies op Netlify.
const TERUG = [
  /^https:\/\/marcelpetrusma84-coder\.github\.io\/Fibro\/fediverse-terug\.html$/,
  /^https:\/\/(deploy-preview-\d{1,5}--)?stately-llama-4b380e\.netlify\.app\/(Fibro\/)?fediverse-terug\.html$/,
]
export const goedTerugAdres = s => typeof s === 'string' && s.length < 200 && TERUG.some(r => r.test(s))

const PRIVE_NAAM = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa|onion)$/
// Een fediverse-server: alleen een gewone naam (geen IP-adres, geen poort, geen pad). Geeft de nette naam of null.
export function netteServer(s) {
  if (typeof s !== 'string') return null
  let t = s.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/+$/, '')
  if (t.startsWith('@')) t = t.split('@').pop() // @naam@server
  if (!t || t.length > 120 || !/^[a-z0-9.-]+$/.test(t)) return null
  if (!t.includes('.') || t.startsWith('.') || t.endsWith('.') || t.includes('..') || /^[\d.]+$/.test(t)) return null
  if (t.split('.').some(d => !d || d.length > 63 || d.startsWith('-') || d.endsWith('-'))) return null
  if (PRIVE_NAAM.test(t)) return null
  return t
}

// Is dit IP-adres van een eigen netwerk? (Dan nooit ophalen.)
export function privéIp(ip) {
  const s = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '')
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  if (!s.includes(':')) return true
  if (s === '::' || s === '::1') return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s)
  if (mapped) return privéIp(mapped[1])
  return /^(fc|fd|fe[89ab]|ff)/.test(s) || s.startsWith('64:ff9b:') || s.startsWith('2001:db8')
}

// Een link naar een video op een goedgekeurde PeerTube-server, zoals de app hem maakt. Geeft de nette link of null.
const VIDEO_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[1-9A-HJ-NP-Za-km-z]{16,24})$/i
export function netteVideo(s) {
  if (typeof s !== 'string' || s.length > 200) return null
  let u
  try { u = new URL(s) } catch (e) { return null }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash) return null
  if (!PEERTUBE.includes(u.hostname)) return null
  const m = /^\/videos\/watch\/([^/]+)$/.exec(u.pathname) || /^\/w\/([^/]+)$/.exec(u.pathname)
  if (!m || !VIDEO_ID.test(m[1])) return null
  return 'https://' + u.hostname + '/videos/watch/' + m[1]
}

// Kleine controles
export const goedStatusId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s)
export const goedeSleutel = s => typeof s === 'string' && s.length >= 8 && s.length <= 512 && /^[A-Za-z0-9._~+/=-]+$/.test(s)
export const goedeCode = goedeSleutel
export const goedeVerifier = s => typeof s === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(s)
export function netteTekst(s) {
  if (typeof s !== 'string') return null
  const t = s.replace(/\r\n?/g, '\n').trim()
  if (!t || [...t].length > MAX_TEKST) return null
  return t
}
// De naam van het kanaal (acct uit Mastodon): naam of naam@server. Alleen nette tekens.
export const goedAcct = s => typeof s === 'string' && /^[A-Za-z0-9_.-]{1,64}(@[a-z0-9.-]{3,120})?$/.test(s)
// Een reactie begint met @kanaal, zodat de maker van de video hem echt krijgt (zoals Mastodon zelf ook doet).
export function metVermelding(tekst, acct) {
  if (!goedAcct(acct)) return tekst
  const naam = '@' + acct
  return tekst.toLowerCase().includes(naam.toLowerCase()) ? tekst : naam + ' ' + tekst
}

// Alleen deze velden gaan terug naar de app
const tal = n => Number.isInteger(n) && n >= 0 ? n : 0
const kort = (s, max) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''
export function klein(soort, d) {
  if (!d || typeof d !== 'object') return null
  if (soort === 'app') return typeof d.client_id === 'string' && typeof d.client_secret === 'string' &&
    goedeSleutel(d.client_id) && goedeSleutel(d.client_secret) ? { client_id: d.client_id, client_secret: d.client_secret } : null
  if (soort === 'token') return goedeSleutel(d.access_token) ? { token: d.access_token } : null
  if (soort === 'ik') return typeof d.acct === 'string' ? { acct: kort(d.acct, 120), naam: kort(d.display_name || d.username || '', 60) } : null
  if (soort === 'status') {
    if (!goedStatusId(d.id)) return null
    const acct = d.account && goedAcct(d.account.acct) ? d.account.acct : ''
    return { id: d.id, favoriet: d.favourited === true, likes: tal(d.favourites_count), reacties: tal(d.replies_count), acct }
  }
  if (soort === 'zoek') {
    const s = d && Array.isArray(d.statuses) ? d.statuses[0] : null
    return s ? klein('status', s) : { geen: true }
  }
  return null
}
