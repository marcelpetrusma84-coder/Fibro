import { berekenPaardroutes } from './schaak-paardroutes.js?v=1'
import { maakPaardHold } from './schaak-paard-hold.js?v=3'
import { schaakFen } from './schaak-ultra-engine.js?v=1'

let volgendeBeschrijving = 0
const geldigeCoordinaten = (r, k) => Number.isInteger(r) && Number.isInteger(k) && r >= 0 && r < 8 && k >= 0 && k < 8

// Own the decoration, not the board's pieces, move selection or game state.
// The root view re-renders after onInspect; refresh then decorates its new cells.
export function maakPaardRoutesUI({ Schaak, board, root = board, menu = null, legend = null,
  getState, playerColor = 'w', getSteps = () => [true,true,true,true], saveSteps = () => {},
  getRevision = () => 0, canInspect = () => false, t = (key, values = {}) => key.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match),
  onInspect, win = board?.ownerDocument?.defaultView || globalThis.window,
  doc = board?.ownerDocument || globalThis.document, holdFactory = maakPaardHold,
} = {}) {
  if (!board || typeof getState !== 'function' || !doc?.createElement) throw new TypeError('Knight routes need a board, position reader and document.')
  const id = `sch-knight-route-${++volgendeBeschrijving}`
  const cleanups = [], markers = [], descriptions = [], sources = [], holdingNodes = []
  const inputs = [...root.querySelectorAll('[data-knight-step]')].filter(input => {
    const depth = Number(input.dataset.knightStep)
    return Number.isInteger(depth) && depth >= 1 && depth <= 4
  })
  const legendLabel = legend?.querySelector('[data-knight-legend-label]')
  const legendSteps = legend?.querySelector('[data-knight-legend-steps]')
  const close = legend?.querySelector('[data-knight-close]')
  const previousLegend = { hidden:legend?.hidden, label:legendLabel?.textContent, steps:legendSteps ? [...legendSteps.childNodes] : [] }
  let disposed = false, activeRoute = null, holding = null, hold = null

  function listen(target, name, handler) {
    if (!target?.addEventListener) return
    target.addEventListener(name, handler)
    cleanups.push(() => target.removeEventListener(name, handler))
  }
  function steps() {
    let value
    try { value = getSteps() } catch { return [true,true,true,true] }
    return Array.isArray(value) && value.length === 4 ? value.map(on => on === true) : [true,true,true,true]
  }
  function context() {
    if (disposed || board.isConnected === false || root.isConnected === false) return null
    try {
      if (canInspect() !== true) return null
      const state = getState()
      return { state, fen:schaakFen(state), revision:getRevision() }
    } catch { return null }
  }
  function sourceMatches(candidate, current) {
    return Boolean(candidate && current && geldigeCoordinaten(candidate.r, candidate.k) &&
      candidate.fen === current.fen && candidate.revision === current.revision &&
      current.state.bord[candidate.r]?.[candidate.k] === candidate.color + 'N')
  }
  function getCandidate(target) {
    const square = target?.closest?.('[data-r]')
    if (!square || !board.contains(square)) return null
    const current = context(), r = Number(square.dataset.r), k = Number(square.dataset.k)
    if (!current || !geldigeCoordinaten(r,k)) return null
    const piece = current.state.bord[r]?.[k]
    return /^[wz]N$/.test(piece || '') ? { r, k, color:piece[0], fen:current.fen, revision:current.revision } : null
  }
  function canHold(candidate) {
    return (!menu || menu.hidden) && steps().some(Boolean) && sourceMatches(candidate, context())
  }
  function field(r, k) { return board.querySelector(`[data-r="${r}"][data-k="${k}"]`) }
  function removeHolding() {
    while (holdingNodes.length) holdingNodes.pop().classList.remove('sch-knight-holding')
  }
  function paintHolding() {
    removeHolding()
    if (!holding) return
    const square = field(holding.r,holding.k)
    if (square && !square.classList.contains('sch-knight-holding')) {
      square.classList.add('sch-knight-holding'); holdingNodes.push(square)
    }
  }
  function removePaint() {
    while (markers.length) markers.pop().remove()
    while (descriptions.length) {
      const { square, description } = descriptions.pop()
      const words = (square.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
      if (words.includes(description.id)) {
        const remaining = words.filter(word => word !== description.id)
        if (remaining.length) square.setAttribute('aria-describedby', remaining.join(' '))
        else square.removeAttribute('aria-describedby')
      }
      description.remove()
    }
    while (sources.length) {
      const square = sources.pop()
      square.classList.remove('sch-knight-source')
    }
  }
  function empty(node) { while (node?.firstChild) node.firstChild.remove() }
  function depthLabel(depth) { return depth === 1 ? t('Na één sprong') : t('Na {n} sprongen', { n:depth }) }
  function makeMarker(depth, enemy) {
    const marker = doc.createElement('span')
    marker.className = `sch-knight-marker sch-knight-depth-${depth}${enemy ? ' sch-knight-enemy' : ''}`
    marker.dataset.depth = String(depth)
    marker.setAttribute('aria-hidden', 'true')
    return marker
  }
  function paint() {
    removePaint()
    if (legend) legend.hidden = !activeRoute
    empty(legendSteps)
    if (!activeRoute) { paintHolding(); return }
    const enemy = activeRoute.color !== playerColor
    const label = t(enemy ? 'Routes van het paard van de computer' : 'Routes van jouw paard')
    if (legendLabel) legendLabel.textContent = label
    for (let depth = 1; depth <= 4; depth++) if (legendSteps) {
      const icon = doc.createElement('button')
      icon.type = 'button'
      icon.className = `sch-knight-marker sch-knight-step-toggle sch-knight-depth-${depth}${enemy ? ' sch-knight-enemy' : ''}`
      icon.dataset.knightLegendStep = String(depth)
      icon.setAttribute('aria-pressed', String(activeRoute.steps[depth - 1]))
      icon.setAttribute('aria-label', depthLabel(depth))
      icon.textContent = String(depth)
      icon.title = depthLabel(depth)
      legendSteps.append(icon)
    }
    const source = field(activeRoute.r,activeRoute.k)
    if (source && !source.classList.contains('sch-knight-source')) {
      source.classList.add('sch-knight-source'); sources.push(source)
    }
    for (const route of activeRoute.routes) {
      const square = field(route.r,route.k)
      if (!square) continue
      // Larger, earlier horizons precede later small ones; the style sheet
      // supplies translucent circles/squares without hiding the existing SVG.
      for (const depth of route.steps) {
        const marker = makeMarker(depth, enemy)
        square.append(marker); markers.push(marker)
      }
      const description = doc.createElement('span')
      description.id = `${id}-${route.r}-${route.k}`
      description.className = 'sch-knight-route-description'
      description.textContent = `${label}. ${route.steps.map(depthLabel).join('; ')}.`
      const previous = square.getAttribute('aria-describedby')
      square.setAttribute('aria-describedby', [previous,description.id].filter(Boolean).join(' '))
      square.append(description); descriptions.push({ square, description })
    }
    paintHolding()
  }
  function recompute(current, enabled) {
    activeRoute.steps = enabled
    activeRoute.routes = berekenPaardroutes({ Schaak, staat:current.state, van:[activeRoute.r,activeRoute.k], stappen:enabled })
  }
  function clear() {
    if (disposed) return
    activeRoute = null; holding = null
    hold?.cancel?.()
    removeHolding(); removePaint(); empty(legendSteps)
    if (legend) legend.hidden = true
  }
  function refresh() {
    if (disposed) return
    const enabled = steps(), current = context()
    for (const input of inputs) input.checked = enabled[Number(input.dataset.knightStep) - 1]
    if (activeRoute && !sourceMatches(activeRoute,current)) clear()
    else if (activeRoute && enabled.some((on, i) => on !== activeRoute.steps[i])) recompute(current, enabled)
    hold?.refresh?.()
    paint()
  }
  function inspect(candidate) {
    if (!canHold(candidate)) return
    const current = context()
    if (!sourceMatches(candidate,current)) return
    activeRoute = { ...candidate }
    recompute(current, steps())
    onInspect?.({ r:candidate.r, k:candidate.k, color:candidate.color })
    refresh()
  }
  function changeSteps() {
    if (disposed) return
    const enabled = steps(), hadRoute = Boolean(activeRoute)
    for (const input of inputs) enabled[Number(input.dataset.knightStep) - 1] = input.checked === true
    try { saveSteps(enabled.slice()) } catch { /* the root can retain an in-memory preference */ }
    refresh()
    if (hadRoute) {
      onInspect?.(activeRoute ? { r:activeRoute.r, k:activeRoute.k, color:activeRoute.color } : null)
      refresh()
    }
  }
  for (const input of inputs) listen(input, 'change', changeSteps)
  listen(legendSteps, 'click', event => {
    const button = event.target?.closest?.('[data-knight-legend-step]')
    const depth = Number(button?.dataset.knightLegendStep)
    if (!activeRoute || !Number.isInteger(depth) || depth < 1 || depth > 4) return
    const input = inputs.find(item => Number(item.dataset.knightStep) === depth)
    if (!input) return
    input.checked = !input.checked
    changeSteps()
  })
  listen(close, 'click', () => { if (!disposed) { clear(); onInspect?.(null) } })
  hold = holdFactory({
    board, getCandidate, canHold, onHold:inspect, win, doc,
    onState:({phase,candidate}) => { if (!disposed) { holding = phase === 'holding' ? candidate : null; paintHolding() } },
  })
  refresh()
  return {
    get active() { return Boolean(activeRoute) },
    refresh, clear,
    shouldIgnoreClick() { return !disposed && hold?.shouldIgnoreClick?.() === true },
    destroy() {
      if (disposed) return
      clear(); disposed = true; hold?.destroy?.()
      while (cleanups.length) cleanups.pop()()
      if (legend) legend.hidden = previousLegend.hidden
      if (legendLabel) legendLabel.textContent = previousLegend.label
      empty(legendSteps)
      if (legendSteps) legendSteps.append(...previousLegend.steps)
    },
  }
}
