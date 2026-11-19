// test-weer.mjs (19 nov 2026): de weer-widget (weer.js). Wat van een vriend komt (normaliseer), dat zoeken en het weer
// alleen Open-Meteo vragen (zonder cookies en referrer), dat het weinig data is, de huisregel, en dat de widget overal is
// aangesloten (Store, Home, Profiel, vrienden, sync).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.window = {}
const W = await import(new URL('../../weer.js', import.meta.url))

// ── plaatsen ──
assert.deepEqual(W.nettePlaats({ naam: '  Utrecht ', gebied: 'Utrecht', land: 'nl', lat: 52.09083, lon: 5.12222 }),
  { naam: 'Utrecht', gebied: 'Utrecht', land: 'NL', lat: 52.09, lon: 5.12 }, 'afgerond op 2 decimalen, landcode in hoofdletters')
for (const fout of [null, {}, { naam: '', lat: 1, lon: 1 }, { naam: 'X', lat: 91, lon: 0 }, { naam: 'X', lat: 0, lon: 181 }, { naam: 'X', lat: 'a', lon: 0 }, { naam: 'X', lat: null, lon: 0 }])
  assert.equal(W.nettePlaats(fout), null, JSON.stringify(fout))
assert.equal(W.nettePlaats({ naam: 'X', land: 'NLD', lat: 1, lon: 1 }).land, '', 'rare landcode weg')
console.log('PASS: plaatsen: naam en coördinaten binnen de grenzen, afgerond')

// ── wat van een vriend komt ──
const cfg = W.normaliseer({
  plaats: { naam: 'Utrecht<script>', lat: 52.09, lon: 5.12, land: 'NL' },
  nu: { temp: 7.34, code: 61, wind: 18.6, dag: 1 },
  dagen: [
    { datum: '2026-11-20', code: 3, max: 9.4, min: 4.6, regen: 30 },
    { datum: '2026-11-19', code: 61, max: 8, min: 3 },
    { datum: '2026-11-19', code: 0, max: 1, min: 0 },             // dubbel
    { datum: 'morgen', code: 0, max: 1, min: 0 },                 // geen datum
    { datum: '2026-11-21', code: 12, max: 1, min: 0 },            // onbekende code
    { datum: '2026-11-22', code: 0, max: 999, min: 0 },           // te warm
    ...Array.from({ length: 10 }, (_, i) => ({ datum: '2026-12-0' + i, code: 0, max: 5, min: 1, regen: 150 })),
  ],
  bijgewerkt: 1763550000000, extra: 'weg',
})
assert.equal(cfg.plaats.naam, 'Utrecht<script>', 'tekst blijft tekst (wordt met textContent getoond)')
assert.deepEqual(cfg.nu, { temp: 7.3, code: 61, dag: true, wind: 19 })
assert.deepEqual(cfg.dagen.map(d => d.datum), ['2026-11-19', '2026-11-20', '2026-12-00', '2026-12-01', '2026-12-02'], 'hoogstens 5, op volgorde, foute dagen weg')
assert.deepEqual(cfg.dagen[1], { datum: '2026-11-20', code: 3, max: 9, min: 5, regen: 30 })
assert.equal(cfg.dagen[2].regen, undefined, 'regenkans boven 100% weg')
assert.equal(cfg.extra, undefined)
assert.equal(W.normaliseer({ nu: { temp: 1, code: 0 } }), null, 'zonder plaats niets')
assert.equal(W.normaliseer(null), null)
assert.equal(W.normaliseer({ plaats: { naam: 'X', lat: 1, lon: 1 }, nu: { temp: 5, code: 7 } }).nu, undefined, 'onbekende code: geen "nu"')
assert.equal(W.normaliseer({ plaats: { naam: 'X', lat: 1, lon: 1 }, nu: { temp: 5, code: 0, dag: 0 } }).nu.dag, false, 'nacht')
console.log('PASS: normaliseer: alleen getallen binnen redelijke grenzen, hoogstens 5 dagen')

