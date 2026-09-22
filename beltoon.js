// beltoon.js — beltoon voor een inkomende oproep, in code gemaakt (geen geluidsbestanden)
// De iPhone laat pas geluid toe na een tik op de pagina. Daarom wordt het geluid
// bij elke tik alvast "ontgrendeld", zodat het later zonder tik kan klinken.
(function () {
  let ctx = null, herhaal = null, max = null, ontgrendeld = false

  function context() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return null
        ctx = new AC()
      }
      if (ctx.state !== 'running') ctx.resume().catch(function () {})
    } catch (e) { return null }
    return ctx
  }

  function ontgrendel() {
    const c = context()
    if (!c || ontgrendeld) return
    try {
      // Eén stil geluidje afspelen binnen de tik: dan geeft iOS het geluid vrij
      const b = c.createBuffer(1, 1, 22050)
      const s = c.createBufferSource()
      s.buffer = b; s.connect(c.destination); s.start(0)
      ontgrendeld = true
    } catch (e) {}
  }
  ;['touchend', 'pointerdown', 'click', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, ontgrendel, { passive: true, capture: true })
  })

  function noot(c, freq, start, duur, vol) {
    const osc = c.createOscillator(), gain = c.createGain()
    osc.type = 'sine'; osc.frequency.value = freq
    osc.connect(gain); gain.connect(c.destination)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02)
    gain.gain.setValueAtTime(vol, start + Math.max(0.02, duur - 0.2))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duur)
    osc.start(start); osc.stop(start + duur + 0.05)
  }

  function speel() {
    if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300]) } catch (e) {} }
    const c = context()
    if (!c || c.state !== 'running') return // nog geen geluid toegestaan: overslaan
    const t = c.currentTime + 0.03
    const noten = [784, 988, 1175, 988, 784, 988, 1175, 1568]
    noten.forEach(function (f, i) { noot(c, f, t + i * 0.14, 0.32, 0.28) })
  }

  function stop() {
    if (herhaal) { clearInterval(herhaal); herhaal = null }
    if (max) { clearTimeout(max); max = null }
    if (navigator.vibrate) { try { navigator.vibrate(0) } catch (e) {} }
  }

  function start() {
    stop()
    speel()
    herhaal = setInterval(speel, 2500)
    max = setTimeout(stop, 46000) // nooit langer dan de beltijd van 45 s
  }

  window.FibroBeltoon = { start: start, stop: stop }
})()
