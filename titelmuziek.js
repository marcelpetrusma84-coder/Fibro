// titelmuziek.js - de muziekjes van de titelschermen (v3, 2 nov 2026; v2: ook 'click', en een stil geluidje voor de iPhone;
// v3: de muziek speelt door in het menu van het spel en stopt pas bij 'fibro-spel-begint';
// v4: in een spelvenster op Home gaat 'stoppen' naar Home, waar de muziek speelt)
//
// In gewone woorden: een klein synthesizertje (Web Audio, geen bestanden) en voor elk spel een eigen deuntje,
// zelf geschreven in de stijl van oude spelcomputers. Een deuntje herhaalt zich tot stop() komt.
//
// Geluid mag pas na een tik (zo werken alle browsers, de iPhone het strengst). Daarom zet dit bestand bij ELKE tik
// op de pagina het geluid alvast aan (ontgrendel). Tik je op 'Uitnodiging accepteren' of 'Start', dan kan de muziek
// van het titelscherm daarna meteen beginnen. Lukt dat niet, dan begint hij bij de eerstvolgende tik.
//
// Noten: 'C5', 'F#4', 'Bb3'; '.' = stil; '-' = vorige noot aanhouden. Een '|' (maatstreep) is alleen voor het lezen.
// Slagwerk: k = basdrum, s = snare, h = hihat, '.' = stil.

let ac = null
let hoofd = null
let speelt = null              // { stop, id }
let slaapTimer = null
const UIT_SLEUTEL = 'fibro_titelmuziek'

export function muziekAan() {
    try { return localStorage.getItem(UIT_SLEUTEL) !== 'uit' } catch (e) { return true }
}
export function zetMuziek(aan) {
    try { localStorage.setItem(UIT_SLEUTEL, aan ? 'aan' : 'uit') } catch (e) {}
    if (!aan) stopTitelMuziek(0.15)
}

function context() {
    if (ac) return ac
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    try { ac = new AC() } catch (e) { return null }
    return ac
}

