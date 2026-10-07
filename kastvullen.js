// kastvullen.js - de kast van de portier aanvullen (v127)
// De portier (service-worker.js) legt een bestand pas in zijn kast als het een keer
// met internet geladen is. Een spel dat je nog nooit gestart hebt, of een pagina die
// je nog niet bezocht hebt, werkt dan zonder internet niet. Dit bestand loopt met
// internet, op de achtergrond, de pagina's na en alles wat ze laden (scripts, spellen,
// lettertypen), en haalt alleen wat nog ontbreekt. Wat al in de kast ligt, kost geen
// internet. Hoogstens eens per 6 uur.

const PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'spel.html']
const WACHT_UUR = 6
const STEMPEL = 'fibro_kast_gevuld'
const MAX_TEKST = 400000 // grotere bestanden (Phaser) niet doorzoeken
// Verwijzingen zoals './sync.js?v=122', "lettertypen/basis.css?v=1" of '../phaser.min.js?v=1'
const VERWIJZING = /["'(`]((?:\.{1,2}\/)?[\w\/.-]+\.(?:js|css)\?v=\d+)["')`]/g
// Lettertypen: alleen de gewone Latijnse set, zoals de browser die meestal nodig heeft
const LETTER = /url\(\s*['"]?([\w.\/-]*-latin-\d[\w-]*\.woff2)['"]?\s*\)/g

let bezig = false

export async function vulKast() {
  if (bezig) return
  bezig = true
  try {
    if (!navigator.onLine || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller || !window.caches) return
    let vorige = null
    try { vorige = JSON.parse(localStorage.getItem(STEMPEL) || 'null') } catch (e) {}
    const naam = (await caches.keys()).find(k => /^fibro-v\d+$/.test(k))
    if (!naam) return
    if (vorige && vorige.kast === naam && Date.now() - vorige.tijd < WACHT_UUR * 3600000) return
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
    while (rij.length) {
      if (!navigator.onLine) return // halverwege internet kwijt: de volgende keer verder
      const u = rij.shift()
      const isPagina = u.pathname.endsWith('.html') && !u.search
      const isVersie = u.searchParams.has('v') && /\.(js|css)$/.test(u.pathname)
      const isLetter = /\/lettertypen\/[a-z0-9-]+\.woff2$/.test(u.pathname)
      if (!isPagina && !isVersie && !isLetter) continue
      let res = await kast.match(u.href)
      if (!res) {
        try {
          if (isPagina) {
            // Pagina's bewaart de portier alleen als je ze opent; hier zelf in de kast
            // leggen, onder hetzelfde adres als de portier gebruikt (zonder ?...).
            const r = await fetch(u.href, { cache: 'no-cache' })
            if (r.ok && r.type === 'basic') { await kast.put(u.href, r.clone()); res = r; gehaald++ } else ontbreekt.push(u.pathname)
          } else {
            // Scripts, css en lettertypen gaan via de portier, en die legt ze zelf in de kast.
            const r = await fetch(u.href)
            if (r.ok) { res = r; gehaald++ } else ontbreekt.push(u.pathname)
          }
        } catch (e) { mislukt++ }
        await new Promise(k => setTimeout(k, 50)) // rustig aan, de pagina gaat voor
      }
      if (!res || isLetter) continue
      let tekst = ''
      try { tekst = await res.text() } catch (e) { continue }
      if (tekst.length > MAX_TEKST) continue
      for (const m of tekst.matchAll(VERWIJZING)) voegToe(m[1], u)
      for (const m of tekst.matchAll(LETTER)) voegToe(m[1], u)
    }
    if (!mislukt) {
      try { localStorage.setItem(STEMPEL, JSON.stringify({ kast: naam, tijd: Date.now() })) } catch (e) {}
    }
    if (gehaald || mislukt) console.log('[kast] ' + gehaald + ' bestand(en) erbij gelegd voor gebruik zonder internet' + (mislukt ? ', ' + mislukt + ' mislukt' : ''))
    if (ontbreekt.length) console.warn('[kast] niet gevonden:', ontbreekt.join(', '))
  } catch (e) {
    console.warn('[kast]', e)
  } finally {
    bezig = false
  }
}
