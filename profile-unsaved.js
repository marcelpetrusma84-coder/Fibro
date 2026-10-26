// Only widget membership is tracked here. Server/photo/theme initialization is
// deliberately not treated as a user edit.
const LEAVE_MESSAGE = 'Je hebt je widget- en spelkeuzes nog niet opgeslagen.\n\nToch de pagina verlaten?'

const uniqueWidgets = values => [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string'))]
const signature = values => JSON.stringify(uniqueWidgets(values).sort())

export function synchroniseerWidgetSchakelaars(page, widgets) {
  const enabled = new Set(uniqueWidgets(widgets))
  const controls = [...(page.querySelectorAll?.('#panel-widgets .toggle[id^="widget-"]') || [])]
  for (const control of controls) {
    const on = enabled.has(control.id.slice('widget-'.length))
    control.classList.toggle('on', on)
    control.classList.toggle('off', !on)
    control.setAttribute('role', 'switch')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-checked', String(on))
    const label = control.closest('.widget-item')?.querySelector('.widget-name')
    if (label) {
      if (!label.id) label.id = control.id + '-label'
      control.setAttribute('aria-labelledby', label.id)
    }
  }
  return controls
}

export function maakWidgetWijzigingsBewaking({ view = window, page = document, getWidgets } = {}) {
  if (typeof getWidgets !== 'function') throw new TypeError('Widget choices are required.')
  Object.assign(view.FIBRO_EN ||= {}, {
    [LEAVE_MESSAGE]: 'You have not saved your widget and game choices yet.\n\nLeave this page anyway?',
    'Niet opgeslagen': 'Unsaved changes',
    'Je hebt je widget- en spelkeuzes nog niet opgeslagen. Sla eerst op om ze te bewaren.': 'You have not saved your widget and game choices yet. Save first to keep them.',
    'Blijven': 'Stay',
    'Toch verlaten': 'Leave anyway'
  })

  const initialWidgets = uniqueWidgets(getWidgets())
  let savedWidgets = initialWidgets
  let initialized = false
  let listeningForUnload = false
  let confirmedNavigation = false
  let navigationTimer = null
  let destroyed = false
  let widgetControls = new Set()
  let pendingNavigation = null
  let replayingNavigation = null
  let previousFocus = null
  const translate = key => typeof view.T === 'function' ? view.T(key) : key
  const saveButton = page.querySelector?.('.top-bar .save-top-btn')
  const note = saveButton ? page.createElement('span') : null
  if (note) {
    note.className = 'profile-unsaved-note'
    note.setAttribute('role', 'status')
    note.hidden = true
    note.textContent = translate('Niet opgeslagen')
    saveButton.before(note)
  }

  const isDirty = () => signature(getWidgets()) !== signature(savedWidgets)
  const clearNavigation = () => {
    confirmedNavigation = false
    view.clearTimeout(navigationTimer)
    navigationTimer = null
  }
  function confirmNavigation() {
    clearNavigation()
    confirmedNavigation = true
    navigationTimer = view.setTimeout(clearNavigation, 1000)
  }
  function replayNavigation(control) {
    if (!control || destroyed) return
    confirmNavigation()
    replayingNavigation = control
    try { control.click() }
    finally { replayingNavigation = null }
  }
  // Native HTML dialogs remain visible in embedded browsers that suppress or
  // auto-dismiss window.confirm(). Construct only text nodes, never HTML text.
  const dialogCandidate = page.createElement('dialog')
  const dialog = typeof dialogCandidate.showModal === 'function' && page.body?.append ? dialogCandidate : null
  let stayButton = null
  const dialogCleanups = []
  if (dialog) {
    dialog.className = 'profile-unsaved-dialog'
    dialog.setAttribute('role', 'alertdialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-labelledby', 'profile-unsaved-title')
    dialog.setAttribute('aria-describedby', 'profile-unsaved-description')
    const heading = page.createElement('h2')
    heading.id = 'profile-unsaved-title'
    heading.textContent = translate('Niet opgeslagen')
    const description = page.createElement('p')
    description.id = 'profile-unsaved-description'
    description.textContent = translate('Je hebt je widget- en spelkeuzes nog niet opgeslagen. Sla eerst op om ze te bewaren.')
    const actions = page.createElement('div')
    actions.className = 'profile-unsaved-actions'
    stayButton = page.createElement('button')
    stayButton.type = 'button'
    stayButton.autofocus = true
    stayButton.textContent = translate('Blijven')
    const leaveButton = page.createElement('button')
    leaveButton.type = 'button'
    leaveButton.className = 'profile-unsaved-leave'
    leaveButton.textContent = translate('Toch verlaten')
    actions.append(stayButton, leaveButton)
    dialog.append(heading, description, actions)
    page.body.append(dialog)
    const listen = (element, type, listener) => {
      element.addEventListener(type, listener)
      dialogCleanups.push(() => element.removeEventListener(type, listener))
    }
    const stay = () => { pendingNavigation = null; dialog.close('stay') }
    listen(stayButton, 'click', stay)
    listen(leaveButton, 'click', () => {
      const control = pendingNavigation
      pendingNavigation = null
      dialog.close('leave')
      replayNavigation(control)
    })
    listen(dialog, 'cancel', event => { event.preventDefault(); stay() })
    listen(dialog, 'click', event => {
      if (event.target !== dialog) return
      const bounds = dialog.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) stay()
    })
    listen(dialog, 'close', () => {
      pendingNavigation = null
      if (dialog.returnValue !== 'leave') {
        clearNavigation()
        previousFocus?.focus?.({ preventScroll:true })
      }
    })
  }
  function beforeUnload(event) {
    if (!isDirty()) return
    if (confirmedNavigation) { clearNavigation(); return }
    event.preventDefault()
    event.returnValue = '' // The browser supplies its own translated warning.
  }
  function changed() {
    if (destroyed) return false
    syncToggles()
    const dirty = isDirty()
    if (dirty !== listeningForUnload) {
      view[dirty ? 'addEventListener' : 'removeEventListener']('beforeunload', beforeUnload)
      listeningForUnload = dirty
    }
    page.body?.classList.toggle('profile-has-unsaved-widgets', dirty)
    if (page.body) page.body.dataset.widgetsUnsaved = String(dirty)
    if (note) note.hidden = !dirty
    return dirty
  }
  function syncToggles() {
    widgetControls = new Set(synchroniseerWidgetSchakelaars(page, getWidgets()))
  }
  function keyboardToggle(event) {
    if (event.defaultPrevented || !widgetControls.has(event.target) || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    if (!event.repeat) event.target.click()
  }

  function navigationTarget(target) {
    const link = target?.closest?.('a[href]')
    if (link) {
      if (link.hasAttribute('download')) return null
      const destinationWindow = link.getAttribute('target')
      if (destinationWindow && !['_self', '_top', '_parent'].includes(destinationWindow)) return null
      try {
        const destination = new URL(link.getAttribute('href'), view.location.href)
        const current = new URL(view.location.href)
        if (!['http:', 'https:'].includes(destination.protocol)) return null
        return destination.origin !== current.origin || destination.pathname !== current.pathname || destination.search !== current.search ? link : null
      } catch { return null }
    }
    // Existing menu items are DIVs with inline navigation handlers. Do not eval
    // those handlers, or intercept widget toggles / Profile's internal tabs.
    const control = target?.closest?.('[onclick]')
    const action = control?.getAttribute('onclick') || ''
    return /(?:window\.)?location\.(?:href\s*=|assign\s*\(|replace\s*\()|\buitloggen\s*\(/u.test(action) ? control : null
  }
  function navigate(event) {
    if (event.target === replayingNavigation) return
    if (!isDirty() || event.defaultPrevented || (event.button ?? 0) !== 0) return
    const link = event.target?.closest?.('a[href]')
    if (link && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return
    const control = navigationTarget(event.target)
    if (!control) return
    if (dialog) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!dialog.open) {
        pendingNavigation = control
        previousFocus = page.activeElement
        dialog.returnValue = ''
        try { dialog.showModal(); stayButton.focus({ preventScroll:true }) }
        catch {
          pendingNavigation = null
          if (view.confirm(translate(LEAVE_MESSAGE))) replayNavigation(control)
        }
      }
      return
    }
    if (!view.confirm(translate(LEAVE_MESSAGE))) { event.preventDefault(); event.stopImmediatePropagation(); return }
    // Avoid a second native warning for this confirmed navigation. If another
    // handler cancels it, future navigation must still warn.
    confirmNavigation()
  }
  page.addEventListener('click', navigate, true)
  page.addEventListener('keydown', keyboardToggle)
  view.addEventListener('pageshow', clearNavigation)
  changed()

  return {
    get initialized() { return initialized },
    isDirty,
    changed,
    syncToggles,
    initialize(values) {
      if (initialized) return uniqueWidgets(getWidgets())
      const current = uniqueWidgets(getWidgets())
      const stored = uniqueWidgets(values)
      const next = new Set(stored)
      // Preserve clicks made while the asynchronous profile load was pending.
      for (const name of initialWidgets) if (!current.includes(name)) next.delete(name)
      for (const name of current) if (!initialWidgets.includes(name)) next.add(name)
      savedWidgets = stored
      initialized = true
      return [...next]
    },
    markSaved(values = getWidgets()) {
      savedWidgets = uniqueWidgets(values)
      clearNavigation()
      return changed()
    },
    destroy() {
      destroyed = true
      clearNavigation()
      view.removeEventListener('beforeunload', beforeUnload)
      view.removeEventListener('pageshow', clearNavigation)
      page.removeEventListener('click', navigate, true)
      page.removeEventListener('keydown', keyboardToggle)
      page.body?.classList.remove('profile-has-unsaved-widgets')
      if (page.body) page.body.dataset.widgetsUnsaved = 'false'
      note?.remove()
      pendingNavigation = null
      dialogCleanups.forEach(cleanup => cleanup())
      if (dialog?.open) dialog.close()
      dialog?.remove()
    }
  }
}
