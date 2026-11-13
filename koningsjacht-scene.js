// Decoratie voor Koningsjacht. De kaarttafel en haar bediening blijven zelf stil.
const eigenaren = new WeakMap()
// Toestemming hoort bij het browservenster, niet bij een tijdelijke spel-scène.
// Ook een nog openstaande permissievraag blijft zo geldig bij wisselen van scherm.
const sensorrechten = new WeakMap()
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const bedienbaar = 'button, input, select, textarea, label, a, summary, dialog, video, canvas, [contenteditable], [role="button"], [role="dialog"], [role="slider"], .kt-kaart, .kt-stapel, .kt-afleg, .kt-onder, .kt-info, .kj-vijand'

export function maakKoningsjachtScene(tafelElement, instellingen = {}) {
  if (!tafelElement?.ownerDocument) throw new Error('De kaarttafel ontbreekt.')
  eigenaren.get(tafelElement)?.stop()
  const doc = tafelElement.ownerDocument
  const win = doc.defaultView || globalThis.window
  const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false }
  const orEvent = win.DeviceOrientationEvent
  const kanSensor = win.isSecureContext === true && Boolean(orEvent)
  let sensorrecht = sensorrechten.get(win)
  if (!sensorrecht) {
    sensorrecht = { waarde: kanSensor && typeof orEvent.requestPermission === 'function' ? 'onbekend' : 'toegestaan', aanvraag: null }
    sensorrechten.set(win, sensorrecht)
  }
  let opties = { beweging: false, middeleeuws: false, flikkeren: true, bierpul: false, bierInhoud: 100, bierOorRechts: true, eigenNaam: '', anderBier: null, ...instellingen }
  let klaar = false, baseline = null, frame = null, x = 0, y = 0, doelX = 0, doelY = 0
  let laatsteBron = '', bierPointer = null
  const cleanup = []
  const laag = doc.createElement('div')
  laag.className = 'kj-scene-laag'
  laag.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;user-select:none;z-index:-1;perspective:1200px;background:#28150d;'
  const decorLayer = doc.createElement('div')
  decorLayer.className = 'kj-scene-decor'
  decorLayer.style.cssText = 'position:absolute;inset:-5%;pointer-events:none;background-position:center;background-size:cover;background-repeat:no-repeat;transform-origin:50% 62%;backface-visibility:hidden;will-change:transform;'
  // De labels blijven boven het donkere kaarslicht leesbaar.
  const bierLayer = doc.createElement('div')
  bierLayer.className = 'kj-scene-pullen'
  bierLayer.style.cssText = 'position:absolute;inset:0;z-index:32;pointer-events:none;'
  function maakPul(ander) {
    const houder = doc.createElement('div')
    houder.className = 'kj-scene-bier ' + (ander ? 'kj-scene-bier-ander' : 'kj-scene-bier-ik')
    houder.hidden = true
    houder.style.cssText = `position:absolute;${ander ? 'left' : 'right'}:8%;bottom:12%;width:12%;min-width:56px;max-width:130px;pointer-events:none;text-align:center;color:white;font:700 12px/1.2 system-ui,sans-serif;filter:drop-shadow(3px 6px 5px #0008);`
    const afbeelding = doc.createElement('img')
    afbeelding.className = 'kj-scene-bierpul'
    afbeelding.alt = ''
    afbeelding.style.cssText = 'display:block;width:100%;height:auto;pointer-events:none;'
    const meter = doc.createElement('div')
    meter.className = 'kj-scene-bier-meter'
    meter.style.cssText = `position:absolute;top:12%;bottom:28px;${ander ? 'right' : 'left'}:0;width:10px;min-height:25px;border:1px solid #fff9;border-radius:8px;background:#1b100ee8;box-shadow:0 1px 4px #000c,inset 0 0 2px #000;overflow:hidden;`
    const niveau = doc.createElement('span')
    niveau.className = 'kj-scene-bier-niveau'
    niveau.style.cssText = 'position:absolute;left:1px;right:1px;bottom:1px;border-radius:5px;background:linear-gradient(0deg,#b95a0b,#f6b32d,#fff0ad);transition:height .25s ease;'
    meter.appendChild(niveau)
    const badge = doc.createElement('div')
    badge.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;gap:3px;max-width:100%;padding:3px 5px;border:1px solid #f9e6b880;border-radius:7px;background:#17100fe8;color:#fff;text-shadow:0 1px 2px #000;box-shadow:0 2px 5px #0008;white-space:nowrap;overflow:hidden;'
    const naam = doc.createElement('span')
    naam.className = 'kj-scene-bier-naam'
    naam.style.cssText = 'overflow:hidden;text-overflow:ellipsis;'
    badge.appendChild(naam)
    houder.append(afbeelding, meter, badge)
    bierLayer.appendChild(houder)
    return { houder, afbeelding, niveau, naam, ronde: null }
  }
  const eigenPul = maakPul(false)
  const anderePul = maakPul(true)
  laag.appendChild(decorLayer)
  tafelElement.prepend(laag)
  tafelElement.appendChild(bierLayer)
  const alActief = tafelElement.classList.contains('kj-scene-actief')
  tafelElement.classList.add('kj-scene-actief')
  const oorspronkelijkeVariabelen = ['--kj-scene-x', '--kj-scene-y'].map(naam => ({ naam, waarde: tafelElement.style.getPropertyValue(naam), prioriteit: tafelElement.style.getPropertyPriority(naam) }))

  function luister(target, type, fn, options) {
    if (!target?.addEventListener) return
    target.addEventListener(type, fn, options)
    cleanup.push(() => target.removeEventListener(type, fn, options))
  }
  function zichtbaar() { return tafelElement.isConnected && !doc.hidden && doc.visibilityState !== 'hidden' }
  function bewegingsStatus() {
    if (klaar || !opties.beweging) return 'uit'
    if (motion.matches) return 'verminderde-beweging'
    if (kanSensor && sensorrecht.waarde === 'onbekend') return 'toestemming-nodig'
    if (kanSensor && sensorrecht.waarde === 'geweigerd') return 'geweigerd'
    return kanSensor ? 'sensor' : 'muis'
  }
  function verf() {
    const dx = x * 9, dy = y * 7
    decorLayer.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(1.015)`
    bierLayer.style.transform = `translate3d(${(dx * 1.2).toFixed(2)}px, ${(dy * 1.2).toFixed(2)}px, 0)`
    tafelElement.style.setProperty('--kj-scene-x', `${dx.toFixed(2)}px`)
    tafelElement.style.setProperty('--kj-scene-y', `${dy.toFixed(2)}px`)
  }
  function stopFrame() { if (frame !== null) { win.cancelAnimationFrame?.(frame); frame = null } }
  function neutraal() { stopFrame(); x = y = doelX = doelY = 0; baseline = null; laatsteBron = ''; verf() }
  function teken() {
    frame = null
    if (klaar || !opties.beweging || motion.matches || !zichtbaar()) return
    x += (doelX - x) * .14; y += (doelY - y) * .14
    const stil = Math.abs(doelX - x) < .002 && Math.abs(doelY - y) < .002
    if (stil) { x = doelX; y = doelY }
    verf()
    if (!stil && win.requestAnimationFrame) frame = win.requestAnimationFrame(teken)
  }
  function verplaats(nx, ny, bron) {
    laatsteBron = bron; doelX = clamp(nx, -1, 1); doelY = clamp(ny, -1, 1)
    if (frame !== null || (Math.abs(doelX - x) < .002 && Math.abs(doelY - y) < .002)) return
    if (win.requestAnimationFrame) frame = win.requestAnimationFrame(teken)
    else { x = doelX; y = doelY; verf() }
  }
  function toestel(event) {
    if (!opties.beweging || motion.matches || !zichtbaar() || !kanSensor || sensorrecht.waarde !== 'toegestaan' || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return
    if (!baseline) { baseline = { gamma: event.gamma, beta: event.beta }; return }
    const verschil = (n, oorsprong) => ((n - oorsprong + 540) % 360) - 180
    const gamma = verschil(event.gamma, baseline.gamma), beta = verschil(event.beta, baseline.beta)
    const rawAngle = Number(win.screen?.orientation?.angle ?? win.orientation ?? 0)
    const hoek = (Number.isFinite(rawAngle) ? rawAngle : 0) * Math.PI / 180
    verplaats((gamma * Math.cos(hoek) + beta * Math.sin(hoek)) / 28, (beta * Math.cos(hoek) - gamma * Math.sin(hoek)) / 32, 'sensor')
  }
  function muis(event) {
    if (!opties.beweging || motion.matches || !zichtbaar() || event.pointerType !== 'mouse') return
    const pad = event.composedPath?.() || []
    if (!pad.length) for (let node = event.target; node; node = node.parentElement) pad.push(node)
    if (event.buttons || pad.some(element => element !== tafelElement && element?.matches?.(bedienbaar))) {
      if (laatsteBron === 'muis') { stopFrame(); doelX = x; doelY = y }
      return
    }
    const rect = tafelElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    verplaats(((event.clientX - rect.left) / rect.width - .5) * 2, ((event.clientY - rect.top) / rect.height - .5) * 2, 'muis')
  }
  function update(nieuw = {}) {
    if (klaar) return
    const wasBeweging = opties.beweging
    opties = { ...opties, ...nieuw }
    const hout = new URL('./assets/koningsjacht/wood-table.png', import.meta.url).href
    const middeleeuws = new URL('./assets/koningsjacht/medieval-scene.png', import.meta.url).href
    const reserve = new URL('./kaarten/hout.webp', import.meta.url).href
    decorLayer.style.backgroundImage = `url("${opties.middeleeuws ? middeleeuws : hout}"), url("${reserve}")`
    const andere = opties.anderBier && typeof opties.anderBier === 'object' && !Array.isArray(opties.anderBier) ? opties.anderBier : {}
    function toonPul(pul, zichtbaar, inhoud, oorRechts, naam, ronde) {
      pul.houder.hidden = !zichtbaar
      if (!zichtbaar) { pul.afbeelding.removeAttribute('src'); pul.ronde = null; return }
      const niveau = typeof inhoud === 'number' && Number.isFinite(inhoud) ? Math.round(clamp(inhoud, 0, 100)) : 100
      const bestand = opties.middeleeuws
        ? (niveau >= 95 ? 'beer-medieval.png' : 'beer-medieval-empty.png')
        : (niveau >= 95 ? 'beer-modern-full.png' : 'beer-modern.png')
      const bierUrl = new URL('./assets/koningsjacht/' + bestand, import.meta.url).href
      if (pul.afbeelding.src !== bierUrl) pul.afbeelding.src = bierUrl
      pul.afbeelding.style.transform = oorRechts === false ? 'scaleX(-1)' : 'none'
      pul.niveau.style.transition = motion.matches || (pul === eigenPul && bierPointer !== null) ? 'none' : 'height .12s ease'
      pul.niveau.style.height = `${niveau}%`
      pul.naam.textContent = typeof naam === 'string' ? naam.trim().slice(0, 32) : ''
      pul.houder.setAttribute('aria-valuenow', String(niveau))
      if (Number.isSafeInteger(ronde) && ronde >= 0) {
        if (pul.ronde !== null && ronde !== pul.ronde && !motion.matches) {
          pul.houder.animate?.([{ transform: 'translateY(-14px) scale(.88)', opacity: .35 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' })
        }
        pul.ronde = ronde
      }
    }
    toonPul(eigenPul, opties.bierpul === true, opties.bierInhoud, opties.bierOorRechts, opties.eigenNaam, opties.bierRonde)
    toonPul(anderePul, andere.zichtbaar === true, andere.inhoud, andere.oorRechts, andere.naam, andere.ronde)
    const kanBedienen = typeof opties.onBierInhoud === 'function'
    eigenPul.houder.style.pointerEvents = kanBedienen ? 'auto' : 'none'
    eigenPul.houder.style.touchAction = 'none'
    eigenPul.houder.style.userSelect = 'none'
    eigenPul.houder.style.webkitUserSelect = 'none'
    eigenPul.houder.style.webkitTouchCallout = 'none'
    eigenPul.houder.style.cursor = kanBedienen ? 'ns-resize' : 'default'
    eigenPul.houder.tabIndex = kanBedienen ? 0 : -1
    eigenPul.houder.setAttribute('role', kanBedienen ? 'slider' : 'group')
    eigenPul.houder.setAttribute('aria-label', opties.bierLabel || opties.eigenNaam || '')
    eigenPul.houder.setAttribute('aria-orientation', 'vertical')
    eigenPul.houder.setAttribute('aria-valuemin', '0')
    eigenPul.houder.setAttribute('aria-valuemax', '100')
    laag.dataset.flikkeren = opties.flikkeren === false || motion.matches ? 'uit' : 'aan'
    if (!opties.beweging || motion.matches || wasBeweging !== opties.beweging) neutraal()
  }
  function verplaatsingsToestemming() {
    if (klaar || !opties.beweging) return Promise.resolve('uit')
    if (motion.matches) return Promise.resolve('verminderde-beweging')
    if (!kanSensor) return Promise.resolve('niet-ondersteund')
    if (typeof orEvent.requestPermission !== 'function' || sensorrecht.waarde === 'toegestaan') return Promise.resolve('toegestaan')
    if (sensorrecht.aanvraag) return sensorrecht.aanvraag
    let aanvraag
    try { aanvraag = orEvent.requestPermission() } catch { sensorrecht.waarde = 'geweigerd'; return Promise.resolve('geweigerd') }
    sensorrecht.aanvraag = Promise.resolve(aanvraag).then(resultaat => {
      sensorrecht.waarde = resultaat === 'granted' ? 'toegestaan' : 'geweigerd'
      return sensorrecht.waarde
    }, () => { sensorrecht.waarde = 'geweigerd'; return 'geweigerd' })
      .finally(() => { sensorrecht.aanvraag = null })
    return sensorrecht.aanvraag
  }
  function stop() {
    if (klaar) return
    klaar = true; stopFrame()
    if (bierPointer !== null) { try { eigenPul.houder.releasePointerCapture?.(bierPointer) } catch {} bierPointer = null }
    while (cleanup.length) cleanup.pop()()
    laag.remove()
    bierLayer.remove()
    for (const v of oorspronkelijkeVariabelen) {
      if (v.waarde) tafelElement.style.setProperty(v.naam, v.waarde, v.prioriteit)
      else tafelElement.style.removeProperty(v.naam)
    }
    if (!alActief) tafelElement.classList.remove('kj-scene-actief')
    if (eigenaren.get(tafelElement) === api) eigenaren.delete(tafelElement)
  }
  const api = { update, verplaatsingsToestemming, stop, laag, decorLayer, bierLayer, get bewegingsStatus() { return bewegingsStatus() } }
  eigenaren.set(tafelElement, api)
  function verzetBier(event, afgerond) {
    const rect = eigenPul.afbeelding.getBoundingClientRect()
    if (!rect.height || !Number.isFinite(event.clientY)) return
    const niveau = Math.round(clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1) * 100)
    update({ bierInhoud: niveau })
    opties.onBierInhoud?.(niveau, afgerond)
  }
  luister(eigenPul.houder, 'pointerdown', event => {
    if (klaar || bierPointer !== null || !opties.bierpul || typeof opties.onBierInhoud !== 'function' || event.isPrimary === false || (event.button != null && event.button !== 0)) return
    event.preventDefault(); event.stopPropagation()
    stopFrame(); doelX = x; doelY = y
    bierPointer = event.pointerId
    eigenPul.houder.focus?.({ preventScroll: true })
    try { eigenPul.houder.setPointerCapture?.(bierPointer) } catch {}
    verzetBier(event, false)
  })
  luister(win, 'pointermove', event => {
    if (bierPointer === null || event.pointerId !== bierPointer) return
    event.preventDefault(); verzetBier(event, false)
  }, { passive: false })
  luister(win, 'pointerup', event => {
    if (bierPointer === null || event.pointerId !== bierPointer) return
    event.preventDefault(); verzetBier(event, true)
    try { eigenPul.houder.releasePointerCapture?.(bierPointer) } catch {}
    bierPointer = null
  })
  const annuleer = () => {
    if (bierPointer === null) return
    try { eigenPul.houder.releasePointerCapture?.(bierPointer) } catch {}
    bierPointer = null
    opties.onBierInhoud?.(opties.bierInhoud, true)
  }
  luister(win, 'pointercancel', event => { if (event.pointerId === bierPointer) annuleer() })
  luister(eigenPul.houder, 'lostpointercapture', annuleer)
  luister(win, 'blur', annuleer)
  luister(eigenPul.houder, 'contextmenu', event => event.preventDefault())
  luister(eigenPul.houder, 'keydown', event => {
    if (!opties.bierpul || typeof opties.onBierInhoud !== 'function') return
    const stap = event.shiftKey ? 10 : 5
    const delta = { ArrowUp: stap, ArrowRight: stap, ArrowDown: -stap, ArrowLeft: -stap }
    if (!(event.key in delta) && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault(); event.stopPropagation()
    const niveau = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : clamp(opties.bierInhoud + delta[event.key], 0, 100)
    update({ bierInhoud: niveau }); opties.onBierInhoud(niveau, true)
  })
  luister(win, 'deviceorientation', toestel, { passive: true })
  luister(tafelElement, 'pointermove', muis, { passive: true })
  luister(tafelElement, 'pointerleave', () => { if (laatsteBron === 'muis') { stopFrame(); doelX = x; doelY = y } }, { passive: true })
  luister(win, 'orientationchange', neutraal)
  luister(win.screen?.orientation, 'change', neutraal)
  luister(doc, 'visibilitychange', () => { if (!zichtbaar()) neutraal() })
  if (motion.addEventListener) luister(motion, 'change', () => update({}))
  else if (motion.addListener) { const wijzig = () => update({}); motion.addListener(wijzig); cleanup.push(() => motion.removeListener(wijzig)) }
  if (win.MutationObserver) {
    const observer = new win.MutationObserver(() => { if (!tafelElement.isConnected) stop() })
    // Observe the ancestors, not every card animation inside the table.
    for (let node = tafelElement.parentNode; node; node = node.parentNode) observer.observe(node, { childList: true })
    cleanup.push(() => observer.disconnect())
  }
  update()
  return api
}
