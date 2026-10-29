// apk.js: downloadknop alleen voor Android in de browser, de keuze bij een uitnodiging,
// en de uitnodiging die in de app wacht (alleen geldige links van Fibro zelf, eenmalig, maximaal een week).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const code = readFileSync(new URL('../../apk.js', import.meta.url), 'utf8')
const BASIS = 'https://marcelpetrusma84-coder.github.io/Fibro/'
const INVITE = BASIS + 'invite.html?token=fibro-ABCDEFGHJKLMNPQR#s=0123456789abcdef0123456789abcdef'

function opslag() {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }
}
function maakEl(tag) {
  const e = {
    tagName: tag.toUpperCase(), className: '', textContent: '', hidden: false, style: {}, kinderen: [], parentNode: null, luisteraars: {},
    appendChild(k) { k.parentNode = this; this.kinderen.push(k); return k },
    insertBefore(k) { return this.appendChild(k) },
    remove() { if (this.parentNode) this.parentNode.kinderen = this.parentNode.kinderen.filter(x => x !== this); this.parentNode = null },
    addEventListener(t, f) { (this.luisteraars[t] ||= []).push(f) },
    klik() { (this.luisteraars.click || []).forEach(f => f({})); if (this.onclick) this.onclick({}) }
  }
  return e
}
function alles(e, uit = []) { uit.push(e); e.kinderen.forEach(k => alles(k, uit)); return uit }
const vind = (e, tekst) => alles(e).find(x => x.textContent === tekst)

