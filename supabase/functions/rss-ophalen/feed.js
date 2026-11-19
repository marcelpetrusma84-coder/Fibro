// feed.js (19 nov 2026) - de rekenregels van de edge function rss-ophalen (index.ts), zonder Deno of internet.
// Zo kan Node ze testen (tests/ui/test-rsswidget.mjs).
//
// In gewone woorden:
//  - netteFeedUrl: alleen https-adressen op het gewone internet (geen inlog, geen rare poort, niets in een eigen netwerk)
//  - privéIp: is een IP-adres (na het opzoeken van de naam) iets van een eigen netwerk? Dan halen we niets op.
//  - leesFeed: haalt uit RSS (2.0 en 1.0) of Atom alleen de naam van de feed en per bericht de kop, de link en de datum.
//    Alle HTML gaat eruit; er gaat dus nooit HTML van de nieuwssite naar de app.

export const MAX_BERICHTEN = 20
const MAX_TITEL = 160
const MAX_LINK = 500

// Namen van een eigen netwerk of van het toestel zelf
function privéNaam(host) {
  const h = host.toLowerCase().replace(/\.$/, '')
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') ||
    h.endsWith('.lan') || h.endsWith('.home.arpa') || !h.includes('.')
}

// Een IPv4- of IPv6-adres dat niet op het gewone internet hoort
export function privéIp(ip) {
  const s = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '')
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  if (!s.includes(':')) return true // geen IP-adres: voor de zekerheid nee
  if (s === '::' || s === '::1') return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s)
  if (mapped) return privéIp(mapped[1])
  return /^(fc|fd|fe[89ab]|ff)/.test(s) || s.startsWith('64:ff9b:') || s.startsWith('2001:db8')
}

// Een feed-adres netjes maken. Geeft het adres of null.
export function netteFeedUrl(url) {
  if (typeof url !== 'string' || url.length > MAX_LINK) return null
  let u
  try { u = new URL(url.trim()) } catch (e) { return null }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null
  const host = u.hostname.toLowerCase()
  if (!host || privéNaam(host) || host.includes(':') || host.startsWith('[')) return null // geen IPv6-adressen
  if (/^[\d.]+$/.test(host)) return null // geen kale IP-adressen: een nieuwssite heeft een naam
  u.hash = ''
  return u.href
}

// Een link naar een artikel: http of https, zonder inlog. Relatieve links ten opzichte van de feed.
export function netteLink(link, basis) {
  if (typeof link !== 'string' || !link.trim() || link.length > MAX_LINK) return ''
  let u
  try { u = new URL(link.trim(), basis || undefined) } catch (e) { return '' }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !u.hostname) return ''
  return u.href.length > MAX_LINK ? '' : u.href
}

const NAMEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', euro: '€', eacute: 'é', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü',
  egrave: 'è', agrave: 'à', ccedil: 'ç', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', middot: '·' }
function ontcijfer(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, k) => {
    if (k[0] === '#') {
      const n = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n < 0xe000) ? String.fromCodePoint(n) : ''
    }
    const v = NAMEN[k.toLowerCase()]
    return v == null ? m : v
  })
}

// Platte tekst uit een stukje XML: CDATA open, tags eruit, tekens ontcijferd (twee keer: veel feeds coderen dubbel)
export function tekstUit(s, max = MAX_TITEL) {
  let t = String(s == null ? '' : s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  t = ontcijfer(t.replace(/<[^>]*>/g, ' '))
  t = ontcijfer(t.replace(/<[^>]*>/g, ' ')) // stond er &lt;b&gt; in, dan is dat nu ook weg
  // eslint-disable-next-line no-control-regex
  t = t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
  t = t.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

const esc = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// De inhoud van het eerste <naam>...</naam> (ook met voorvoegsel, zoals dc:date)
function binnen(xml, naam) {
  const m = new RegExp('<' + esc(naam) + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc(naam) + '\\s*>', 'i').exec(xml)
  return m ? m[1] : ''
}
function attr(tag, naam) {
  const m = new RegExp('\\s' + naam + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag)
  return m ? ontcijfer(m[2] != null ? m[2] : m[3]) : ''
}
function datumUit(stuk) {
  for (const n of ['pubDate', 'dc:date', 'published', 'updated', 'issued', 'modified']) {
    const t = tekstUit(binnen(stuk, n), 80)
    if (!t) continue
    const d = Date.parse(t)
    if (Number.isFinite(d) && d > 0) return d
  }
  return 0
}
function atomLink(stuk) {
  let reserve = ''
  for (const m of stuk.matchAll(/<link\b[^>]*>/gi)) {
    const href = attr(m[0], 'href'), rel = attr(m[0], 'rel').toLowerCase()
    if (!href) continue
    if (!rel || rel === 'alternate') return href
    if (!reserve && rel !== 'self' && rel !== 'enclosure' && rel !== 'replies') reserve = href
  }
  return reserve
}

// Uit de tekst van een feed: { titel, berichten: [{ titel, link, datum }] } of null als het geen feed is
export function leesFeed(xml, feedUrl = '') {
  if (typeof xml !== 'string') return null
  const s = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  const atom = /<feed\b[^>]*>/i.test(s) && !/<rss\b|<rdf:RDF\b/i.test(s)
  const tag = atom ? 'entry' : 'item'
  if (!atom && !/<(rss|rdf:RDF|channel)\b/i.test(s)) return null
  const eerste = s.search(new RegExp('<' + tag + '\\b', 'i'))
  const kop = eerste >= 0 ? s.slice(0, eerste) : s
  const titel = tekstUit(binnen(kop, 'title'), 60)
  const basis = (atom ? atomLink(kop) : tekstUit(binnen(kop, 'link'), MAX_LINK)) || feedUrl
  const berichten = []
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '\\s*>', 'gi')
  for (const m of s.matchAll(re)) {
    const stuk = m[1]
    const t = tekstUit(binnen(stuk, 'title'))
    let ruweLink = atom ? atomLink(stuk) : tekstUit(binnen(stuk, 'link'), MAX_LINK)
    if (!ruweLink && !atom) {
      const g = /<guid\b([^>]*)>([\s\S]*?)<\/guid\s*>/i.exec(stuk)
      if (g && !/isPermaLink\s*=\s*["']false/i.test(g[1])) ruweLink = tekstUit(g[2], MAX_LINK)
    }
    const link = netteLink(ruweLink, netteLink(basis, feedUrl) || feedUrl || undefined)
    if (!t || !link) continue
    berichten.push({ titel: t, link, datum: datumUit(stuk) })
    if (berichten.length >= MAX_BERICHTEN) break
  }
  return { titel, berichten }
}

// Welke tekenset staat er bovenaan de XML (encoding="...")? Anders utf-8.
export function tekenset(begin) {
  const m = /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.-]{1,30})["']/i.exec(begin || '')
  const e = m ? m[1].toLowerCase() : 'utf-8'
  return ['utf-8', 'utf8', 'iso-8859-1', 'iso-8859-15', 'windows-1252', 'latin1', 'us-ascii'].includes(e) ? e : 'utf-8'
}
