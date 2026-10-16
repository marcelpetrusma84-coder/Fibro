// stickerfx.js - beweging en geluid bij stickers (v153, 15 oktober 2026; v160: geluiden als mp3; v161: 12 eigen geluiden)
// De bibliotheek: 15 bewegingen en 19 geluiden (met "geen"), dezelfde als in het Stickerlab van 15 okt.
// Een sticker onthoudt alleen de namen (bijv. beweging 'stuiter', geluid 'boing'); dit bestand speelt ze af.
// Geluiden worden met code gemaakt (Web Audio). v160: daarvan zijn mp3's gemaakt (geluiden/<naam>.mp3, met
// tests/tools/geluiden.py), die klinken hetzelfde en spelen op de iPhone ook als hij op stil staat. Fibro speelt
// de mp3; lukt dat niet (geen internet, nog niet binnen), dan het code-geluid zoals voorheen.
// Let op: tests/tools/geluiden.py neemt alles tussen '/* ---------- geluiden (Web Audio)' en
// '/* ---------- afspelen' op. Verander je daar een geluid, maak dan de mp3's opnieuw en verhoog MP3_VERSIE.
// v161: twaalf geluiden bestaan alleen als mp3 (mp3: true, gemaakt met tests/tools/geluiden2.py), voor stickervel 1.
// Lukt de mp3 niet, dan klinkt hun 'terug'-geluid (het geluid dat die sticker voorheen had).
// Namen staan hier in twee talen ([Nederlands, Engels]); de taal volgt window.T.taal (taal.js).
// Op de iPhone mag een pagina pas geluid maken na een tik: daarom zet de eerste tik op de pagina
// het geluid alvast klaar (zie onderaan).

const naamVan = item => (item && item.naam) ? (window.T && window.T.taal === 'en' ? item.naam[1] : item.naam[0]) : ''
export { naamVan }

