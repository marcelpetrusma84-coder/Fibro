import assert from 'node:assert/strict'
import { laadSnelkoppelingMap, bewaarSnelkoppelingMap } from '../../shortcut-folder-store.js'

const handle = { kind:'directory', name:'Fibro', getDirectoryHandle() {} }
function fakeIndexedDB({ openError = false, blocked = false, transactionError = false, requestError = false, putError = false, upgradeError = false, abortError = false, lateUpgrade = false, readValue = handle } = {}) {
  const state = { closed:0, created:0, writes:[], reads:[] }
  const database = {
    objectStoreNames:{ contains:() => false },
    createObjectStore(name) { if (upgradeError) throw new Error('upgrade failed'); assert.equal(name, 'directories'); state.created++ },
    close() { state.closed++ },
    transaction(name, mode) {
      assert.equal(name, 'directories')
      if (transactionError) throw new Error('transaction unavailable')
      const transaction = {
        abort() { transaction.onabort?.() },
        objectStore() {
          function request(value) {
            const pending = {}
            queueMicrotask(() => {
              if (requestError) { pending.onerror?.(); transaction.onabort?.(); return }
              pending.result = value
              pending.onsuccess?.()
              transaction.oncomplete?.()
            })
            return pending
          }
          return {
            get(key) { assert.equal(mode, 'readonly'); state.reads.push(key); return request(readValue) },
            put(value, key) { if (putError) throw new Error('DataCloneError'); assert.equal(mode, 'readwrite'); state.writes.push({ value, key }); return request(key) }
          }
        }
      }
      return transaction
    }
  }
  return { state, factory:{ open(name, version) {
    assert.equal(name, 'fibro_shortcuts'); assert.equal(version, 1)
    const request = {}
    queueMicrotask(() => {
      if (openError) { request.onerror?.(); return }
      request.result = database
      request.transaction = { abort() { if (abortError) throw new Error('already inactive') } }
      if (blocked) {
        request.onblocked?.()
        queueMicrotask(() => { if (lateUpgrade) request.onupgradeneeded?.(); request.onsuccess?.() }) // late connections must close
        return
      }
      request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  } } }
}

assert.equal(await laadSnelkoppelingMap({ indexedDB:null }), null)
assert.equal(await bewaarSnelkoppelingMap(handle, { indexedDB:null }), false)
assert.equal(await bewaarSnelkoppelingMap({ kind:'file' }, { indexedDB:null }), false)
const write = fakeIndexedDB()
assert.equal(await bewaarSnelkoppelingMap(handle, { indexedDB:write.factory }), true)
assert.equal(write.state.closed, 1)
assert.equal(write.state.created, 1)
assert.equal(write.state.writes[0].key, 'default')
assert.equal(write.state.writes[0].value, handle)
const read = fakeIndexedDB()
assert.equal(await laadSnelkoppelingMap({ indexedDB:read.factory }), handle)
assert.deepEqual(read.state.reads, ['default'])
assert.equal(read.state.closed, 1)
for (const options of [{ openError:true }, { blocked:true }, { transactionError:true }, { requestError:true }, { upgradeError:true, abortError:true }, { blocked:true, lateUpgrade:true, abortError:true }]) {
  const failing = fakeIndexedDB(options)
  assert.equal(await laadSnelkoppelingMap({ indexedDB:failing.factory }), null)
  await Promise.resolve()
  assert.equal(failing.state.closed, options.openError ? 0 : 1)
  const failingWrite = fakeIndexedDB(options)
  assert.equal(await bewaarSnelkoppelingMap(handle, { indexedDB:failingWrite.factory }), false)
  await Promise.resolve()
  assert.equal(failingWrite.state.closed, options.openError ? 0 : 1)
}
const cloneFailure = fakeIndexedDB({ putError:true })
assert.equal(await bewaarSnelkoppelingMap(handle, { indexedDB:cloneFailure.factory }), false)
assert.equal(cloneFailure.state.closed, 1)
const invalid = fakeIndexedDB({ readValue:{ kind:'file' } })
assert.equal(await laadSnelkoppelingMap({ indexedDB:invalid.factory }), null)
assert.equal(invalid.state.closed, 1)
const denied = { open() { throw new Error('denied') } }
assert.equal(await laadSnelkoppelingMap({ indexedDB:denied }), null)
assert.equal(await bewaarSnelkoppelingMap(handle, { indexedDB:denied }), false)
console.log('PASS: remembered folder handles; missing, blocked and failed IndexedDB; connections close; no permission prompt.')