// ── weerbeeld ──
for (const c of W.CODES) assert.ok(W.weerbeeld(c).tekst, 'tekst voor code ' + c)
assert.equal(W.weerbeeld(0, false).icoon, '🌙')
assert.equal(W.weerbeeld(0, true).icoon, '☀️')
assert.equal(W.dagNaam('2026-11-19', new Date(2026, 10, 19, 10)), 'Vandaag')
assert.equal(W.vandaag(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
console.log('PASS: elke weercode heeft een plaatje en een tekst')

// ── Open-Meteo ──
const gevraagd = []
const nep = antwoord => async (url, opties) => { gevraagd.push({ url, opties }); return { ok: true, json: async () => antwoord } }
const zoek = await W.zoekPlaatsen(' Utrecht ', { fetch: nep({ results: [
  { name: 'Utrecht', admin1: 'Utrecht', country_code: 'NL', latitude: 52.09083, longitude: 5.12222, population: 290529, timezone: 'Europe/Amsterdam' },
  { name: 'Utrecht dubbel', country_code: 'NL', latitude: 52.0911, longitude: 5.1201 },
  { name: 'Kapot', latitude: 'x', longitude: 1 },
] }) })
assert.deepEqual(zoek, [{ naam: 'Utrecht', gebied: 'Utrecht', land: 'NL', lat: 52.09, lon: 5.12 }], 'zelfde plek één keer; kapotte weg')
let u = new URL(gevraagd[0].url)
assert.equal(u.origin + u.pathname, 'https://geocoding-api.open-meteo.com/v1/search')
assert.equal(u.searchParams.get('name'), 'Utrecht'); assert.equal(u.searchParams.get('language'), 'nl')
assert.equal(gevraagd[0].opties.credentials, 'omit'); assert.equal(gevraagd[0].opties.referrerPolicy, 'no-referrer')
assert.deepEqual(await W.zoekPlaatsen('U', { fetch: async () => { throw new Error('mag niet') } }), [], 'te kort: niets vragen')
assert.equal(await W.zoekPlaatsen('Utrecht', { fetch: async () => { throw new Error('weg') } }), null, 'mislukt: null')
assert.deepEqual(await W.zoekPlaatsen('Nergensdorp', { fetch: nep({ generationtime_ms: 1 }) }), [], 'niets gevonden: []')

gevraagd.length = 0
const weer = await W.haalWeer({ naam: 'Utrecht', lat: 52.09, lon: 5.12 }, { fetch: nep({
  current: { time: '2026-11-19T20:00', temperature_2m: 6.8, weather_code: 3, wind_speed_10m: 14.2, is_day: 0 },
  daily: { time: ['2026-11-19', '2026-11-20'], weather_code: [61, 2], temperature_2m_max: [8.1, 9.6], temperature_2m_min: [3.2, 4.4], precipitation_probability_max: [80, 5] },
}) })
assert.deepEqual(weer, { nu: { temp: 6.8, code: 3, dag: false, wind: 14 }, dagen: [{ datum: '2026-11-19', code: 61, max: 8, min: 3, regen: 80 }, { datum: '2026-11-20', code: 2, max: 10, min: 4, regen: 5 }] })
u = new URL(gevraagd[0].url)
assert.equal(u.origin + u.pathname, 'https://api.open-meteo.com/v1/forecast')
assert.equal(u.searchParams.get('latitude'), '52.09'); assert.equal(u.searchParams.get('longitude'), '5.12')
assert.equal(u.searchParams.get('forecast_days'), '5')
assert.doesNotMatch(u.search, /hourly/, 'geen uurlijst: houdt het antwoord klein')
assert.equal(gevraagd[0].opties.credentials, 'omit'); assert.equal(gevraagd[0].opties.referrerPolicy, 'no-referrer')
assert.equal(await W.haalWeer({ naam: 'X', lat: 1, lon: 1 }, { fetch: async () => ({ ok: false }) }), null)
assert.equal(await W.haalWeer({ naam: 'X', lat: 1, lon: 1 }, { fetch: nep({}) }), null, 'leeg antwoord: null')
assert.equal(await W.haalWeer(null, { fetch: async () => { throw new Error('mag niet') } }), null)
console.log('PASS: Open-Meteo: alleen zoeken en het weer, zonder cookies en referrer, zonder uurlijst')

// ── weinig data ──
const wj = lees('weer.js')
assert.equal(W.VERS_MS, 30 * 60 * 1000, 'hoogstens één keer per half uur')
assert.match(wj, /if \(nu\(\) - \(laatstePoging\.get\(sl\) \|\| 0\) > VERS_MS\) ververs/, 'ook na een mislukte poging niet steeds opnieuw')
assert.doesNotMatch(wj, /geolocation/, 'nooit de locatie van de telefoon')
assert.doesNotMatch(wj, /innerHTML/, 'alles met textContent')
console.log('PASS: weinig data, en nooit de locatie van de telefoon')

// ── huisregel ──
const csp = f => lees(f).match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)[1]
const connect = f => csp(f).match(/connect-src ([^;]*);/)[1].split(' ')
assert.ok(connect('index.html').includes('https://api.open-meteo.com') && connect('index.html').includes('https://geocoding-api.open-meteo.com'), 'index.html: Open-Meteo mag')
for (const f of ['vriend-profiel.html', 'chat.html', 'login.html', 'profiel.html']) assert.doesNotMatch(csp(f), /open-meteo/, f + ': geen Open-Meteo')
console.log('PASS: de huisregel: alleen Home vraagt Open-Meteo, vrienden niet')

// ── overal aangesloten ──
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null }
const S = await import(new URL('../../store.js', import.meta.url))
const item = S.STORE_WIDGETS.find(w => w.id === 'weer')
assert.ok(item && item.widget === 'weer' && item.w === 4 && item.h === 3 && S.STORE_ITEMS.includes(item))
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \[[^\]]*'weer'[^\]]*\]/)
assert.match(sync, /\['weer','weer_'\]/)
assert.match(lees('doorgeven.js'), /const KLEIN = \[[^\]]*'weer'[^\]]*\]/)
assert.match(lees('index.html'), /\{ id:'weer',\s+icon:'🌤️', titel:'Weer',\s+w:4, h:3 \}/)
assert.match(lees('index.html'), /\} else if \(id === 'weer'\) \{\n    renderWeer\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widgetRij-weer" style="display:none"/)
assert.match(lees('profiel.html'), /weer:\s+\{ id:'weer'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'weer'\) \{/)
assert.match(lees('vriend-profiel.html'), /cfg = W\.normaliseer\(JSON\.parse\(ruw\)\)/)
assert.match(lees('vriend-profiel.html'), /W\.tekenWeerWidget\(el\.querySelector\('\.widget-inhoud'\), \{ cfg \}\)/, 'bij een vriend: alleen tonen')
for (const f of ['index.html', 'vriend-profiel.html']) assert.match(lees(f), /import\('\.\/weer\.js\?v=1'\)/)
const en = lees('taal-en.js')
for (const t of ['Weer', 'Nog geen plaats', item.uitleg, 'Uit de Store: het weer van een plaats die je kiest', 'Weer verwijderen', 'Helder', 'Onweer met hagel', 'wind {n} km/u'])
  assert.ok(en.includes(JSON.stringify(t) + ':'), 'Engels voor: ' + t)
console.log('PASS: het weer staat in de Store, op Home, bij vrienden, in Profiel en gaat mee via sync')
