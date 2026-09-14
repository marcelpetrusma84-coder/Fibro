// opruimen.js — alles wat lokaal van één vriend is opgeslagen weggooien.
// Gebruikt bij ontvrienden: zijn foto's, muziek, video en widgets horen dan
// niet meer op dit apparaat te staan.

function openFibroDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('FibroDB', 2)
        req.onupgradeneeded = (e) => {
            const db = e.target.result
            if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

// Geeft terug hoeveel er is weggegooid en hoeveel ruimte dat scheelt.
export async function wisVriendData(vriendId, mijnId) {
    const resultaat = { items: 0, kb: 0, sleutels: 0 }
    if (!vriendId) return resultaat
        const prefix = 'vriend_' + vriendId + '_'

        try {
            const db = await openFibroDB()
            await new Promise((klaar) => {
                const tx = db.transaction('fotos', 'readwrite')
                const store = tx.objectStore('fotos')
                const cur = store.openCursor()
                cur.onsuccess = (e) => {
                    const c = e.target.result
                    if (!c) return
                        const id = String(c.value && c.value.id || c.key || '')
                        if (id.startsWith(prefix)) {
                            resultaat.items++
                            resultaat.kb += Math.round(String(c.value && c.value.data || '').length / 1024)
                            c.delete()
                        }
                        c.continue()
                }
                tx.oncomplete = () => klaar()
                tx.onerror = () => klaar()
                tx.onabort = () => klaar()
            })
        } catch (e) {
            console.warn('[opruimen] IndexedDB niet gelukt:', e)
        }

        try {
            const weg = []
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                if (!k) continue
                    if (k.includes(vriendId) && (k.startsWith('vriend_') || k.startsWith('fibro_sync_'))) weg.push(k)
            }
            for (const k of weg) localStorage.removeItem(k)
                resultaat.sleutels = weg.length
        } catch (e) {
            console.warn('[opruimen] localStorage niet gelukt:', e)
        }

        console.log('[opruimen] van vriend gewist:', resultaat.items, 'items (' + resultaat.kb + ' kB) en', resultaat.sleutels, 'instellingen')
        return resultaat
}
