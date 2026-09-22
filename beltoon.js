// beltoon.js — beltoon voor een inkomende oproep (v5)
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
    // Echt bestandje (blob) i.p.v. data-URL: Safari speelt dat betrouwbaarder af
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
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

  let ontgrendeld = false, bezig = false, belt = false, max = null, tril = null, getikt = false

  // Statusregel in het belvenster, zodat we zien wat de telefoon met het geluid doet
  function status(tekst) {
    const type = document.getElementById('oproepType')
    if (!type) return
    let r = document.getElementById('oproepBelStatus')
    if (!r) {
      r = document.createElement('div')
      r.id = 'oproepBelStatus'
      r.style.cssText = 'font-size:12px;opacity:0.7;margin-top:6px;text-align:center;'
      type.insertAdjacentElement('afterend', r)
    }
    r.textContent = tekst
  }

  function speelNu(doorTik) {
    const p = el.play()
    if (!p || !p.then) { status('🔔 speelt'); return }
    p.then(() => status('🔔 speelt' + (doorTik ? ' (na tik)' : '')))
     .catch(e => {
       const naam = (e && e.name) || 'fout'
       if (naam === 'NotAllowedError') status('🔇 geblokkeerd (ontgrendeld: ' + (ontgrendeld ? 'ja' : 'nee') + ') — tik ergens om te horen')
       else status('⚠️ beltoon: ' + naam)
     })
  }

  function ontgrendel() {
    getikt = true
    // Belt het al maar is het stil? Dan telt deze tik: nu afspelen
    if (belt) { if (el.paused) speelNu(true); return }
    if (ontgrendeld || bezig) return
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

  // ── Alleen iPhone/iPad: na 12 s zonder tik een Fibro-scherm dat je aantikt ──
  // Safari vergeet de tik bij elke nieuwe pagina; zonder tik blijft de beltoon stil.
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const WACHT_MS = 12000
  let wekScherm = null

  // welkom = true: "Welkom bij Fibro" (na inloggen / openen), anders het gewone Fibro-scherm
  function toonWekScherm(welkom) {
    if (getikt || belt || wekScherm || !document.body) return
    wekScherm = document.createElement('div')
    wekScherm.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:14px;background:rgba(26,10,46,0.94);color:#f3e8ff;' +
      'font-family:inherit;text-align:center;padding:24px;opacity:0;transition:opacity .3s;cursor:pointer;'
    const hallo = document.createElement('div')
    hallo.textContent = welkom ? 'Welkom bij' : ''
    hallo.style.cssText = 'font-size:22px;opacity:0.8;' + (welkom ? '' : 'display:none;')
    const logo = document.createElement('div')
    logo.textContent = welkom ? 'Fibro 👋' : 'Fibro'
    logo.style.cssText = 'font-size:52px;font-weight:700;background:linear-gradient(135deg,#c084fc,#f0abfc);' +
      '-webkit-background-clip:text;background-clip:text;color:transparent;'
    const tik = document.createElement('div')
    tik.textContent = welkom ? '👆 Tik om te beginnen' : '👆 Tik om verder te gaan'
    tik.style.cssText = 'font-size:20px;'
    const uitleg = document.createElement('div')
    uitleg.textContent = '🔔 Dan hoor je de beltoon als iemand belt'
    uitleg.style.cssText = 'font-size:14px;opacity:0.6;'
    wekScherm.append(hallo, logo, tik, uitleg)
    // De tik zelf wordt al opgevangen door ontgrendel(); hier alleen het scherm weghalen
    // en voorkomen dat de tik doorgaat naar wat eronder ligt
    const weg = (e) => { e.preventDefault(); e.stopPropagation(); verbergWekScherm() }
    wekScherm.addEventListener('click', weg)
    wekScherm.addEventListener('touchend', weg)
    document.body.appendChild(wekScherm)
    requestAnimationFrame(() => { if (wekScherm) wekScherm.style.opacity = '1' })
  }

  function verbergWekScherm() {
    if (!wekScherm) return
    const w = wekScherm
    wekScherm = null
    w.style.opacity = '0'
    setTimeout(() => w.remove(), 300)
  }

  // Welkom: net ingelogd (kwam van login.html) of Fibro net geopend in dit tabblad
  function isWelkomMoment() {
    let nieuw = false
    try {
      nieuw = !sessionStorage.getItem('fibro_welkom')
      sessionStorage.setItem('fibro_welkom', '1')
    } catch (e) {}
    const vanLogin = /login\.html/.test(document.referrer || '')
    return nieuw || vanLogin
  }

  if (IS_IOS) {
    if (isWelkomMoment()) {
      const toon = () => toonWekScherm(true)
      if (document.body) toon(); else document.addEventListener('DOMContentLoaded', toon)
    }
    setTimeout(() => toonWekScherm(false), WACHT_MS) // doet niets als er al getikt is of het welkom er nog staat
  }

  function trillen() {
    if (navigator.vibrate) { try { navigator.vibrate([300, 150, 300]) } catch (e) {} }
  }

  function start() {
    stop()
    verbergWekScherm() // het belvenster moet zichtbaar zijn
    belt = true
    el.src = BELTOON
    el.loop = true
    try { el.currentTime = 0 } catch (e) {}
    status('…')
    speelNu(false)
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
