// pushnamen.js (v1, 5 nov 2026, v270): in een pushmelding de eigen naam van je vriend ERBIJ, als je die kent.
//
// Een pushmelding komt van de server ("📞 ChonkyCapibara404 belt je"). De server kent alleen gebruikersnamen: je
// eigen naam (weergavenaam) staat niet op de server, die gaat versleuteld tussen vrienden (sync.js, postbus.js).
// Daarom zet de telefoon van de ONTVANGER de naam er zelf in: "📞 Sanne de Vries aka ChonkyCapibara404 belt je".
// Kent jouw telefoon de eigen naam van die vriend nog niet, dan blijft het alleen de gebruikersnaam.
//
// Hoe: Chat en Vrienden zetten een lijstje { gebruikersnaam: eigen naam } van je vrienden in het kastje 'fibro-badge'
// (sleutel 'fibro-pushnamen'), waar de portier (service-worker.js) bij kan. De portier laadt dit bestand
// (importScripts) en past naamInMelding toe op de tekst van elke melding.
// Een gewoon script (geen module), zodat de portier het kan laden; op een pagina mag je het ook importeren.
;(function (g) {
  'use strict'
  var KAST = 'fibro-badge', SLEUTEL = 'fibro-pushnamen', NAAM_MAX = 40

  function schoon(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, NAAM_MAX).trim() }

  // { gebruikersnaam: eigen naam } voor de vrienden waarvan dit toestel een eigen naam kent (die anders is dan de gebruikersnaam)
  function maakNamenLijst(eigenId, vrienden, ls) {
    var lijst = {}
    if (!eigenId || !vrienden || !ls) return lijst
    for (var i = 0; i < vrienden.length; i++) {
      var v = vrienden[i]
      if (!v || typeof v.id !== 'string' || typeof v.username !== 'string' || !v.username) continue
      var naam = ''
      try { naam = schoon(ls.getItem('vriend_naam_' + v.id + '_' + eigenId)) } catch (e) {}
      if (naam && naam !== v.username) lijst[v.username] = naam
    }
    return lijst
  }

  function isLetter(c) { return !!c && /[\p{L}\p{N}_]/u.test(c) }

  // De tekst van een melding met de eigen naam erbij: "Bram belt je" -> "Bram de Boer aka Bram belt je".
  // Alleen een hele gebruikersnaam telt (niet midden in een ander woord), en alleen de eerste keer.
  function naamInMelding(tekst, lijst) {
    tekst = String(tekst == null ? '' : tekst)
    if (!lijst || typeof lijst !== 'object') return tekst
    var namen = Object.keys(lijst).sort(function (a, b) { return b.length - a.length }) // langste eerst
    for (var i = 0; i < namen.length; i++) {
      var gebruiker = namen[i], eigen = schoon(lijst[gebruiker])
      if (!gebruiker || !eigen || eigen === gebruiker) continue
      var plek = -1, van = 0
      while ((plek = tekst.indexOf(gebruiker, van)) !== -1) {
        if (!isLetter(tekst.charAt(plek - 1)) && !isLetter(tekst.charAt(plek + gebruiker.length))) break
        van = plek + 1
      }
      if (plek === -1) continue
      if (tekst.slice(Math.max(0, plek - eigen.length - 5), plek) === eigen + ' aka ') return tekst // staat er al
      return tekst.slice(0, plek) + eigen + ' aka ' + tekst.slice(plek)
    }
    return tekst
  }

  // Op een pagina: het lijstje voor de portier klaarzetten (stil; lukt het niet, dan gewoon alleen gebruikersnamen)
  function bewaar(eigenId, vrienden) {
    try {
      if (!g.caches || !g.localStorage) return Promise.resolve(false)
      var lijst = maakNamenLijst(eigenId, vrienden, g.localStorage)
      return g.caches.open(KAST).then(function (k) {
        return k.put(SLEUTEL, new Response(JSON.stringify(lijst), { headers: { 'Content-Type': 'application/json' } }))
      }).then(function () { return true }, function () { return false })
    } catch (e) { return Promise.resolve(false) }
  }

  // In de portier: het lijstje lezen (of {} als er niets is)
  function lees() {
    try {
      return g.caches.open(KAST).then(function (k) { return k.match(SLEUTEL) })
        .then(function (r) { return r ? r.json() : {} })
        .then(function (l) { return l && typeof l === 'object' ? l : {} }, function () { return {} })
    } catch (e) { return Promise.resolve({}) }
  }

  g.FibroPushNamen = { KAST: KAST, SLEUTEL: SLEUTEL, maakNamenLijst: maakNamenLijst, naamInMelding: naamInMelding, bewaar: bewaar, lees: lees }
})(typeof self !== 'undefined' ? self : globalThis)
