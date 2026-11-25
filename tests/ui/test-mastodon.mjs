// test-mastodon.mjs (19 nov 2026): de Mastodon-widget (mastodon.js) en wat de server (feed.js v3) uit een Mastodon-feed
// haalt. De privacyregels: alleen meelezen (geen inloggen, alleen de openbare feed), gevoelige plaatjes en berichten met
// een waarschuwing krijgen geen plaatje, CW eerst, alleen links naar de server van het account, en overal aangesloten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const M = await import(new URL('../../mastodon.js', import.meta.url))
const F = await import(new URL('../../supabase/functions/rss-ophalen/feed.js', import.meta.url))

// ── wat de server uit een Mastodon-feed haalt ──
const FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:webfeeds="http://webfeeds.org/rss/1.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<title>Marcel 🐘</title><description>Openbare berichten van @marcel@mastodon.social</description><link>https://mastodon.social/@marcel</link>
<image><url>https://files.mastodon.social/accounts/avatars/1/original/a.png</url><title>Marcel</title><link>https://mastodon.social/@marcel</link></image>
<item><guid isPermaLink="true">https://mastodon.social/@marcel/1</guid><link>https://mastodon.social/@marcel/1</link><pubDate>Wed, 18 Nov 2026 10:00:00 +0000</pubDate>
<description>&lt;p&gt;Hallo &lt;a href="https://mastodon.social/tags/stekky" class="mention hashtag"&gt;#&lt;span&gt;stekky&lt;/span&gt;&lt;/a&gt;!&lt;/p&gt;&lt;p&gt;Tweede alinea&lt;br /&gt;regel&lt;/p&gt;</description>
<media:content url="https://files.mastodon.social/media_attachments/files/1/original/foto.jpg" type="image/jpeg" fileSize="900000" medium="image"><media:rating scheme="urn:simple">nonadult</media:rating><media:description type="plain">alt</media:description></media:content></item>
<item><guid isPermaLink="true">https://mastodon.social/@marcel/2</guid><link>https://mastodon.social/@marcel/2</link><pubDate>Wed, 18 Nov 2026 09:00:00 +0000</pubDate>
<description>&lt;p&gt;&lt;strong&gt;Inhoudswaarschuwing:&lt;/strong&gt; spoilers film&lt;/p&gt;&lt;hr /&gt;&lt;p&gt;De dader is de butler&lt;/p&gt;</description>
<media:content url="https://files.mastodon.social/x/original/b.jpg" type="image/jpeg" medium="image"><media:rating scheme="urn:simple">adult</media:rating></media:content></item>
<item><guid isPermaLink="true">https://mastodon.social/@marcel/3</guid><link>https://mastodon.social/@marcel/3</link><pubDate>Wed, 18 Nov 2026 08:00:00 +0000</pubDate>
<description>&lt;p&gt;Zonder waarschuwing, wel gevoelig&lt;/p&gt;</description>
<media:content url="https://files.mastodon.social/x/original/c.jpg" type="image/jpeg" medium="image"><media:rating scheme="urn:simple">adult</media:rating></media:content></item>
<item><guid isPermaLink="true">https://mastodon.social/@marcel/4</guid><link>https://mastodon.social/@marcel/4</link><pubDate>Wed, 18 Nov 2026 07:00:00 +0000</pubDate>
<description>&lt;p&gt;Een gifje&lt;/p&gt;</description>
<media:content url="https://files.mastodon.social/x/original/d.mp4" type="video/mp4" medium="image"><media:rating scheme="urn:simple">nonadult</media:rating></media:content></item>
</channel></rss>`
const f = F.leesFeed(FEED, 'https://mastodon.social/@marcel.rss')
assert.equal(f.titel, 'Marcel 🐘')
assert.equal(f.afbeelding, 'https://files.mastodon.social/accounts/avatars/1/original/a.png', 'de profielfoto')
assert.equal(f.link, 'https://mastodon.social/@marcel')
const [b1, b2, b3, b4] = f.berichten
assert.equal(b1.inhoud, 'Hallo #stekky!\n\nTweede alinea\nregel', 'berichten zonder kop: de tekst, met alinea\'s; #stekky aan elkaar')
assert.equal(b1.titel, 'Hallo #stekky! Tweede alinea regel')
assert.equal(b1.plaatje, 'https://files.mastodon.social/media_attachments/files/1/original/foto.jpg')
assert.equal(b2.cw, 'spoilers film'); assert.equal(b2.titel, 'spoilers film', 'de kop is de waarschuwing, nooit de tekst erachter')
assert.equal(b2.inhoud, 'De dader is de butler'); assert.equal(b2.gevoelig, true); assert.equal(b2.plaatje, '', 'CW: geen plaatje-adres')
assert.equal(b3.gevoelig, true); assert.equal(b3.plaatje, '', 'gevoelig: geen plaatje-adres'); assert.equal(b3.plaatjeGroot, '')
assert.equal(b4.plaatje, '', 'een video is geen plaatje')
// een gewone RSS-feed blijft zoals hij was (met kop: geen inhoud-veld)
const gewoon = F.leesFeed('<rss><channel><title>N</title><item><title>Kop</title><link>https://n.nl/1</link><description>Tekst</description></item></channel></rss>', 'https://n.nl/rss')
assert.equal(gewoon.berichten[0].inhoud, undefined); assert.equal(gewoon.berichten[0].tekst, 'Tekst')
assert.equal(F.tekstUit('<p>Een <a href="x">#<span>tag</span></a> en <strong>vet</strong></p><p>Twee</p>'), 'Een #tag en vet Twee')
console.log('PASS: server: tekst zonder kop, CW apart, gevoelig = geen plaatje, geen video, profielfoto en link')

// ── het account ──
for (const [in_, uit] of [['@marcel@mastodon.social', 'marcel@mastodon.social'], ['marcel@Mastodon.Social', 'marcel@mastodon.social'],
  ['https://mastodon.social/@marcel', 'marcel@mastodon.social'], ['mastodon.social/@marcel/', 'marcel@mastodon.social'], ['@a_b9@social.vivaldi.net', 'a_b9@social.vivaldi.net']]) {
  const a = M.leesAccount(in_)
  assert.ok(a, in_); assert.equal(a.naam + '@' + a.server, uit, in_)
}
for (const fout of ['', 'marcel', '@marcel', '@mar cel@x.nl', '@marcel@localhost', '@marcel@192.168.1.1', '@marcel@nas.local', 'http://mastodon.social/@marcel',
  '@marcel@x.nl/../evil', 'javascript:alert(1)', '@' + 'a'.repeat(31) + '@x.nl', '@marcel@-x.nl'])
  assert.equal(M.leesAccount(fout), null, 'geweigerd: ' + fout)
const acc = M.leesAccount('@marcel@mastodon.social')
assert.equal(M.feedUrl(acc), 'https://mastodon.social/@marcel.rss', 'alleen de openbare feed')
assert.equal(M.profielUrl(acc), 'https://mastodon.social/@marcel')
assert.equal(M.handle(acc), '@marcel@mastodon.social')
assert.equal(M.kleinPlaatje('https://files.mastodon.social/media_attachments/files/1/original/foto.jpg'), 'https://files.mastodon.social/media_attachments/files/1/small/foto.jpg', 'de kleine versie: lichter voor de server')
assert.equal(M.kleinPlaatje('https://cdn.x.nl/a.jpg'), 'https://cdn.x.nl/a.jpg')
console.log('PASS: het account: @naam@server of profiel-link; nooit een eigen netwerk; alleen de openbare feed')

// ── van de server naar de widget, en van een vriend ──
const ber = M.berichtenUit({ berichten: f.berichten })
assert.deepEqual(ber.map(x => [x.tekst.slice(0, 12), x.cw || '']), [['Hallo #stekk', ''], ['De dader is ', 'spoilers film'], ['Zonder waars', ''], ['Een gifje', '']])
const cfg = M.normaliseer({ account: { naam: 'marcel', server: 'mastodon.social' }, profiel: { naam: ' Marcel‮ ', vak: 0 }, fotoId: 'abc1', berichten: [
  { tekst: 'Een\n\n\n\nTwee', link: 'https://mastodon.social/@marcel/1', datum: 5, vak: 1 },
  { tekst: 'Elders', link: 'https://evil.example/@marcel/2' },
  { tekst: 'Kwaad', link: 'javascript:alert(1)' },
  { tekst: 'Geheim', cw: 'let op', link: 'https://mastodon.social/@marcel/3', vak: 2 },
  { tekst: 'Vak klopt niet', link: 'https://mastodon.social/@marcel/4', vak: 7 },
  ...Array.from({ length: 10 }, (_, i) => ({ tekst: 'B' + i, link: 'https://mastodon.social/@marcel/x' + i })),
] })
assert.equal(cfg.profiel.naam, 'Marcel'); assert.equal(cfg.profiel.vak, 0); assert.equal(cfg.fotoId, 'abc1')
assert.equal(cfg.berichten.length, M.MAX_BERICHTEN)
assert.deepEqual(cfg.berichten[0], { tekst: 'Een\n\nTwee', link: 'https://mastodon.social/@marcel/1', datum: 5, vak: 1 })
assert.ok(!cfg.berichten.some(x => /evil|javascript/.test(x.link)), 'alleen links naar de server van het account')
assert.deepEqual(cfg.berichten[1], { tekst: 'Geheim', link: 'https://mastodon.social/@marcel/3', datum: 0, cw: 'let op' }, 'met een waarschuwing nooit een plaatje')
assert.equal(cfg.berichten[2].vak, undefined, 'vak moet bij de plek horen')
assert.equal(M.normaliseer({ account: { naam: 'x', server: 'localhost' } }), null)
assert.equal(M.normaliseer({ berichten: [] }), null)
assert.ok(JSON.stringify(M.normaliseer({ account: acc, profiel: { naam: 'x'.repeat(100) }, berichten: Array.from({ length: 8 }, (_, i) => ({ tekst: 'y'.repeat(900), cw: 'z'.repeat(200), link: 'https://mastodon.social/@marcel/' + 'q'.repeat(400) + i })) })).length < 20000, 'past in sync')
console.log('PASS: normaliseer: hoogstens 8 berichten, nette tekst, alleen links naar zijn eigen server, CW nooit met plaatje')

// ── plaatjes ──
const bronnen = { [ber[0].link]: b1.plaatjeGroot }
let k = M.kiesPlaatjes(ber, bronnen, f.afbeelding, {})
assert.deepEqual(k.map(x => [x.sleutel.slice(0, 8), x.url, x.b, x.h]), [
  ['profiel:', 'https://files.mastodon.social/accounts/avatars/1/original/a.png', 96, 96],
  ['https://', 'https://files.mastodon.social/media_attachments/files/1/small/foto.jpg', 240, 135]], 'profielfoto + de kleine versie van het plaatje')
k = M.kiesPlaatjes(ber, bronnen, f.afbeelding, { ['profiel:' + f.afbeelding]: { d: 'data:image/jpeg;base64,AA' }, [ber[0].link]: { mis: 1 } })
assert.deepEqual(k, [], 'al in het geheugen of eerder mislukt: niet opnieuw')
k = M.kiesPlaatjes([{ link: 'https://mastodon.social/@marcel/9', cw: 'x', tekst: 'y' }], { 'https://mastodon.social/@marcel/9': 'https://files.mastodon.social/a/original/z.jpg' }, '', {})
assert.deepEqual(k, [], 'CW: nooit een plaatje (ook niet als er een adres zou zijn)')
const veel = Array.from({ length: 8 }, (_, i) => ({ link: 'https://mastodon.social/@m/' + i, tekst: 't' }))
assert.equal(M.kiesPlaatjes(veel, Object.fromEntries(veel.map(x => [x.link, 'https://files.mastodon.social/a/original/' + x.link.slice(-1) + '.jpg'])), 'https://files.mastodon.social/av.png', {}).length, M.MAX_PLAATJES, 'hoogstens 5 per keer')
const gevraagd = []
const cache = await M.maakFotos({ berichten: ber, bronnen, profielfoto: f.afbeelding, cache: { 'https://oud/x': { d: 'data:image/jpeg;base64,ZZ' } },
  haal: async u => { gevraagd.push(u); return { u } }, verklein: async (blob, w, h) => 'data:image/jpeg;base64,' + w + 'x' + h })
assert.equal(gevraagd.length, 2); assert.ok(!cache['https://oud/x'], 'oude weg')
const delen = M.spriteDelen(ber, f.afbeelding, cache)
assert.deepEqual(delen.map(d => [d.i, d.data.split(',')[1]]), [[0, '96x96'], [1, '240x135']])
assert.deepEqual(M.vak(0), { x: 0, y: 0, w: 96, h: 96 }); assert.deepEqual(M.vak(8), { x: 240, y: 96 + 3 * 135, w: 240, h: 135 }); assert.equal(M.vak(9), null)
for (let i = 0; i <= 8; i++) { const v = M.vak(i); assert.ok(v.x + v.w <= M.SPRITE_B && v.y + v.h <= M.SPRITE_H) }
assert.deepEqual(M.vakStijl(1), { size: '200% 471.11%', pos: '0% 19.16%' })
console.log('PASS: plaatjes: alleen nieuwe, nooit gevoelig, hoogstens 5, de kleine versie; samen één fotoplaatje')

// ── geen inloggen, alleen de server van Stekky ──
const mj = lees('mastodon.js')
assert.doesNotMatch(mj, /oauth|access_token|\/api\/v1\/|authorize|client_secret/i, 'geen inloggen bij Mastodon')
assert.doesNotMatch(mj, /\bfetch\(|XMLHttpRequest|new WebSocket|createElement\('(img|iframe|audio|video|script)'\)|innerHTML/, 'zelf niets ophalen, geen HTML van buiten')
assert.match(mj, /from '\.\/rsswidget\.js\?v=4'/, 'dezelfde weg als de RSS-widget (rss-ophalen)')
assert.match(mj, /a\.rel = 'noopener noreferrer'/)
console.log('PASS: geen inloggen, geen eigen verbindingen, links zonder referrer')

// ── overal aangesloten ──
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null }
const S = await import(new URL('../../store.js', import.meta.url))
const item = S.STORE_WIDGETS.find(w => w.id === 'mastodon')
assert.ok(item && item.widget === 'mastodon' && item.w === 4 && item.h === 3 && S.STORE_ITEMS.includes(item))
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \[[^\]]*'mastodon'[^\]]*\]/)
assert.match(sync, /const WBG_WIDGETS = \[[^\]]*'mastodon'[^\]]*\]/)
assert.match(sync, /\['mastodon','mastodon_'\]/)
const dg = lees('doorgeven.js')
assert.match(dg, /const KLEIN = \[[^\]]*'mastodon'[^\]]*\]/); assert.match(dg, /wbg_\([^)]*\|mastodon\)/)
const ih = lees('index.html')
assert.match(ih, /\{ id:'mastodon',\s+icon:'🐘', titel:'Mastodon',\s+w:4, h:3 \}/)
assert.match(ih, /\} else if \(id === 'mastodon'\) \{\n    renderMastodon\(c, window\._uid\)/)
assert.match(ih, /const key = 'mastodon_' \+ uid, bg = 'widgetbg_mastodon_' \+ uid, fotosKey = 'mastodonfotos_' \+ uid/)
assert.doesNotMatch(ih, /zetWidgetAchtergrond\(c, 'widgetbg_mastodon_'/, 'geen 🖼-knop')
assert.match(lees('profiel.html'), /id="widgetRij-mastodon" style="display:none"/)
assert.match(lees('profiel.html'), /mastodon:\s+\{ id:'mastodon'/)
const vp = lees('vriend-profiel.html')
assert.match(vp, /if \(w\.id === 'mastodon'\) \{/)
assert.match(vp, /d\.item !== 'klein:mastodon' && d\.item !== 'wbg:mastodon'/)
assert.ok(vp.includes("M.tekenMastodonWidget(el.querySelector('.widget-inhoud'), { cfg, sprite, spriteId })"), 'bij een vriend: niets ophalen')
for (const fl of ['index.html', 'vriend-profiel.html']) assert.match(lees(fl), /import\('\.\/mastodon\.js\?v=2'\)/)
const csp = fl => lees(fl).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
for (const fl of ['index.html', 'vriend-profiel.html']) assert.doesNotMatch(csp(fl), /mastodon|joinmastodon/, fl + ': huisregel ongewijzigd')
const en = lees('taal-en.js')
for (const t of ['Mastodon', 'Volg mij op Mastodon', 'Toon bericht', item.uitleg, 'Uit de Store: je openbare Mastodon-berichten', 'Nog geen account'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: de Mastodon-widget staat in de Store, op Home, bij vrienden, in Profiel en gaat mee via sync')
