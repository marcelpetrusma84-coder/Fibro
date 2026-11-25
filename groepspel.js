// groepspel.js (v1, 25 nov 2026) - een beurtspel of kaartspel met 2 tot 6 spelers over één spelkanaal.
//
// In gewone woorden: één speler is de GASTHEER (wie het spel startte, zetel 1). Hij heeft de echte stand. De anderen
// sturen alleen wat ze willen doen ('actie'); de gastheer kijkt of het mag (de spelregels), maakt de nieuwe stand en
// stuurt die naar iedereen ('stand'). Zo krijgt iedereen precies hetzelfde te zien en kan niemand iets doen wat niet mag.
//  - Lege zetels en spelers die weg zijn speelt de computer (op de gastheer). Laat iemand zijn beurt verlopen
//    (beurtMs, plus wat speling), dan doet de computer een zet voor hem: zo wacht niemand eindeloos.
//  - Wie achterloopt (een bericht miste), vraagt elke 3 seconden de stand op ('vraag-stand').
//  - Tegen de computer (spel.html, kanaal.isSolo) ben jij de gastheer en zijn alle andere zetels de computer.
// De spelregels geef je mee (regels): { doeStap(s, zetel, stap), computerStap(s, zetel, niveau), geldigeStand(s),
//   aanZet(s) -> zetel die nu iets moet doen (of 0), volgendeRonde?(s) -> nieuwe ronde (of null) }.
//
//   const g = maakGroepSpel({ kanaal, zetel, spelers, regels, niveau, beurtMs, rondePauze, denkMs, onStand })
//   g.start(staat)      gastheer: begin met deze stand          g.doe(stap)   jouw zet (gastheer of niet)
//   g.staat()           de stand nu                              g.stop()      opruimen
//   spelers = [{ zetel: 1, naam, id?, computer? }, ...]
//   onStand(oud, nieuw, { wie, auto }) wordt aangeroepen bij elke nieuwe stand (ook je eigen zet)

