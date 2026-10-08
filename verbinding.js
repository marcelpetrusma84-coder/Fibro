// verbinding.js - Fibro (v2): een balkje als de server even niet antwoordt.
//
// Fibro blijft dan gewoon werken met wat er op dit toestel bewaard is, maar je ziet nu ook
// dat het niet de nieuwste stand is. Het balkje verdwijnt vanzelf zodra de server weer
// antwoordt. Zonder internet toont offline.js al zijn eigen balkje; dan doet dit niets.
//
// v2: niet meer te snel. Alleen de database en het inloggen tellen mee (niet de hulpfuncties
// zoals pushmeldingen of belgegevens); de eerste seconden na het openen of terugkomen in de app
// tellen niet mee (de iPhone zet de verbinding dan net weer aan; daarna wordt het wel nagekeken); en vóór het balkje verschijnt,
// kijkt Fibro zelf nog één keer of de server echt niet antwoordt.
//
// Werkt door fetch() van de pagina te volgen. Daarom moet dit een gewoon script zijn dat vroeg
// in <head> geladen wordt, vóór supabase.js.
// Inhaken:  <script src="verbinding.js?v=2"></script>  direct na <meta charset="UTF-8">
(function () {
  'use strict'
  var orig = window.fetch
  if (!orig || window.__fibroVerbinding) return
  window.__fibroVerbinding = true

  var BALK_ID = 'fibro-server-balk'
  var TEKST = '⚠️ Server even niet bereikbaar · je ziet wat er op dit toestel bewaard is'
  var RUST_MS = 8000          // zo lang na openen/terugkomen tellen fouten niet
  var balk = null, krimpTimer = null, zichtbaar = false
  var fouten = [], server = null, rustTot = Date.now() + RUST_MS, bezigMetKijken = false, kijkTimer = null

  function maakBalk() {
    if (balk || !document.body) return balk
    balk = document.createElement('div')
    balk.id = BALK_ID
    balk.setAttribute('role', 'status')
    balk.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 6px);left:50%;transform:translateX(-50%);' +
      'z-index:99998;max-width:calc(100% - 24px);padding:5px 12px;border-radius:999px;background:rgba(60,36,10,0.95);' +
      'border:0.5px solid rgba(251,191,36,0.55);color:#fef3c7;font:12px "DM Sans",sans-serif;text-align:center;' +
      'box-shadow:0 2px 10px rgba(0,0,0,0.45);pointer-events:none;display:none'
    document.body.appendChild(balk)
    return balk
  }
  function toon() {
    if (!navigator.onLine || zichtbaar || document.hidden) return
    if (!maakBalk()) { document.addEventListener('DOMContentLoaded', toon, { once: true }); return }
    zichtbaar = true
    balk.textContent = TEKST
    balk.style.padding = '5px 12px'
    balk.style.display = 'block'
    clearTimeout(krimpTimer)
    krimpTimer = setTimeout(function () { if (zichtbaar) { balk.textContent = '⚠️'; balk.style.padding = '3px 7px' } }, 6000)
    plan(15000) // zelf blijven kijken, zodat het balkje ook weggaat als de pagina niets meer vraagt
  }
  function verberg() {
    fouten = []
    clearTimeout(kijkTimer)
    if (!zichtbaar) return
    zichtbaar = false
    clearTimeout(krimpTimer)
    if (balk) balk.style.display = 'none'
  }
  function rust() { rustTot = Date.now() + RUST_MS; fouten = [] }

  // Zelf kijken: antwoordt de server met iets onder de 500 (ook "geen toegang"), dan is hij er gewoon.
  function kijk() {
    if (bezigMetKijken || !server || !navigator.onLine) return
    bezigMetKijken = true
    var klaar = false
    var stop = setTimeout(function () { if (!klaar) { klaar = true; bezigMetKijken = false; toon() } }, 8000)
    orig.call(window, server + '/auth/v1/health', { cache: 'no-store' }).then(function (r) {
      if (klaar) return; klaar = true; clearTimeout(stop); bezigMetKijken = false
      if (r.status < 500) verberg(); else toon()
    }, function () {
      if (klaar) return; klaar = true; clearTimeout(stop); bezigMetKijken = false
      toon()
    })
  }
  function plan(ms) { clearTimeout(kijkTimer); kijkTimer = setTimeout(kijk, ms) }

  function fout() {
    if (!navigator.onLine || document.hidden) return
    var nu = Date.now()
    // net geopend of terug in de app: niet meteen melden, maar na de rustpauze zelf nakijken
    if (nu < rustTot) { if (!zichtbaar) plan(rustTot - nu + 300); return }
    fouten = fouten.filter(function (t) { return nu - t < 30000 })
    fouten.push(nu)
    if (fouten.length >= 2 && !zichtbaar) kijk() // eerst zelf nakijken, dan pas melden
  }

  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input || '')
    var p = orig.apply(this, arguments)
    var m = /^(https:\/\/[a-z0-9-]+\.supabase\.co)\/(rest|auth)\/v1\//.exec(url)
    if (!m) return p
    server = m[1]
    return p.then(function (r) {
      if (r.status >= 500) fout()
      else verberg()
      return r
    }, function (e) {
      if (!(e && e.name === 'AbortError')) fout()
      throw e
    })
  }
  window.addEventListener('offline', verberg)
  window.addEventListener('online', rust)
  document.addEventListener('visibilitychange', function () { if (!document.hidden) rust() })
  window.addEventListener('pageshow', rust)
})()
