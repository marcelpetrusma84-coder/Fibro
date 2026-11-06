// balk-vast.js (v1, 6 nov 2026): de navigatiebalk onderaan blijft echt onderaan op de iPhone.
//
// Op de iPhone blijven vaste balken (position:fixed) soms halverwege het scherm "hangen" nadat het toetsenbord
// dichtgaat (bijvoorbeeld na typen in het gastenboek) of nadat een spel of venster sluit. Safari tekent ze dan op de
// plek waar ze stonden toen het toetsenbord open was. Een piepklein schuifje (1 pixel heen en meteen terug) laat
// Safari de pagina opnieuw uitlijnen. Dat doen we op die momenten. Je ziet er niets van.
;(function () {
  if (window.__fibroBalkVast) return
  window.__fibroBalkVast = true
  var bezig = false
  function zetRecht() {
    if (bezig) return
    bezig = true
    requestAnimationFrame(function () {
      var x = window.scrollX || 0, y = window.scrollY || 0
      window.scrollTo(x, y + 1)
      requestAnimationFrame(function () { window.scrollTo(x, y); bezig = false })
    })
  }
  window.fibroZetBalkRecht = zetRecht
  var invoer = function (el) { return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) }
  // toetsenbord dicht: na het verlaten van een invoerveld (even wachten tot het toetsenbord weg is)
  document.addEventListener('focusout', function (e) {
    if (!invoer(e.target)) return
    setTimeout(function () { if (!invoer(document.activeElement)) zetRecht() }, 120)
    setTimeout(function () { if (!invoer(document.activeElement)) zetRecht() }, 450)
  }, true)
  // het zichtbare deel van het scherm wordt weer groter (toetsenbord weg, adresbalk terug)
  var vv = window.visualViewport, laatst = vv ? vv.height : 0
  if (vv) vv.addEventListener('resize', function () {
    if (vv.height > laatst + 40) zetRecht()
    laatst = vv.height
  })
  window.addEventListener('fibro-spel-dicht', zetRecht)
  window.addEventListener('orientationchange', function () { setTimeout(zetRecht, 300) })
  window.addEventListener('pageshow', zetRecht)
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') zetRecht() })
})()
