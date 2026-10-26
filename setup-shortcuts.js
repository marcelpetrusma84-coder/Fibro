import { maakSnelkoppelingen, maakZip, schrijfSnelkoppelingMap } from './device-shortcuts.js?v=2'
import { laadSnelkoppelingMap, bewaarSnelkoppelingMap } from './shortcut-folder-store.js?v=1'

const EN = {
  'Fibro-map met 2 snelkoppelingen maken':'Create a Fibro folder with 2 shortcuts',
  'Home en Sleutelherstel, met het Fibro-icoon.':'Home and Key recovery, with the Fibro icon.',
  'Je profiel en gastenboek':'Your profile and guestbook',
  'Sleutelherstel':'Key recovery',
  'Sleutel op dit apparaat terugzetten':'Restore your key on this device',
  'Map opslaan':'Save folder',
  'ZIP downloaden':'Download ZIP',
  'Op het beginscherm':'On your Home Screen',
  'Kies waar je de nieuwe Fibro-map wilt opslaan…':'Choose where to save the new Fibro folder…',
  'Fibro-map maken…':'Creating the Fibro folder…',
  'Map {naam} is gemaakt. Open Home of Key recovery in die map.':'Folder {naam} was created. Open Home or Key recovery in that folder.',
  'Geen map gekozen. Je kunt opnieuw kiezen of de ZIP downloaden.':'No folder selected. Choose again or download the ZIP.',
  'De map kon niet worden afgemaakt. Je kunt de ZIP downloaden.':'The folder could not be completed. You can download the ZIP.',
  'Snelkoppelingen voorbereiden…':'Preparing shortcuts…',
  'De ZIP is klaargezet voor download. Pak hem uit: daarin staat de Fibro-map met de twee links en het icoon.':'The ZIP is ready to download. Extract it to get the Fibro folder with both links and the icon.',
  'Downloaden lukte niet. Controleer je verbinding en probeer het opnieuw.':'The download failed. Check your connection and try again.',
  'Op je telefoon voeg je de twee iconen zelf toe en sleep je ze samen in een map.':'On your phone, add the two icons yourself and drag them together into a folder.',
  'Open Home hierboven. Kies in Safari: Deel → Zet op beginscherm → Voeg toe.':'Open Home above. In Safari choose Share → Add to Home Screen → Add.',
  'Open Home hierboven. Kies in Chrome: menu → Snelkoppeling maken of Toevoegen aan startscherm.':'Open Home above. In Chrome choose menu → Create shortcut or Add to Home Screen.',
  'Herhaal dit voor Sleutelherstel als je browser een losse snelkoppeling aanbiedt.':'Repeat for Key recovery if your browser offers a separate shortcut.',
  'Sleep de twee iconen op elkaar om een Fibro-map te maken.':'Drag the two icons onto each other to create a Fibro folder.',
  'Biedt je browser alleen App installeren aan? Op ondersteunde apparaten vind je beide links in het snelmenu van het geïnstalleerde Fibro-icoon.':'If your browser only offers Install app, supported devices show both links in the installed Fibro icon’s shortcut menu.',
  'De ZIP is een map met links. Downloaden installeert geen beginschermiconen.':'The ZIP is a folder of links. Downloading it does not install Home Screen icons.',
  'Deze links bevatten geen privésleutel of inloggegevens.':'These links contain no private key or login credentials.',
  'Lokale preview: deze snelkoppelingen horen bij dit previewadres. Maak mobiele snelkoppelingen vanuit de live Fibro-app.':'Local preview: these shortcuts use this preview address. Create mobile shortcuts from the live Fibro app.',
  'Adres':'Address',
  'Je browser laat je een map kiezen; anders kun je de Fibro-map als ZIP downloaden.':'Your browser lets you choose a folder; otherwise you can download the Fibro folder as a ZIP.'
}
Object.assign(EN, {
  'Fibro — Setup':'Fibro — Setup',
  'Maak Fibro klaar op dit apparaat':'Set up Fibro on this device',
  'Je account is klaar. Voeg hieronder de twee handige links toe.':'Your account is ready. Add the two useful links below.',
  'Je kunt dit overslaan en meteen verdergaan.':'You can skip this and continue straight away.',
  'Open Fibro':'Open Fibro',
  'Dit setupscherm maakt geen nieuwe sleutel aan.':'This setup screen does not create a new key.',
  'Standaard: een Fibro-map op je bureaublad.':'Default: a Fibro folder on your desktop.',
  'Eerdere maptoegang controleren…':'Checking previously allowed folder access…',
  'Map {naam} is gemaakt in {locatie}.':'Folder {naam} was created in {locatie}.',
  'Rechtstreeks plaatsen kan hier niet. Het Fibro-pakket wordt gedownload.':'Direct placement is unavailable here. Downloading the Fibro package.',
  'Rechtstreeks plaatsen kon niet worden afgerond. Het Fibro-pakket wordt gedownload.':'Direct placement could not be completed. Downloading the Fibro package.',
  'Het Fibro-pakket is klaargezet voor download. Pak de Fibro-map uit op je bureaublad. Je browser bepaalt de downloadlocatie.':'The Fibro package is ready to download. Extract the Fibro folder onto your desktop. Your browser controls the download location.',
  'Downloaden lukte niet. Probeer opnieuw of kies een map.':'The download failed. Try again or choose a folder.',
  'Andere mogelijkheid':'Another option',
  'Map kiezen':'Choose a folder',
  'Pakket opnieuw downloaden':'Download package again',
  'Je browser heeft nog geen toegang tot je bureaublad. Je kunt de map zelf kiezen.':'Your browser does not yet have access to your desktop. You can choose the folder yourself.',
  'Kies een map; de kiezer begint bij Bureaublad.':'Choose a folder; the picker starts at Desktop.',
  'Geen map gekozen. Je gedownloade pakket blijft bruikbaar.':'No folder selected. Your downloaded package can still be used.',
  'De map kon niet worden gemaakt. Gebruik het pakket of probeer een andere map.':'The folder could not be created. Use the package or try another folder.',
  'Op je telefoon: pak de ZIP uit voor de links, of voeg Home en Sleutelherstel toe via je browser.':'On your phone: extract the ZIP for the links, or add Home and Key recovery through your browser.'
})

