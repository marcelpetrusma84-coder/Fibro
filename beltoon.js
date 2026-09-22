// beltoon.js — beltoon voor een inkomende oproep (v2)
// Werkt met een gewoon <audio>-element i.p.v. Web Audio: de iPhone laat dat beter toe.
// Het klankje wordt hier in code gemaakt als WAV, er zijn geen geluidsbestanden.
// Bij de eerste tik op de pagina speelt het element een stil stukje af; daarna
// mag het van de iPhone later ook zonder tik geluid maken.
(function () {
  const SR = 22050
  const NOTEN = [784, 988, 1175, 988, 784, 988, 1175, 1568] // G-B-D, twee keer, hoog eind

  function wavUrl(samples) {
    const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
    const schrijf = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    schrijf(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); schrijf(8, 'WAVE')
    schrijf(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
    schrijf(36, 'data'); v.setUint32(40, n * 2, true)
    for (let i = 0; i < n; i++) {
      const x = Math.max(-1, Math.min(1, samples[i]))
      v.setInt16(44 + i * 2, x * 32767, true)
    }
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
    return 'data:audio/wav;base64,' + btoa(bin)
  }

  function maakBeltoon() {
    const s = new Float32Array(Math.floor(SR * 2.5)) // één ronde van 2,5 s, speelt in een lus
    NOTEN.forEach((f, i) => {
      const begin = Math.floor((0.03 + i * 0.14) * SR), len = Math.floor(0.32 * SR)
      for (let k = 0; k < len && begin + k < s.length; k++) {
        const t = k / SR
        const aan = Math.min(1, t / 0.02)
        const uit = t > 0.12 ? Math.exp(-(t - 0.12) * 14) : 1
        s[begin + k] += 0.3 * aan * uit * Math.sin(2 * Math.PI * f * t)
      }
    })
    return wavUrl(s)
  }

  const BELTOON = maakBeltoon()
  const STIL = wavUrl(new Float32Array(Math.floor(SR * 0.05)))

  const el = document.createElement('audio')
  el.setAttribute('playsinline', '')
  el.preload = 'auto'
  el.style.display = 'none'
  ;(document.body || document.documentElement).appendChild(el)

  let ontgrendeld = false, bezig = false, belt = false, max = null, tril = null

  function ontgrendel() {
    if (ontgrendeld || bezig || belt) return
    bezig = true
    el.loop = false
    el.src = STIL
    const p = el.play()
    const klaar = () => { bezig = false }
    if (p && p.then) {
      p.then(() => { ontgrendeld = true; if (!belt) el.pause(); klaar() }).catch(klaar)
    } else { ontgrendeld = true; klaar() }
  }
  // touchend/click tellen op de iPhone als echte tik (pointerdown niet)
  ;['touchend', 'click', 'keydown'].forEach(ev =>
    document.addEventListener(ev, ontgrendel, { passive: true, capture: true })
  )

  function trillen() {
    if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300]) } catch (e) {} }
  }

  function start() {
    stop()
    belt = true
    el.src = BELTOON
    el.loop = true
    try { el.currentTime = 0 } catch (e) {}
    const p = el.play()
    if (p && p.catch) p.catch(e => console.log('beltoon geblokkeerd:', e && e.name))
    trillen()
    tril = setInterval(trillen, 2500)
    max = setTimeout(stop, 46000) // nooit langer dan de beltijd van 45 s
  }

  function stop() {
    belt = false
    try { el.pause(); el.loop = false } catch (e) {}
    if (tril) { clearInterval(tril); tril = null }
    if (max) { clearTimeout(max); max = null }
    if (navigator.vibrate) { try { navigator.vibrate(0) } catch (e) {} }
  }

  window.FibroBeltoon = { start: start, stop: stop }
})()
