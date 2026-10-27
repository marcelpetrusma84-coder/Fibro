// foutmelder.js (v1, Fibro v221): wat er technisch misgaat in de app, naar de tabel foutmeldingen (sql/foutmeldingen.sql).
// Moderators lezen ze op Moderatie > Foutmeldingen. Staat zo vroeg mogelijk op elke pagina (direct na huisregel.js),
// zodat ook fouten tijdens het laden meekomen.
//
// Privacy: er gaat geen account, geen bericht en geen naam mee. Uit elke tekst haalt dit bestand eerst internetadressen
// (alleen de bestandsnaam blijft over, zonder ?... of #...), id's (uuid's) en foto-/geluidsgegevens (data:...).
// Gevangen worden alleen echte fouten: een script dat vastloopt (soort 'fout') en een belofte die mislukt zonder dat
// iemand het opvangt (soort 'belofte'). Geen console-berichten, geen klikken, geen gedrag.
//
// Zuinig: dezelfde fout gaat per pagina maar een keer mee, hoogstens 10 per pagina, en van hetzelfde toestel hoogstens
// een keer per 10 minuten. Zonder internet bewaart het toestel er hoogstens 20 en stuurt ze later.
;(function () {
  if (typeof window === 'undefined' || window.__fibroFoutmelder) return

  const URL_RPC = 'https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/rpc/meld_fout'
  const SLEUTEL_API = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
  const WACHTRIJ = 'fibro_foutmelder_wacht'
  const LAATST = 'fibro_foutmelder_laatst'
  const MAX_PER_PAGINA = 10
  const RUST_MS = 10 * 60 * 1000
  const MAX_WACHT = 20

  // Ruis die niets over Fibro zegt
  const NEGEER = [
    /ResizeObserver loop/i,
    /^Script error\.?$/i,                       // fout uit een ander domein, zonder inhoud
    /(chrome|moz|safari|safari-web)-extension:/i, // browserextensies van de gebruiker
    /webkit-masked-url/i,
    /^AbortError\b/,                            // verzoek afgebroken omdat je wegging
    /The user aborted a request/i
  ]

  function schoon (tekst, max) {
    let s = String(tekst == null ? '' : tekst)
    s = s.replace(/data:[a-z0-9.+\/-]+;base64,[A-Za-z0-9+\/=]+/gi, 'data:…')
    s = s.replace(/blob:[^\s)'"]+/gi, 'blob:…')
    // internetadres -> alleen de bestandsnaam (met :regel:kolom als die er staat), zonder ?... en #...
    s = s.replace(/\b(?:https?|wss?):\/\/[^\s)'"<>]+/gi, function (adres) {
      const m = /^[a-z]+:\/\/([^\/?#]+)([^?#]*)(?:[?#][^\s]*?)?((?::\d+){0,2})$/i.exec(adres)
      if (!m) return '…'
      const host = m[1], pad = m[2] || '/'
      const eigen = /github\.io$/i.test(host) || /^localhost(:\d+)?$/i.test(host) || host === location.host
      const naam = pad.split('/').filter(Boolean).pop() || ''
      const kort = naam.replace(/[?#].*$/, '')
      const regel = m[3] || ''
      return (eigen ? kort || '/' : host + '/' + kort) + regel
    })
    s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<pas>') // inlogpassen (JWT)
    s = s.replace(/\s+\n/g, '\n').trim()
    return max && s.length > max ? s.slice(0, max - 1) + '…' : s
  }

  function pagina () {
    const p = location.pathname.split('/').filter(Boolean)
    const naam = location.pathname.slice(-1) === '/' ? 'index.html' : (p.pop() || 'index.html')
    return (p.length && p[p.length - 1] === 'spellen' ? 'spellen/' : '') + naam
  }

  function toestel () {
    const ua = navigator.userAgent || ''
    let os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Steam ?Deck|SteamOS/i.test(ua) ? 'Steam Deck' : /CrOS/.test(ua) ? 'ChromeOS' : /Windows/.test(ua) ? 'Windows'
      : /Macintosh/.test(ua) ? (navigator.maxTouchPoints > 1 ? 'iPad' : 'Mac') : /Linux/.test(ua) ? 'Linux' : 'onbekend'
    const ios = /OS (\d+)_(\d+)/.exec(ua)
    if (ios && (os === 'iPhone' || os === 'iPad')) os += ' iOS ' + ios[1] + '.' + ios[2]
    const and = /Android (\d+(?:\.\d+)?)/.exec(ua)
    if (and && os === 'Android') os += ' ' + and[1]
    let br = 'browser'
    let m
    if ((m = /Edg\/(\d+)/.exec(ua))) br = 'Edge ' + m[1]
    else if ((m = /Firefox\/(\d+)/.exec(ua))) br = 'Firefox ' + m[1]
    else if ((m = /(?:Chrome|CriOS)\/(\d+)/.exec(ua))) br = 'Chrome ' + m[1]
    else if ((m = /Version\/(\d+(?:\.\d+)?).*Safari/.exec(ua))) br = 'Safari ' + m[1]
    let app = ''
    try { if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) app = ' · beginscherm' } catch (e) {}
    return (os + ' · ' + br + app).slice(0, 200)
  }

  function lees (k, standaard) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? standaard : v } catch (e) { return standaard } }
  function schrijf (k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

  function pasVanGebruiker () {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.indexOf('sb-') === 0 && k.slice(-11) === '-auth-token') {
          const s = JSON.parse(localStorage.getItem(k) || 'null')
          if (s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 30000)) return s.access_token
        }
      }
    } catch (e) {}
    return null
  }

  function verstuur (melding) {
    const kop = { 'Content-Type': 'application/json', apikey: SLEUTEL_API }
    const pas = pasVanGebruiker()
    if (pas) kop.Authorization = 'Bearer ' + pas
    return fetch(URL_RPC, { method: 'POST', headers: kop, body: JSON.stringify(melding), keepalive: true, credentials: 'omit' })
      .then(function (r) { if (!r.ok && r.status >= 500) throw new Error('server ' + r.status) })
  }

  function bewaarVoorLater (melding) {
    const rij = lees(WACHTRIJ, [])
    if (!Array.isArray(rij)) return
    rij.push(melding)
    schrijf(WACHTRIJ, rij.slice(-MAX_WACHT))
  }

  function stuurWachtrij () {
    if (navigator.onLine === false) return
    const rij = lees(WACHTRIJ, [])
    if (!Array.isArray(rij) || !rij.length) return
    schrijf(WACHTRIJ, [])
    rij.slice(0, MAX_WACHT).forEach(function (m) { verstuur(m).catch(function () { bewaarVoorLater(m) }) })
  }

  const gezien = new Set()
  let aantal = 0

  function meld (soort, bericht, bron, stapel) {
    try {
      const b = schoon(bericht, 300)
      if (!b || NEGEER.some(function (r) { return r.test(b) || r.test(String(bron || '')) })) return
      const melding = {
        p_pagina: pagina(),
        p_soort: soort,
        p_bericht: b,
        p_bron: schoon(bron, 200) || null,
        p_stapel: schoon(stapel, 1500) || null,
        p_toestel: toestel()
      }
      const merk = melding.p_pagina + '|' + soort + '|' + b + '|' + (melding.p_bron || '')
      if (gezien.has(merk) || aantal >= MAX_PER_PAGINA) return
      gezien.add(merk); aantal++
      const laatst = lees(LAATST, {})
      const nu = Date.now()
      if (laatst && typeof laatst === 'object' && laatst[merk] && nu - laatst[merk] < RUST_MS) return
      const nieuw = {}
      for (const k in laatst) if (nu - laatst[k] < RUST_MS) nieuw[k] = laatst[k]
      nieuw[merk] = nu
      schrijf(LAATST, nieuw)
      if (navigator.onLine === false) { bewaarVoorLater(melding); return }
      verstuur(melding).catch(function () { bewaarVoorLater(melding) })
    } catch (e) { /* de foutmelder mag zelf nooit iets laten vastlopen */ }
  }

  window.addEventListener('error', function (e) {
    if (!e || (e.target && e.target !== window)) return // een plaatje of script dat niet laadt: geen scriptfout
    const fout = e.error
    const bron = (e.filename || '') + (e.lineno ? ':' + e.lineno + (e.colno ? ':' + e.colno : '') : '')
    const tekst = fout && fout.name && fout.message ? fout.name + ': ' + fout.message : (e.message || 'Onbekende fout')
    meld('fout', tekst, bron, fout && fout.stack)
  })

  window.addEventListener('unhandledrejection', function (e) {
    const r = e && e.reason
    let tekst
    if (r && typeof r === 'object' && (r.name || r.message)) tekst = (r.name || 'Error') + ': ' + (r.message || '')
    else { try { tekst = typeof r === 'string' ? r : JSON.stringify(r) } catch (x) { tekst = String(r) } }
    meld('belofte', tekst || 'Mislukte belofte zonder reden', '', r && r.stack)
  })

  window.addEventListener('online', stuurWachtrij)
  setTimeout(stuurWachtrij, 3000)

  window.__fibroFoutmelder = { schoon: schoon, toestel: toestel, pagina: pagina, meld: meld }
})()
