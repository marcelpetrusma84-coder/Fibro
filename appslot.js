// appslot.js (v266, 5 nov 2026): Fibro op slot met Face ID, vingerafdruk of een pincode.
//
// In gewone woorden: zet je het aan (☰ > Instellingen > 🔒 App-slot), dan vraagt Fibro om je gezicht, vingerafdruk of
// pincode als je een tijdje weg was. Standaard UIT. Je kiest zelf na hoe lang: meteen, 1 minuut, 15 minuten of 1 uur.
//  - Meldingen komen gewoon binnen: die toont de telefoon zelf (en er staat nooit in wat iemand schreef).
//  - Bellen gaat altijd direct door: het oproepvenster staat boven het slot, en het belscherm (bellen.html) heeft geen slot.
//  - Tik je op een melding, dan opent Fibro de juiste pagina; na het ontgrendelen zie je meteen die chat.
//  - Pincode vergeten? "Uitloggen": daarna log je opnieuw in met je wachtwoord (dan is het slot ook uit).
// Het slot hoort bij dit toestel en dit account (staat in localStorage). Het is een slot op het scherm: de berichten zelf
// zijn al versleuteld. Een gewoon script (geen module), vroeg in <head> na taal.js, zodat er niets zichtbaar is voor het slot.
;(function () {
  'use strict'
  if (typeof window === 'undefined' || window.FibroSlot) return
  var T = function (s, v) { return window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m }) }

  var SLEUTEL = 'fibro_appslot'          // { aan, minuten, uid, pin:{zout,hash,iter}, cred }
  var ACTIEF = 'fibro_appslot_actief'    // wanneer Fibro voor het laatst in beeld was (ms)
  var POGINGEN = 'fibro_appslot_mis'     // { n, tot } verkeerde pincodes
  var KEUZES = [0, 1, 15, 60]             // minuten; 0 = meteen
  var MARGE_MS = 10000                    // naar een andere pagina van Fibro gaan telt niet als weg (ook niet bij 'meteen')

  function lees(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } }
  function schrijf(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

  // Wie is er ingelogd op dit toestel? (uit de sessie van Supabase, zonder iets te laden)
  function sessieUid() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (!k || k.indexOf('sb-') !== 0 || !/-auth-token$/.test(k)) continue
        var s = JSON.parse(localStorage.getItem(k) || 'null')
        var u = s && (s.user || (s.currentSession && s.currentSession.user))
        if (u && u.id) return u.id
      }
    } catch (e) {}
    return null
  }

  // Moet het slot nu dicht? (puur: makkelijk te testen)
  function moetDicht(inst, nu, laatst, uid) {
    if (!inst || !inst.aan || !inst.pin || !uid || inst.uid !== uid) return false
    if (KEUZES.indexOf(inst.minuten) < 0) return false
    if (!laatst) return true
    return nu - laatst > Math.max(MARGE_MS, inst.minuten * 60000)
  }

  // ── Pincode: alleen een hash op dit toestel (PBKDF2), nooit de code zelf ──
  function b64(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s) }
  function vanB64(t) { var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b }
  function hashPin(pin, zoutB64, iter) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: vanB64(zoutB64), iterations: iter }, k, 256) })
      .then(b64)
  }
  function maakPin(pin) {
    var zout = b64(crypto.getRandomValues(new Uint8Array(16))), iter = 150000
    return hashPin(pin, zout, iter).then(function (hash) { return { zout: zout, hash: hash, iter: iter } })
  }
  function geldigePin(pin) { return /^\d{4,6}$/.test(String(pin)) }
  // Hoe lang wachten na verkeerde pogingen? 5 fout = 30 s, daarna steeds langer (max 15 min)
  function wachtNa(n) { return n < 5 ? 0 : Math.min(15 * 60000, 30000 * Math.pow(2, n - 5)) }

  // ── Face ID / vingerafdruk (WebAuthn op dit toestel) ──
  function kanBiometrie() {
    if (!window.PublicKeyCredential || !navigator.credentials || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false)
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false })
  }
  function b64url(buf) { return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
  function vanB64url(t) { t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return vanB64(t) }
  function maakBiometrie() {
    return navigator.credentials.create({ publicKey: {
      rp: { name: 'Fibro' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'Fibro-slot', displayName: T('Fibro (app-slot)') },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'discouraged', userVerification: 'required' },
      timeout: 60000
    } }).then(function (c) { return b64url(c.rawId) })
  }
  function controleerBiometrie(credId) {
    return navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: vanB64url(credId) }],
      userVerification: 'required',
      timeout: 60000
    } }).then(function (c) {
      var data = c && c.response && c.response.authenticatorData ? new Uint8Array(c.response.authenticatorData) : null
      return !!(data && data.length > 32 && (data[32] & 0x04)) // UV: de gebruiker is echt herkend
    })
  }

  // ── Het slot zelf ──
  var stijl = document.createElement('style')
  stijl.textContent =
    // Meteen vanaf de eerste tekening: alles bedekt (ook voordat <body> er is)
    'html.fibro-slot-dicht::after{content:"";position:fixed;inset:0;z-index:99989;background:#12061f}' +
    'html.fibro-slot-dicht body{overflow:hidden}' +
    // Bellen gaat voor: het oproepvenster van de chat boven het slot (bel-luisteraar.js staat al hoger: 100000)
    'html.fibro-slot-dicht #oproepModal{z-index:100001!important}' +
    '#fibroSlot{position:fixed;inset:0;z-index:99990;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
    'padding:24px;background:radial-gradient(ellipse at 50% 20%,#3b1764,#12061f 70%);color:#f3e8ff;font-family:"DM Sans",system-ui,sans-serif;text-align:center}' +
    '#fibroSlot .fs-slot{font-size:52px}#fibroSlot h1{margin:0;font-size:22px}#fibroSlot p{margin:0;opacity:.8;font-size:14px;max-width:300px}' +
    '#fibroSlot button{min-height:48px;border-radius:24px;border:none;padding:12px 22px;font:inherit;font-weight:700;font-size:16px;cursor:pointer}' +
    '#fibroSlot .fs-hoofd{background:linear-gradient(135deg,#c084fc,#f0abfc);color:#1a0a2e;min-width:240px}' +
    '#fibroSlot .fs-licht{background:none;color:#f3e8ff;opacity:.75;text-decoration:underline;font-weight:400;font-size:14px}' +
    '#fibroSlot input{width:200px;min-height:52px;border-radius:14px;border:1px solid #c084fc88;background:#ffffff14;color:#fff;' +
    'font-size:26px;letter-spacing:.4em;text-align:center}#fibroSlot .fs-fout{color:#fca5a5;min-height:20px;font-size:14px}' +
    '.fs-dialoog{position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;background:#000a;padding:16px}' +
    '.fs-kaart{width:100%;max-width:360px;background:#1a0a2e;border:1px solid #c084fc55;border-radius:16px;padding:18px;color:#f3e8ff;' +
    'font-family:"DM Sans",system-ui,sans-serif;display:flex;flex-direction:column;gap:10px}' +
    '.fs-keuzes{display:flex;flex-wrap:wrap;gap:6px}.fs-kaart h2{margin:0 0 4px;font-size:18px}.fs-kaart p{margin:0;font-size:13px;opacity:.8}' +
    '.fs-kaart button{min-height:44px;border-radius:12px;border:1px solid #c084fc55;background:#ffffff0d;color:#f3e8ff;font:inherit;font-size:15px;cursor:pointer;text-align:left;padding:10px 12px}' +
    '.fs-kaart button[aria-pressed="true"]{background:#c084fc;color:#1a0a2e;font-weight:700}' +
    '.fs-kaart .fs-rij{display:flex;gap:8px}.fs-kaart .fs-rij button{flex:1;text-align:center}' +
    '.fs-kaart input{min-height:48px;border-radius:12px;border:1px solid #c084fc88;background:#ffffff14;color:#fff;font-size:22px;letter-spacing:.3em;text-align:center}' +
    '.fs-kaart .fs-fout{color:#fca5a5;min-height:18px;font-size:13px}'
  ;(document.head || document.documentElement).appendChild(stijl)

  var dicht = false, overlay = null

  function werkActiefBij() { if (!dicht && document.visibilityState !== 'hidden') schrijf(ACTIEF, Date.now()) }

  function sluit() {
    if (dicht) return
    dicht = true
    document.documentElement.classList.add('fibro-slot-dicht')
    if (document.body) toonScherm()
    else document.addEventListener('DOMContentLoaded', toonScherm, { once: true })
  }

  function open() {
    dicht = false
    schrijf(POGINGEN, null)
    document.documentElement.classList.remove('fibro-slot-dicht')
    if (overlay) { overlay.remove(); overlay = null }
    schrijf(ACTIEF, Date.now())
    try { window.dispatchEvent(new CustomEvent('fibro-slot-open')) } catch (e) {}
  }

  function toonScherm() {
    if (!dicht || overlay) return
    var inst = lees(SLEUTEL) || {}
    overlay = document.createElement('div')
    overlay.id = 'fibroSlot'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.innerHTML = '<div class="fs-slot" aria-hidden="true">🔒</div><h1></h1><p class="fs-uitleg"></p>' +
      '<button type="button" class="fs-hoofd fs-bio" hidden></button>' +
      '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" class="fs-pin">' +
      '<div class="fs-fout" role="alert"></div>' +
      '<button type="button" class="fs-hoofd fs-ok"></button>' +
      '<button type="button" class="fs-licht fs-vergeten"></button>'
    overlay.querySelector('h1').textContent = T('Fibro is op slot')
    overlay.querySelector('.fs-uitleg').textContent = inst.cred ? T('Ontgrendel met Face ID of je vingerafdruk, of typ je pincode.') : T('Typ je pincode.')
    var bio = overlay.querySelector('.fs-bio'), pin = overlay.querySelector('.fs-pin'), fout = overlay.querySelector('.fs-fout')
    var ok = overlay.querySelector('.fs-ok'), vergeten = overlay.querySelector('.fs-vergeten')
    pin.setAttribute('aria-label', T('Pincode'))
    pin.placeholder = '••••'
    ok.textContent = T('Ontgrendelen')
    vergeten.textContent = T('Pincode vergeten? Uitloggen')
    if (inst.cred) {
      bio.hidden = false
      bio.textContent = T('🙂 Face ID of vingerafdruk')
      bio.onclick = function () { // in de tik zelf: anders vraagt de iPhone niets
        fout.textContent = ''
        controleerBiometrie(inst.cred).then(function (goed) { if (goed) open(); else fout.textContent = T('Niet herkend. Probeer het nog eens of typ je pincode.') },
          function () { fout.textContent = T('Niet gelukt. Probeer het nog eens of typ je pincode.') })
      }
    }
    function probeer() {
      var mis = lees(POGINGEN) || { n: 0, tot: 0 }
      if (mis.tot && Date.now() < mis.tot) { fout.textContent = T('Te vaak fout. Wacht nog {s} seconden.', { s: Math.ceil((mis.tot - Date.now()) / 1000) }); return }
      var code = pin.value.trim()
      if (!geldigePin(code)) { fout.textContent = T('Een pincode heeft 4 tot 6 cijfers.'); return }
      ok.disabled = true
      hashPin(code, inst.pin.zout, inst.pin.iter).then(function (h) {
        ok.disabled = false
        if (h === inst.pin.hash) { open(); return }
        mis.n++
        var w = wachtNa(mis.n)
        mis.tot = w ? Date.now() + w : 0
        schrijf(POGINGEN, mis)
        pin.value = ''
        fout.textContent = w ? T('Te vaak fout. Wacht nog {s} seconden.', { s: Math.ceil(w / 1000) }) : T('Verkeerde pincode.')
      }, function () { ok.disabled = false; fout.textContent = T('Dat lukte niet. Probeer het nog eens.') })
    }
    ok.onclick = probeer
    pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') probeer() })
    vergeten.onclick = function () {
      if (!confirm(T('Uitloggen? Daarna log je opnieuw in met je gebruikersnaam en wachtwoord. Het app-slot staat dan uit.'))) return
      uitloggen()
    }
    document.body.appendChild(overlay)
    if (!inst.cred) setTimeout(function () { try { pin.focus() } catch (e) {} }, 50)
  }

  // Pincode vergeten: de sessie op dit toestel weg en het slot uit; inloggen met wachtwoord kan altijd
  function uitloggen() {
    try {
      var weg = []
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sb-') === 0 && /-auth-token$/.test(k)) weg.push(k) }
      weg.forEach(function (k) { localStorage.removeItem(k) })
    } catch (e) {}
    schrijf(SLEUTEL, null); schrijf(POGINGEN, null); schrijf(ACTIEF, null)
    var pad = location.pathname.indexOf('/spellen/') >= 0 ? '../login.html' : 'login.html'
    location.href = pad
  }

  function controleer() {
    if (dicht) return
    if (moetDicht(lees(SLEUTEL), Date.now(), lees(ACTIEF), sessieUid())) sluit()
    else werkActiefBij()
  }

  // ── Instellingen (☰ > Instellingen > 🔒 App-slot) ──
  function stand() {
    var inst = lees(SLEUTEL)
    if (!inst || !inst.aan || inst.uid !== sessieUid()) return T('uit')
    return inst.minuten === 0 ? T('meteen') : inst.minuten === 60 ? T('na 1 uur') : T('na {n} min', { n: inst.minuten })
  }

  function openInstellingen(opKlaar) {
    var uid = sessieUid()
    if (!uid) return
    var inst = lees(SLEUTEL)
    if (!inst || inst.uid !== uid) inst = { aan: false, minuten: 1, uid: uid, pin: null, cred: null }
    var d = document.createElement('div')
    d.className = 'fs-dialoog'
    d.innerHTML = '<div class="fs-kaart" role="dialog" aria-modal="true" aria-labelledby="fsTitel"><h2 id="fsTitel"></h2><p class="fs-p1"></p>' +
      '<div class="fs-keuzes"></div><div class="fs-pinvak" hidden><p class="fs-p2"></p>' +
      '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" class="fs-pin1">' +
      '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" class="fs-pin2"></div>' +
      '<button type="button" class="fs-bio" hidden></button><div class="fs-fout" role="alert"></div>' +
      '<div class="fs-rij"><button type="button" class="fs-annuleer"></button><button type="button" class="fs-bewaar" aria-pressed="true"></button></div></div>'
    var q = function (s) { return d.querySelector(s) }
    q('#fsTitel').textContent = T('🔒 App-slot')
    q('.fs-p1').textContent = T('Fibro vraagt om Face ID, je vingerafdruk of een pincode als je een tijdje weg was. Meldingen komen gewoon binnen en bellen gaat altijd direct door.')
    q('.fs-p2').textContent = T('Kies een pincode van 4 tot 6 cijfers (twee keer). Die heb je nodig als Face ID of je vingerafdruk niet lukt.')
    q('.fs-pin1').placeholder = T('Pincode'); q('.fs-pin2').placeholder = T('Nog een keer')
    q('.fs-pin1').setAttribute('aria-label', T('Pincode')); q('.fs-pin2').setAttribute('aria-label', T('Pincode nog een keer'))
    q('.fs-annuleer').textContent = T('Annuleren'); q('.fs-bewaar').textContent = T('Bewaren')
    var keuze = inst.aan ? inst.minuten : -1, cred = inst.cred
    var opties = [[-1, T('Uit')], [0, T('Meteen')], [1, T('Na 1 minuut')], [15, T('Na 15 minuten')], [60, T('Na 1 uur')]]
    var knoppen = opties.map(function (o) {
      var b = document.createElement('button')
      b.type = 'button'; b.textContent = o[1]
      b.onclick = function () { keuze = o[0]; teken() }
      q('.fs-keuzes').appendChild(b)
      return [o[0], b]
    })
    var bio = q('.fs-bio')
    kanBiometrie().then(function (kan) { if (kan) { bio.dataset.kan = '1'; teken() } })
    bio.onclick = function () {
      if (cred) { cred = null; teken(); return }
      q('.fs-fout').textContent = ''
      maakBiometrie().then(function (id) { cred = id; teken() }, function () { q('.fs-fout').textContent = T('Face ID of vingerafdruk instellen lukte niet. De pincode werkt wel.') })
    }
    function teken() {
      knoppen.forEach(function (k) { k[1].setAttribute('aria-pressed', k[0] === keuze ? 'true' : 'false') })
      q('.fs-pinvak').hidden = keuze < 0 || !!inst.pin
      bio.hidden = keuze < 0 || !bio.dataset.kan
      bio.textContent = cred ? T('🙂 Face ID / vingerafdruk: aan (tik om uit te zetten)') : T('🙂 Ook Face ID of vingerafdruk gebruiken')
    }
    teken()
    function weg() { d.remove() }
    q('.fs-annuleer').onclick = weg
    d.addEventListener('click', function (e) { if (e.target === d) weg() })
    q('.fs-bewaar').onclick = function () {
      var fout = q('.fs-fout')
      if (keuze < 0) {
        schrijf(SLEUTEL, { aan: false, minuten: inst.minuten, uid: uid, pin: null, cred: null })
        weg(); if (opKlaar) opKlaar(stand()); return
      }
      var klaar = function (pinData) {
        schrijf(SLEUTEL, { aan: true, minuten: keuze, uid: uid, pin: pinData, cred: cred || null })
        schrijf(ACTIEF, Date.now())
        weg(); if (opKlaar) opKlaar(stand())
      }
      if (inst.pin) { klaar(inst.pin); return }
      var p1 = q('.fs-pin1').value.trim(), p2 = q('.fs-pin2').value.trim()
      if (!geldigePin(p1)) { fout.textContent = T('Een pincode heeft 4 tot 6 cijfers.'); return }
      if (p1 !== p2) { fout.textContent = T('De twee pincodes zijn niet hetzelfde.'); return }
      maakPin(p1).then(klaar, function () { fout.textContent = T('Dat lukte niet. Probeer het nog eens.') })
    }
    document.body.appendChild(d)
  }

  window.FibroSlot = { openInstellingen: openInstellingen, stand: stand, _intern: { moetDicht: moetDicht, wachtNa: wachtNa, geldigePin: geldigePin, hashPin: hashPin, maakPin: maakPin, sessieUid: sessieUid, KEUZES: KEUZES, MARGE_MS: MARGE_MS } }

  controleer()
  setInterval(werkActiefBij, 15000)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (!dicht) schrijf(ACTIEF, Date.now()) }
    else controleer()
  })
  window.addEventListener('pagehide', function () { if (!dicht) schrijf(ACTIEF, Date.now()) })
  window.addEventListener('pageshow', function (e) { if (e.persisted) controleer() }) // terug uit de cache van de browser
})()
