// Chess has its own device preference. Changing it never changes Fibro's app language.
import { SCHAAK_EN } from './schaak-taal-en.js?v=3'

export const SCHAAK_TAAL_KEY = 'fibro_chess_language_v1'
export const SCHAAK_TAAL_EVENT = 'fibro-chess-language-change'
const validLanguage = language => language === 'nl' || language === 'en'
let temporaryLanguage = 'nl'
let temporaryOnly = false

function defaultStorage() {
  try { return globalThis.localStorage } catch { return undefined }
}

function read(storage, fallback = 'nl') {
  try {
    const value = storage?.getItem(SCHAAK_TAAL_KEY)
    return validLanguage(value) ? value : 'nl'
  } catch { return fallback }
}

export function leesSchaakTaal() {
  if (temporaryOnly) return temporaryLanguage
  const storage = defaultStorage()
  return storage ? read(storage, temporaryLanguage) : temporaryLanguage
}

export function vertaalSchaak(nl, values, language = 'nl') {
  const key = String(nl ?? '')
  const message = language === 'en' && Object.hasOwn(SCHAAK_EN, key) ? SCHAAK_EN[key] : key
  return message.replace(/\{(\w+)\}/g, (match, name) => values && Object.hasOwn(values, name) ? String(values[name]) : match)
}

// For entry screens and media callbacks that do not own a mounted chess view.
export function schaakT(nl, values) {
  return vertaalSchaak(nl, values, leesSchaakTaal())
}

export function maakSchaakTaal(options = {}) {
  const usesDefaultStorage = !Object.hasOwn(options, 'storage')
  const storage = usesDefaultStorage ? defaultStorage() : options.storage
  const target = Object.hasOwn(options, 'eventTarget') ? options.eventTarget : globalThis.window
  let language = usesDefaultStorage && temporaryOnly ? temporaryLanguage : read(storage, usesDefaultStorage ? temporaryLanguage : 'nl')
  if (!storage && usesDefaultStorage) language = temporaryLanguage
  let destroyed = false
  const subscribers = new Set()

  function update(value) {
    if (destroyed || !validLanguage(value) || value === language) return false
    language = value
    if (usesDefaultStorage) temporaryLanguage = value
    for (const subscriber of [...subscribers]) subscriber(value)
    return true
  }
  const onLanguage = event => update(event?.detail?.language)
  const onStorage = event => {
    if (event.key !== SCHAAK_TAAL_KEY && event.key !== null) return
    if (event.storageArea && storage && event.storageArea !== storage) return
    if (usesDefaultStorage) temporaryOnly = false
    update(validLanguage(event.newValue) ? event.newValue : 'nl')
  }
  target?.addEventListener?.(SCHAAK_TAAL_EVENT, onLanguage)
  target?.addEventListener?.('storage', onStorage)

  const t = (nl, values) => vertaalSchaak(nl, values, language)
  return {
    get language() { return language },
    t,
    setLanguage(value) {
      if (destroyed || !validLanguage(value)) return false
      let persisted = false
      try { if (storage) { storage.setItem(SCHAAK_TAAL_KEY, value); persisted = true } } catch {}
      if (usesDefaultStorage) { temporaryLanguage = value; temporaryOnly = !persisted }
      const changed = update(value)
      if (changed && target?.dispatchEvent) {
        let event
        if (typeof CustomEvent === 'function') event = new CustomEvent(SCHAAK_TAAL_EVENT, { detail:{ language:value } })
        else {
          event = new Event(SCHAAK_TAAL_EVENT)
          Object.defineProperty(event, 'detail', { value:{ language:value } })
        }
        target.dispatchEvent(event)
      }
      return changed
    },
    subscribe(callback) {
      if (destroyed || typeof callback !== 'function') return () => {}
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    translate(root) {
      if (!root || destroyed) return
      root.setAttribute?.('lang', language)
      for (const [marker, attribute] of [
        ['data-sch-text', null], ['data-sch-label', 'aria-label'],
        ['data-sch-title', 'title'], ['data-sch-placeholder', 'placeholder']
      ]) {
        const nodes = [...(root.querySelectorAll?.(`[${marker}]`) || [])]
        if (root.matches?.(`[${marker}]`)) nodes.unshift(root)
        for (const node of nodes) {
          const text = t(node.getAttribute(marker))
          if (attribute) node.setAttribute(attribute, text)
          else node.textContent = text
        }
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      subscribers.clear()
      target?.removeEventListener?.(SCHAAK_TAAL_EVENT, onLanguage)
      target?.removeEventListener?.('storage', onStorage)
    }
  }
}
