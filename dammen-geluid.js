// dammen-geluid.js - de geluiden van dammen (v1, 3 nov 2026; v2: geluidje als je geslagen wordt)
// In gewone woorden: een houten 'tok' bij een zet, een 'klak' per geslagen schijf, een belletje als je dam haalt,
// en een deuntje bij winst, verlies of remise. Alles met Web Audio, zonder geluidsbestanden.
// Aan of uit staat in localStorage 'fibro_dammen_geluid' (standaard aan).

let ac = null
const SLEUTEL = 'fibro_dammen_geluid'

export function geluidAan() {
    try { return localStorage.getItem(SLEUTEL) !== 'uit' } catch (e) { return true }
}
export function zetGeluid(aan) {
    try { localStorage.setItem(SLEUTEL, aan ? 'aan' : 'uit') } catch (e) {}
}

function context() {
    if (!geluidAan()) return null
    try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!ac && AC) ac = new AC()
        if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
    } catch (e) { return null }
    return ac
}
// Bij een tik het geluid alvast openzetten (de iPhone wil dat)
export function ontgrendel() { context() }

let ruisBuf = null
function ruis(a) {
    if (ruisBuf && ruisBuf.sampleRate === a.sampleRate) return ruisBuf
    ruisBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.3), a.sampleRate)
    const d = ruisBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return ruisBuf
}

// Een houten tik: een kort stukje ruis door een bandfilter, met een lage toon eronder
function hout(a, t, { hoog = 1700, laag = 170, vol = 0.5, lang = 0.09 } = {}) {
    const b = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain()
    b.buffer = ruis(a)
    f.type = 'bandpass'; f.frequency.value = hoog; f.Q.value = 2.2
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + lang)
    b.connect(f); f.connect(g); g.connect(a.destination)
    b.start(t); b.stop(t + lang + 0.02)
    const o = a.createOscillator(), og = a.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(laag, t)
    o.frequency.exponentialRampToValueAtTime(laag * 0.6, t + lang)
    og.gain.setValueAtTime(vol * 0.6, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + lang * 1.2)
    o.connect(og); og.connect(a.destination)
    o.start(t); o.stop(t + lang * 1.3)
}

function toon(a, t, freq, lang, vol = 0.12, golf = 'triangle') {
    const o = a.createOscillator(), g = a.createGain()
    o.type = golf; o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + lang)
    o.connect(g); g.connect(a.destination)
    o.start(t); o.stop(t + lang + 0.05)
}

export const geluid = {
    kies() { const a = context(); if (a) hout(a, a.currentTime, { hoog: 2600, laag: 260, vol: 0.12, lang: 0.04 }) },
    // stappen = aantal sprongen (bij een slag); geslagen = aantal geslagen schijven
    zet(stappen = 1, geslagen = 0) {
        const a = context(); if (!a) return
        const t = a.currentTime
        if (!geslagen) { hout(a, t, {}); return }
        for (let i = 0; i < geslagen; i++) {
            hout(a, t + i * 0.11, { hoog: 2300, laag: 140, vol: 0.55, lang: 0.07 })            // de schijf landt
            hout(a, t + i * 0.11 + 0.035, { hoog: 3400, laag: 320, vol: 0.28, lang: 0.05 })    // de geslagen schijf tikt weg
        }
        void stappen
    },
    dam() {
        const a = context(); if (!a) return
        const t = a.currentTime + 0.12
        ;[784, 988, 1175, 1568].forEach((f, i) => toon(a, t + i * 0.07, f, 0.35, 0.09))
    },
    winst() {
        const a = context(); if (!a) return
        const t = a.currentTime + 0.1
        ;[523, 659, 784, 1047].forEach((f, i) => toon(a, t + i * 0.12, f, 0.45, 0.13))
    },
    verlies() {
        const a = context(); if (!a) return
        const t = a.currentTime + 0.1
        ;[523, 466, 392, 330].forEach((f, i) => toon(a, t + i * 0.16, f, 0.5, 0.12))
    },
    // v2: je wordt geslagen (alleen met de webcamrondjes): een doffe bonk met een dalend 'oei'-toontje
    geslagen(aantal = 1) {
        const a = context(); if (!a) return
        const t = a.currentTime + 0.02
        hout(a, t, { hoog: 900, laag: 110, vol: 0.6, lang: 0.12 })
        const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(520, t + 0.05)
        o.frequency.exponentialRampToValueAtTime(170, t + 0.42)
        f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 3
        g.gain.setValueAtTime(0.0001, t + 0.05)
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.08)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
        o.connect(f); f.connect(g); g.connect(a.destination)
        o.start(t + 0.05); o.stop(t + 0.5)
        if (aantal > 1) toon(a, t + 0.5, 196, 0.25, 0.08, 'square')   // meer dan een schijf kwijt: nog een laag toontje
    },
    remise() {
        const a = context(); if (!a) return
        const t = a.currentTime + 0.1
        toon(a, t, 587, 0.5, 0.11); toon(a, t + 0.22, 587, 0.6, 0.11)
    }
}
