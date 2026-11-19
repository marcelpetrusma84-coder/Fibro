// test-rsswidget.mjs (19 nov 2026): de RSS-widget (rsswidget.js) en de edge function rss-ophalen (feed.js, index.ts).
// Welke feed-adressen mogen (alleen https met een naam, niets in een eigen netwerk), wat er uit RSS en Atom overblijft
// (alleen tekst, links alleen http(s)), wat er van een vriend binnenkomt, het samenvoegen, de vraag aan de server, en
// dat de widget overal is aangesloten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const R = await import(new URL('../../rsswidget.js', import.meta.url))
const F = await import(new URL('../../supabase/functions/rss-ophalen/feed.js', import.meta.url))

// ── feed-adressen (de app en de server denken hetzelfde) ──
const goed = ['https://feeds.nos.nl/nosnieuwsalgemeen', 'https://www.nu.nl/rss/Algemeen', 'https://blog.voorbeeld.nl:443/feed.xml']
const fout = ['http://feeds.nos.nl/x', 'https://localhost/feed', 'https://router.local/rss', 'https://intranet/rss', 'https://192.168.1.1/rss',
  'https://10.0.0.5/rss', 'https://127.0.0.1/rss', 'https://169.254.169.254/latest', 'https://[::1]/rss', 'https://u:p@site.nl/rss',
  'https://site.nl:8443/rss', 'https://nas.home.arpa/rss', 'javascript:alert(1)', 'file:///etc/passwd', '', 'x'.repeat(600)]
for (const u of goed) { assert.ok(F.netteFeedUrl(u), u); assert.equal(R.netteFeedUrl(u), F.netteFeedUrl(u), u) }
for (const u of fout) { assert.equal(F.netteFeedUrl(u), null, 'server: ' + u.slice(0, 40)); assert.equal(R.netteFeedUrl(u), null, 'app: ' + u.slice(0, 40)) }
assert.equal(F.netteFeedUrl('https://site.nl/rss#boven'), 'https://site.nl/rss', 'hekje weg')
for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.0.1', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', 'onzin'])
  assert.equal(F.privéIp(ip), true, ip)
for (const ip of ['145.58.29.10', '8.8.8.8', '2a00:1450:4001::1', '::ffff:8.8.8.8']) assert.equal(F.privéIp(ip), false, ip)
console.log('PASS: alleen https-feeds met een naam, niets in een eigen netwerk (ook niet na het opzoeken van de naam)')

