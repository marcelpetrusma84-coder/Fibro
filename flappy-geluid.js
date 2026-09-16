// flappy-geluid.js - geluidseffecten voor Flappy Friends.
// Alles wordt gemaakt met Web Audio, dus er zijn geen geluidsbestanden nodig.

const OPSLAG = 'fibro_flappy_geluid'

export function maakGeluid() {
    let ctx = null
    let aan = true
    try { aan = localStorage.getItem(OPSLAG) !== 'uit' } catch (e) {}

    function audio() {
        if (!aan) return null
            try {
                if (!ctx) {
                    const AC = window.AudioContext || window.webkitAudioContext
                    if (!AC) return null
                        ctx = new AC()
                }
                if (ctx.state === 'suspended') ctx.resume()
                    return ctx
            } catch (e) {
                return null
            }
    }

    // Eén toon die van freq naar eind glijdt
    function toon({ freq, eind = freq, duur = 0.15, type = 'sine', volume = 0.2, vertraging = 0 }) {
        const a = audio()
        if (!a) return
            const t = a.currentTime + vertraging
            const osc = a.createOscillator()
            const gain = a.createGain()
            osc.type = type
            osc.frequency.setValueAtTime(freq, t)
            osc.frequency.exponentialRampToValueAtTime(Math.max(eind, 1), t + duur)
            gain.gain.setValueAtTime(0.0001, t)
            gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.0001, t + duur)
            osc.connect(gain)
            gain.connect(a.destination)
            osc.start(t)
            osc.stop(t + duur + 0.05)
    }

    // Ruis, voor vleugels, klappen en gerommel
    function ruis({ duur = 0.2, volume = 0.3, filter = 1000, filterEind = filter, soort = 'lowpass', vertraging = 0 }) {
        const a = audio()
        if (!a) return
            const t = a.currentTime + vertraging
            const lengte = Math.floor(a.sampleRate * duur)
            const buffer = a.createBuffer(1, lengte, a.sampleRate)
            const data = buffer.getChannelData(0)
            for (let i = 0; i < lengte; i++) data[i] = Math.random() * 2 - 1
                const bron = a.createBufferSource()
                bron.buffer = buffer
                const f = a.createBiquadFilter()
                f.type = soort
                f.frequency.setValueAtTime(filter, t)
                f.frequency.exponentialRampToValueAtTime(Math.max(filterEind, 1), t + duur)
                const gain = a.createGain()
                gain.gain.setValueAtTime(volume, t)
                gain.gain.exponentialRampToValueAtTime(0.0001, t + duur)
                bron.connect(f)
                f.connect(gain)
                gain.connect(a.destination)
                bron.start(t)
    }

    return {
        get aan() {
            return aan
        },
        wissel() {
            aan = !aan
            try { localStorage.setItem(OPSLAG, aan ? 'aan' : 'uit') } catch (e) {}
            if (aan) toon({ freq: 660, duur: 0.1, volume: 0.15 })
                return aan
        },
        flap() {
            ruis({ duur: 0.12, volume: 0.35, filter: 1800, filterEind: 400, soort: 'bandpass' })
        },
        punt() {
            toon({ freq: 880, duur: 0.08, type: 'square', volume: 0.08 })
            toon({ freq: 1320, duur: 0.12, type: 'square', volume: 0.08, vertraging: 0.07 })
        },
        af(geraakt) {
            if (geraakt) {
                ruis({ duur: 0.35, volume: 0.5, filter: 2500, filterEind: 200 })
                toon({ freq: 300, eind: 60, duur: 0.4, type: 'sawtooth', volume: 0.15 })
            } else {
                toon({ freq: 500, eind: 120, duur: 0.5, type: 'triangle', volume: 0.2 })
            }
        },
        munt() {
      toon({ freq: 988, duur: 0.07, type: 'square', volume: 0.07 })
      toon({ freq: 1319, duur: 0.18, type: 'square', volume: 0.07, vertraging: 0.06 })
    },
    hartje() {
      toon({ freq: 523, duur: 0.1, type: 'triangle', volume: 0.15 })
      toon({ freq: 659, duur: 0.1, type: 'triangle', volume: 0.15, vertraging: 0.08 })
      toon({ freq: 1047, duur: 0.25, type: 'triangle', volume: 0.15, vertraging: 0.16 })
    },
    au() {
      ruis({ duur: 0.2, volume: 0.4, filter: 1500, filterEind: 300 })
      toon({ freq: 440, eind: 220, duur: 0.25, type: 'square', volume: 0.1 })
    },
    vriendAf() {
            toon({ freq: 400, eind: 200, duur: 0.25, type: 'triangle', volume: 0.1 })
        },
        waarschuwing() {
            toon({ freq: 740, duur: 0.12, type: 'square', volume: 0.07 })
            toon({ freq: 740, duur: 0.12, type: 'square', volume: 0.07, vertraging: 0.18 })
        },
        vallen() {
            ruis({ duur: 0.5, volume: 0.3, filter: 300, filterEind: 80 })
        },
        tel() {
            toon({ freq: 520, duur: 0.1, type: 'square', volume: 0.08 })
        },
        start() {
            toon({ freq: 1040, duur: 0.2, type: 'square', volume: 0.1 })
        },
        einde(uitslag) {
            const noten = uitslag > 0 ? [523, 659, 784, 1047] : uitslag < 0 ? [392, 330, 262] : [523, 523]
            noten.forEach((f, i) => toon({ freq: f, duur: 0.18, type: 'triangle', volume: 0.15, vertraging: i * 0.15 }))
        }
    }
}
