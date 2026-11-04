// chatfotos.js (v262, 4 nov 2026): foto's uit de chat blijven op dit toestel bewaard.
//
// Foto's in de chat gaan rechtstreeks van telefoon naar telefoon (p2pfoto.js), niet via de server. Tot nu toe stonden
// ze alleen in de chat zolang de pagina open was: na verversen waren ze weg. Nu bewaart elk toestel de foto's die het
// verstuurde of ontving zelf, in FibroDB (de bak 'fotos', net als de profielfoto's van vrienden). De server doet niets.
//
// Naam: vriend_<vriend-id>_chatfoto_<mijn-id>_<tijd>_<kort>. Daardoor:
//   - ontvrienden gooit ze weg (opruimen.js: alles met 'vriend_' en zijn id),
//   - account verwijderen ook (account.js: alles met 'vriend_'),
//   - sync.js ruimt ze NIET op (die kijkt naar 'vriend_<id>_foto_', met een _ direct na foto).
// Ze blijven even lang als je berichten (menu > Berichten bewaren, fibro_bewaren_<id>, standaard 31 dagen), en per
// vriend hoogstens de nieuwste MAX_PER_VRIEND.
//
// Twee soorten (de verstuurder kiest):
//   bewaren  - blijft in de chat; je vriend kan hem op zijn telefoon opslaan (knop in het grote scherm)
//   eenmalig - je vriend kan hem een keer openen. Na het sluiten gooit zijn toestel de foto weg en blijft er alleen
//              '👁️ Foto bekeken' staan (markeerBekeken). Bij de verstuurder blijft hij gewoon staan.
const MAX_PER_VRIEND = 150
const STANDAARD_DAGEN = 31

function openDB() {
  return new Promise((ok, nee) => {
    const r = indexedDB.open('FibroDB', 2)
    r.onupgradeneeded = (e) => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => nee(r.error)
    r.onblocked = () => nee(new Error('geblokkeerd'))
  })
}
const voorvoegsel = (mijnId, vriendId) => 'vriend_' + vriendId + '_chatfoto_' + mijnId + '_'
const GELDIG_ID = /^[0-9a-f-]{36}$/i
const GELDIGE_REEKS = /^[a-z0-9]{4,12}$/

export function bewaarDagen(mijnId) {
  try { const n = Number(localStorage.getItem('fibro_bewaren_' + mijnId)); return n > 0 ? n : STANDAARD_DAGEN } catch (e) { return STANDAARD_DAGEN }
}

// Een foto bewaren. blob: de foto zoals hij verstuurd of ontvangen is. Geeft het id terug, of null.
export async function bewaarChatFoto(mijnId, vriendId, blob, { mijn, reeks, tijd, eenmalig } = {}) {
  if (!GELDIG_ID.test(String(mijnId)) || !GELDIG_ID.test(String(vriendId)) || !blob || !/^image\//.test(blob.type || '')) return null
  try {
    const t = Number(tijd) || Date.now()
    const id = voorvoegsel(mijnId, vriendId) + t + '_' + Math.random().toString(36).slice(2, 8)
    // Als bytes, niet als Blob: dat bewaart ook op oudere iPhones betrouwbaar
    const data = await blob.arrayBuffer()
    const db = await openDB()
    await new Promise((ok) => {
      const tx = db.transaction('fotos', 'readwrite')
      tx.objectStore('fotos').put({ id, chatfoto: 1, bytes: data, type: blob.type, mijn: !!mijn, reeks: eenmalig ? null : (GELDIGE_REEKS.test(reeks || '') ? reeks : null), tijd: t, eenmalig: !!eenmalig })
      tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok
    })
    return id
  } catch (e) { console.warn('[chatfotos] bewaren mislukt', e); return null }
}

// Alle bewaarde foto's van een gesprek, oudste eerst: [{ id, tijd, mijn, reeks, blob }]. Te oud of te veel: weg.
export async function haalChatFotos(mijnId, vriendId) {
  if (!GELDIG_ID.test(String(mijnId)) || !GELDIG_ID.test(String(vriendId))) return []
  try {
    const pre = voorvoegsel(mijnId, vriendId)
    const grens = Date.now() - bewaarDagen(mijnId) * 24 * 60 * 60 * 1000
    const db = await openDB()
    const alle = await new Promise((ok) => {
      const uit = []
      const tx = db.transaction('fotos', 'readonly')
      const req = tx.objectStore('fotos').openCursor(IDBKeyRange.bound(pre, pre + '￿'))
      req.onsuccess = (e) => { const c = e.target.result; if (!c) return; uit.push(c.value); c.continue() }
      tx.oncomplete = () => ok(uit); tx.onerror = () => ok(uit)
    })
    alle.sort((a, b) => (a.tijd || 0) - (b.tijd || 0))
    const weg = []
    const houden = []
    for (const f of alle) {
      if (!f || (!f.bytes && !f.bekeken) || !(f.tijd > grens)) weg.push(f && f.id)
      else houden.push(f)
    }
    while (houden.length > MAX_PER_VRIEND) weg.push(houden.shift().id)
    if (weg.length) {
      await new Promise((ok) => {
        const tx = db.transaction('fotos', 'readwrite')
        for (const id of weg) if (id) tx.objectStore('fotos').delete(id)
        tx.oncomplete = ok; tx.onerror = ok
      })
    }
    return houden.map(f => ({ id: f.id, tijd: f.tijd, mijn: !!f.mijn, reeks: f.reeks || null, eenmalig: !!f.eenmalig, bekeken: !!f.bekeken,
      blob: f.bytes ? new Blob([f.bytes], { type: /^image\//.test(f.type || '') ? f.type : 'image/jpeg' }) : null }))
  } catch (e) { console.warn('[chatfotos] ophalen mislukt', e); return [] }
}

// Een foto die je maar een keer mocht zien is bekeken: de foto zelf weg, alleen 'bekeken' blijft (voor in de chat)
export async function markeerBekeken(id) {
  if (typeof id !== 'string' || !id.includes('_chatfoto_')) return
  try {
    const db = await openDB()
    await new Promise((ok) => {
      const tx = db.transaction('fotos', 'readwrite')
      const st = tx.objectStore('fotos')
      const r = st.get(id)
      r.onsuccess = () => { const f = r.result; if (f) { f.bytes = null; f.type = null; f.bekeken = 1; st.put(f) } }
      tx.oncomplete = ok; tx.onerror = ok
    })
  } catch (e) { console.warn('[chatfotos] bekeken bewaren mislukt', e) }
}