/* ---------- bewegingen (Web Animations) ---------- */
export const BEWEGINGEN = {
  geen:      { naam: ['Geen beweging', 'No movement'], ms: 0, kf: [] },
  stuiter:   { naam: ['Stuiteren', 'Bounce'], ms: 950, easing: 'linear', oorsprong: '50% 100%', kf: [
    { transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(0) scale(1.12,0.86)', offset: 0.08 },
    { transform: 'translateY(-30%) scale(0.94,1.08)', offset: 0.3 }, { transform: 'translateY(0) scale(1.1,0.9)', offset: 0.5 },
    { transform: 'translateY(-12%) scale(0.97,1.03)', offset: 0.68 }, { transform: 'translateY(0) scale(1.05,0.95)', offset: 0.83 },
    { transform: 'translateY(-3%) scale(1,1)', offset: 0.92 }, { transform: 'translateY(0) scale(1,1)' } ] },
  wiebel:    { naam: ['Wiebelen', 'Wobble'], ms: 1000, easing: 'ease-in-out', oorsprong: '50% 90%', kf: [
    { transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-8deg)' },
    { transform: 'rotate(5deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0)' } ] },
  schud:     { naam: ['Schudden', 'Shake'], ms: 650, easing: 'linear', kf: [
    { transform: 'translateX(0)' }, { transform: 'translateX(-7%) rotate(-3deg)' }, { transform: 'translateX(7%) rotate(3deg)' },
    { transform: 'translateX(-6%) rotate(-2deg)' }, { transform: 'translateX(6%) rotate(2deg)' }, { transform: 'translateX(-3%)' },
    { transform: 'translateX(3%)' }, { transform: 'translateX(0)' } ] },
  groei:     { naam: ['Groeien', 'Pop'], ms: 750, easing: 'ease-out', kf: [
    { transform: 'scale(1)' }, { transform: 'scale(1.32)', offset: 0.28 }, { transform: 'scale(0.9)', offset: 0.55 },
    { transform: 'scale(1.08)', offset: 0.78 }, { transform: 'scale(1)' } ] },
  draai:     { naam: ['Rondje draaien', 'Spin'], ms: 850, easing: 'cubic-bezier(.5,0,.3,1)', kf: [
    { transform: 'rotate(0) scale(1)' }, { transform: 'rotate(180deg) scale(0.85)' }, { transform: 'rotate(360deg) scale(1)' } ] },
  hup:       { naam: ['Huppen', 'Hop'], ms: 1000, easing: 'linear', oorsprong: '50% 100%', kf: [
    { transform: 'translate(0,0) rotate(0) scale(1,1)' }, { transform: 'translate(0,0) rotate(0) scale(1.1,0.88)', offset: 0.1 },
    { transform: 'translate(-6%,-34%) rotate(-10deg) scale(0.96,1.06)', offset: 0.32 }, { transform: 'translate(0,0) rotate(0) scale(1.08,0.92)', offset: 0.52 },
    { transform: 'translate(4%,-13%) rotate(6deg) scale(1,1)', offset: 0.7 }, { transform: 'translate(0,0) rotate(0) scale(1.04,0.96)', offset: 0.86 },
    { transform: 'translate(0,0) rotate(0) scale(1,1)' } ] },
  kantel:    { naam: ['Hoofd scheef', 'Head tilt'], ms: 1300, easing: 'ease-in-out', oorsprong: '50% 85%', kf: [
    { transform: 'rotate(0)' }, { transform: 'rotate(-16deg) translateX(-3%)', offset: 0.25 }, { transform: 'rotate(-16deg) translateX(-3%)', offset: 0.4 },
    { transform: 'rotate(14deg) translateX(3%)', offset: 0.65 }, { transform: 'rotate(14deg) translateX(3%)', offset: 0.78 }, { transform: 'rotate(0)' } ] },
  knik:      { naam: ['Knikken', 'Nod'], ms: 1100, easing: 'ease-in-out', oorsprong: '50% 100%', kf: [
    { transform: 'rotate(0) translateY(0)' }, { transform: 'rotate(14deg) translateY(6%)', offset: 0.25 },
    { transform: 'rotate(14deg) translateY(6%)', offset: 0.6 }, { transform: 'rotate(-3deg) translateY(0)', offset: 0.85 }, { transform: 'rotate(0) translateY(0)' } ] },
  flakker:   { naam: ['Flakkeren', 'Flicker'], ms: 1100, easing: 'ease-in-out', oorsprong: '50% 100%', kf: [
    { transform: 'scale(1,1) skewX(0)', filter: 'brightness(1)' }, { transform: 'scale(1.04,1.12) skewX(-3deg)', filter: 'brightness(1.15)' },
    { transform: 'scale(0.98,0.96) skewX(2deg)', filter: 'brightness(1)' }, { transform: 'scale(1.05,1.14) skewX(3deg)', filter: 'brightness(1.2)' },
    { transform: 'scale(0.99,0.97) skewX(-2deg)', filter: 'brightness(1.05)' }, { transform: 'scale(1.03,1.08) skewX(1deg)', filter: 'brightness(1.12)' },
    { transform: 'scale(1,1) skewX(0)', filter: 'brightness(1)' } ] },
  glitch:    { naam: ['Haperen', 'Glitch'], ms: 800, easing: 'steps(1, end)', kf: [
    { transform: 'translate(0,0)', filter: 'none', opacity: 1 }, { transform: 'translate(-4%,1%)', filter: 'hue-rotate(80deg) saturate(1.6)', opacity: 1 },
    { transform: 'translate(3%,-2%)', filter: 'none', opacity: 0.6 }, { transform: 'translate(0,0) skewX(8deg)', filter: 'invert(0.15)', opacity: 1 },
    { transform: 'translate(-2%,0)', filter: 'hue-rotate(-60deg)', opacity: 1 }, { transform: 'translate(4%,1%)', filter: 'none', opacity: 0.75 },
    { transform: 'translate(0,0) skewX(-6deg)', filter: 'none', opacity: 1 }, { transform: 'translate(-1%,0)', filter: 'brightness(1.4)', opacity: 1 },
    { transform: 'translate(0,0)', filter: 'none', opacity: 1 } ] },
  oplichten: { naam: ['Oplichten', 'Glow'], ms: 1200, easing: 'ease-out', kf: [
    { transform: 'scale(1)', filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,214,63,0))' },
    { transform: 'scale(1.16)', filter: 'brightness(1.18) drop-shadow(0 0 22px rgba(255,214,63,0.95))', offset: 0.3 },
    { transform: 'scale(1.1)', filter: 'brightness(1.1) drop-shadow(0 0 14px rgba(255,214,63,0.7))', offset: 0.6 },
    { transform: 'scale(1)', filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,214,63,0))' } ] },
  duw:       { naam: ['Naar voren', 'Push'], ms: 950, easing: 'cubic-bezier(.3,0,.2,1)', kf: [
    { transform: 'scale(1)' }, { transform: 'scale(0.86)', offset: 0.15 }, { transform: 'scale(1.32)', offset: 0.35 },
    { transform: 'scale(1.25)', offset: 0.7 }, { transform: 'scale(1)' } ] },
  ontplof:   { naam: ['Ontploffen', 'Explode'], ms: 1100, easing: 'linear', kf: [
    { transform: 'scale(1) translate(0,0)', filter: 'brightness(1)' }, { transform: 'scale(0.86) translate(-2%,1%)', filter: 'brightness(1)', offset: 0.1 },
    { transform: 'scale(0.84) translate(2%,-1%)', filter: 'brightness(1)', offset: 0.18 }, { transform: 'scale(0.86) translate(-2%,0)', filter: 'brightness(1)', offset: 0.26 },
    { transform: 'scale(1.42) translate(0,0)', filter: 'brightness(1.6)', offset: 0.36 }, { transform: 'scale(1.18) translate(2%,1%)', filter: 'brightness(1.1)', offset: 0.5 },
    { transform: 'scale(1.06) translate(-1%,0)', filter: 'brightness(1)', offset: 0.7 }, { transform: 'scale(1) translate(0,0)', filter: 'brightness(1)' } ] },
  zweef:     { naam: ['Zweven', 'Float'], ms: 1600, easing: 'ease-in-out', kf: [
    { transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-10%) rotate(-3deg)' }, { transform: 'translateY(0) rotate(0)' },
    { transform: 'translateY(-6%) rotate(2deg)' }, { transform: 'translateY(0) rotate(0)' } ] },
  hartslag:  { naam: ['Hartslag', 'Heartbeat'], ms: 900, easing: 'ease-out', kf: [
    { transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.15 }, { transform: 'scale(1)', offset: 0.32 },
    { transform: 'scale(1.12)', offset: 0.47 }, { transform: 'scale(1)', offset: 0.65 }, { transform: 'scale(1)' } ] },
}

/* ---------- geluiden (Web Audio) ---------- */
let ctx = null, master = null, ruis = null
function audio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain(); master.gain.value = 0.8
      const comp = ctx.createDynamicsCompressor()
      master.connect(comp); comp.connect(ctx.destination)
      ruis = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const d = ruis.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    return ctx
  } catch (e) { return null }
}
function omhulsel(p, t, a, piek, rest) {
  p.setValueAtTime(0.0001, t)
  p.exponentialRampToValueAtTime(piek, t + a)
  p.exponentialRampToValueAtTime(0.0001, t + a + rest)
}
function toon(uit, o) {
  const { type = 'sine', f0, f1, t, duur, piek = 0.3, a = 0.004, filter } = o
  const osc = ctx.createOscillator(); osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + duur)
  const g = ctx.createGain(); omhulsel(g.gain, t, a, piek, duur)
  let kop = osc
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; osc.connect(f); kop = f }
  kop.connect(g); g.connect(uit)
  osc.start(t); osc.stop(t + a + duur + 0.05)
  return osc
}
function ruisstoot(uit, o) {
  const { t, duur, piek = 0.4, a = 0.002, type = 'bandpass', f0 = 1500, f1, q = 1 } = o
  const s = ctx.createBufferSource(); s.buffer = ruis
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + duur)
  const g = ctx.createGain(); omhulsel(g.gain, t, a, piek, duur)
  s.connect(f); f.connect(g); g.connect(uit)
  s.start(t, Math.random()); s.stop(t + a + duur + 0.05)
}
function vibrato(osc, t, hz, diepte, duur) {
  const l = ctx.createOscillator(); l.frequency.value = hz
  const d = ctx.createGain(); d.gain.setValueAtTime(0, t); d.gain.linearRampToValueAtTime(diepte, t + Math.min(0.2, duur / 2))
  l.connect(d); d.connect(osc.frequency); l.start(t); l.stop(t + duur + 0.05)
}
function noten(uit, t, rij, o = {}) {
  let tt = t
  rij.forEach(([f, duur], i) => {
    const osc = toon(uit, { type: o.type || 'sawtooth', f0: f, t: tt, duur, piek: o.piek || 0.18, a: 0.02, filter: o.filter || 1200 })
    if (i === rij.length - 1 && o.vib) vibrato(osc, tt, 6, f * 0.025, duur)
    tt += duur + (o.pauze ?? 0.04)
  })
}

