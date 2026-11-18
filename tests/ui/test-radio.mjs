// test-radio.mjs (18 nov 2026): de radio-widget (radio.js). Welke streams goed zijn (alleen https, niets in je eigen
// netwerk), wat er uit Radio Browser overblijft (werkend, https, MP3/AAC, geen HLS), dat zoeken alleen de servers van
// Radio Browser vraagt en geen "klik" stuurt, de huisregel, en dat de radio overal is aangesloten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const R = await import(new URL('../../radio.js', import.meta.url))

// ── streams ──
assert.equal(R.netteStream('https://icecast.omroep.nl/radio2-bb-mp3'), 'https://icecast.omroep.nl/radio2-bb-mp3')
assert.equal(R.netteStream('https://stream.zender.nl:8443/live#x'), 'https://stream.zender.nl:8443/live', 'poort mag, hekje weg')
for (const fout of ['http://zender.nl/live', 'https://localhost/s', 'https://router.local/s', 'https://192.168.1.1/s', 'https://10.0.0.5/s',
  'https://127.0.0.1/s', 'https://172.20.1.1/s', 'https://169.254.1.1/s', 'https://[::1]/s', 'https://u:p@zender.nl/s', 'javascript:alert(1)', '', 'x'.repeat(600)])
  assert.equal(R.netteStream(fout), null, fout.slice(0, 40))
assert.match(R.zenderUitLink('http://zender.nl/live', 'X').fout, /https/)
assert.ok(R.zenderUitLink('https://zender.nl/live', '  ').fout, 'naam nodig')
assert.deepEqual(R.zenderUitLink('https://zender.nl/live.mp3', '  Mijn   zender '), { naam: 'Mijn zender', url: 'https://zender.nl/live.mp3', land: '' })
console.log('PASS: alleen https-streams, niets in je eigen netwerk of met inlog')

// ── wat van een vriend komt ──
const cfg = R.normaliseer({ zenders: [
  { naam: 'NPO Radio 2', url: 'https://icecast.omroep.nl/radio2-bb-mp3', land: 'nl' },
  { naam: 'Kwaad', url: 'https://192.168.1.1/' }, { naam: '', url: 'https://a.nl/s' }, { naam: 'Dubbel', url: 'https://icecast.omroep.nl/radio2-bb-mp3' },
  ...Array.from({ length: 10 }, (_, i) => ({ naam: 'Z' + i, url: 'https://z' + i + '.nl/s', land: 'xyz' })),
] })
assert.equal(cfg.zenders.length, R.MAX_ZENDERS, 'hoogstens 6')
assert.deepEqual(cfg.zenders[0], { naam: 'NPO Radio 2', url: 'https://icecast.omroep.nl/radio2-bb-mp3', land: 'NL' })
assert.equal(cfg.zenders[1].land, '', 'rare landcode weg')
assert.equal(R.normaliseer({ zenders: [{ naam: 'X', url: 'http://x.nl' }] }), null)
assert.equal(R.normaliseer(null), null)
assert.equal(R.normaliseer({ zenders: 'x' }), null)
console.log('PASS: normaliseer: hoogstens 6 nette zenders, de rest valt weg')

