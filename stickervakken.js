// stickervakken.js (13 nov 2026, Marcel) - welke stickervellen uit de Stekky Store in de chat staan.
// Een gedownload vel staat eerst alleen bij Stijl > Stickers. Daar zet je het aan; dan komt het in een Winkelvakje van
// de stickerkeuze in de chat (4 vakjes, op volgorde van aanzetten). Daar kun je het ook verwijderen.
// Bewaard op dit toestel in fibro_stickervakken_<uid> (een lijst met Store-id's). Bestaat die sleutel nog niet (vellen
// van voor deze versie), dan staan alle gedownloade vellen aan, zoals eerst.
import { mijnStoreVellen } from './stickervellen.js?v=237'

export const WINKEL_VAKJES = 4
const vakSleutel = uid => 'fibro_stickervakken_' + uid
function leesVakken(uid) {
  try { const l = JSON.parse(localStorage.getItem(vakSleutel(uid))); return Array.isArray(l) ? l.map(String) : null } catch (e) { return null }
}
function bewaarVakken(uid, lijst) { try { localStorage.setItem(vakSleutel(uid), JSON.stringify(lijst)) } catch (e) {} }

// De vellen die aan staan (en gedownload zijn), op volgorde van de vakjes
export function actieveStoreVellen(uid) {
  const gedownload = mijnStoreVellen(uid)
  const aan = leesVakken(uid)
  if (!aan) return gedownload.slice(0, WINKEL_VAKJES)
  return aan.map(id => gedownload.find(v => v.store === id)).filter(Boolean).slice(0, WINKEL_VAKJES)
}
export const isStoreVelActief = (uid, store) => actieveStoreVellen(uid).some(v => v.store === store)
// Vóór een nieuwe download: de huidige stand vastleggen, zodat het nieuwe vel uit staat tot je het bij Stijl aanzet
export function legStoreVakkenVast(uid) { if (!leesVakken(uid)) bewaarVakken(uid, actieveStoreVellen(uid).map(v => v.store)) }
// Aan- of uitzetten. Geeft false als alle vakjes al vol zijn (of het vel niet gedownload is).
export function zetStoreVelActief(uid, store, aan) {
  const nu = actieveStoreVellen(uid).map(v => v.store).filter(id => id !== store)
  if (aan) {
    if (!mijnStoreVellen(uid).some(v => v.store === store) || nu.length >= WINKEL_VAKJES) return false
    nu.push(store)
  }
  bewaarVakken(uid, nu)
  return true
}
