import { maakSnelkoppelingen, maakZip } from './device-shortcuts.js?v=1'

export function startSetup({ view = window, page = document, device = navigator,
  maakPakket = maakSnelkoppelingen, zip = maakZip } = {}) {
  const install = page.getElementById('install-button')
  const folder = page.getElementById('folder-button')
  const download = page.getElementById('download-button')
  const status = page.getElementById('setup-status')
  const hint = page.getElementById('install-hint')
  const instructions = page.getElementById('install-steps')
  const media = view.matchMedia('(display-mode: standalone)')
  const ua = device.userAgent || ''
  const ios = /iPhone|iPad|iPod/.test(ua) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
  const platform = ios ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'
  const baseUrl = new URL('./', view.location.href).href
  let prompt = null, installed = media.matches || device.standalone === true
  let pakket, destroyed = false
  const listeners = []
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler)
    listeners.push(() => target.removeEventListener(type, handler))
  }
  const meld = (text, kind = 'info') => {
    if (destroyed) return
    status.textContent = text
    status.dataset.kind = kind
    status.hidden = !text
  }
  function updateInstall() {
    install.hidden = installed
    install.textContent = prompt ? 'Install Fibro' : 'Show install steps'
    hint.textContent = installed ? 'You are already using Fibro as an app on this device.'
      : prompt ? 'Your browser will ask you to confirm installation.'
      : 'Use your browser’s menu to add the Fibro icon. The steps below match your device.'
  }
  function toonStappen() {
    for (const section of page.querySelectorAll('[data-platform]')) section.open = section.dataset.platform === platform
    instructions.scrollIntoView({ behavior:'instant', block:'start' })
    instructions.focus({ preventScroll:true })
  }
  function pakketVoorbereiden() {
    pakket ??= (async () => {
      const response = await view.fetch(new URL('icon-192.png', baseUrl).href)
      if (!response.ok) throw new Error('icon-unavailable')
      return maakPakket({ baseUrl, iconPng:new Uint8Array(await response.arrayBuffer()) })
    })().catch(error => { pakket = null; throw error })
    return pakket
  }
  async function installeer() {
    if (installed || destroyed) return
    if (!prompt) { toonStappen(); return }
    const current = prompt
    prompt = null
    install.disabled = true
    try {
      const result = await current.prompt()
      const choice = current.userChoice ? await current.userChoice : result
      if (choice?.outcome === 'accepted') meld('Installation requested. Open Fibro from the new icon when it appears.')
      else meld('No problem. You can install Fibro later or continue in your browser.')
    } catch { meld('Use your browser’s install menu, or follow the steps below.'); toonStappen() }
    finally { install.disabled = false; updateInstall() }
  }
  async function downloadMap() {
    if (destroyed) return
    download.disabled = true
    try {
      const entries = await pakketVoorbereiden()
      if (destroyed) return
      const url = view.URL.createObjectURL(new Blob([zip(entries, 'Fibro')], { type:'application/zip' }))
      const link = page.createElement('a')
      link.href = url
      link.download = 'Fibro-shortcuts.zip'
      page.body.append(link)
      link.click()
      link.remove()
      view.setTimeout(() => view.URL.revokeObjectURL(url), 30000)
      meld('Shortcut ZIP prepared. Extract it to get your Fibro folder, then open Home or Key recovery.')
    } catch { meld('The shortcut download could not be prepared. Try again when you are online.', 'error') }
    finally { download.disabled = false }
  }
  async function nieuweMap(parent) {
    for (let number = 1; number <= 100; number++) {
      const name = number === 1 ? 'Fibro' : `Fibro ${number}`
      try { await parent.getDirectoryHandle(name) }
      catch (error) {
        if (error.name === 'TypeMismatchError') continue
        if (error.name !== 'NotFoundError') throw error
        return parent.getDirectoryHandle(name, { create:true })
      }
    }
    throw new Error('folder-exists')
  }
  async function maakMap() {
    if (destroyed || folder.hidden) return
    folder.disabled = true
    try {
      // Open the picker before any asynchronous asset work: it requires a tap.
      const parent = await view.showDirectoryPicker({ id:'fibro-shortcuts', mode:'readwrite', startIn:'desktop' })
      if (destroyed) return
      const entries = await pakketVoorbereiden()
      if (destroyed) return
      const target = await nieuweMap(parent)
      for (const entry of entries) {
        const file = await target.getFileHandle(entry.name, { create:true })
        const writer = await file.createWritable()
        try { await writer.write(entry.data); await writer.close() }
        catch (error) { await writer.abort().catch(() => {}); throw error }
      }
      meld(`${target.name} folder created. Open Home.url on Windows, Home.webloc on Mac, or Fibro.html in your browser.`, 'success')
    } catch (error) {
      if (error.name === 'AbortError') meld('No folder was selected. You can try again or download the ZIP instead.')
      else meld('The folder could not be completed. Use the ZIP download instead.', 'error')
    } finally { folder.disabled = false }
  }
  folder.hidden = platform !== 'desktop' || !view.isSecureContext || typeof view.showDirectoryPicker !== 'function'
  for (const section of page.querySelectorAll('[data-platform]')) section.open = section.dataset.platform === platform
  if (new URL(view.location.href).searchParams.get('welcome') === '1') {
    page.getElementById('setup-eyebrow').textContent = 'WELCOME TO FIBRO'
  }
  listen(view, 'beforeinstallprompt', event => {
    if (installed) return
    event.preventDefault()
    prompt = event
    updateInstall()
  })
  listen(view, 'appinstalled', () => { installed = true; prompt = null; updateInstall(); meld('Fibro is installed. Look for its icon on this device.') })
  listen(media, 'change', event => { installed = event.matches || device.standalone === true; updateInstall() })
  listen(install, 'click', installeer)
  listen(folder, 'click', maakMap)
  listen(download, 'click', downloadMap)
  updateInstall()
  return { installeer, maakMap, downloadMap, destroy() { destroyed = true; listeners.forEach(remove => remove()) } }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') startSetup()
