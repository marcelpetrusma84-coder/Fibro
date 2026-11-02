// A soft, continuous breath of sound for an evaluation change. Unlike the
// metallic capture bars, these voices swell slowly and glide in pitch.
export function evaluationSoundProfile(deltaCp) {
    if (!Number.isFinite(deltaCp) || deltaCp === 0) return null
    const magnitude = Math.abs(deltaCp)
    const tier = magnitude < 50 ? 0 : magnitude < 150 ? 1 : 2
    return { tier, positive: deltaCp > 0, duration: [.44, .66, .9][tier], peak: [.045, .06, .075][tier] }
}

export function renderEvaluationSound(context, { deltaCp, onended } = {}, at = context?.currentTime ?? 0) {
    const profile = evaluationSoundProfile(deltaCp)
    if (!context || !profile) return false
    const { tier, positive, duration, peak } = profile
    const start = Math.max(context.currentTime, at)
    const end = start + duration + .025
    const master = context.createGain()
    master.gain.value = .72
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -18
    limiter.knee.value = 12
    limiter.ratio.value = 5
    limiter.attack.value = .008
    limiter.release.value = .12
    const toneFilter = context.createBiquadFilter()
    toneFilter.type = 'lowpass'
    toneFilter.Q.value = .5
    toneFilter.frequency.setValueAtTime(positive ? 650 : 850, start)
    toneFilter.frequency.exponentialRampToValueAtTime(positive ? 1100 : 340, start + duration)
    toneFilter.connect(master)
    master.connect(limiter)
    limiter.connect(context.destination)
    const sources = []
    let remaining = 0, complete = false, cancelled = false

    function source(node, owned) {
        sources.push(node)
        remaining++
        let ended = false
        node.onended = () => {
            if (ended) return
            ended = true
            node.disconnect()
            for (const connected of owned) connected.disconnect()
            if (--remaining === 0) {
                complete = true
                toneFilter.disconnect(); master.disconnect(); limiter.disconnect()
                if (typeof onended === 'function') onended()
            }
        }
    }

    function envelope(gain, strength) {
        gain.gain.setValueAtTime(.0001, start)
        gain.gain.exponentialRampToValueAtTime(strength, start + duration * .3)
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    }

    // Three harmonic, low-register strands move together as one warm breath;
    // there are no separate struck notes or inharmonic metallic partials.
    const from = positive ? 155 : 230
    const to = positive ? [195, 225, 270][tier] : [185, 150, 118][tier]
    const harmony = positive ? [1, 1.25, 1.5] : [1, 1.2, 1.5]
    harmony.forEach((ratio, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain()
        oscillator.type = index === 1 ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(from * ratio, start)
        oscillator.frequency.exponentialRampToValueAtTime(to * ratio, start + duration * .8)
        envelope(gain, peak * [1, .58, .4][index])
        oscillator.connect(gain); gain.connect(toneFilter)
        source(oscillator, [gain])
        oscillator.start(start); oscillator.stop(end)
    })

    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
    const wind = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain()
    wind.buffer = buffer
    filter.type = 'bandpass'; filter.Q.value = .45
    filter.frequency.setValueAtTime(positive ? 320 : 750, start)
    filter.frequency.exponentialRampToValueAtTime(positive ? 900 : 240, start + duration)
    envelope(gain, peak * .26)
    wind.connect(filter); filter.connect(gain); gain.connect(master)
    source(wind, [filter, gain])
    wind.start(start); wind.stop(end)

    return {
        ...profile, start, end,
        cancel(atTime = context.currentTime) {
            if (complete || cancelled) return context.currentTime
            cancelled = true
            const fromTime = Math.max(context.currentTime, atTime)
            const stopAt = fromTime + .012
            master.gain.cancelScheduledValues?.(fromTime)
            master.gain.setValueAtTime(.72, fromTime)
            master.gain.exponentialRampToValueAtTime(.0001, stopAt)
            for (const node of sources) {
                try { node.stop(stopAt) } catch {}
            }
            return stopAt
        }
    }
}
