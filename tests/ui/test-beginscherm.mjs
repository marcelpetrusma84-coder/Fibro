// v248 (31 okt 2026): uitleg met tekeningen om Fibro op het beginscherm te zetten (beginscherm.js), de tip op Home voor
// iPhone-gebruikers in Safari, en een knop Meldingen aanzetten op Profiel (die was er niet: Fibro vroeg het alleen na
// het inloggen; op een iPhone in Safari gebeurde dan niets).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const bs = lees('beginscherm.js'), index = lees('index.html'), profiel = lees('profiel.html')

// 1. Welk toestel, welke iOS (de echte functie, met verschillende browsergegevens)
globalThis.window = { matchMedia: () => ({ matches: false }) }
const zet = (ua, extra = {}) => Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, platform: 'iPhone', maxTouchPoints: 5, ...extra }, configurable: true })
const BS = await import(new URL('../../beginscherm.js', import.meta.url))
const iphone = v => `Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Mobile/15E148 Safari/604.1`
zet(iphone('27.0')); assert.equal(BS.toestel().iosVersie, 'ios27'); assert.equal(BS.iphoneZonderApp(), true)
zet(iphone('26.1')); assert.equal(BS.toestel().iosVersie, 'ios26')
zet(iphone('17.5')); assert.equal(BS.toestel().iosVersie, 'ouder')
zet('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1')
assert.equal(BS.toestel().anderBrowser, true, 'Chrome op de iPhone: tip om Safari te gebruiken')
zet(iphone('27.0'), { standalone: true }); assert.equal(BS.iphoneZonderApp(), false, 'als app op het beginscherm: geen uitleg nodig')
zet('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36', { platform: 'Linux', maxTouchPoints: 5 })
assert.equal(BS.toestel().android, true); assert.equal(BS.iphoneZonderApp(), false)
delete globalThis.window

