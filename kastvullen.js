// kastvullen.js - de kast van de portier aanvullen (v127)
// De portier (service-worker.js) legt een bestand pas in zijn kast als het een keer
// met internet geladen is. Een spel dat je nog nooit gestart hebt, of een pagina die
// je nog niet bezocht hebt, werkt dan zonder internet niet. Dit bestand loopt met
// internet, op de achtergrond, de pagina's na en alles wat ze laden (scripts, spellen,
// lettertypen), en haalt alleen wat nog ontbreekt. Wat al in de kast ligt, kost geen
// internet. Hoogstens eens per 6 uur.
// v172: ook de plaatjes en geluiden van de stickers (de portier bewaart ze in zijn eigen kast 'fibro-media-<n>').
// Welke dat zijn, leest dit bestand uit stickervellen.js en stickerfx.js, en wel de versies die de pagina's nu laden
// (de nieuwste ?v= die het onderweg tegenkomt). Een nieuw stickervel of een nieuw geluid doet dus vanzelf mee.
// v203 (sneller): begint al kort nadat Home klaar is (was: na 6 seconden), en eerst met Chat en Vrienden (daar ga je
// meestal heen). Na elke update meteen opnieuw (het versienummer van Fibro staat in het stempel; was: pas na 6 uur).
// De pagina's zelf altijd vers ophalen (een kleine vraag als er niets veranderd is): de kopie in de kast kan van voor
// een update zijn, en dan vond dit bestand de nieuwe scripts niet. De allereerste keer even wachten tot de portier
// de pagina heeft overgenomen.

