// Remember only a browser directory handle. Permission remains controlled by the browser.
const DATABASE = 'fibro_shortcuts'
const STORE = 'directories'
const DEFAULT = 'default'
const TIMEOUT_MS = 1500

function openDatabase(factory) {
  if (!factory || typeof factory.open !== 'function') return Promise.resolve(null)
  return new Promise(resolve => {
    let finished = false
    let request
    const finish = value => {
      if (finished) { try { value?.close() } catch {} return }
      finished = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), TIMEOUT_MS)
    try {
      request = factory.open(DATABASE, 1)
      request.onblocked = () => finish(null)
      request.onerror = () => finish(null)
      request.onupgradeneeded = () => {
        if (finished) { try { request.transaction?.abort() } catch {} return }
        try {
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
        } catch {
          try { request.transaction?.abort() } catch {}
          finish(null)
        }
      }
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        finish(database)
      }
    } catch { finish(null) }
  })
}

async function useStore(factory, mode, operation, fallback) {
  const database = await openDatabase(factory)
  if (!database) return fallback
  try {
    return await new Promise(resolve => {
      let transaction, finished = false, result = fallback
      const finish = value => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        resolve(value)
      }
      const timer = setTimeout(() => {
        try { transaction?.abort() } catch {}
        finish(fallback)
      }, TIMEOUT_MS)
      try {
        transaction = database.transaction(STORE, mode)
        transaction.onabort = transaction.onerror = () => finish(fallback)
        transaction.oncomplete = () => finish(result)
        const request = operation(transaction.objectStore(STORE))
        request.onsuccess = () => { result = mode === 'readwrite' ? true : request.result }
        request.onerror = () => finish(fallback)
      } catch { finish(fallback) }
    })
  } finally { try { database.close() } catch {} }
}

function isDirectory(handle) {
  return Boolean(handle && handle.kind === 'directory' && typeof handle.getDirectoryHandle === 'function')
}

export async function laadSnelkoppelingMap({ indexedDB = globalThis.indexedDB } = {}) {
  const handle = await useStore(indexedDB, 'readonly', store => store.get(DEFAULT), null)
  return isDirectory(handle) ? handle : null
}

export async function bewaarSnelkoppelingMap(handle, { indexedDB = globalThis.indexedDB } = {}) {
  if (!isDirectory(handle)) return false
  return useStore(indexedDB, 'readwrite', store => store.put(handle, DEFAULT), false)
}
