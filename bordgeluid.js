// bordgeluid.js — geluidjes voor schaken en dammen (Web Audio, geen bestanden nodig)
// Aan/uit wordt onthouden in localStorage onder 'fibro_spelgeluid'.

const SLEUTEL = 'fibro_spelgeluid'
let _ctx = null
let _vorige = null   // aantallen stukken na de vorige zet, om promotie te herkennen

function aan() { try { return localStorage.getItem(SLEUTEL) !== 'uit' } catch (e) { return true } }

function ctx() {
    if (!_ctx) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return null
            _ctx = new AC()
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {})
        return _ctx
}

// Houten "tok": een kort ruisje door een filter, met een zachte lage dreun eronder
function tok(t, freq = 1400, vol = 0.35) {
    const c = _ctx
    const lengte = Math.floor(c.sampleRate * 0.05)
    const buf = c.createBuffer(1, lengte, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < lengte; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / lengte, 3)
        const bron = c.createBufferSource()
        bron.buffer = buf
        const filter = c.createBiquadFilter()
        filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 5
        const g = c.createGain()
        g.gain.value = vol * 2.2
        bron.connect(filter); filter.connect(g); g.connect(c.destination)
        bron.start(t)
        const osc = c.createOscillator(), og = c.createGain()
        osc.type = 'sine'; osc.frequency.setValueAtTime(190, t); osc.frequency.exponentialRampToValueAtTime(90, t + 0.08)
        og.gain.setValueAtTime(vol * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
        osc.connect(og); og.connect(c.destination)
        osc.start(t); osc.stop(t + 0.1)
}

function toon(t, freq, duur, vol = 0.18, type = 'triangle') {
    const c = _ctx
    const osc = c.createOscillator(), g = c.createGain()
    osc.type = type; osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + duur)
    osc.connect(g); g.connect(c.destination)
    osc.start(t); osc.stop(t + duur + 0.02)
}

const GELUIDEN = {
    zet:      t => tok(t, 1500),
    damzet:   t => tok(t, 1200),
    slag:     t => { tok(t, 1100, 0.45); tok(t + 0.07, 1700, 0.3) },
    rokade:   t => { tok(t, 1500, 0.3); tok(t + 0.12, 1300, 0.3) },
    schaak:   t => { tok(t, 1500); toon(t + 0.08, 988, 0.18); toon(t + 0.17, 1319, 0.28) },
    promotie: t => { tok(t, 1500); [784, 988, 1175, 1568].forEach((f, i) => toon(t + 0.08 + i * 0.07, f, 0.22, 0.14)) },
    win:      t => { tok(t, 1500); [523, 659, 784, 1047].forEach((f, i) => toon(t + 0.12 + i * 0.12, f, i === 3 ? 0.6 : 0.2, 0.18)) },
    verlies:  t => { tok(t, 1500); [392, 311, 262].forEach((f, i) => toon(t + 0.15 + i * 0.22, f, i === 2 ? 0.6 : 0.25, 0.15, 'sine')) },
    remise:   t => { tok(t, 1500); toon(t + 0.15, 587, 0.3, 0.14, 'sine'); toon(t + 0.45, 523, 0.5, 0.14, 'sine') },
}

function speel(naam, extra) {
    if (!naam || !aan()) return
        try {
            const c = ctx()
            if (!c) return
                const t = c.currentTime + 0.02
                if (naam === 'damslag') {
                    const n = Math.max(1, extra || 1)
                    for (let i = 0; i < n; i++) tok(t + i * 0.09, 1100 + i * 150, 0.4)
                        return
                }
                GELUIDEN[naam](t)
        } catch (e) {}
}

function tel(bord, stuk) { let n = 0; for (const rij of bord) for (const s of rij) if (s === stuk) n++; return n }

// Welk geluid hoort bij de zet die net gedaan is? (los te testen, speelt zelf niets)
export function kiesSchaakGeluid(Schaak, staat, zet, mijnKleur) {
    if (!zet) { _vorige = null; return null }
    const aanZet = staat.aanZet, mover = aanZet === 'w' ? 'z' : 'w'
    const pionnen = { w: tel(staat.bord, 'wP'), z: tel(staat.bord, 'zP') }
    const promotie = _vorige && pionnen[mover] < _vorige[mover]
    _vorige = pionnen
    if (Schaak.isSchaakmat(staat, aanZet)) return aanZet === mijnKleur ? 'verlies' : 'win'
        if (Schaak.isPat(staat, aanZet)) return 'remise'
            if (Schaak.staatInSchaak(staat, aanZet)) return 'schaak'
                if (promotie) return 'promotie'
                    if (zet.type === 'rokade-kort' || zet.type === 'rokade-lang') return 'rokade'
                        if (zet.type === 'slag' || zet.type === 'enpassant') return 'slag'
                            return 'zet'
}

export function kiesDamGeluid(Dammen, staat, keten, mijnKleur) {
    if (!keten) { _vorige = null; return null }
    const aanZet = staat.aanZet, mover = aanZet === 'w' ? 'z' : 'w'
    const dammen = { w: tel(staat.bord, 'wD'), z: tel(staat.bord, 'zD') }
    const nieuweDam = _vorige && dammen[mover] > _vorige[mover]
    _vorige = dammen
    if (Dammen.heeftGeenZetten(staat, aanZet)) return aanZet === mijnKleur ? 'verlies' : 'win'
        if (nieuweDam) return 'promotie'
            const geslagen = keten.filter(s => s.geslagen).length
            if (geslagen) return 'damslag:' + geslagen
                return 'damzet'
}

export function schaak(Schaak, staat, zet, mijnKleur) {
    try { speel(kiesSchaakGeluid(Schaak, staat, zet, mijnKleur)) } catch (e) {}
}

export function dammen(Dammen, staat, keten, mijnKleur) {
    try {
        const g = kiesDamGeluid(Dammen, staat, keten, mijnKleur)
        if (g && g.startsWith('damslag:')) speel('damslag', parseInt(g.split(':')[1], 10))
            else speel(g)
    } catch (e) {}
}

// Klein knopje 🔊/🔇 onder de statusregel
export function knop(naastEl) {
    if (!naastEl || !naastEl.parentElement) return
        const b = document.createElement('button')
        const zet = () => { b.textContent = aan() ? '🔊 Geluid aan' : '🔇 Geluid uit' }
        b.style.cssText = 'background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.2);border-radius:14px;padding:3px 12px;color:#fff;font-size:12px;cursor:pointer;'
        b.addEventListener('click', () => {
            try { localStorage.setItem(SLEUTEL, aan() ? 'uit' : 'aan') } catch (e) {}
            zet()
            if (aan()) speel('zet')
        })
        zet()
        naastEl.insertAdjacentElement('afterend', b)
        // iOS en Chrome: geluid mag pas na een tik; zet het alvast klaar bij de eerste tik
        document.addEventListener('pointerdown', () => { if (aan()) ctx() }, { once: true })
}