// ── Radio Browser ──
const r = R.filterResultaten([
  { name: 'NPO Radio 2', url_resolved: 'https://icecast.omroep.nl/radio2-bb-mp3', codec: 'MP3', bitrate: 192, hls: 0, lastcheckok: 1, countrycode: 'NL' },
  { name: 'HLS', url_resolved: 'https://x.nl/a.m3u8', codec: 'AAC', hls: 1, lastcheckok: 1 },
  { name: 'Stil', url_resolved: 'https://x.nl/b', codec: 'MP3', hls: 0, lastcheckok: 0 },
  { name: 'Ogg', url_resolved: 'https://x.nl/c', codec: 'OGG', hls: 0, lastcheckok: 1 },
  { name: 'Http', url_resolved: 'http://x.nl/d', codec: 'MP3', hls: 0, lastcheckok: 1 },
  { name: 'Dubbel', url_resolved: 'https://icecast.omroep.nl/radio2-bb-mp3', codec: 'MP3', hls: 0, lastcheckok: 1 },
  { name: 'AAC+', url: 'https://x.nl/e', codec: 'aac+', hls: 0, lastcheckok: 1, bitrate: 64 },
])
assert.deepEqual(r.map(x => x.naam), ['NPO Radio 2', 'AAC+'], 'alleen werkend, https, MP3/AAC, geen HLS, geen dubbele')
const gevraagd = []
const nep = async (url, opties) => { gevraagd.push([url, opties.credentials, opties.referrerPolicy]); return { ok: true, json: async () => [{ name: 'Q', url_resolved: 'https://q.nl/s', codec: 'AAC', hls: 0, lastcheckok: 1, countrycode: 'NL' }] } }
const res = await R.zoekZenders({ land: 'nl', tag: 'News ' }, { fetch: nep })
assert.deepEqual(res, [{ naam: 'Q', url: 'https://q.nl/s', land: 'NL', codec: 'AAC', bitrate: 0 }])
const [url, cred, ref] = gevraagd[0]
const u = new URL(url)
assert.ok(R.ZOEK_SERVERS.includes(u.hostname) && u.pathname === '/json/stations/search', 'een server van Radio Browser')
assert.equal(u.searchParams.get('countrycode'), 'NL'); assert.equal(u.searchParams.get('tag'), 'news')
assert.equal(u.searchParams.get('is_https'), 'true'); assert.equal(u.searchParams.get('hidebroken'), 'true')
assert.equal(cred, 'omit'); assert.equal(ref, 'no-referrer')
let pogingen = 0
assert.equal(await R.zoekZenders({ naam: 'x' }, { fetch: async () => { pogingen++; throw new Error('weg') } }), null, 'geen server: null')
assert.equal(pogingen, R.ZOEK_SERVERS.length, 'alle servers geprobeerd')
assert.doesNotMatch(lees('radio.js'), /\/json\/url\//, 'geen "klik" naar Radio Browser: vrienden praten alleen met de zender')
console.log('PASS: Radio Browser: alleen goede streams, alleen hun servers, zonder cookies en referrer')

// ── de speler ──
const rj = lees('radio.js')
assert.equal((rj.match(/createElement\('audio'\)/g) || []).length, 1, 'één plek die de stream laadt')
assert.match(rj, /\/\/ Pas hier wordt er iets van buiten geladen\n    function speel\(\)/)
assert.match(rj, /audio\.preload = 'none'/)
assert.match(rj, /radio\.appendChild\(audio\)/, 'in de pagina: weg = stil')
assert.match(rj, /'fibro-spel-open' : 'fibro-spel-dicht'/, 'profielmuziek stil tijdens de radio')
assert.equal(R.vlag('NL'), '🇳🇱'); assert.equal(R.vlag(''), '📻')
console.log('PASS: de stream laadt pas na een tik, en de profielmuziek gaat even stil')

// ── huisregel ──
const csp = f => lees(f).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
const connect = csp('index.html').match(/connect-src ([^;]*);/)[1].split(' ')
assert.ok(R.ZOEK_SERVERS.every(s => connect.includes('https://' + s)), 'index.html: zoeken bij Radio Browser mag')
assert.doesNotMatch(csp('vriend-profiel.html'), /radio-browser/, 'vrienden zoeken niets')
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(csp(f), /media-src 'self' data: blob: https:;/, f + ': https-streams mogen spelen')
for (const f of ['chat.html', 'login.html']) assert.doesNotMatch(csp(f), /media-src[^;]*https:/, f + ': daar niet nodig')
console.log('PASS: de huisregel: zoeken alleen op Home, streams alleen https, alleen waar de radio staat')

// ── overal aangesloten ──
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null }
const S = await import(new URL('../../store.js', import.meta.url))
const item = S.STORE_WIDGETS.find(w => w.id === 'radio')
assert.ok(item && item.widget === 'radio' && item.w === 4 && item.h === 3 && S.STORE_ITEMS.includes(item))
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \[[^\]]*'radio'[^\]]*\]/)
assert.match(sync, /\['radio','radio_'\]/)
assert.match(lees('doorgeven.js'), /const KLEIN = \[[^\]]*'radio'[^\]]*\]/)
assert.match(lees('index.html'), /\{ id:'radio',\s+icon:'📻', titel:'Radio',\s+w:4, h:3 \}/)
assert.match(lees('index.html'), /\} else if \(id === 'radio'\) \{\n    renderRadio\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widgetRij-radio" style="display:none"/)
assert.match(lees('profiel.html'), /radio:\s+\{ id:'radio'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'radio'\) \{/)
assert.match(lees('vriend-profiel.html'), /cfg = R\.normaliseer\(JSON\.parse\(ruw\)\)/)
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/radio\.js\?v=1'\)/)
const en = lees('taal-en.js')
for (const t of ['Radio', 'Nog geen zender', item.uitleg, 'Uit de Store: internetradio, speelt pas na een tik', 'Nederland', 'Klassiek'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: de radio staat in de Store, op Home, bij vrienden, in Profiel en gaat mee via sync')