function laad({ ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130', referrer = '', standalone = false, href = BASIS + 'login.html', local = opslag(), sessie = opslag() } = {}) {
  const head = maakEl('head')
  const document = { referrer, head, createElement: maakEl, getElementById: id => alles(head).find(x => x.id === id) || null }
  const gegaan = []
  const location = { href, replace: u => gegaan.push(u) }
  const ctx = vm.createContext({
    window: {}, document, location, navigator: { userAgent: ua }, localStorage: local, sessionStorage: sessie,
    matchMedia: q => ({ matches: standalone && q.includes('standalone') }), URL, JSON, Date, Number, String, Object
  })
  ctx.window.matchMedia = ctx.matchMedia
  vm.runInContext(code, ctx)
  return { api: ctx.window.FibroApk, local, sessie, gegaan, ctx }
}

// 1. Wie ziet de downloadknop?
assert.equal(laad().api.toonDownload(), true, 'Android in de browser: wel')
assert.equal(laad({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }).api.toonDownload(), false, 'iPhone: niet')
assert.equal(laad({ ua: 'Mozilla/5.0 (X11; Linux x86_64)' }).api.toonDownload(), false, 'computer: niet')
assert.equal(laad({ referrer: 'android-app://nl.fibro.app/' }).api.toonDownload(), false, 'in de app: niet')
assert.equal(laad({ standalone: true }).api.toonDownload(), false, 'als icoon op het startscherm: niet')
const s1 = opslag(); laad({ referrer: 'android-app://nl.fibro.app/', sessie: s1 })
assert.equal(laad({ sessie: s1 }).api.inApp(), true, 'de app wordt onthouden bij de volgende pagina in dezelfde app')
assert.match(laad().api.url, /^https:\/\/github\.com\/marcelpetrusma84-coder\/Fibro\/releases\/download\/apk-nieuwste\/fibro\.apk$/)

// 2. Alleen echte uitnodigingen van Fibro zelf mogen wachten
{
  const { api } = laad()
  assert.equal(api.bewaarUitnodiging(INVITE), true)
  assert.equal(api.wachtendeUitnodiging(), INVITE)
  for (const fout of [
    'https://kwaad.example/Fibro/invite.html?token=fibro-ABCDEFGHJKLMNPQR',
    BASIS + 'login.html?token=fibro-ABCDEFGHJKLMNPQR',
    BASIS + 'invite.html',
    BASIS + 'invite.html?token=%3Cscript%3E',
    'javascript:alert(1)'
  ]) assert.equal(api.bewaarUitnodiging(fout), false, 'geweigerd: ' + fout)
}
{
  const local = opslag()
  local.setItem('fibro_uitnodiging_voor_app', JSON.stringify({ url: 'https://kwaad.example/x', t: Date.now() }))
  assert.equal(laad({ local }).api.wachtendeUitnodiging(), null, 'een vervalste wachtende link wordt genegeerd')
  assert.equal(local.getItem('fibro_uitnodiging_voor_app'), null, 'en weggegooid')
  local.setItem('fibro_uitnodiging_voor_app', JSON.stringify({ url: INVITE, t: Date.now() - 8 * 24 * 3600 * 1000 }))
  assert.equal(laad({ local }).api.wachtendeUitnodiging(), null, 'ouder dan een week: verlopen')
}

// 3. De app neemt de uitnodiging over, maar alleen in de app en maar een keer
{
  const local = opslag()
  laad({ local }).api.bewaarUitnodiging(INVITE)
  const browser = laad({ local })
  assert.equal(browser.api.hervatUitnodiging(), false, 'in de browser niet doorsturen')
  assert.deepEqual(browser.gegaan, [])
  const app = laad({ local, referrer: 'android-app://nl.fibro.app/' })
  assert.equal(app.api.hervatUitnodiging(), true)
  assert.deepEqual(app.gegaan, [INVITE], 'in de app naar de uitnodiging')
  const later = laad({ local, referrer: 'android-app://nl.fibro.app/' })
  assert.equal(later.api.hervatUitnodiging(), false, 'de tweede keer niet meer')
}

// 4. De keuze op de uitnodigingspagina
{
  const { api, local, sessie, ctx } = laad({ href: INVITE })
  let web = 0
  const k = api.keuze({ naam: 'Bram', onWeb: () => web++ })
  assert.ok(vind(k, 'Hoe wil je Fibro gebruiken?'))
  assert.ok(vind(k, 'Aanbevolen'), 'de app staat als aanbevolen')
  const knop = vind(k, '⬇️ Download de app')
  assert.equal(knop.href, api.url)
  const stappen = alles(k).find(x => x.kinderen.some(c => c.tagName === 'OL'))
  assert.equal(stappen.hidden, true, 'de stappen pas na het downloaden')
  knop.klik()
  assert.equal(stappen.hidden, false)
  assert.ok(vind(k, 'Open de Fibro-app. Daar maak je je account aan en word je meteen vrienden met Bram.'))
  assert.equal(api.wachtendeUitnodiging(), INVITE, 'na kiezen voor de app wacht de uitnodiging')
  const parent = ctx.document.createElement('div'); parent.appendChild(k)
  vind(k, '🌐 Verder in de browser').klik()
  assert.equal(web, 1, 'verder in de browser toont het formulier')
  assert.equal(local.getItem('fibro_uitnodiging_voor_app'), null, 'en de uitnodiging wacht dan niet meer op de app')
  assert.equal(sessie.getItem('fibro_apk_keuze'), 'web')
  assert.equal(api.webGekozen(), true, 'bij herladen niet opnieuw vragen')
  assert.equal(parent.kinderen.length, 0, 'de keuze verdwijnt')
}

// 5. 'Niet nu' op Home: dertig dagen niet meer
{
  const local = opslag()
  const { api, ctx } = laad({ local })
  const k = api.kaart({ sluitbaar: true })
  const p = ctx.document.createElement('div'); p.appendChild(k)
  vind(k, 'Niet nu').klik()
  assert.equal(p.kinderen.length, 0)
  assert.equal(laad({ local }).api.kaart({ sluitbaar: true }), null, 'binnen dertig dagen niet terug')
  assert.ok(laad({ local }).api.kaart(), 'op de inlogpagina (niet sluitbaar) wel')
  local.setItem('fibro_apk_niet_nu', String(Date.now() - 31 * 24 * 3600 * 1000))
  assert.ok(laad({ local }).api.kaart({ sluitbaar: true }), 'na dertig dagen weer wel')
}

// 6. Engelse vertalingen voor alle teksten
{
  const { ctx } = laad()
  const en = ctx.window.FIBRO_EN
  const teksten = [...code.matchAll(/\bt\('([^']+)'/g)].map(m => m[1])
  assert.ok(teksten.length > 10)
  for (const s of teksten) assert.ok(en[s], 'vertaling ontbreekt: ' + s)
}

console.log('PASS: downloadknop alleen voor Android in de browser, keuze bij een uitnodiging, wachtende uitnodiging (alleen geldig, eenmalig, een week) en vertalingen')
