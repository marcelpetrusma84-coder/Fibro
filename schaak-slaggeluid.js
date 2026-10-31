// Material, weight and harmony convey a capture; no high-pitched UI beeps.
// Kept independent of the DOM so the same voices can be rendered offline.
const WEIGHTS = new Map([
  [1, { duration:.28, chime:.72, body:155, noise:.10, layers:1 }],
  [3, { duration:.58, chime:1.05, body:118, noise:.14, layers:2 }],
  [5, { duration:.92, chime:1.38, body:88, noise:.19, layers:3 }],
  [9, { duration:1.45, chime:1.9, body:73, noise:.22, layers:4 }]
])

export function renderCaptureSound(context, { value, outcome, theme = 'classic' } = {}, at = context?.currentTime ?? 0) {
  if (!context || !WEIGHTS.has(value) || !['win','loss'].includes(outcome)) return false
  const spec = WEIGHTS.get(value)
  const positive = outcome === 'win'
  const wood = theme === 'wood'
  const start = Math.max(context.currentTime, at)
  const duration = positive ? spec.chime + (spec.layers-1)*.036 : spec.duration
  const end = start + duration
  const master = context.createGain()
  master.gain.value = .72
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -16
  limiter.knee.value = 10
  limiter.ratio.value = 6
  limiter.attack.value = .003
  limiter.release.value = .18
  master.connect(limiter)
  limiter.connect(context.destination)
  let remaining = 0
  const cleanup = source => {
    remaining++
    source.onended = () => {
      source.disconnect()
      if (--remaining === 0) { master.disconnect(); limiter.disconnect() }
    }
  }

  function envelope(node, peak, attack, length, from = start) {
    node.gain.setValueAtTime(.0001, from)
    node.gain.exponentialRampToValueAtTime(peak, from + attack)
    node.gain.exponentialRampToValueAtTime(.0001, from + length)
  }

  function resonance(frequency, peak, length, target, delay = 0, type = 'sine', attack = .012) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    const from = start + delay
    oscillator.frequency.setValueAtTime(frequency, from)
    if (target) oscillator.frequency.exponentialRampToValueAtTime(target, from + length * .8)
    envelope(gain, peak, attack, length, from)
    oscillator.connect(gain); gain.connect(master)
    cleanup(oscillator)
    oscillator.onended = (() => { const done=oscillator.onended; return () => { gain.disconnect(); done() } })()
    oscillator.start(from); oscillator.stop(from + length + .025)
  }

  if (positive) {
    // Metallic bars ring in several inharmonic modes at once. The upper modes
    // fade sooner, leaving the softer fundamental: an instrument, not a UI beep.
    const root = { 1:659.25, 3:587.33, 5:523.25, 9:440 }[value]
    const harmony = [1,1.25,1.5,2]
    const modes = [1,2.756,5.404,8.933]
    const strength = [1,.38,.14,.055]
    const notePeak = { 1:.14, 3:.15, 5:.16, 9:.17 }[value] / Math.sqrt(spec.layers)
    for (let note=0; note<spec.layers; note++) {
      for (let mode=0; mode<modes.length; mode++) {
        const frequency = root * harmony[note] * modes[mode]
        if (frequency > 4500) continue
        const tail = spec.chime * (wood ? .8 : 1) / (1+mode*.9)
        resonance(frequency, notePeak*strength[mode]*(wood && mode>0 ? .55 : 1), tail,
          null, note*.036, 'sine', .004)
      }
    }
    // A quiet mallet contact keeps the attack physical without a sharp click.
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate*.025), context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i=0; i<samples.length; i++) samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3)
    const mallet = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain()
    mallet.buffer=buffer;filter.type='lowpass';filter.frequency.value=wood?1600:2400;filter.Q.value=.6
    envelope(gain,.03,.003,.025)
    mallet.connect(filter);filter.connect(gain);gain.connect(master)
    cleanup(mallet)
    mallet.onended=(()=>{const done=mallet.onended;return()=>{filter.disconnect();gain.disconnect();done()}})()
    mallet.start(start);mallet.stop(start+.04)
    return { value, outcome, duration, end:end+.08 }
  }

  // A low, filtered impact gives larger captures a physical thud and rumble.
  const noiseDuration = value === 1 ? .075 : spec.duration * .8
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * noiseDuration), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random()*2-1) * Math.pow(1-i/samples.length, 2)
  const noise = context.createBufferSource()
  noise.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = .65
  filter.frequency.setValueAtTime((wood ? 750 : 1250) * .72, start)
  filter.frequency.exponentialRampToValueAtTime(95, start + noiseDuration)
  const noiseGain = context.createGain()
  envelope(noiseGain, spec.noise, .004, noiseDuration)
  noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(master)
  cleanup(noise)
  noise.onended = (() => { const done=noise.onended; return () => { filter.disconnect(); noiseGain.disconnect(); done() } })()
  noise.start(start); noise.stop(start + noiseDuration + .015)

  resonance(spec.body, .18, spec.duration * .72, spec.body * .49)
  if (value >= 3) resonance(67, .12, spec.duration, 34)
  const notes = [110,130.81,164.81,220]
  for (let i = 0; i < spec.layers; i++) {
    const length = spec.duration * .85
    resonance(notes[i], (value === 9 ? .075 : .045) / (1+i*.15), length,
      notes[i] * (value >= 5 ? .72 : .88), .018 + i*.012, wood ? 'sine' : 'triangle')
  }
  return { value, outcome, duration, end:end+.08 }
}