// ── RSS en Atom lezen ──
const rss = `<?xml version="1.0" encoding="UTF-8"?><!-- reclame --><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>NOS Nieuws</title><link>https://nos.nl/</link><image><title>logo</title></image>
<item><title><![CDATA[Kabinet & Kamer <b>eens</b>]]></title><link>https://nos.nl/artikel/1</link><pubDate>Wed, 18 Nov 2026 20:00:00 +0100</pubDate><description>&lt;p&gt;tekst&lt;/p&gt;</description></item>
<item><title>Caf&eacute; &#8216;De Zon&#8217; &amp;amp; meer</title><link>/artikel/2</link><dc:date>2026-11-18T10:00:00Z</dc:date></item>
<item><title>Kwaad</title><link>javascript:alert(1)</link></item>
<item><title>Via guid</title><guid isPermaLink="true">https://nos.nl/artikel/3</guid></item>
<item><title>Geen link</title><guid isPermaLink="false">abc-123</guid></item>
<item><title></title><link>https://nos.nl/leeg</link></item>
</channel></rss>`
const a = F.leesFeed(rss, 'https://feeds.nos.nl/nosnieuwsalgemeen')
assert.equal(a.titel, 'NOS Nieuws')
assert.deepEqual(a.berichten.map(b => b.titel), ['Kabinet & Kamer eens', 'Café ‘De Zon’ & meer', 'Via guid'], 'html weg, tekens ontcijferd, kwaad/leeg weg')
assert.deepEqual(a.berichten.map(b => b.link), ['https://nos.nl/artikel/1', 'https://nos.nl/artikel/2', 'https://nos.nl/artikel/3'], 'relatieve link via de site')
assert.equal(a.berichten[0].datum, Date.parse('2026-11-18T19:00:00Z'))
assert.equal(a.berichten[1].datum, Date.parse('2026-11-18T10:00:00Z'))
assert.equal(a.berichten[2].datum, 0)
const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title type="html">Mijn &lt;i&gt;blog&lt;/i&gt;</title>
<link rel="self" href="https://blog.nl/atom.xml"/><link href="https://blog.nl/"/>
<entry><title>Eerste</title><link rel="replies" href="https://blog.nl/1#reacties"/><link rel="alternate" type="text/html" href="https://blog.nl/1"/><updated>2026-11-17T08:00:00Z</updated></entry>
<entry><title>Tweede</title><link href='posts/2'/><published>2026-11-16T08:00:00Z</published></entry>
</feed>`
const b = F.leesFeed(atom, 'https://blog.nl/atom.xml')
assert.equal(b.titel, 'Mijn blog')
assert.deepEqual(b.berichten.map(x => [x.titel, x.link]), [['Eerste', 'https://blog.nl/1'], ['Tweede', 'https://blog.nl/posts/2']])
const rdf = `<rdf:RDF xmlns:rdf="x" xmlns="http://purl.org/rss/1.0/"><channel><title>Oud</title></channel><item rdf:about="x"><title>Een</title><link>https://oud.nl/1</link></item></rdf:RDF>`
assert.deepEqual(F.leesFeed(rdf, 'https://oud.nl/rss').berichten.map(x => x.titel), ['Een'], 'RSS 1.0')
assert.equal(F.leesFeed('<html><body>Geen feed</body></html>'), null)
assert.equal(F.leesFeed(null), null)
const veel = '<rss><channel><title>V</title>' + Array.from({ length: 40 }, (_, i) => `<item><title>T${i}</title><link>https://v.nl/${i}</link></item>`).join('') + '</channel></rss>'
assert.equal(F.leesFeed(veel, 'https://v.nl/').berichten.length, F.MAX_BERICHTEN)
assert.equal(F.tekstUit('x'.repeat(300)).length, 160)
assert.equal(F.tekstUit('a‮b\u0007c'), 'abc', 'geen rare stuurtekens')
assert.equal(F.tekenset('<?xml version="1.0" encoding="ISO-8859-1"?>'), 'iso-8859-1')
assert.equal(F.tekenset('<?xml version="1.0" encoding="raar"?>'), 'utf-8')
console.log('PASS: RSS 2.0, RSS 1.0 en Atom: alleen kop, link en datum, als platte tekst')

// ── van een vriend ──
const cfg = R.normaliseer({
  feeds: [{ url: 'https://feeds.nos.nl/nosnieuwsalgemeen', naam: ' NOS  Nieuws ' }, { url: 'http://oud.nl/rss' }, { url: 'https://192.168.1.1/x' },
    { url: 'https://feeds.nos.nl/nosnieuwsalgemeen' }, { url: 'https://www.nu.nl/rss/Algemeen' }, { url: 'https://a.nl/r' }, { url: 'https://b.nl/r' }],
  berichten: [
    { titel: 'Goed', link: 'https://nos.nl/1', datum: 5, feed: 0 }, { titel: 'Kwaad', link: 'javascript:alert(1)', feed: 0 },
    { titel: 'Te ver', link: 'https://x.nl/', feed: 7 }, { titel: '', link: 'https://x.nl/2', feed: 0 }, { titel: 'Dubbel', link: 'https://nos.nl/1', feed: 1 },
    ...Array.from({ length: 20 }, (_, i) => ({ titel: 'B' + i, link: 'https://nu.nl/' + i, datum: 'x', feed: 1 })),
  ], bijgewerkt: 123,
})
assert.deepEqual(cfg.feeds.map(f => f.naam), ['NOS Nieuws', 'nu.nl', 'a.nl'], 'hoogstens 3 nette feeds; zonder naam de site')
assert.equal(cfg.berichten.length, R.MAX_BERICHTEN)
assert.deepEqual(cfg.berichten[0], { titel: 'Goed', link: 'https://nos.nl/1', datum: 5, feed: 0 })
assert.equal(cfg.berichten[1].datum, 0, 'rare datum = 0')
assert.equal(cfg.bijgewerkt, 123)
assert.equal(R.normaliseer({ feeds: [{ url: 'http://x.nl/rss' }] }), null)
assert.equal(R.normaliseer(null), null)
assert.ok(JSON.stringify(R.normaliseer({ feeds: [{ url: 'https://a.nl/r' }], berichten: Array.from({ length: 12 }, (_, i) => ({ titel: 'x'.repeat(500), link: 'https://a.nl/' + 'y'.repeat(480) + i, feed: 0 })) })).length < 20000, 'past in sync (kleinMax)')
console.log('PASS: normaliseer: hoogstens 3 feeds en 12 nette koppen, de rest valt weg')