const PAGINAS = ['chat.html', 'vrienden.html', 'index.html', 'profiel.html', 'vriend-profiel.html', 'spel.html']
const WACHT_UUR = 6
const STEMPEL = 'fibro_kast_gevuld'
const MAX_TEKST = 400000 // grotere bestanden (Phaser) niet doorzoeken
// Verwijzingen zoals './sync.js?v=149', "lettertypen/basis.css?v=1" of '../phaser.min.js?v=1'
const VERWIJZING = /["'(`]((?:\.{1,2}\/)?[\w\/.-]+\.(?:js|css)\?v=\d+)["')`]/g
// Lettertypen: alleen de gewone Latijnse set, zoals de browser die meestal nodig heeft
const LETTER = /url\(\s*['"]?([\w.\/-]*-latin-\d[\w-]*\.woff2)['"]?\s*\)/g

let bezig = false

export async function vulKast(versie) {
  if (bezig) return
  bezig = true
  try {
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
      // v203: de allereerste keer neemt de portier de pagina pas over als hij geinstalleerd is
      await new Promise(ok => { navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true }); setTimeout(ok, 15000) })
    }
    if (!navigator.onLine || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller || !window.caches) return
    let vorige = null
    try { vorige = JSON.parse(localStorage.getItem(STEMPEL) || 'null') } catch (e) {}
    const kasten = await caches.keys()
    const naam = kasten.find(k => /^fibro-v\d+$/.test(k))
    if (!naam) return
    const media = kasten.find(k => /^fibro-media-\d+$/.test(k)) // v172: alleen bij een nieuwe portier
    if (vorige && vorige.kast === naam && vorige.media === media && (vorige.versie || null) === (versie || null) &&
        Date.now() - vorige.tijd < WACHT_UUR * 3600000) return
    const kast = await caches.open(naam)
    const basis = new URL('./', location.href)
    const gezien = new Set()
    const rij = []
    const voegToe = (ref, van) => {
      let u
      try { u = new URL(ref, van) } catch (e) { return }
      if (u.origin !== location.origin || !u.pathname.startsWith(basis.pathname)) return
      u.hash = ''
      if (gezien.has(u.href)) return
      gezien.add(u.href)
      rij.push(u)
    }
    for (const p of PAGINAS) voegToe(p, basis)
    let gehaald = 0
    let mislukt = 0 // geen verbinding: de volgende keer opnieuw
    const ontbreekt = [] // bestaat niet (404): melden, niet steeds opnieuw proberen
    let vellen = null, fx = null // v172: stickervellen.js en stickerfx.js zoals de pagina's ze laden
    const versieVan = u => (u ? Number(u.searchParams.get('v')) || 0 : -1)
    while (rij.length) {
      if (!navigator.onLine) return // halverwege internet kwijt: de volgende keer verder
      const u = rij.shift()
      const isPagina = u.pathname.endsWith('.html') && !u.search
      const isVersie = u.searchParams.has('v') && /\.(js|css)$/.test(u.pathname)
      const isLetter = /\/lettertypen\/[a-z0-9-]+\.woff2$/.test(u.pathname)
      if (!isPagina && !isVersie && !isLetter) continue
      let res = isPagina ? null : await kast.match(u.href) // v203: pagina's altijd vers (zie boven)
      if (!res) {
        try {
          if (isPagina) {
            // Pagina's bewaart de portier alleen als je ze opent; hier zelf in de kast
            // leggen, onder hetzelfde adres als de portier gebruikt (zonder ?...).
            const r = await fetch(u.href, { cache: 'no-cache' })
            if (r.ok && r.type === 'basic') { await kast.put(u.href, r.clone()); res = r } else ontbreekt.push(u.pathname)
          } else {
            // Scripts, css en lettertypen gaan via de portier, en die legt ze zelf in de kast.
            const r = await fetch(u.href)
            if (r.ok) { res = r; gehaald++ } else ontbreekt.push(u.pathname)
          }
        } catch (e) { mislukt++ }
        if (!res && isPagina) res = await kast.match(u.href) // v203: vers lukte niet: dan de kopie, voor de rest
        if (!isPagina) await new Promise(k => setTimeout(k, 50)) // rustig aan, de pagina gaat voor
      }
      if (!res || isLetter) continue
      let tekst = ''
      try { tekst = await res.text() } catch (e) { continue }
      if (tekst.length > MAX_TEKST) continue
      if (/\/stickervellen\.js$/.test(u.pathname) && versieVan(u) > versieVan(vellen)) vellen = u
      if (/\/stickerfx\.js$/.test(u.pathname) && versieVan(u) > versieVan(fx && fx.u)) fx = { u, tekst }
      for (const m of tekst.matchAll(VERWIJZING)) voegToe(m[1], u)
      for (const m of tekst.matchAll(LETTER)) voegToe(m[1], u)
    }
    // v172: de stickerplaatjes en -geluiden. Een oude portier (nog zonder mediakast) slaat dit over; de volgende
    // keer opnieuw (geen stempel).
    if (media) {
      const mkast = await caches.open(media)
      const adressen = []
      if (vellen) {
        try {
          const sv = await import(vellen.href) // alleen een tabel, verder doet dit bestand niets
          for (const v of sv.FIBRO_VELLEN) for (const s of v.stickers) adressen.push(new URL(sv.stickerSrc(v.id, s.nr), basis).href)
        } catch (e) { mislukt++ }
      }
      if (fx) {
        // stickerfx.js zelf niet laden (dat zet bij elke tik geluid klaar); de namen staan in de tabel GELUIDEN,
        // elk geluid als mp3 in geluiden/<naam>.mp3?v=<MP3_VERSIE> (zoals haalMp3 in stickerfx.js)
        const versie = /\bMP3_VERSIE\s*=\s*(\d+)/.exec(fx.tekst)
        const tabel = /\bGELUIDEN\s*=\s*\{([\s\S]*?)\n\}/.exec(fx.tekst)
        if (versie && tabel) {
          for (const m of tabel[1].matchAll(/^ {2}([\w$]+):\s*\{\s*naam:/gm)) {
            if (m[1] !== 'geen') adressen.push(new URL('geluiden/' + m[1] + '.mp3?v=' + versie[1], basis).href)
          }
        }
      }
      for (const a of adressen) {
        if (!navigator.onLine) return
        if (await mkast.match(a)) continue
        try {
          const r = await fetch(a) // via de portier, en die legt hem in de mediakast
          if (r.ok) gehaald++; else ontbreekt.push(new URL(a).pathname)
        } catch (e) { mislukt++ }
        await new Promise(k => setTimeout(k, 50))
      }
    }
    if (!mislukt && media) {
      try { localStorage.setItem(STEMPEL, JSON.stringify({ kast: naam, media, versie: versie || null, tijd: Date.now() })) } catch (e) {}
    }
    if (gehaald || mislukt) console.log('[kast] ' + gehaald + ' bestand(en) erbij gelegd voor gebruik zonder internet' + (mislukt ? ', ' + mislukt + ' mislukt' : ''))
    if (ontbreekt.length) console.warn('[kast] niet gevonden:', ontbreekt.join(', '))
  } catch (e) {
    console.warn('[kast]', e)
  } finally {
    bezig = false
  }
}
