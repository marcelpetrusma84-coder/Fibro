// taal.js - Fibro in het Nederlands of in het Engels (v7, 13 oktober 2026, v148)
//
// In gewone woorden: dit bestand weet welke taal je gekozen hebt en vertaalt de teksten.
// De Nederlandse zin is zelf de sleutel: T('Opslaan') geeft in het Nederlands 'Opslaan' en in
// het Engels wat er in taal-en.js bij 'Opslaan' staat. Ontbreekt een vertaling, dan staat er
// gewoon Nederlands (en in de console een regel '[taal] nog geen vertaling: ...').
//
// Welke taal:
//   1. wat je zelf gekozen hebt (localStorage 'fibro_taal' = 'nl' of 'en'): in het menu op Home,
//      of bovenaan het inlogscherm en de uitnodiging;
//   2. anders, als dit toestel Fibro al kent (ingelogd geweest): Nederlands, zoals het altijd was;
//   3. anders de taal van de browser: begint die met 'nl', dan Nederlands, anders Engels.
//
// Gebruik:
//   T('Opslaan')                       vaste tekst in de code
//   T('{n} stemmen', { n: 3 })          met invulplekken; {app} is altijd de naam van de app
//   T('lettertype|Bellen')             met een context ervoor, als hetzelfde woord twee dingen betekent
//                                      (bellen = opbellen / bubbels); in het Nederlands valt 'lettertype|' weg
//   <div data-t>Inloggen</div>          vaste tekst in de html (ook met <b>/<span> erin)
//   <input data-t-attr="placeholder,title" placeholder="...">   tekst in een attribuut
//   T.taal ('nl' of 'en'), T.locale ('nl-NL' of 'en-GB'), T.kies('en'), T.bewaar()
//
// Alleen pagina's met <html data-taal> krijgen lang="en" (die zijn al vertaald).
// In het Nederlands doet dit bestand verder niets met de pagina: alles blijft precies zoals het was.
// Een gewoon script (geen module), vroeg geladen: direct na huisregel.js.
// De Engelse woordenlijst (taal-en.js?v=46) wordt alleen bij Engels geladen.
(function () {
  'use strict'
  if (window.T) return
  var SLEUTEL = 'fibro_taal'
  var APP = 'Fibro' // de naam van de app, op één plek

  function bepaal() {
    try {
      var k = localStorage.getItem(SLEUTEL)
      if (k === 'nl' || k === 'en') return k
      for (var i = 0; i < localStorage.length; i++) {
        var s = localStorage.key(i) || ''
        if (s === SLEUTEL) continue
        if (s.indexOf('fibro_') === 0 || (s.indexOf('sb-') === 0 && s.slice(-11) === '-auth-token')) return 'nl'
      }
    } catch (e) {}
    var l = ''
    try { l = (navigator.languages && navigator.languages[0]) || navigator.language || '' } catch (e) {}
    return /^nl\b/i.test(l) ? 'nl' : 'en'
  }

  var taal = bepaal()
  var gemeld = {}
  var heeft = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k) }
  var norm = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim() }
  function mis(k) {
    if (gemeld[k]) return
    gemeld[k] = true
    try { console.warn('[taal] nog geen vertaling:', k) } catch (e) {}
  }
  function vul(s, v) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      if (v && heeft(v, k)) return String(v[k])
      return k === 'app' ? APP : m
    })
  }

  function T(nl, v) {
    var s = (typeof nl === 'string' && /^[a-z]+\|/.test(nl)) ? nl.slice(nl.indexOf('|') + 1) : nl
    if (taal === 'en') {
      var l = window.FIBRO_EN
      if (heeft(l, nl)) s = l[nl]
      else if (l) mis(nl)
    }
    return vul(s, v)
  }
  T.taal = taal
  T.locale = taal === 'en' ? 'en-GB' : 'nl-NL'
  T.app = APP
  T.bewaar = function () { try { localStorage.setItem(SLEUTEL, taal) } catch (e) {} }
  T.kies = function (code) {
    if (code !== 'nl' && code !== 'en') return
    try { localStorage.setItem(SLEUTEL, code) } catch (e) {}
    if (code !== taal) location.reload()
  }
  window.T = T

  if (taal !== 'en') return

  // ---- Engels: de woordenlijst laden en de vaste tekst in de html vertalen ----
  var html = document.documentElement
  if (html && html.hasAttribute('data-taal')) html.setAttribute('lang', 'en')
  try {
    var hier = (document.currentScript && document.currentScript.src) || location.href
    document.write('<script src="' + new URL('taal-en.js?v=46', hier).href + '"><\/script>')
  } catch (e) {}

  function vertaal(el) {
    var l = window.FIBRO_EN
    if (!l || !el || el.nodeType !== 1) return
    if (!el.__tKlaar && el.hasAttribute('data-t')) {
      var metHtml = el.children.length > 0
      var nu = norm(metHtml ? el.innerHTML : el.textContent)
      if (heeft(l, nu)) {
        el.__tKlaar = true
        if (metHtml) el.innerHTML = vul(l[nu]); else el.textContent = vul(l[nu])
      }
    }
    if (!el.__tAttr && el.hasAttribute('data-t-attr')) {
      el.__tAttr = true
      el.getAttribute('data-t-attr').split(',').forEach(function (n) {
        n = n.trim()
        var w = el.getAttribute(n)
        if (w == null) return
        var k = norm(w)
        if (heeft(l, k)) el.setAttribute(n, vul(l[k])); else mis(k)
      })
    }
  }
  function kijk(n) {
    if (n && n.nodeType === 3) n = n.parentNode
    if (!n || n.nodeType !== 1) return
    var e = n.closest('[data-t]')
    if (e) vertaal(e)
    if (n.hasAttribute('data-t-attr')) vertaal(n)
    var binnen = n.querySelectorAll('[data-t],[data-t-attr]')
    for (var i = 0; i < binnen.length; i++) vertaal(binnen[i])
  }
  function alles() {
    var a = document.querySelectorAll('[data-t],[data-t-attr]')
    for (var i = 0; i < a.length; i++) {
      vertaal(a[i])
      if (window.FIBRO_EN && a[i].hasAttribute('data-t') && !a[i].__tKlaar) {
        mis(norm(a[i].children.length ? a[i].innerHTML : a[i].textContent))
      }
    }
  }
  T.vertaalPagina = alles
  // Terwijl de pagina binnenkomt: elk stukje meteen vertalen, nog voordat het op het scherm staat
  try {
    var mo = new MutationObserver(function (lijst) {
      for (var i = 0; i < lijst.length; i++) {
        kijk(lijst[i].target)
        var nieuw = lijst[i].addedNodes
        for (var j = 0; j < nieuw.length; j++) kijk(nieuw[j])
      }
    })
    mo.observe(html, { childList: true, subtree: true, characterData: true })
    document.addEventListener('DOMContentLoaded', function () { alles(); mo.disconnect() })
  } catch (e) {
    document.addEventListener('DOMContentLoaded', alles)
  }
})()