// ── samenvoegen ──
const feeds = [{ url: 'https://a.nl/r', naam: 'A' }, { url: 'https://b.nl/r', naam: 'B' }]
const oud = [{ titel: 'B-oud', link: 'https://b.nl/oud', datum: 50, feed: 1 }, { titel: 'A-oud', link: 'https://a.nl/oud', datum: 60, feed: 0 }]
const s = R.samenvoegen(feeds, [{ berichten: [{ titel: 'A1', link: 'https://a.nl/1', datum: 100 }, { titel: 'A-zonder', link: 'https://a.nl/z', datum: 0 }] }, null], oud)
assert.deepEqual(s.map(x => x.titel), ['A1', 'B-oud', 'A-zonder'], 'nieuwste eerst; mislukte feed houdt zijn oude koppen; zonder datum achteraan')
console.log('PASS: samenvoegen')

// ── de vraag aan de server ──
const gevraagd = []
const nep = antw => async (url, o) => { gevraagd.push([url, o]); return { ok: antw.ok !== false, json: async () => antw } }
let r = await R.maakOphaler(async () => 'PAS', { fetch: nep({ ok: true, titel: 'NOS', berichten: [] }) })('https://feeds.nos.nl/nosnieuwsalgemeen')
assert.deepEqual(r, { titel: 'NOS', berichten: [] })
const [url, o] = gevraagd[0]
assert.equal(url, R.FUNCTIE_URL); assert.equal(o.method, 'POST'); assert.equal(o.credentials, 'omit'); assert.equal(o.referrerPolicy, 'no-referrer')
assert.equal(o.headers.Authorization, 'Bearer PAS')
assert.deepEqual(JSON.parse(o.body), { url: 'https://feeds.nos.nl/nosnieuwsalgemeen' }, 'de link in de vraag, niet in het adres')
r = await R.maakOphaler(async () => 'PAS', { fetch: nep({ ok: false, reden: 'geen feed' }) })('https://a.nl/r'); assert.match(r.fout, /geen RSS-feed/)
r = await R.maakOphaler(async () => 'PAS', { fetch: nep({ ok: false, reden: 'niet bereikbaar' }) })('https://a.nl/r'); assert.match(r.fout, /niet te bereiken/)
r = await R.maakOphaler(async () => 'PAS', { fetch: async () => { throw new Error('weg') } })('https://a.nl/r'); assert.ok(r.fout)
const voor = gevraagd.length
r = await R.maakOphaler(async () => null, { fetch: nep({ ok: true, berichten: [] }) })('https://a.nl/r'); assert.ok(r.fout, 'niet ingelogd')
r = await R.maakOphaler(async () => 'PAS', { fetch: nep({ ok: true, berichten: [] }) })('https://192.168.1.1/'); assert.ok(r.fout)
assert.equal(gevraagd.length, voor, 'zonder pas of met een kwaad adres: niets gevraagd')
const rj = lees('rsswidget.js')
assert.equal((rj.match(/await f\(/g) || []).length, 1, 'één plek die iets ophaalt (de server van Stekky)')
assert.doesNotMatch(rj, /createElement\('(img|iframe|audio|video)'\)|innerHTML/, 'geen plaatjes of HTML van buiten')
assert.match(rj, /a\.rel = 'noopener noreferrer'/)
assert.equal(R.wanneer(0), ''); assert.equal(R.wanneer(1000, 1000 + 5 * 60000), '5 min geleden'); assert.equal(R.wanneer(0 + 1, 3 * 3600000), '2 uur geleden')
console.log('PASS: de app vraagt alleen de server van Stekky, met de inlogpas, zonder cookies en referrer')

// ── de edge function ──
const ts = lees('supabase/functions/rss-ophalen/index.ts')
assert.match(ts, /from "\.\/feed\.js"/)
assert.match(ts, /redirect: "manual"/, 'doorverwijzingen zelf nalopen')
assert.match(ts, /const nette = netteFeedUrl\(url\);\n\s+if \(!nette\)/, 'elke doorverwijzing opnieuw gecontroleerd')
assert.match(ts, /naamVeilig\(new URL\(nette\)\.hostname\)/, 'de naam opzoeken en kijken of hij naar een eigen netwerk wijst')
assert.match(ts, /auth\.getUser\(pas\)/); assert.match(ts, /geblokkeerd/); assert.match(ts, /teVeel\(uid\)/)
assert.match(ts, /MAX_BYTES = 2 \* 1024 \* 1024/); assert.match(ts, /AbortSignal\.timeout\(TIJD_MS\)/)
assert.match(ts, /ok: true, titel: r\.feed\.titel, berichten: r\.feed\.berichten/, 'alleen tekst terug')
assert.match(lees('supabase/config.toml'), /\[functions\.rss-ophalen\]/)
console.log('PASS: de edge function: ingelogd, https, geen eigen netwerk, 2 MB, 8 seconden, alleen tekst terug')

// ── huisregel: er hoeft niets bij ──
const csp = f => lees(f).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
for (const f of ['index.html', 'vriend-profiel.html']) {
  assert.match(csp(f), /connect-src 'self' https:\/\/qmgatbphiplrfxrljtbe\.supabase\.co /, f)
  assert.doesNotMatch(csp(f), /nos\.nl|nu\.nl/, f + ': geen nieuwssites in de huisregel')
}
console.log('PASS: de huisregel blijft zoals hij was')

// ── overal aangesloten ──
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null }
const S = await import(new URL('../../store.js', import.meta.url))
const item = S.STORE_WIDGETS.find(w => w.id === 'rss')
assert.ok(item && item.widget === 'rss' && item.w === 4 && item.h === 3 && S.STORE_ITEMS.includes(item))
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \[[^\]]*'rss'[^\]]*\]/)
assert.match(sync, /\['rss','rss_'\]/)
assert.match(lees('doorgeven.js'), /const KLEIN = \[[^\]]*'rss'[^\]]*\]/)
assert.match(lees('index.html'), /\{ id:'rss',\s+icon:'📰', titel:'RSS-feed',\s+w:4, h:3 \}/)
assert.match(lees('index.html'), /\} else if \(id === 'rss'\) \{\n    renderRss\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widgetRij-rss" style="display:none"/)
assert.match(lees('profiel.html'), /rss:\s+\{ id:'rss'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'rss'\) \{/)
assert.ok(lees('vriend-profiel.html').includes("R.tekenRssWidget(el.querySelector('.widget-inhoud'), { cfg })"))
assert.doesNotMatch(lees('vriend-profiel.html'), /maakOphaler|rss-ophalen/, 'bij een vriend: niets ophalen')
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/rsswidget\.js\?v=1'\)/)
const en = lees('taal-en.js')
for (const t of ['RSS-feed', 'Nog geen feed', item.uitleg, 'Uit de Store: de nieuwste koppen van je favoriete sites', 'Ophalen lukt nu niet. Probeer het later nog eens.', 'Bijgewerkt: {wanneer}'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: de RSS-widget staat in de Store, op Home, bij vrienden, in Profiel en gaat mee via sync')
