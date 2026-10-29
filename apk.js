// apk.js (v1): de Fibro-app voor Android (APK), zie android/LEESMIJ.md.
// - Een downloadknop of -kaart voor wie Fibro op een Android-telefoon in de browser opent.
// - Op de uitnodigingspagina een keuze tussen de app (aanbevolen) en de browser.
// - Kiest iemand bij een uitnodiging voor de app, dan wacht die uitnodiging in dit toestel
//   (localStorage). De app gebruikt dezelfde opslag als Chrome, en login.html stuurt de nieuwe
//   app-gebruiker dan door naar die uitnodiging. Zo wordt hij in de app meteen vrienden met wie hem uitnodigde.
// Een gewoon script (geen module), na taal.js. Zet window.FibroApk.
(function () {
  'use strict'
  if (window.FibroApk) return

  // Vaste downloadlink: de workflow Android-APK zet de nieuwste APK altijd onder deze naam.
  var APK_URL = 'https://github.com/marcelpetrusma84-coder/Fibro/releases/download/apk-nieuwste/fibro.apk'
  var WACHT = 'fibro_uitnodiging_voor_app'
  var WACHT_MAX = 7 * 24 * 3600 * 1000 // een week
  var NIET_NU = 'fibro_apk_niet_nu'
  var NIET_NU_MAX = 30 * 24 * 3600 * 1000 // dertig dagen

  var en = window.FIBRO_EN = window.FIBRO_EN || {}
  Object.assign(en, {
    '📱 Fibro-app voor Android': '📱 Fibro app for Android',
    'Installeer Fibro als app, met een eigen icoon op je telefoon. Het is dezelfde Fibro, met hetzelfde account.': 'Install Fibro as an app, with its own icon on your phone. It is the same Fibro, with the same account.',
    '⬇️ Download de app': '⬇️ Download the app',
    'Android vraagt of je apps uit deze bron wilt toestaan. Dat is normaal: de app komt niet uit de Play Store.': 'Android asks whether to allow apps from this source. That is normal: the app does not come from the Play Store.',
    'Niet nu': 'Not now',
    'Hoe wil je Fibro gebruiken?': 'How do you want to use Fibro?',
    'Aanbevolen': 'Recommended',
    '📱 De Fibro-app': '📱 The Fibro app',
    'Een eigen icoon op je telefoon, en Fibro opent als een echte app. Je uitnodiging wacht in de app op je.': 'Its own icon on your phone, and Fibro opens like a real app. Your invite waits for you in the app.',
    '🌐 Verder in de browser': '🌐 Continue in the browser',
    'Zo ga je verder:': "Here's what to do next:",
    'Wacht tot de download klaar is en tik op het bestand fibro.apk.': 'Wait until the download is done and tap the file fibro.apk.',
    'Sta installeren toe als Android erom vraagt.': 'Allow installing if Android asks.',
    'Open de Fibro-app. Daar maak je je account aan en word je meteen vrienden met {naam}.': 'Open the Fibro app. There you create your account and immediately become friends with {naam}.',
    'Open de Fibro-app. Daar maak je je account aan.': 'Open the Fibro app. There you create your account.',
    'Lukt het niet? Ga verder in de browser': "Doesn't work? Continue in the browser",
    'Open Fibro op je Android-telefoon om de app te installeren. Op de iPhone gebruik je Fibro in Safari: deelicoon, Zet op beginscherm.': 'Open Fibro on your Android phone to install the app. On iPhone, use Fibro in Safari: share icon, Add to Home Screen.',
    'Je gebruikt Fibro nu al als app.': 'You are already using Fibro as an app.'
  })
  function t(s, v) { return window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m }) }

  function isAndroid() { return /Android/i.test(navigator.userAgent || '') }
  // In de app (of als icoon op het startscherm): dan geen downloadknop.
  function inApp() {
    try {
      if ((document.referrer || '').indexOf('android-app://nl.fibro.app') === 0) sessionStorage.setItem('fibro_in_app', '1')
      if (sessionStorage.getItem('fibro_in_app') === '1') return true
    } catch (e) {}
    try { return !!(window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) } catch (e) { return false }
  }
  inApp() // meteen bij het laden: de eerste pagina in de app heeft de app als referrer, en dat onthouden we
  function toonDownload() { return isAndroid() && !inApp() }

  // ── Een uitnodiging die in de app wacht ──
  function isUitnodiging(u) {
    try {
      var x = new URL(u)
      var hier = new URL('invite.html', location.href)
      return x.origin === hier.origin && x.pathname === hier.pathname && /^[A-Za-z0-9-]{6,80}$/.test(x.searchParams.get('token') || '')
    } catch (e) { return false }
  }
  function bewaarUitnodiging(u) {
    if (!isUitnodiging(u)) return false
    try { localStorage.setItem(WACHT, JSON.stringify({ url: u, t: Date.now() })); return true } catch (e) { return false }
  }
  function vergeetUitnodiging() { try { localStorage.removeItem(WACHT) } catch (e) {} }
  function wachtendeUitnodiging() {
    var w = null
    try { w = JSON.parse(localStorage.getItem(WACHT) || 'null') } catch (e) { w = null }
    if (!w) return null
    var leeftijd = Date.now() - Number(w.t)
    if (typeof w.url !== 'string' || !(leeftijd >= 0 && leeftijd < WACHT_MAX) || !isUitnodiging(w.url)) { vergeetUitnodiging(); return null }
    return w.url
  }
  // Alleen in de app, en maar een keer: ligt er een uitnodiging klaar, dan daarheen.
  function hervatUitnodiging() {
    if (!inApp()) return false
    var u = wachtendeUitnodiging()
    if (!u) return false
    vergeetUitnodiging()
    location.replace(u)
    return true
  }

  // ── Opmaak ──
  function stijl() {
    if (document.getElementById('fibro-apk-stijl')) return
    var s = document.createElement('style')
    s.id = 'fibro-apk-stijl'
    s.textContent =
      '.fapk{background:rgba(192,132,252,0.08);border:1px solid rgba(192,132,252,0.45);border-radius:16px;padding:16px;margin:14px 0;text-align:left;color:#f3e8ff;font-family:"DM Sans",system-ui,sans-serif;letter-spacing:normal;text-transform:none}' +
      '.fapk h3{font-size:15px;font-weight:600;margin:0 0 6px;color:#c084fc}' +
      '.fapk p{font-size:13px;line-height:1.55;margin:0 0 12px;color:#d8cfe6}' +
      '.fapk .fapk-klein{font-size:11px;color:#a89cbc;margin:10px 0 0}' +
      '.fapk-knop{display:block;width:100%;box-sizing:border-box;text-align:center;padding:14px;border-radius:14px;border:none;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer;background:linear-gradient(135deg,#c084fc,#f0abfc);color:#1a0a2e;font-family:"DM Sans",system-ui,sans-serif;letter-spacing:normal;text-transform:none;min-height:48px}' +
      '.fapk-tweede{display:block;width:100%;margin-top:10px;padding:12px;background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.18);border-radius:14px;color:#e5e5e5;font-size:14px;cursor:pointer;font-family:inherit;min-height:44px}' +
      '.fapk-badge{display:inline-block;font-size:11px;font-weight:700;color:#1a0a2e;background:#c084fc;border-radius:10px;padding:2px 8px;margin-left:8px;vertical-align:middle}' +
      '.fapk ol{margin:6px 0 0 18px;padding:0}.fapk li{font-size:13px;line-height:1.55;margin-bottom:6px;color:#e5dcf2}' +
      '.fapk-sluit{background:none;border:none;color:#a89cbc;font-size:12px;cursor:pointer;padding:8px 0 0;font-family:inherit}'
    document.head.appendChild(s)
  }
  function el(tag, klasse, tekst) {
    var e = document.createElement(tag)
    if (klasse) e.className = klasse
    if (tekst != null) e.textContent = tekst
    return e
  }
  function downloadKnop(opKlik) {
    var a = el('a', 'fapk-knop', t('⬇️ Download de app'))
    a.href = APK_URL
    a.rel = 'noopener'
    if (opKlik) a.addEventListener('click', opKlik)
    return a
  }

  // Kaart voor login.html, index.html en het welkomstscherm na het aanmelden.
  // opties.sluitbaar: met 'Niet nu' (onthouden voor dertig dagen).
  function kaart(opties) {
    opties = opties || {}
    if (opties.sluitbaar) {
      try { var n = Number(localStorage.getItem(NIET_NU)); if (n && Date.now() - n < NIET_NU_MAX) return null } catch (e) {}
    }
    stijl()
    var k = el('div', 'fapk')
    k.appendChild(el('h3', '', t('📱 Fibro-app voor Android')))
    k.appendChild(el('p', '', t('Installeer Fibro als app, met een eigen icoon op je telefoon. Het is dezelfde Fibro, met hetzelfde account.')))
    k.appendChild(downloadKnop())
    k.appendChild(el('p', 'fapk-klein', t('Android vraagt of je apps uit deze bron wilt toestaan. Dat is normaal: de app komt niet uit de Play Store.')))
    if (opties.sluitbaar) {
      var s = el('button', 'fapk-sluit', t('Niet nu'))
      s.type = 'button'
      s.onclick = function () { try { localStorage.setItem(NIET_NU, String(Date.now())) } catch (e) {} k.remove() }
      k.appendChild(s)
    }
    return k
  }

  // Keuze op de uitnodigingspagina: de app (aanbevolen) of de browser.
  // opties.naam: wie uitnodigt; opties.onWeb: verder in de browser.
  function keuze(opties) {
    opties = opties || {}
    stijl()
    var k = el('div', 'fapk')
    k.style.marginTop = '0'
    var kop = el('h3', '', t('Hoe wil je Fibro gebruiken?'))
    kop.style.fontSize = '17px'; kop.style.color = '#f3e8ff'; kop.style.marginBottom = '12px'
    k.appendChild(kop)

    var app = el('div')
    app.style.cssText = 'background:rgba(192,132,252,0.12);border:1px solid #c084fc;border-radius:14px;padding:14px;'
    var titel = el('h3', '', t('📱 De Fibro-app'))
    titel.appendChild(el('span', 'fapk-badge', t('Aanbevolen')))
    app.appendChild(titel)
    app.appendChild(el('p', '', t('Een eigen icoon op je telefoon, en Fibro opent als een echte app. Je uitnodiging wacht in de app op je.')))
    var stappen = el('div')
    stappen.hidden = true
    app.appendChild(downloadKnop(function () {
      bewaarUitnodiging(location.href)
      stappen.hidden = false
    }))
    app.appendChild(el('p', 'fapk-klein', t('Android vraagt of je apps uit deze bron wilt toestaan. Dat is normaal: de app komt niet uit de Play Store.')))
    k.appendChild(app)

    stappen.style.marginTop = '14px'
    stappen.appendChild(el('p', '', t('Zo ga je verder:')))
    var ol = el('ol')
    ol.appendChild(el('li', '', t('Wacht tot de download klaar is en tik op het bestand fibro.apk.')))
    ol.appendChild(el('li', '', t('Sta installeren toe als Android erom vraagt.')))
    ol.appendChild(el('li', '', opties.naam
      ? t('Open de Fibro-app. Daar maak je je account aan en word je meteen vrienden met {naam}.', { naam: opties.naam })
      : t('Open de Fibro-app. Daar maak je je account aan.')))
    stappen.appendChild(ol)
    k.appendChild(stappen)

    var web = el('button', 'fapk-tweede', t('🌐 Verder in de browser'))
    web.type = 'button'
    web.onclick = function () {
      vergeetUitnodiging()
      try { sessionStorage.setItem('fibro_apk_keuze', 'web') } catch (e) {}
      k.remove()
      if (opties.onWeb) opties.onWeb()
    }
    k.appendChild(web)
    return k
  }
  function webGekozen() { try { return sessionStorage.getItem('fibro_apk_keuze') === 'web' } catch (e) { return false } }

  window.FibroApk = {
    url: APK_URL,
    isAndroid: isAndroid,
    inApp: inApp,
    toonDownload: toonDownload,
    bewaarUitnodiging: bewaarUitnodiging,
    vergeetUitnodiging: vergeetUitnodiging,
    wachtendeUitnodiging: wachtendeUitnodiging,
    hervatUitnodiging: hervatUitnodiging,
    kaart: kaart,
    keuze: keuze,
    webGekozen: webGekozen
  }
})()