export function maakGroepSpel({ kanaal, zetel, spelers, regels, niveau = 'normaal', beurtMs = 30000, speling = 6000, rondePauze = 3500, denkMs = () => 900 + Math.floor(Math.random() * 700), onStand = () => {}, onGastheerWeg = () => {} }) {
  const gastheer = zetel === 1
  let staat = null, spelId = -1, nr = 0, gestopt = false
  let botTimer = null, wachtTimer = null, rondeTimer = null
  const weg = new Set()                       // zetels waarvan de speler weg is (de computer speelt)
  const computer = z => spelers.some(sp => sp.zetel === z && sp.computer) || weg.has(z)
  const stuur = (event, payload) => { try { kanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }

  function zet(nieuw, info = {}) {
    const oud = staat
    staat = nieuw; nr++
    if (gastheer) stuur('stand', { staat, nr, spelId, spelers: spelers.map(s => ({ zetel: s.zetel, naam: s.naam, computer: Boolean(s.computer) })) })
    try { onStand(oud, nieuw, info) } catch (e) { console.error('[groepspel]', e) }
    if (gastheer) plan()
  }

  // ── Gastheer: wie is er aan de beurt, en moet de computer iets doen? ──
  function plan() {
    clearTimeout(botTimer); clearTimeout(wachtTimer); clearTimeout(rondeTimer)
    if (gestopt || !staat) return
    const z = regels.aanZet(staat)
    if (!z) {
      // ronde klaar: na een pauze de volgende ronde
      if (regels.volgendeRonde) rondeTimer = setTimeout(() => {
        if (gestopt || !staat || regels.aanZet(staat)) return
        const n = regels.volgendeRonde(staat)
        if (n) zet(n, { wie: 0, ronde: true })
      }, rondePauze)
      return
    }
    if (computer(z)) {
      botTimer = setTimeout(() => speelVoor(z, false), denkMs())   // even 'nadenken', anders voelt het niet als een speler
    } else if (z !== zetel) {
      // een mens: wacht op zijn zet; komt die niet, dan zet de computer voor hem
      wachtTimer = setTimeout(() => speelVoor(z, true), beurtMs + speling)
    }
  }
  function speelVoor(z, auto) {
    if (gestopt || !staat || regels.aanZet(staat) !== z) return
    const nieuw = regels.doeStap(staat, z, regels.computerStap(staat, z, auto ? 'normaal' : niveau))
    if (nieuw) zet(nieuw, { wie: z, computer: true, auto })
  }
  // Een actie van een andere speler (alleen de gastheer luistert)
  function actie(p) {
    if (!gastheer || !p || p.spelId !== spelId || !staat) return
    const z = Number(p.zetel)
    if (!spelers.some(sp => sp.zetel === z && !sp.computer) || regels.aanZet(staat) !== z) return
    weg.delete(z)
    const nieuw = regels.doeStap(staat, z, p.stap)
    if (nieuw) zet(nieuw, { wie: z })
  }

  // ── Niet-gastheer: de stand van de gastheer overnemen ──
  function neem(p, nieuwSpel) {
    if (gastheer || !p || !regels.geldigeStand(p.staat)) return
    const id = p.spelId ?? spelId, n = p.nr ?? 0
    if (nieuwSpel ? id <= spelId : (id < spelId || (id === spelId && n <= nr))) return
    const oud = id === spelId ? staat : null
    spelId = id; nr = n; staat = p.staat
    try { onStand(oud, staat, { wie: (p.staat.laatste && p.staat.laatste.wie) || 0, nieuw: !oud }) } catch (e) { console.error('[groepspel]', e) }
  }

  kanaal.on('broadcast', { event: 'actie' }, msg => actie(msg.payload))
  kanaal.on('broadcast', { event: 'stand' }, msg => neem(msg.payload, false))
  kanaal.on('broadcast', { event: 'opnieuw' }, msg => neem(msg.payload, true))
  kanaal.on('broadcast', { event: 'vraag-stand' }, msg => {
    const p = msg.payload || {}
    if (gastheer && staat && (spelId > (p.spelId ?? -1) || (spelId === (p.spelId ?? -1) && nr > (p.nr ?? 0))))
      stuur('stand', { staat, nr, spelId, spelers: spelers.map(s => ({ zetel: s.zetel, naam: s.naam, computer: Boolean(s.computer) })) })
  })
  // iemand gaat weg (het spel sluit bij hem): de computer neemt zijn zetel over
  kanaal.on('broadcast', { event: 'weg' }, msg => {
    const z = Number(msg.payload && msg.payload.zetel)
    if (gastheer && z && z !== zetel) { weg.add(z); plan() }
    else if (!gastheer && z === 1 && !gestopt) { try { onGastheerWeg() } catch (e) {} }   // v2: de gastheer is weg: het spel stopt
  })

  const timer = setInterval(() => {
    if (gestopt) return clearInterval(timer)
    if (!gastheer && (!staat || regels.aanZet(staat) !== zetel)) stuur('vraag-stand', { spelId, nr })
  }, 3000)

  return {
    gastheer, zetel,
    staat: () => staat,
    computer,
    // gastheer: een nieuw spel (ook "opnieuw spelen")
    start(nieuw) {
      if (!gastheer) return
      spelId = Math.max(Date.now(), spelId + 1); nr = 0
      const oud = staat; staat = nieuw
      stuur('opnieuw', { staat, nr, spelId, spelers: spelers.map(s => ({ zetel: s.zetel, naam: s.naam, computer: Boolean(s.computer) })) })
      try { onStand(oud, nieuw, { wie: 0, nieuw: true }) } catch (e) { console.error('[groepspel]', e) }
      plan()
    },
    // jouw zet: de gastheer voert hem meteen uit, de anderen sturen hem naar de gastheer (en wachten op de stand)
    doe(stap) {
      if (!staat || regels.aanZet(staat) !== zetel) return false
      if (gastheer) { const n = regels.doeStap(staat, zetel, stap); if (!n) return false; zet(n, { wie: zetel }); return true }
      if (!regels.doeStap(staat, zetel, stap)) return false
      stuur('actie', { spelId, nr, zetel, stap })
      return true
    },
    stop() {
      if (gestopt) return
      gestopt = true; clearInterval(timer); clearTimeout(botTimer); clearTimeout(wachtTimer); clearTimeout(rondeTimer)
      stuur('weg', { zetel })   // een gast: de computer neemt over; de gastheer: het spel stopt bij de anderen
    },
  }
}
