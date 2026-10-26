/* Shared by early cached profile rendering, server rendering and user toggles. */
(() => {
  'use strict'
  window.FIBRO_EN = Object.assign(window.FIBRO_EN || {}, {
    'Persoonlijk': 'Personal', 'Uiterlijk': 'Appearance', 'Inhoud': 'Content',
    'Vorige onderdelen': 'Previous sections', 'Volgende onderdelen': 'Next sections'
  })
  window.toonOnlineLamp = online => {
    const control = document.getElementById('onlineToggle')
    if (!control) return
    control.dataset.online = String(Boolean(online))
    control.setAttribute('aria-checked', String(Boolean(online)))
    document.getElementById('onlineLabel').textContent = typeof T === 'function' ? T(online ? 'Online' : 'Offline') : (online ? 'Online' : 'Offline')
  }
  function startNavigation() {
    const rail = document.querySelector('.main-tabs')
    if (!rail) return
    const previous = document.getElementById('profile-nav-previous')
    const next = document.getElementById('profile-nav-next')
    const tabs = [...rail.querySelectorAll('.main-tab')]
    const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    const edges = () => {
      previous.disabled = rail.scrollLeft < 6
      next.disabled = rail.scrollWidth - rail.clientWidth - rail.scrollLeft < 6
    }
    previous.addEventListener('click', () => rail.scrollBy({ left: -Math.max(120, rail.clientWidth * .8), behavior: motion() }))
    next.addEventListener('click', () => rail.scrollBy({ left: Math.max(120, rail.clientWidth * .8), behavior: motion() }))
    rail.addEventListener('scroll', edges, { passive: true })
    rail.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      const canScroll = event.deltaY > 0 ? !next.disabled : !previous.disabled
      if (canScroll) { rail.scrollLeft += event.deltaY; event.preventDefault() }
    }, { passive: false })
    rail.addEventListener('keydown', event => {
      const index = tabs.indexOf(event.target)
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
      tabs[target].click()
      tabs[target].focus({ preventScroll: true })
    })
    new ResizeObserver(edges).observe(rail)
    edges()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startNavigation, { once: true })
  else startNavigation()
})()
