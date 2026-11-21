export function stapelProfiel(aantal) {
  const n = Math.max(0, Math.min(54, Math.floor(Number(aantal) || 0)))
  return { lagen: Math.max(1, Math.ceil(n / 4)), hoogte: Math.max(0, n - 1) * .75 }
}

export function maakStapelFeedback({ teller, melding, label, rustig, factor = () => 1,
  now = () => performance.now(), raf = fn => requestAnimationFrame(fn), cancel = id => cancelAnimationFrame(id) }) {
  const delta = teller.ownerDocument.createElement('span')
  delta.className = 'kt-stapel-delta'; delta.setAttribute('aria-hidden', 'true')
  teller.parentElement.appendChild(delta)
  let target = null, value = 0, frame = 0, timer = 0
  function update(n) {
    if (n === target) return
    const previous = target
    target = n
    if (melding) melding.textContent = label(n)
    cancel(frame); clearTimeout(timer)
    if (previous !== null) {
      const d = n - previous
      delta.textContent = (d > 0 ? '+' : '−') + Math.abs(d)
      delta.dataset.richting = d > 0 ? 'bij' : 'af'; delta.hidden = false
      timer = setTimeout(() => { delta.hidden = true }, 2600 * factor())
    } else delta.hidden = true
    if (previous === null || rustig()) { value = n; teller.textContent = label(n); return }
    const from = value, start = now(), duration = Math.min(1600, 700 + Math.abs(n - from) * 50) * factor()
    function tick(time) {
      if (!teller.isConnected) return
      const t = Math.min(1, Math.max(0, (time - start) / duration))
      const ease = t * t * (3 - 2 * t)
      value = from + (n - from) * ease
      teller.textContent = label(Math.round(value))
      if (t < 1) frame = raf(tick)
      else { frame = 0; value = n; teller.textContent = label(n) }
    }
    frame = raf(tick)
  }
  return { update, destroy() { cancel(frame); clearTimeout(timer); delta.remove() } }
}
