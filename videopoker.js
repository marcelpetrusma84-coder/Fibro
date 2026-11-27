// videopoker.js (25 nov 2026, uit Stekky Studio) - Video Poker 🎰.
// BEGINSPEL uit het sjabloon. De echte regels staan in spellen/videopoker.md: bouw die hier (zie BLAUWDRUK-KAARTSPEL.md).
//
// sjabloon-beurtspel.js - de COMPUTERSPELER bij het sjabloon (sjabloon-beurtspel-ui.js, "Stokjes"), v1 25 nov 2026.
//
// In gewone woorden: tegen de computer krijgt het spel een nagemaakt kanaal (solo.js, maakSoloKanaal). Aan de andere
// kant zit deze computerspeler: hij hoort dezelfde berichten als een vriend ('zet', 'vraag-stand', 'opnieuw') en stuurt
// hetzelfde terug. Stekky Studio (tests/tools/studio-spel-installeer.mjs) zet dit bestand neer als <id>.js voor een
// nieuw spel; Claude vervangt het daarna door een computerspeler voor de echte regels.
//   export function bot({ stuur, niveau, isDicht }) -> { ontvang(event, payload), stop() }

const BEGIN = 15
const COMPUTER = 2

// Hoeveel stokjes pakt de computer? Moeilijk: laat er 1, 5, 9, 13 over (dan verliest de ander); makkelijk: zomaar.
export function kies(over, niveau) {
  const max = Math.min(3, over)
  const slim = (over - 1) % 4
  if (niveau === 'makkelijk' || slim === 0 || (niveau !== 'moeilijk' && Math.random() < 0.35)) return 1 + Math.floor(Math.random() * max)
  return Math.min(slim, max)
}

export function bot({ stuur, niveau, isDicht }) {
  let staat = { over: BEGIN, aanZet: 1 }, spelId = 0, nr = 0, timer = null
  function denk() {
    clearTimeout(timer)
    if (staat.aanZet !== COMPUTER || staat.over <= 0) return
    timer = setTimeout(() => {
      if (isDicht() || staat.aanZet !== COMPUTER || staat.over <= 0) return
      const n = kies(staat.over, niveau)
      staat = { over: staat.over - n, aanZet: 1 }
      nr++
      stuur('zet', { staat, nr, spelId, einde: staat.over <= 0 || undefined })
    }, 500 + Math.floor(Math.random() * 400))
  }
  return {
    ontvang(event, p) {
      if (event === 'zet' && p && p.staat) {
        spelId = p.spelId ?? spelId; nr = p.nr ?? nr + 1
        staat = { over: Number(p.staat.over) || 0, aanZet: p.staat.aanZet === COMPUTER ? COMPUTER : 1 }
        denk()
      } else if (event === 'opnieuw') {
        spelId = (p && p.spelId) || spelId + 1; nr = 0; staat = { over: BEGIN, aanZet: 1 }
        clearTimeout(timer)
      } else if (event === 'vraag-stand') {
        if (spelId > ((p && p.spelId) ?? 0) || (spelId === ((p && p.spelId) ?? 0) && nr > ((p && p.nr) ?? 0))) stuur('stand', { staat, nr, spelId })
      }
    },
    stop() { clearTimeout(timer) },
  }
}