export const GELUIDEN = {
  geen:    { naam: ['Geen geluid', 'No sound'], f() {} },
  boing:   { naam: ['Boing', 'Boing'], f(u, t) {
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(480, t + 0.07); o.frequency.exponentialRampToValueAtTime(290, t + 0.65)
    const l = ctx.createOscillator(); l.frequency.setValueAtTime(22, t); l.frequency.linearRampToValueAtTime(11, t + 0.65)
    const d = ctx.createGain(); d.gain.setValueAtTime(0, t); d.gain.linearRampToValueAtTime(95, t + 0.08); d.gain.exponentialRampToValueAtTime(1, t + 0.7)
    l.connect(d); d.connect(o.frequency)
    const g = ctx.createGain(); omhulsel(g.gain, t, 0.008, 0.5, 0.7)
    o.connect(g); g.connect(u); o.start(t); l.start(t); o.stop(t + 0.8); l.stop(t + 0.8)
  } },
  pling:   { naam: ['Pling pling', 'Pling pling'], f(u, t) {
    toon(u, { f0: 1300, f1: 2000, t, duur: 0.1, piek: 0.3 })
    toon(u, { f0: 1500, f1: 2300, t: t + 0.13, duur: 0.12, piek: 0.3 })
  } },
  pop:     { naam: ['Plop', 'Pop'], f(u, t) {
    toon(u, { f0: 1100, f1: 170, t, duur: 0.07, piek: 0.6, a: 0.002 })
    ruisstoot(u, { t, duur: 0.02, piek: 0.15, type: 'highpass', f0: 2500 })
  } },
  popcorn: { naam: ['Popcorn', 'Popcorn'], f(u, t) {
    for (let i = 0; i < 8; i++) {
      const tt = t + i * 0.11 + Math.random() * 0.06
      toon(u, { f0: 700 + Math.random() * 800, f1: 160, t: tt, duur: 0.05, piek: 0.45, a: 0.002 })
      ruisstoot(u, { t: tt, duur: 0.015, piek: 0.12, type: 'highpass', f0: 3000 })
    }
  } },
  sprong:  { naam: ['Sprongetje', 'Jump'], f(u, t) { toon(u, { f0: 260, f1: 980, t, duur: 0.17, piek: 0.4 }) } },
  tsjirp:  { naam: ['Tsjirp', 'Chirp'], f(u, t) {
    for (let c = 0; c < 3; c++) for (let p = 0; p < 4; p++)
      toon(u, { f0: 4300, t: t + c * 0.26 + p * 0.024, duur: 0.014, piek: 0.16, a: 0.002 })
  } },
  boem:    { naam: ['Boem', 'Boom'], f(u, t) {
    ruisstoot(u, { t, duur: 1.3, piek: 0.9, a: 0.005, type: 'lowpass', f0: 2600, f1: 110, q: 0.7 })
    toon(u, { f0: 110, f1: 36, t, duur: 0.65, piek: 0.9, a: 0.004 })
  } },
  alarm:   { naam: ['Alarm', 'Alarm'], f(u, t) {
    for (let i = 0; i < 6; i++) toon(u, { type: 'square', f0: i % 2 ? 660 : 880, t: t + i * 0.15, duur: 0.12, piek: 0.11, filter: 3000 })
  } },
  huh:     { naam: ['Huh?', 'Huh?'], f(u, t) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.36)
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1100, t + 0.36)
    const g = ctx.createGain(); omhulsel(g.gain, t, 0.05, 0.45, 0.36)
    o.connect(f); f.connect(g); g.connect(u); o.start(t); o.stop(t + 0.48)
  } },
  ting:    { naam: ['Ting!', 'Ding!'], f(u, t) {
    [[1, 0.32, 1.4], [2, 0.11, 0.8], [2.76, 0.09, 0.6], [5.4, 0.05, 0.3]]
      .forEach(([r, p, d]) => toon(u, { f0: 1568 * r, t, duur: d, piek: p, a: 0.002 }))
  } },
  klets:   { naam: ['Klets', 'Slap'], f(u, t) {
    ruisstoot(u, { t, duur: 0.1, piek: 1.0, a: 0.001, f0: 1500, q: 0.7 })
    toon(u, { f0: 230, f1: 90, t, duur: 0.08, piek: 0.45, a: 0.002 })
  } },
  zucht:   { naam: ['Wah wah wah', 'Wah wah wah'], f(u, t) {
    noten(u, t, [[294, 0.3], [277, 0.3], [262, 0.3], [247, 0.95]], { vib: true, filter: 1000, piek: 0.2 })
  } },
  slurp:   { naam: ['Slurp', 'Slurp'], f(u, t) {
    const s = ctx.createBufferSource(); s.buffer = ruis
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 7
    f.frequency.setValueAtTime(450, t); f.frequency.exponentialRampToValueAtTime(2300, t + 0.55)
    const g = ctx.createGain(); omhulsel(g.gain, t, 0.04, 0.9, 0.55)
    const trem = ctx.createGain(); trem.gain.value = 0.5
    const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = 26
    const ld = ctx.createGain(); ld.gain.value = 0.5; l.connect(ld); ld.connect(trem.gain)
    s.connect(f); f.connect(trem); trem.connect(g); g.connect(u)
    s.start(t); l.start(t); s.stop(t + 0.7); l.stop(t + 0.7)
  } },
  vuur:    { naam: ['Vuur', 'Fire'], f(u, t) {
    const s = ctx.createBufferSource(); s.buffer = ruis
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8
    f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.35); f.frequency.exponentialRampToValueAtTime(500, t + 1.0)
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05)
    s.connect(f); f.connect(g); g.connect(u); s.start(t); s.stop(t + 1.1)
    for (let i = 0; i < 12; i++) ruisstoot(u, { t: t + 0.1 + Math.random() * 0.85, duur: 0.012, piek: 0.28, type: 'highpass', f0: 2600 })
  } },
  zoemer:  { naam: ['Zoemer', 'Buzzer'], f(u, t) {
    [147, 155].forEach(fr => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1700
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01)
      g.gain.setValueAtTime(0.16, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.56)
      o.connect(f); f.connect(g); g.connect(u); o.start(t); o.stop(t + 0.6)
    })
  } },
  error:   { naam: ['Computerfout', 'Computer error'], f(u, t) {
    toon(u, { type: 'square', f0: 700, t, duur: 0.1, piek: 0.1, filter: 3000 })
    toon(u, { type: 'square', f0: 470, t: t + 0.15, duur: 0.1, piek: 0.1, filter: 3000 });
    [98, 104].forEach(fr => toon(u, { type: 'sawtooth', f0: fr, t: t + 0.32, duur: 0.42, piek: 0.14, a: 0.01, filter: 1400 }))
  } },
  drama:   { naam: ['Dun dun duuun', 'Dun dun duuun'], f(u, t) {
    noten(u, t, [[220, 0.17], [208, 0.17], [175, 1.1]], { vib: true, filter: 1500, piek: 0.22, pauze: 0.06 })
  } },
  fluit:   { naam: ['Fluitje', 'Whistle'], f(u, t) {
    toon(u, { f0: 800, f1: 1800, t, duur: 0.22, piek: 0.2, a: 0.02 })
    toon(u, { f0: 1000, f1: 1900, t: t + 0.32, duur: 0.18, piek: 0.2, a: 0.02 })
    toon(u, { f0: 1900, f1: 550, t: t + 0.5, duur: 0.4, piek: 0.2, a: 0.01 })
  } },
  // v161: alleen als mp3 (tests/tools/geluiden2.py); zonder mp3 het terug-geluid
  lach:     { naam: ['Lachen', 'Laughing'], mp3: true, terug: 'boing' },
  ssst:     { naam: ['Ssst', 'Shh'], mp3: true, terug: 'pling' },
  snurk:    { naam: ['Snurken', 'Snoring'], mp3: true, terug: 'ting' },
  moe:      { naam: ['Moeie zucht', 'Tired sigh'], mp3: true, terug: 'zucht' },
  huil:     { naam: ['Huilen', 'Crying'], mp3: true, terug: 'drama' },
  hartklop: { naam: ['Hartklop', 'Heartbeat'], mp3: true, terug: 'pling' },
  grom:     { naam: ['Grommen', 'Growl'], mp3: true, terug: 'zoemer' },
  schrik:   { naam: ['Schrik', 'Startle'], mp3: true, terug: 'alarm' },
  uitval:   { naam: ['Uitvallen', 'Power down'], mp3: true, terug: 'error' },
  druk:     { naam: ['Druk druk', 'Busy busy'], mp3: true, terug: 'popcorn' },
  spook:    { naam: ['Spookgeluid', 'Ghostly'], mp3: true, terug: 'huh' },
  sluw:     { naam: ['Sluipen', 'Sneaky'], mp3: true, terug: 'fluit' },
}