// Bij elke tik: het geluid aanzetten (mag alleen tijdens een tik). Speelt er niets, dan na 20 seconden weer slapen,
// zodat een stille AudioContext de telefoon niet wakker houdt.
let stilGespeeld = false
function ontgrendel() {
    const a = context()
    if (!a) return
    if (a.state === 'suspended') a.resume().catch(() => {})
    if (!stilGespeeld) {   // v2: oudere iPhones openen het geluid pas echt met een (stil) geluidje tijdens de tik
        try {
            const bron = a.createBufferSource()
            bron.buffer = a.createBuffer(1, 1, 22050)
            bron.connect(a.destination)
            bron.start(0)
            stilGespeeld = true
        } catch (e) {}
    }
    clearTimeout(slaapTimer)
    slaapTimer = setTimeout(() => { if (!speelt && ac && ac.state === 'running') ac.suspend().catch(() => {}) }, 20000)
}
if (typeof document !== 'undefined') {
    for (const soort of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(soort, ontgrendel, { capture: true, passive: true })
}

export function geluidKlaar() {
    return !!(ac && ac.state === 'running')
}

// ── Noten ──
const NOOT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export function frequentie(naam) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(naam)
    if (!m) return null
    const halve = NOOT[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12
    return 440 * Math.pow(2, (halve - 69) / 12)
}
export function stappen(tekst) {
    return tekst.split(/\s+/).filter(t => t && t !== '|')
}
// Een akkoord als snel loopje (arpeggio): noten heen en terug, 'n' stappen lang
export function loopje(noten, n, soort = 'op') {
    const reeks = soort === 'opneer' ? [...noten, ...noten.slice(1, -1).reverse()] : noten
    return Array.from({ length: n }, (_, i) => reeks[i % reeks.length]).join(' ')
}

// ── Instrumenten ──
const KLANK = {
    // golf, aanslag, uitklinken (s), aanhoud-niveau, octaaf erbij, vibrato
    marimba: { golf: 'sine', a: 0.004, d: 0.28, s: 0, boven: 'triangle' },
    speelgoed: { golf: 'triangle', a: 0.003, d: 0.35, s: 0.05, boven: 'sine' },
    klavecimbel: { golf: 'square', a: 0.002, d: 0.32, s: 0.08, zacht: true },
    fluit: { golf: 'triangle', a: 0.03, d: 0.25, s: 0.6, vib: 5 },
    pulse: { golf: 'square', a: 0.005, d: 0.12, s: 0.45 },
    kort: { golf: 'square', a: 0.002, d: 0.09, s: 0 },
    zaag: { golf: 'sawtooth', a: 0.004, d: 0.12, s: 0.35, zacht: true },
    synth: { golf: 'sawtooth', a: 0.02, d: 0.3, s: 0.55, zacht: true, vib: 4 },
    bas: { golf: 'triangle', a: 0.004, d: 0.18, s: 0.55 },
    zaagbas: { golf: 'sawtooth', a: 0.004, d: 0.1, s: 0.4, zacht: true },
    arp: { golf: 'square', a: 0.002, d: 0.07, s: 0.1, zacht: true },
    zing: { golf: 'triangle', a: 0.04, d: 0.2, s: 0.7, vib: 7 }
}

function speelNoot(a, uit, freq, t, duur, klank, vol) {
    const k = KLANK[klank] || KLANK.pulse
    const osc = a.createOscillator()
    const g = a.createGain()
    osc.type = k.golf
    osc.frequency.setValueAtTime(freq, t)
    if (k.vib) {
        const lfo = a.createOscillator(), lg = a.createGain()
        lfo.frequency.value = k.vib
        lg.gain.value = freq * 0.006
        lfo.connect(lg); lg.connect(osc.frequency)
        lfo.start(t + 0.08); lfo.stop(t + duur + 0.3)
    }
    let bron = osc
    if (k.zacht) {   // scherpe golven wat zachter maken
        const f = a.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = Math.min(6000, freq * 6)
        osc.connect(f)
        bron = f
    }
    const top = vol, rust = vol * k.s
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(top, t + k.a)
    g.gain.exponentialRampToValueAtTime(Math.max(rust, 0.0001), t + k.a + k.d)
    g.gain.setValueAtTime(Math.max(rust, 0.0001), t + Math.max(duur, k.a + k.d))
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(duur, k.a + k.d) + 0.12)
    bron.connect(g)
    g.connect(uit)
    osc.start(t)
    osc.stop(t + Math.max(duur, k.a + k.d) + 0.15)
    if (k.boven) {   // een zachte boventoon (hout, speelgoed)
        const o2 = a.createOscillator(), g2 = a.createGain()
        o2.type = k.boven
        o2.frequency.value = freq * (klank === 'marimba' ? 4 : 2)
        g2.gain.setValueAtTime(vol * 0.25, t)
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
        o2.connect(g2); g2.connect(uit)
        o2.start(t); o2.stop(t + 0.1)
    }
}

