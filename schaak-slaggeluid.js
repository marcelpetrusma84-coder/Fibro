// Material, weight and harmony convey a capture; no high-pitched UI beeps.
// Kept independent of the DOM so the same voices can be rendered offline.
const WEIGHTS = new Map([
  [1, { duration:.28, body:155, noise:.10, layers:1 }],
  [3, { duration:.58, body:118, noise:.14, layers:2 }],
  [5, { duration:.92, body:88, noise:.19, layers:3 }],
  [9, { duration:1.45, body:73, noise:.22, layers:4 }]
])

export function renderCaptureSound(context, { value, outcome, theme = 'classic' } = {}, at = context?.currentTime ?? 0) {
  if (!context || !WEIGHTS.has(value) || !['win','loss'].includes(outcome)) return false
  const spec = WEIGHTS.get(value)
  const positive = outcome === 'win'
  const wood = theme === 'wood'
  const start = Math.max(context.currentTime, at)
  const end = start + spec.duration
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
  filter.frequency.setValueAtTime((wood ? 750 : 1250) * (positive ? 1 : .72), start)
  filter.frequency.exponentialRampToValueAtTime(positive ? 260 : 95, start + noiseDuration)
  const noiseGain = context.createGain()
  envelope(noiseGain, spec.noise, .004, noiseDuration)
  noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(master)
  cleanup(noise)
  noise.onended = (() => { const done=noise.onended; return () => { filter.disconnect(); noiseGain.disconnect(); done() } })()
  noise.start(start); noise.stop(start + noiseDuration + .015)

  function resonance(frequency, peak, length, target, delay = 0, type = 'sine') {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    const from = start + delay
    oscillator.frequency.setValueAtTime(frequency, from)
    if (target) oscillator.frequency.exponentialRampToValueAtTime(target, from + length * .8)
    envelope(gain, peak, .012, length, from)
    oscillator.connect(gain); gain.connect(master)
    cleanup(oscillator)
    oscillator.onended = (() => { const done=oscillator.onended; return () => { gain.disconnect(); done() } })()
    oscillator.start(from); oscillator.stop(from + length + .025)
  }

  resonance(spec.body * (positive ? 1.15 : 1), .18, spec.duration * .72, spec.body * (positive ? .88 : .49))
  if (value >= 3) resonance(positive ? 82 : 67, .12, spec.duration, positive ? 78 : 34)
  // Reward uses a warm major voicing; loss sinks into a darker minor voicing.
  // The notes overlap as one material resonance, never a sequence of bleeps.
  const notes = positive ? [130.81,164.81,196,261.63] : [110,130.81,164.81,220]
  for (let i = 0; i < spec.layers; i++) {
    const length = spec.duration * (positive ? .96 : .85)
    resonance(notes[i], (value === 9 ? .075 : .045) / (1+i*.15), length,
      positive ? null : notes[i] * (value >= 5 ? .72 : .88), .018 + i*.012, wood ? 'sine' : 'triangle')
  }
  return { value, outcome, duration:spec.duration, end:end+.08 }
}
