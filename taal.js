// taal.js - Fibro in het Nederlands of in het Engels (v7, 13 oktober 2026, v148)
// v265 (4 november 2026): taal-en.js?v=72 (wachtwoord resetten)
// v265b (4 november 2026): taal-en.js?v=72 (quiz)
// v265c (5 november 2026): taal-en.js?v=67 (uitnodiging)
// v266 (5 november 2026): taal-en.js?v=68 (knop 'Kies een andere naam' bij registreren)
// v266b (5 november 2026): taal-en.js?v=69 (melding als een vriend online komt)
// v266c (5 november 2026): taal-en.js?v=70 (kopje Pushmeldingen in het menu)
// v268 (5 november 2026): taal-en.js?v=71 (menu met inklapbare kopjes)
// v266e (5 november 2026): taal-en.js?v=72 (sleutels controleren)
// v266 (5 november 2026): de app heet nu Stekky (APP hieronder; de Engelse woordenlijst taal-en.js?v=73)
// v269 (5 november 2026): taal-en.js?v=74 (app-slot)
// v270 (5 november 2026): taal-en.js?v=75 (je eigen naam bij het registreren)
// v270b (5 november 2026): taal-en.js?v=76 (Je eigen plekkie, wachtwoord tonen)
// v270c (6 november 2026): taal-en.js?v=77 (herstel korter, herinnering op Home)
// v271 (6 november 2026): taal-en.js?v=79 (nummers uit je playlist verwijderen)
// v273 (6 november 2026): taal-en.js?v=80 (bellen: geluid en microfoon, inloggen tijdens laden)
// v275 (6 november 2026): taal-en.js?v=81 (spreekwolkje in het spel bij een berichtje)
// groepschat (10 november 2026): taal-en.js?v=82 (teksten van groep.html)
// groepschat (10 november 2026): taal-en.js?v=83 (groepen met onbekenden)
// groepschat (10 november 2026): taal-en.js?v=84 (foto's, spraak en stickers in groepen)
// groepschat (10 november 2026): taal-en.js?v=85 (antwoorden, reacties, weghalen, typen in groepen)
// groepschat (10 november 2026): taal-en.js?v=86 (voice chat in groepen)
// groepschat (10 november 2026): taal-en.js?v=87 (webcam chat in groepen)
// groepschat (10 november 2026): taal-en.js?v=88 (profielfoto's en knoppen in de voice chat)
// lijn-iconen (10 november 2026): taal-en.js?v=89 (chatbalk en keuzebalk bij Stijl)
// groepschat (10 november 2026): taal-en.js?v=90 (poll en afspraak)
// groepschat (10 november 2026): taal-en.js?v=91 (groepsmuziek)
// groepschat (10 november 2026): taal-en.js?v=92 (whiteboard)
// groepschat (10 november 2026): taal-en.js?v=93 (wit whiteboard)
// groepschat (10 november 2026): taal-en.js?v=94 (piano)
// Stekky Store (10 november 2026): taal-en.js?v=95
// lettertype-pakketten (11 november 2026): taal-en.js?v=96
// Pesten, het eerste kaartspel (11 november 2026): taal-en.js?v=97
// Pesten alleen via de Store (11 november 2026): taal-en.js?v=99 (98 is voor het spelmenu)
// spelmenu in elk spel (11 november 2026): taal-en.js?v=98
// spelmenu + Pesten samen (11 november 2026): taal-en.js?v=100
// Store voor iedereen (11 november 2026): taal-en.js?v=101
// verwijderen uit de Store (11 november 2026): taal-en.js?v=102
// Store-balken (11 november 2026): taal-en.js?v=103
// Toepen en Eenentwintigen (11 november 2026): taal-en.js?v=104
// kaartstijl Perkament (11 november 2026): taal-en.js?v=105
// Sessielader (12 november 2026, #156): taal-en.js?v=106 (automatisch terug naar Home).
// stickervel Sinterklaas (13 november 2026): taal-en.js?v=107
// lettertypes Sinterklaas (13 november 2026): taal-en.js?v=108
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
// De Engelse woordenlijst (taal-en.js?v=108) wordt alleen bij Engels geladen.
(function () {
  'use strict'
  if (window.T) return
  var SLEUTEL = 'fibro_taal'
  var APP = 'Stekky' // de naam van de app, op één plek

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
    document.write('<script src="' + new URL('taal-en.js?v=108', hier).href + '"><\/script>')
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
