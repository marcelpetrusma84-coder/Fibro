// huisregel.js - opschrijven wat de huisregel van Fibro tegenhoudt (v1, 8 oktober 2026, v136)
// De huisregel zelf (Content-Security-Policy) staat als <meta http-equiv> bovenaan elke pagina,
// want GitHub Pages kan geen eigen headers sturen. In gewone woorden: Fibro laadt alleen code van
// de eigen site, en praat alleen met de eigen site en met Supabase. Plaatjes, geluid en video
// komen van de eigen site, van Supabase of van het toestel zelf (data:, blob:).
// Houdt de huisregel iets tegen, dan schrijft dit bestand dat op in localStorage 'fibro_huisregel'
// (de laatste 20, alleen het adres zonder ?...), zodat het ook op een iPhone te zien is:
// Over Fibro -> Technisch. Een gewoon script (geen module), direct na de huisregel geladen.
(function () {
  var SLEUTEL = 'fibro_huisregel'
  function lees() {
    try { var l = JSON.parse(localStorage.getItem(SLEUTEL) || '[]'); return Array.isArray(l) ? l : [] } catch (e) { return [] }
  }
  function kort(u) {
    u = String(u || '')
    if (/^(inline|eval|wasm-eval|trusted-types-sink|data|blob)$/.test(u)) return u
    try {
      var x = new URL(u, location.href)
      if (x.protocol === 'data:' || x.protocol === 'blob:') return x.protocol.slice(0, -1)
      return x.origin + x.pathname
    } catch (e) { return u.split('?')[0].slice(0, 120) }
  }
  document.addEventListener('securitypolicyviolation', function (e) {
    try {
      var regel = e.effectiveDirective || e.violatedDirective || '?'
      var adres = kort(e.blockedURI)
      var pagina = location.pathname.split('/').pop() || 'index.html'
      console.warn('[huisregel] tegengehouden:', regel, adres, 'op', pagina)
      var l = lees(), zelfde = null
      for (var i = 0; i < l.length; i++) {
        if (l[i] && l[i].regel === regel && l[i].adres === adres && l[i].pagina === pagina) zelfde = l[i]
      }
      if (zelfde) { zelfde.keer = (zelfde.keer || 1) + 1; zelfde.laatst = Date.now() }
      else l.push({ regel: regel, adres: adres, pagina: pagina, keer: 1, laatst: Date.now() })
      l.sort(function (a, b) { return (b.laatst || 0) - (a.laatst || 0) })
      localStorage.setItem(SLEUTEL, JSON.stringify(l.slice(0, 20)))
    } catch (x) {}
  })
  window.fibroHuisregel = {
    lees: lees,
    wis: function () { try { localStorage.removeItem(SLEUTEL) } catch (e) {} }
  }
})()
