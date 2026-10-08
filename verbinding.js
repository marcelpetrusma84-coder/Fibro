// verbinding.js - Fibro (v1): een balkje als de server even niet antwoordt.
//
// Fibro blijft dan gewoon werken met wat er op dit toestel bewaard is, maar je ziet nu ook
// dat het niet de nieuwste stand is. Het balkje verdwijnt vanzelf zodra de server weer
// antwoordt. Zonder internet toont offline.js al zijn eigen balkje; dan doet dit niets.
//
// Werkt door fetch() van de pagina te volgen (alleen verzoeken naar Supabase). Daarom moet
// dit een gewoon script zijn dat vroeg in <head> geladen wordt, vóór supabase.js.
// Inhaken:  <script src="verbinding.js?v=1"></script>  direct na <meta charset="UTF-8">
(function () {
  'use strict'
  var orig = window.fetch
  if (!orig || window.__fibroVerbinding) return
  window.__fibroVerbinding = true

  var BALK_ID = 'fibro-server-balk'
  var TEKST = '⚠️ Server even niet bereikbaar · je ziet wat er op dit toestel bewaard is'
  var fouten = 0, balk = null, krimpTimer = null, zichtbaar = false

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
    if (!navigator.onLine || zichtbaar) return
    if (!maakBalk()) { document.addEventListener('DOMContentLoaded', toon, { once: true }); return }
    zichtbaar = true
    balk.textContent = TEKST
    balk.style.padding = '5px 12px'
    balk.style.display = 'block'
    clearTimeout(krimpTimer)
    krimpTimer = setTimeout(function () { if (zichtbaar) { balk.textContent = '⚠️'; balk.style.padding = '3px 7px' } }, 6000)
  }
  function verberg() {
    fouten = 0
    if (!zichtbaar) return
    zichtbaar = false
    clearTimeout(krimpTimer)
    if (balk) balk.style.display = 'none'
  }
  function fout() {
    if (!navigator.onLine) return
    fouten++
    if (fouten >= 2) toon() // één losse hapering niet meteen melden
  }

  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input || '')
    var p = orig.apply(this, arguments)
    if (url.indexOf('.supabase.co/') === -1) return p
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
})()