let ruisBuffer = null
function ruis(a) {
    if (ruisBuffer && ruisBuffer.sampleRate === a.sampleRate) return ruisBuffer
    ruisBuffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.4), a.sampleRate)
    const d = ruisBuffer.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return ruisBuffer
}
function speelSlag(a, uit, soort, t, vol) {
    if (soort === 'k') {
        const o = a.createOscillator(), g = a.createGain()
        o.frequency.setValueAtTime(140, t)
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
        g.gain.setValueAtTime(vol, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
        o.connect(g); g.connect(uit)
        o.start(t); o.stop(t + 0.18)
        return
    }
    const b = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain()
    b.buffer = ruis(a)
    f.type = soort === 'h' ? 'highpass' : 'bandpass'
    f.frequency.value = soort === 'h' ? 7000 : 1800
    const lang = soort === 'h' ? 0.04 : 0.13
    g.gain.setValueAtTime(vol * (soort === 'h' ? 0.35 : 0.7), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + lang)
    b.connect(f); f.connect(g); g.connect(uit)
    b.start(t); b.stop(t + lang + 0.02)
}

// ── De deuntjes ── (bpm = tellen per minuut; stap = stappen per tel)
export const DEUNTJES = {
    // Tic-Tac-Toe: vrolijk op een houten marimba
    botkaaseiren: { bpm: 118, stemmen: [
        { klank: 'marimba', vol: 0.32, stap: 2, noten: 'C5 . E5 G5 E5 . C5 . | A4 C5 F5 . C5 . A4 . | G4 B4 D5 G5 F5 D5 B4 G4 | C5 . E5 . C5 . . . | E5 F5 G5 . A5 G5 E5 . | F5 E5 D5 . E5 D5 C5 . | D5 E5 F5 D5 G5 . F5 E5 | D5 C5 B4 D5 C5 . . .' },
        { klank: 'bas', vol: 0.26, stap: 2, noten: 'C3 . G3 . C3 . G3 . | F3 . C4 . F3 . C4 . | G3 . D4 . G3 . B3 . | C3 . G3 . C3 . . . | C3 . G3 . F3 . C4 . | D3 . A3 . G3 . . . | F3 . A3 . G3 . B3 . | G3 . G2 . C3 . . .' },
        { slag: true, vol: 0.18, stap: 2, noten: 'k . h . h . h . | k . h . h . h h' }
    ] },
    // Four in a Row: speelgoedpiano, huppelend
    vieroprij: { bpm: 132, stemmen: [
        { klank: 'speelgoed', vol: 0.3, stap: 2, noten: 'F5 . A5 . C6 . A5 . | G5 . A5 Bb5 A5 . F5 . | E5 . G5 . C6 . G5 . | F5 . . . . . C5 . | D5 . F5 . Bb5 . A5 G5 | C5 . E5 . A5 . G5 F5 | Bb4 . D5 . G5 F5 E5 D5 | C5 . E5 . F5 . . .' },
        { klank: 'bas', vol: 0.26, stap: 2, noten: 'F3 . C3 . F3 . C3 . | Bb2 . F3 . Bb2 . F3 . | C3 . G3 . C3 . G3 . | F3 . C3 . F3 . . . | Bb2 . F3 . Bb2 . F3 . | A2 . E3 . A2 . E3 . | G2 . D3 . C3 . E3 . | F3 . C3 . F2 . . .' },
        { slag: true, vol: 0.2, stap: 2, noten: 'k . s . k k s .' }
    ] },
    // Pesten: een ondeugend kroegpianootje (11 nov 2026)
    pesten: { bpm: 126, stemmen: [
        { klank: 'speelgoed', vol: 0.28, stap: 2, noten: 'C5 E5 G5 E5 A5 . G5 . | F5 A5 C6 A5 G5 . E5 . | D5 F5 A5 F5 G5 . B4 . | C5 . E5 G5 C6 . . . | A5 G5 F5 E5 D5 . F5 . | G5 F5 E5 D5 C5 . E5 . | D5 . F5 . B4 . D5 . | C5 . G4 . C5 . . .' },
        { klank: 'bas', vol: 0.26, stap: 2, noten: 'C3 . G3 . C3 . G3 . | F3 . C4 . F3 . C4 . | G2 . D3 . G2 . D3 . | C3 . G3 . C3 . E3 . | F3 . C4 . F3 . A3 . | C3 . G3 . A2 . E3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
        { slag: true, vol: 0.18, stap: 2, noten: 'k . s . k k s .' }
    ] },
    // Toepen: een stoer kroeglied in mineur, met een klop op de tafel (11 nov 2026)
    toepen: { bpm: 112, stemmen: [
        { klank: 'speelgoed', vol: 0.28, stap: 2, noten: 'A4 . C5 E5 A5 . G5 . | F5 . E5 D5 E5 . . . | D5 . F5 A5 G5 . F5 . | E5 . C5 . E5 . . . | A4 . C5 E5 A5 . B5 . | C6 . B5 A5 G5 . E5 . | F5 E5 D5 C5 B4 . E5 . | A4 . E4 . A4 . . .' },
        { klank: 'bas', vol: 0.26, stap: 2, noten: 'A2 . E3 . A2 . E3 . | D3 . A3 . D3 . A3 . | G2 . D3 . G2 . D3 . | C3 . G3 . E3 . C3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | D3 . A3 . E3 . B2 . | A2 . E3 . A2 . . .' },
        { slag: true, vol: 0.2, stap: 2, noten: 'k . . k s . . .' }
    ] },
    // Eenentwintigen: een spannend casino-swingetje (11 nov 2026)
    eenentwintigen: { bpm: 132, stemmen: [
        { klank: 'speelgoed', vol: 0.27, stap: 2, noten: 'G5 . E5 G5 A5 . G5 . | E5 . C5 . D5 . . . | G5 . E5 G5 A5 . C6 . | B5 . A5 . G5 . . . | A5 . F5 A5 B5 . A5 . | G5 . E5 . F5 . D5 . | E5 . G5 . D5 . F5 . | C5 . G4 . C5 . . .' },
        { klank: 'bas', vol: 0.25, stap: 2, noten: 'C3 . G3 . C3 . G3 . | A2 . E3 . G2 . D3 . | C3 . G3 . C3 . G3 . | E3 . B3 . G2 . D3 . | F2 . C3 . F2 . C3 . | C3 . G3 . D3 . A3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
        { slag: true, vol: 0.16, stap: 2, noten: 'k s k s k s k s' }
    ] },
    // Koningsjacht: een middeleeuwse mars op weg naar het kasteel (13 nov 2026)
    koningsjacht: { bpm: 104, stemmen: [
        { klank: 'fluit', vol: 0.24, stap: 2, noten: 'D5 . D5 E5 F5 . A5 . | G5 . F5 E5 D5 . . . | C5 . C5 D5 E5 . G5 . | F5 . E5 D5 C#5 . . . | D5 . F5 A5 D6 . C6 . | A#5 . A5 G5 A5 . . . | G5 F5 E5 D5 C#5 . E5 . | D5 . A4 . D5 . . .' },
        { klank: 'klavecimbel', vol: 0.12, stap: 2, noten: 'D3 A3 D4 A3 D3 A3 D4 A3 | A#2 F3 A#3 F3 A2 E3 A3 E3 | C3 G3 C4 G3 C3 G3 C4 G3 | A2 E3 A3 E3 A2 E3 C#4 E3 | D3 A3 D4 A3 F3 C4 F4 C4 | G2 D3 G3 D3 A2 E3 A3 E3 | A#2 F3 A#3 F3 A2 E3 A3 E3 | D3 A3 D4 A3 D3 . . .' },
        { slag: true, vol: 0.18, stap: 2, noten: 'k . . k k . s .' }
    ] },
    // Schaken: deftig, als een klavecimbel
    schaken: { bpm: 92, stemmen: [
        { klank: 'fluit', vol: 0.24, stap: 2, noten: 'A4 - - B4 C5 - - E5 | D5 - C5 - B4 - - - | G4 - - A4 B4 - - D5 | C5 - B4 - A4 - - - | E5 - - F5 E5 - D5 - | C5 - - D5 C5 - B4 - | A4 - C5 - B4 - G#4 - | A4 - - - - - . .' },
        { klank: 'klavecimbel', vol: 0.13, stap: 2, noten: 'A2 E3 A3 E3 A2 E3 A3 E3 | D3 A3 D4 A3 E3 B3 E4 B3 | G2 D3 G3 D3 G2 D3 G3 D3 | C3 G3 C4 G3 F3 C4 A3 F3 | C3 G3 C4 G3 G2 D3 G3 D3 | A2 E3 A3 E3 E3 B3 E4 B3 | F3 C4 A3 F3 E3 B3 G#3 E3 | A2 E3 A3 E3 A2 . . .' }
    ] },
    // Dammen: een rustige wals (3 tellen per maat)
    dammen: { bpm: 150, stemmen: [
        { klank: 'fluit', vol: 0.24, stap: 1, noten: 'D5 . F#5 | A5 - - | G5 F#5 E5 | F#5 - - | E5 . G5 | B5 - - | A5 G5 F#5 | E5 - - | D5 . F#5 | A5 . D6 | C#6 B5 A5 | B5 . G5 | F#5 . E5 | D5 . E5 | F#5 E5 C#5 | D5 - -' },
        { klank: 'speelgoed', vol: 0.16, stap: 1, noten: 'D3 A3 A3 | D3 A3 A3 | A2 G3 G3 | D3 F#3 F#3 | A2 G3 G3 | E3 G3 G3 | A2 E3 E3 | A2 C#3 E3 | D3 A3 A3 | D3 F#3 A3 | A2 E3 G3 | G2 D3 G3 | D3 A3 A3 | B2 F#3 B3 | A2 E3 G3 | D3 . .' }
    ] },
    // Neo Paddle: synthwave met een glinsterend loopje
    pong: { bpm: 100, stemmen: [
        { klank: 'synth', vol: 0.17, stap: 2, noten: 'B4 - - - E5 - G5 - | E5 - - - - - D5 - | D5 - - - G5 - B5 - | A5 - - - F#5 - - - | B4 - E5 - G5 - B5 - | C6 - B5 - G5 - E5 - | D5 - G5 - B5 - D6 - | A5 - - - F#5 - D5 -' },
        { klank: 'arp', vol: 0.07, stap: 4, noten: loopje(['E4', 'G4', 'B4', 'E5'], 16, 'opneer') + ' ' + loopje(['C4', 'E4', 'G4', 'C5'], 16, 'opneer') + ' ' + loopje(['G4', 'B4', 'D5', 'G5'], 16, 'opneer') + ' ' + loopje(['D4', 'F#4', 'A4', 'D5'], 16, 'opneer') },
        { klank: 'zaagbas', vol: 0.16, stap: 2, noten: 'E2 E2 E3 E2 E2 E2 E3 E2 | C2 C2 C3 C2 C2 C2 C3 C2 | G2 G2 G3 G2 G2 G2 G3 G2 | D2 D2 D3 D2 D2 D2 D3 D2' },
        { slag: true, vol: 0.2, stap: 2, noten: 'k . h . s . h . | k . h k s . h h' }
    ] },
    // Ghost Tag: spookachtig maar grappig
    pacman: { bpm: 128, stemmen: [
        { klank: 'pulse', vol: 0.16, stap: 2, noten: 'C5 . Eb5 . G5 . F#5 . | F5 . Eb5 . D5 . . . | C5 . Eb5 . G5 . Ab5 . | G5 - - - . . . . | Ab5 . G5 . F5 . Eb5 . | D5 . F5 . Eb5 . D5 . | C5 . B4 . C5 . G4 . | C5 - - - . . . .' },
        { klank: 'bas', vol: 0.26, stap: 2, noten: 'C3 . G2 . C3 . G2 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . Ab2 . | G2 . D3 . G2 . B2 . | Ab2 . Eb3 . Ab2 . Eb3 . | G2 . D3 . G2 . B2 . | C3 . G2 . G2 . B2 . | C3 . G2 . C3 . . .' },
        { slag: true, vol: 0.16, stap: 2, noten: 'k . h . s . h h' }
    ] },
    // Block It: vrolijke puzzelmuziek
    breakout: { bpm: 140, stemmen: [
        { klank: 'pulse', vol: 0.16, stap: 2, noten: 'D5 . G5 . B5 . A5 G5 | A5 . F#5 . D5 . . . | E5 . G5 . C6 . B5 A5 | B5 . G5 . . . . . | C6 . B5 . A5 . G5 . | F#5 . A5 . D5 . F#5 . | G5 . E5 . C5 . E5 . | D5 - - - G4 . . .' },
        { klank: 'bas', vol: 0.26, stap: 2, noten: 'G2 . G3 . D3 . G3 . | D3 . D4 . A3 . D4 . | C3 . C4 . G3 . C4 . | G2 . G3 . D3 . B2 . | A2 . A3 . E3 . A3 . | D3 . D4 . A3 . F#3 . | C3 . C4 . E3 . G3 . | D3 . F#3 . G2 . . .' },
        { slag: true, vol: 0.18, stap: 2, noten: 'k . h . s . h . | k k h . s . h h' }
    ] },
    // The Swarm: zoemend en snel
    swarm: { bpm: 150, stemmen: [
        { klank: 'zaag', vol: 0.12, stap: 4, noten: 'E5 F5 E5 F5 E5 . G5 . F5 E5 . . B4 . C5 . | B4 C5 B4 C5 B4 . D5 . C5 B4 . . E4 . . . | A5 B5 A5 G5 F5 . E5 . F5 G5 . . A5 . . . | G5 F5 E5 F5 E5 D5 C5 B4 C5 . B4 . E4 . . .' },
        { klank: 'zaagbas', vol: 0.18, stap: 2, noten: 'E2 . E2 . E2 . F2 . | E2 . E2 . B1 . C2 . | A2 . A2 . F2 . F2 . | G2 . G2 . E2 . . .' },
        { slag: true, vol: 0.2, stap: 2, noten: 'k h s h k k s h' }
    ] },
    // Twin Snakes: slangenbezweerder
    pinball: { bpm: 100, stemmen: [
        { klank: 'zing', vol: 0.2, stap: 2, noten: 'D5 . Eb5 F#5 G5 . F#5 Eb5 | D5 - - - A4 - - - | Bb4 . A4 . G4 . F#4 . | G4 F#4 Eb4 . D4 - - - | A4 . Bb4 . C5 . D5 . | Eb5 . D5 C5 Bb4 . A4 . | G4 . Bb4 A4 G4 F#4 Eb4 F#4 | D4 - - - - - . .' },
        { klank: 'bas', vol: 0.24, stap: 2, noten: 'D3 . A3 . D3 . A3 . | D3 . A3 . D3 . A3 . | G3 . D3 . G3 . D3 . | D3 . A2 . D3 . . .' },
        { slag: true, vol: 0.17, stap: 2, noten: 'k . h k s . h .' }
    ] },
    // Runner & Gunner: actie!
    endlessrunner: { bpm: 160, stemmen: [
        { klank: 'pulse', vol: 0.15, stap: 2, noten: 'A4 . A4 C5 . A4 D5 . | C5 . A4 . G4 . A4 . | A4 . A4 C5 . A4 E5 . | D5 . C5 . D5 . E5 . | F5 . E5 . D5 . C5 . | D5 . C5 . B4 . G4 . | A4 . C5 . E5 . A5 . | G5 . E5 . A5 - - -' },
        { klank: 'zaagbas', vol: 0.17, stap: 2, noten: 'A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 G2 G2 G3 G2 | A2 A2 A3 A2 A2 A2 A3 A2 | D2 D2 D3 D2 E2 E2 E3 E2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | A2 A2 A3 A2 C3 C3 C4 C3 | E2 E2 E3 E2 E2 E2 E3 E2' },
        { slag: true, vol: 0.22, stap: 2, noten: 'k h s h k k s h' }
    ] },
    // Flapper: een vleermuis in de nacht (wals in zes)
    flappybird: { bpm: 112, stemmen: [
        { klank: 'fluit', vol: 0.22, stap: 2, noten: 'G4 Bb4 D5 . D5 . | Eb5 D5 C5 . Bb4 . | A4 C5 Eb5 . Eb5 . | D5 - - - . . | G5 F5 Eb5 . D5 . | C5 Eb5 D5 . C5 . | Bb4 A4 G4 . F#4 . | G4 - - - . .' },
        { klank: 'speelgoed', vol: 0.15, stap: 2, noten: 'G2 . D3 . D3 . | Eb2 . Bb2 . Bb2 . | F2 . C3 . C3 . | D2 . A2 . F#2 . | Eb2 . Bb2 . Bb2 . | C2 . G2 . G2 . | D2 . A2 . D3 . | G2 . D3 . G2 .' },
        { slag: true, vol: 0.12, stap: 2, noten: 'k . h k h .' }
    ] },
    // Neon Raiders: ruimte-avontuur
    shmup: { bpm: 118, stemmen: [
        { klank: 'synth', vol: 0.16, stap: 2, noten: 'D5 - - - A5 - - - | F5 - - G5 F5 - D5 - | C5 - - - F5 - - - | E5 - - - C5 - - - | D5 - - - A5 - - - | Bb5 - A5 - G5 - F5 - | E5 - - - G5 - - - | A5 - - - - - - -' },
        { klank: 'arp', vol: 0.065, stap: 4, noten: [['D4', 'F4', 'A4', 'D5'], ['Bb3', 'D4', 'F4', 'Bb4'], ['F3', 'A3', 'C4', 'F4'], ['C4', 'E4', 'G4', 'C5'], ['D4', 'F4', 'A4', 'D5'], ['Bb3', 'D4', 'F4', 'Bb4'], ['C4', 'E4', 'G4', 'C5'], ['A3', 'C#4', 'E4', 'A4']].map(a => loopje(a, 16)).join(' ') },
        { klank: 'zaagbas', vol: 0.16, stap: 2, noten: 'D2 D2 D3 D2 D2 D2 D3 D2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | F2 F2 F3 F2 F2 F2 F3 F2 | C2 C2 C3 C2 C2 C2 C3 C2 | D2 D2 D3 D2 D2 D2 D3 D2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | C2 C2 C3 C2 C2 C2 C3 C2 | A1 A1 A2 A1 A1 A1 A2 A1' },
        { slag: true, vol: 0.2, stap: 2, noten: 'k . h . s . h . | k k h . s . h h' }
    ] }
}
DEUNTJES.schakendrie = DEUNTJES.schaken

// ── Afspelen ──
export function speelTitelMuziek(id) {
    const deuntje = DEUNTJES[id]
    if (!deuntje || !muziekAan()) return false
    if (speelt && speelt.id === id) return true
    stopTitelMuziek(0.2)
    const a = context()
    if (!a) return false
    if (a.state === 'suspended') a.resume().catch(() => {})
    // Is het geluid nog niet aan (nog niet getikt), dan staat de klok van de AudioContext stil: de muziek begint
    // vanzelf bij de eerste tik (ontgrendel).
    const uit = a.createGain()
    uit.gain.setValueAtTime(0.0001, a.currentTime)
    uit.gain.exponentialRampToValueAtTime(0.8, a.currentTime + 0.6)
    uit.connect(a.destination)
    hoofd = uit
    const tel = 60 / deuntje.bpm
    const stemmen = deuntje.stemmen.map(s => ({ ...s, reeks: stappen(s.noten), i: 0, tijd: a.currentTime + 0.08, stapDuur: tel / s.stap }))
    const klok = setInterval(() => {
        const tot = a.currentTime + 0.25
        for (const s of stemmen) {
            while (s.tijd < tot) {
                const n = s.reeks[s.i % s.reeks.length]
                if (s.slag) {
                    if (n !== '.') speelSlag(a, uit, n, s.tijd, s.vol)
                } else if (n !== '.' && n !== '-') {
                    let lang = 1
                    while (s.reeks[(s.i + lang) % s.reeks.length] === '-' && lang < s.reeks.length) lang++
                    const f = frequentie(n)
                    if (f) speelNoot(a, uit, f, s.tijd, s.stapDuur * lang * 0.92, s.klank, s.vol)
                }
                s.i++
                s.tijd += s.stapDuur
            }
        }
    }, 60)
    speelt = {
        id,
        stop(fade) {
            clearInterval(klok)
            const t = a.currentTime
            try {
                uit.gain.cancelScheduledValues(t)
                uit.gain.setValueAtTime(Math.max(uit.gain.value, 0.0001), t)
                uit.gain.exponentialRampToValueAtTime(0.0001, t + fade)
            } catch (e) {}
            setTimeout(() => { try { uit.disconnect() } catch (e) {} }, fade * 1000 + 400)
        }
    }
    return true
}
// v3: een spel laat weten dat het echt begint (na zijn eigen menu): dan stopt de titelmuziek
if (typeof window !== 'undefined') window.addEventListener('fibro-spel-begint', () => stopTitelMuziek(0.8))

export function speeltNu() {
    return speelt ? speelt.id : null
}

// v4: speelt het spel in een venster op Home (ingebed), dan speelt de muziek op Home: laat Home weten dat hij moet stoppen
const ingebed = typeof window !== 'undefined' && window.parent && window.parent !== window
export function stopTitelMuziek(fade = 0.8) {
    if (ingebed) { try { window.parent.postMessage({ fibro: 'spel-begint' }, location.origin) } catch (e) {} }
    if (!speelt) return
    const s = speelt
    speelt = null
    s.stop(fade)
    clearTimeout(slaapTimer)
    slaapTimer = setTimeout(() => { if (!speelt && ac && ac.state === 'running') ac.suspend().catch(() => {}) }, 20000)
}
