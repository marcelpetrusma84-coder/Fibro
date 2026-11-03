// beurtspel-hulp.js - gereedschap voor beurtspellen in Fibro (v1, 3 nov 2026)
//
// In gewone woorden: dit is het deel van de BLAUWDRUK (zie BLAUWDRUK-BEURTSPEL.md) dat een spel zelf gebruikt.
// De chatbalk en de webcamrondjes regelt chat.html al vanzelf voor elk spel in BEURTSPELLEN. Het spel hoeft alleen:
//   1. ruimte bovenin te laten als de webcamrondjes er staan  -> webcamRuimte() en opWebcamWissel(...)
//   2. te melden als iemand geslagen wordt of iets verliest   -> meldGeslagen('ik' | 'ander', aantal)
//      (dan wordt het rondje van die persoon even rood, en hoor je zelf een geluidje als jij het bent)
// Werkt ook in spel.html (tegen de computer): daar zijn geen rondjes, dus gebeurt er dan niets extra.

const overlay = () => document.getElementById('spelOverlay')

// Hoeveel pixels bovenin vrij moeten blijven voor de webcamrondjes (0 als ze er niet staan)
export function webcamRuimte() {
    const o = overlay()
    if (!o) return 0
    if (o.classList.contains('dam-video-modus')) return 152
    if (o.classList.contains('klein-video-modus')) return 74
    return 0
}

// Roep fn aan als de webcamrondjes verschijnen of verdwijnen (bijvoorbeeld om het bord opnieuw te schalen).
// Geeft een functie terug om weer te stoppen.
export function opWebcamWissel(fn) {
    const luister = () => setTimeout(() => { try { fn(webcamRuimte()) } catch (e) {} }, 30)
    window.addEventListener('fibro-chess-video-state', luister)
    return () => window.removeEventListener('fibro-chess-video-state', luister)
}

let ac = null
function context() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!ac && AC) ac = new AC()
        if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
    } catch (e) { return null }
    return ac
}

// Een doffe bonk met een dalend 'oei'-toontje (hetzelfde idee als bij dammen)
export function geslagenGeluid(aantal = 1) {
    const a = context(); if (!a) return
    const t = a.currentTime + 0.02
    const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(520, t)
    o.frequency.exponentialRampToValueAtTime(170, t + 0.38)
    f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 3
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
    o.connect(f); f.connect(g); g.connect(a.destination)
    o.start(t); o.stop(t + 0.46)
    if (aantal > 1) {
        const o2 = a.createOscillator(), g2 = a.createGain()
        o2.type = 'square'; o2.frequency.value = 196
        g2.gain.setValueAtTime(0.0001, t + 0.48); g2.gain.exponentialRampToValueAtTime(0.07, t + 0.5); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.72)
        o2.connect(g2); g2.connect(a.destination); o2.start(t + 0.48); o2.stop(t + 0.75)
    }
}

// Iemand is geslagen of verliest iets. wie = 'ik' (jij) of 'ander' (je vriend of de computer).
// opties.geluid = false als het spel zelf al een geluid afspeelt.
export function meldGeslagen(wie, aantal = 1, opties = {}) {
    wie = wie === 'ik' ? 'ik' : 'ander'
    window.dispatchEvent(new CustomEvent('fibro-spel-geslagen', { detail: { wie, aantal } }))
    if (wie === 'ik' && opties.geluid !== false && webcamRuimte() > 0) geslagenGeluid(aantal)
}

// Speel je tegen de computer (spel.html)? Dan is er geen webcam en geen chatbalk.
export function isSolo(spelKanaal) { return Boolean(spelKanaal && spelKanaal.isSolo) }