// 2. De stappen: per iOS-versie de goede eerste knop, daarna overal Zet op beginscherm > Open als webapp > Voeg toe
assert.match(bs, /ios27: \[T\('Houd je vinger op de <b>adresbalk<\/b>/)
assert.match(bs, /ios26: \[T\('Tik in Safari rechts naast het adres op <b>(?:\\u2022|•){3}<\/b>\.'\)/)
assert.match(bs, /ouder: \[T\('Tik onderaan in Safari op de <b>deelknop<\/b>/)
assert.match(bs, /\.\.\.\(versie === 'ouder' \? \[\] : \[\[T\('Tik op <b>Deel<\/b>\.'\)/, 'oudere iPhone: de deelknop staat meteen in beeld')
for (const s of ['Zet op beginscherm', 'Open als webapp', 'Voeg toe', 'App installeren', 'Installeren']) assert.ok(bs.includes(`T('${s}')`), 'in de tekening: ' + s)
assert.ok(!/https?:\/\//.test(bs.replace(/\/\/.*$/gm, '')), 'geen plaatjes of bestanden van buiten (alleen icon-192.png)')
assert.match(bs, /if \(soort === 'iphone'\) \{\n      lijst\.appendChild\(el\('li', '', T\('Log opnieuw in\./, 'opnieuw inloggen alleen op de iPhone (eigen opslag)')

// 3. Home: menu en tip
assert.match(index, /function openAppUitleg\(\) \{\n  import\('\.\/beginscherm\.js\?v=1'\)\.then\(m => m\.openBeginschermUitleg\(\)\)/)
assert.match(index, /<div id="beginschermTip" style="padding:0 16px"><\/div>/)
assert.match(index, /if \(!m\.iphoneZonderApp\(\)\) return/)
assert.match(index, /Date\.now\(\) - Number\(localStorage\.getItem\('fibro_tip_beginscherm'\) \|\| 0\) < 7 \* 86400000/, 'weggetikt: een week niet')

// 4. Profiel: Meldingen aanzetten
assert.match(profiel, /<div class="section-label" data-t>Meldingen<\/div>/)
assert.match(profiel, /onclick="meldingenAanzetten\(\)"/)
const knop = profiel.slice(profiel.indexOf('window.meldingenAanzetten = async function'), profiel.indexOf('toonMeldStand()\n'))
assert.match(knop, /if \(bs && bs\.iphoneZonderApp\(\)\) \{ bs\.openBeginschermUitleg\(\{ reden: 'meldingen' \}\); return \}/)
assert.ok(knop.indexOf('Notification.requestPermission()') < knop.indexOf('activeerPushNotificaties()'), 'eerst de toestemming vragen, meteen bij de tik')

// 5. Engels voor alle teksten
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
const stukken = bs + index.slice(index.indexOf('async function toonBeginschermTip'), index.indexOf('toonBeginschermTip()\n')) +
  profiel.slice(profiel.indexOf('async function toonMeldStand'), profiel.indexOf('window.activeerPushNotificaties = async') + 900)
const leesbaar = s => s.replace(/\\u\{([0-9A-F]+)\}/gi, (x, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (x, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, "'")
for (const m of stukken.matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) assert.ok(Object.prototype.hasOwnProperty.call(EN, leesbaar(m[1])), 'Engels voor: ' + leesbaar(m[1]).slice(0, 50))
for (const k of ['Meldingen', '🔔 Meldingen aanzetten']) assert.ok(EN[k], 'Engels voor ' + k)
delete globalThis.window
console.log('ok: Fibro op het beginscherm, met tekeningen; Meldingen aanzetten op Profiel')

// 6. v248b: al bij het aanmelden (login.html > Registreren) en op de setup-pagina
{
  const login = lees('login.html'), setup = lees('setup.html'), bs2 = lees('beginscherm.js')
  assert.match(login, /<div id="reg-beginscherm" hidden/, 'de kaart staat standaard verborgen')
  assert.ok(login.indexOf('id="reg-beginscherm"') < login.indexOf('id="reg-form"'), 'boven het formulier')
  assert.match(login, /import \{ iphoneZonderApp, openBeginschermUitleg \} from '\.\/beginscherm\.js\?v=1'/)
  assert.match(login, /if \(kaart && iphoneZonderApp\(\) && !weg\) \{/, 'alleen op een iPhone in Safari')
  assert.match(login, /openBeginschermUitleg\(\{ reden: 'account' \}\)/)
  assert.match(login, /sessionStorage\.setItem\('fibro_reg_beginscherm_weg', '1'\)/, 'Toch hier verdergaan: weg')
  assert.match(bs2, /if \(reden === 'account'\) \{\n      \/\/ nog geen account: dat maak je meteen in de app\n      lijst\.appendChild\(el\('li', '', T\('Tik op <b>Registreren<\/b> en maak daar je account\.'\)\)\)/,
    'bij het aanmelden: daarna in de app registreren (niet opnieuw inloggen)')
  assert.match(setup, /if \(blok && !t\.app && \(t\.ios \|\| t\.android\)\) \{/, 'setup: alleen op een telefoon, niet als app')
  assert.match(setup, /openBeginschermUitleg\(\{ reden: 'setup' \}\)/)
  globalThis.window = {}
  new Function('window', lees('taal-en.js'))(globalThis.window)
  const EN = globalThis.window.FIBRO_EN
  for (const m of login.matchAll(/<(?:div|button)[^>]*data-t>([^<]+)<\/(?:div|button)>/g)) if (/beginscherm|iPhone|Laat zien hoe|Toch hier/.test(m[1])) assert.ok(EN[m[1].trim()], 'Engels voor ' + m[1].slice(0, 40))
  for (const m of (setup + bs2).matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) {
    const k = m[1].replace(/\\u\{([0-9A-F]+)\}/gi, (x, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (x, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, "'")
    assert.ok(Object.prototype.hasOwnProperty.call(EN, k), 'Engels voor ' + k.slice(0, 50))
  }
  delete globalThis.window
  console.log('ok: ook bij het aanmelden en op de setup-pagina')
}