export function startSetupSnelkoppelingen({ view = window, page = document, device = navigator, storage = {} } = {}) {
  const host = page.getElementById('setup-shortcuts-slot')
  if (!host || page.getElementById('fibro-shortcuts')) return null
  Object.assign(view.FIBRO_EN ||= {}, EN)
  const t = (key, values = {}) => typeof view.T === 'function' ? view.T(key, values) : key.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '{' + name + '}')
  const baseUrl = new URL('./', view.location.href)
  const iconUrl = new URL('icon-192.png', baseUrl).href
  const mobile = /iPhone|iPad|iPod|Android/.test(device.userAgent || '') || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
  const ios = /iPhone|iPad|iPod/.test(device.userAgent || '') || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
  const supportsFolders = Boolean(view.isSecureContext && typeof view.showDirectoryPicker === 'function')
  const loadDirectory = storage.load || (() => laadSnelkoppelingMap({ indexedDB:view.indexedDB }))
  const saveDirectory = storage.save || (handle => bewaarSnelkoppelingMap(handle, { indexedDB:view.indexedDB }))
  // Read permission only. Loading Setup never opens a picker or requests access.
  let rememberedDirectory = Promise.resolve().then(loadDirectory).catch(() => null)
  const card = page.createElement('section')
  card.id = 'fibro-shortcuts'
  card.className = 'fibro-shortcuts'
  card.innerHTML = `
    <label class="fibro-shortcuts-label" for="fibro-shortcuts-check">
      <input type="checkbox" id="fibro-shortcuts-check" aria-describedby="fibro-shortcuts-hint">
      <span><strong data-text="Fibro-map met 2 snelkoppelingen maken"></strong><small id="fibro-shortcuts-hint" data-text="Home en Sleutelherstel, met het Fibro-icoon."></small></span>
      <img class="fibro-shortcuts-brand" alt="" width="30" height="30">
    </label>
    <p class="fibro-shortcuts-note" data-text="Standaard: een Fibro-map op je bureaublad." data-desktop></p>
    <div class="fibro-shortcuts-details" hidden>
      <div class="fibro-shortcuts-links">
        <a class="fibro-shortcuts-link" data-link="home" target="_blank" rel="noopener"><img alt="" width="30" height="30"><span>Home<small data-text="Je profiel en gastenboek"></small></span></a>
        <a class="fibro-shortcuts-link" data-link="recovery" target="_blank" rel="noopener"><img alt="" width="30" height="30"><span><b data-text="Sleutelherstel"></b><small data-text="Sleutel op dit apparaat terugzetten"></small></span></a>
      </div>
      <div class="fibro-shortcuts-fallback" hidden>
        <p class="fibro-shortcuts-note" data-text="Je browser heeft nog geen toegang tot je bureaublad. Je kunt de map zelf kiezen." data-folder-note hidden></p>
        <div class="fibro-shortcuts-actions">
          <button type="button" data-action="folder" data-text="Map kiezen" hidden></button>
          <button type="button" class="secondary" data-action="download" data-text="Pakket opnieuw downloaden"></button>
        </div>
      </div>
      <details class="fibro-shortcuts-steps" data-mobile hidden><summary data-text="Op het beginscherm"></summary><ol></ol></details>
      <p class="fibro-shortcuts-note" data-text="Deze links bevatten geen privésleutel of inloggegevens."></p>
      <p class="fibro-shortcuts-note" data-local hidden data-text="Lokale preview: deze snelkoppelingen horen bij dit previewadres. Maak mobiele snelkoppelingen vanuit de live Fibro-app."></p>
    </div>
    <p class="fibro-shortcuts-status" role="status" aria-live="polite"></p>`
  for (const element of card.querySelectorAll('[data-text]')) element.textContent = t(element.dataset.text)
  for (const image of card.querySelectorAll('img')) image.src = iconUrl
  card.querySelector('[data-link="home"]').href = new URL('index.html', baseUrl).href
  card.querySelector('[data-link="recovery"]').href = new URL('login.html#herstellen', baseUrl).href
  card.querySelector('[data-local]').hidden = !['localhost','127.0.0.1','[::1]'].includes(baseUrl.hostname)
  card.querySelector('[data-desktop]').hidden = mobile
  host.append(card)
  const checkbox = card.querySelector('input')
  const details = card.querySelector('.fibro-shortcuts-details')
  const fallback = card.querySelector('.fibro-shortcuts-fallback')
  const folderButton = card.querySelector('[data-action="folder"]')
  const downloadButton = card.querySelector('[data-action="download"]')
  const status = card.querySelector('[role="status"]')
  const steps = card.querySelector('[data-mobile]')
  steps.hidden = !mobile
  for (const key of [
    ios ? 'Open Home hierboven. Kies in Safari: Deel → Zet op beginscherm → Voeg toe.' : 'Open Home hierboven. Kies in Chrome: menu → Snelkoppeling maken of Toevoegen aan startscherm.',
    'Herhaal dit voor Sleutelherstel als je browser een losse snelkoppeling aanbiedt.',
    'Sleep de twee iconen op elkaar om een Fibro-map te maken.',
    'Biedt je browser alleen App installeren aan? Op ondersteunde apparaten vind je beide links in het snelmenu van het geïnstalleerde Fibro-icoon.'
  ]) { const item = page.createElement('li'); item.textContent = t(key); steps.querySelector('ol').append(item) }
  let pakket = null, busy = false, destroyed = false
  const listeners = []
  const listen = (element, event, callback) => { element.addEventListener(event, callback); listeners.push(() => element.removeEventListener(event, callback)) }
  const report = (key, kind = 'info', values = {}) => { if (!destroyed) { status.textContent = t(key, values); status.dataset.kind = kind } }
  const setBusy = value => { busy = value; checkbox.disabled = folderButton.disabled = downloadButton.disabled = value; card.setAttribute('aria-busy', String(value)) }
  function prepare() {
    pakket ??= (async () => {
      const response = await view.fetch(iconUrl)
      if (!response.ok) throw new Error('icon-unavailable')
      return maakSnelkoppelingen({ baseUrl, iconPng:new Uint8Array(await response.arrayBuffer()) })
    })().catch(error => { pakket = null; throw error })
    return pakket
  }
  function showFallback() {
    fallback.hidden = false
    folderButton.hidden = !supportsFolders
    card.querySelector('[data-folder-note]').hidden = !supportsFolders || mobile
  }
  async function downloadPackage() {
    report('Snelkoppelingen voorbereiden…')
    try {
      const entries = await prepare()
      if (destroyed) return
      const href = view.URL.createObjectURL(new Blob([maakZip(entries)], { type:'application/zip' }))
      const link = page.createElement('a')
      link.href = href; link.download = 'Fibro-shortcuts.zip'
      page.body.append(link); link.click(); link.remove()
      view.setTimeout(() => view.URL.revokeObjectURL(href), 30000)
      report(mobile ? 'Op je telefoon: pak de ZIP uit voor de links, of voeg Home en Sleutelherstel toe via je browser.' : 'Het Fibro-pakket is klaargezet voor download. Pak de Fibro-map uit op je bureaublad. Je browser bepaalt de downloadlocatie.', 'success')
    } catch { report('Downloaden lukte niet. Probeer opnieuw of kies een map.', 'error') }
  }
  async function defaultAction() {
    if (destroyed || busy) return
    setBusy(true)
    fallback.hidden = true
    report('Eerdere maptoegang controleren…')
    let savedWriteFailed = false
    try {
      try {
        const parent = await rememberedDirectory
        if (destroyed) return
        if (!mobile && parent?.kind === 'directory' && typeof parent.queryPermission === 'function' && await parent.queryPermission({ mode:'readwrite' }) === 'granted') {
          const entries = await prepare()
          if (destroyed) return
          report('Fibro-map maken…')
          const result = await schrijfSnelkoppelingMap(parent, entries)
          report('Map {naam} is gemaakt in {locatie}.', 'success', { naam:result.name, locatie:parent.name })
          return
        }
      } catch { savedWriteFailed = true }
      if (destroyed) return
      showFallback()
      report(savedWriteFailed ? 'Rechtstreeks plaatsen kon niet worden afgerond. Het Fibro-pakket wordt gedownload.' : 'Rechtstreeks plaatsen kan hier niet. Het Fibro-pakket wordt gedownload.')
      await downloadPackage()
    } finally { if (!destroyed) setBusy(false) }
  }
  async function chooseFolder() {
    if (destroyed || busy || !supportsFolders) return
    setBusy(true)
    report('Kies een map; de kiezer begint bij Bureaublad.')
    try {
      // Only this explicit fallback click opens the picker, directly in its gesture.
      const parent = await view.showDirectoryPicker({ id:'fibro-shortcuts-desktop', mode:'readwrite', startIn:'desktop' })
      if (destroyed) return
      const entries = await prepare()
      if (destroyed) return
      report('Fibro-map maken…')
      const result = await schrijfSnelkoppelingMap(parent, entries)
      rememberedDirectory = Promise.resolve(parent)
      // Remember only a handle that was successfully used; never store keys or paths.
      await Promise.resolve().then(() => saveDirectory(parent)).catch(() => false)
      report('Map {naam} is gemaakt in {locatie}.', 'success', { naam:result.name, locatie:parent.name })
      fallback.hidden = true
    } catch (error) {
      report(error.name === 'AbortError' ? 'Geen map gekozen. Je gedownloade pakket blijft bruikbaar.' : 'De map kon niet worden gemaakt. Gebruik het pakket of probeer een andere map.', error.name === 'AbortError' ? 'info' : 'error')
      showFallback()
    } finally { if (!destroyed) setBusy(false) }
  }
  listen(checkbox, 'change', () => {
    details.hidden = !checkbox.checked
    if (!checkbox.checked) { status.textContent = ''; return }
    steps.open = mobile
    defaultAction()
  })
  listen(folderButton, 'click', chooseFolder)
  listen(downloadButton, 'click', async () => {
    if (destroyed || busy) return
    setBusy(true)
    try { await downloadPackage() } finally { if (!destroyed) setBusy(false) }
  })
  prepare().catch(() => {})
  return { defaultAction, chooseFolder, destroy() { destroyed = true; listeners.forEach(remove => remove()); card.remove() } }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') startSetupSnelkoppelingen()