/* ---------- afspelen ---------- */
export function speelBeweging(el, beweging) {
  const bw = BEWEGINGEN[beweging]
  if (!el || !bw || !bw.ms || typeof el.animate !== 'function') return
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.getAnimations().forEach(a => a.cancel())
    el.style.transformOrigin = bw.oorsprong || '50% 50%'
    el.animate(bw.kf, { duration: bw.ms, easing: bw.easing || 'ease', fill: 'none' })
  } catch (e) {}
}
// Het geluid met code (Web Audio): de terugval als de mp3 niet lukt
function speelCode(geluid) {
  let g = GELUIDEN[geluid]
  if (g && g.mp3) g = GELUIDEN[g.terug] // v161: alleen als mp3: dan het terug-geluid
  if (!g || !g.f || geluid === 'geen') return
  if (!audio()) return
  try { g.f(master, ctx.currentTime + 0.02) } catch (e) { console.warn('[stickerfx]', e) }
}

/* ---------- geluiden als mp3 (v160) ---------- */
// De 30 mp3's samen zijn ongeveer 0,55 MB (v161) en komen van dezelfde plek als de app (GitHub), niet van de server. Ze
// worden een keer opgehaald en als blob bewaard zolang de pagina open is. Afspelen gaat met een paar <audio>-
// spelers, zodat geluiden over elkaar heen kunnen. Een iPhone laat een speler pas geluid maken als hij een keer bij
// een tik is gestart: daarom start de eerste tik op de pagina ze allemaal even met een stil geluidje (zegenen).
// Op de iPhone telt alleen het loslaten als tik (touchend/click, zie beltoon.js), niet het neerzetten (pointerdown):
// tot v159 zette Fibro het geluid alleen bij pointerdown klaar, daardoor bleef het op de iPhone vaak op slot.
const MP3_VERSIE = 160
const MP3_WACHT_MS = 400 // nog aan het ophalen: zo lang wachten, daarna het code-geluid
const SPELERS = 4
// Een stil stukje van 50 ms als blob (Safari speelt een blob betrouwbaarder af dan een data-adres, zie beltoon.js)
let stilUrl = null
function stil() {
  if (stilUrl) return stilUrl
  const sr = 22050, n = Math.floor(sr * 0.05), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
  const zet = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)) }
  zet(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); zet(8, 'WAVE'); zet(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); zet(36, 'data'); v.setUint32(40, n * 2, true)
  stilUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return stilUrl
}
const mp3 = {} // naam -> { url: blob-adres of null, klaar: belofte }
function haalMp3(naam) {
  if (!GELUIDEN[naam] || naam === 'geen') return null
  if (!mp3[naam]) {
    const m = mp3[naam] = { url: null }
    m.klaar = fetch('geluiden/' + naam + '.mp3?v=' + MP3_VERSIE)
      .then(r => (r.ok ? r.blob() : null))
      .then(b => { if (b && b.size) m.url = URL.createObjectURL(b); return m.url })
      .catch(() => null)
  }
  return mp3[naam]
}
function haalAlleMp3() { try { Object.keys(GELUIDEN).forEach(haalMp3) } catch (e) {} }
const spelers = []
let beurt = 0
function nieuweSpeler() {
  const a = new Audio()
  a.preload = 'auto'
  try { a.disableRemotePlayback = true } catch (e) {}
  a.dataset.stickerfx = '1'
  spelers.push(a)
  return a
}
function speler() {
  if (spelers.length < SPELERS) return nieuweSpeler()
  const vrij = spelers.find(a => !a._zegen && (a.paused || a.ended))
  if (vrij) return vrij
  return spelers[beurt++ % SPELERS] // alle vier bezig: de volgende in de rij
}
function speelMp3(geluid, url) {
  const a = speler()
  a._zegen = false
  try { if (a.src !== url) a.src = url; a.currentTime = 0 } catch (e) {}
  let p
  try { p = a.play() } catch (e) { p = Promise.reject(e) }
  if (p && typeof p.then === 'function') p.then(() => { a._vrij = true }, e => { if (!e || e.name !== 'AbortError') speelCode(geluid) })
}
export function speelGeluid(geluid) {
  const g = GELUIDEN[geluid]
  if (!g || geluid === 'geen') return
  const m = haalMp3(geluid)
  if (m && m.url) return speelMp3(geluid, m.url)
  // nog niet binnen: heel even wachten, anders het code-geluid
  let gedaan = false
  const terug = setTimeout(() => { if (!gedaan) { gedaan = true; speelCode(geluid) } }, MP3_WACHT_MS)
  m.klaar.then(url => {
    if (gedaan) return
    gedaan = true; clearTimeout(terug)
    if (url) speelMp3(geluid, url); else speelCode(geluid)
  })
}
// Bij elke tik tot alle spelers vrij zijn: een tik die (op de iPhone) niet telt, mislukt en de volgende probeert opnieuw
function zegenSpelers() {
  haalAlleMp3()
  while (spelers.length < SPELERS) nieuweSpeler()
  for (const a of spelers) {
    if (a._vrij || a._zegen || !a.paused) continue
    a._zegen = true
    try {
      a.src = stil()
      const p = a.play()
      if (p && typeof p.then === 'function') p.then(() => { a._vrij = true; if (a._zegen) { a.pause(); a._zegen = false } }, () => { a._zegen = false })
      else { a._vrij = true; a._zegen = false }
    } catch (e) { a._zegen = false }
  }
}
// Speel een sticker af: beweging op el (een <img>), en het geluid als metGeluid niet false is.
export function speel(el, sticker, metGeluid = true) {
  if (!sticker) return
  speelBeweging(el, sticker.b)
  if (metGeluid) speelGeluid(sticker.g)
}

// De eerste tik op de pagina zet het geluid klaar, zodat een sticker die daarna binnenkomt ook
// geluid kan maken (iPhone/Chrome laten anders pas geluid toe na een tik). Een stil toontje van
// 1 sample ontgrendelt het geluid op de iPhone (zoals in meldingen.js). Na de achtergrond (iPhone:
// 'interrupted') zet de volgende tik het weer aan.
function klaarzetten() {
  zegenSpelers() // v160: de mp3-spelers
  if (ctx && ctx.state === 'running') return
  if (!audio()) return
  try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0) } catch (e) {}
}
// v160: ook touchend en click, want op de iPhone telt alleen het loslaten als tik
for (const soort of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(soort, klaarzetten, { passive: true, capture: true })
setTimeout(haalAlleMp3, 1200) // v160: de mp3's alvast ophalen, de pagina gaat voor
