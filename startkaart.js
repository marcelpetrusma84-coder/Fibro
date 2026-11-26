// startkaart.js (v1, 26 nov 2026, Marcel): de kaart "Speel met een vriend" bovenaan Home voor wie nog nooit een spel
// met een vriend startte.
//
// In gewone woorden: een nieuwe gebruiker zag op Home vooral zijn profiel (mood, foto's, gastenboek). Het leukste wat
// Stekky kan, samen spelen, stond nergens vooraan. Nu staat er één kaart met drie spellen die iedereen meteen heeft
// (geen download nodig). Een tik opent het spel; daar kies je "Tegen een vriend".
//   - Geen vrienden? Dan staat er "Nodig eerst een vriend uit" met een knop naar Vrienden.
//   - De kaart verdwijnt zodra je een uitnodiging voor een spel verstuurd hebt, of als je op het kruisje tikt.
//   - Wat je deed onthoudt Stekky alleen op dit toestel (per account), er komt niets op de server.
export const KAART_SPELLEN = [
  { id: 'vieroprij', icon: '🔴', naam: 'Four in a Row' },
  { id: 'botkaaseiren', icon: '⭕', naam: 'Tic-Tac-Toe' },
  { id: 'schaken', icon: '♟️', naam: 'Chess' },
]

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const sleutel = uid => 'fibro_startkaart_klaar_' + uid
function lees(ls, k) { try { return ls.getItem(k) } catch (e) { return null } }

// Is de kaart al weg (uitnodiging verstuurd of weggeklikt)?
export function isKlaar(ls, uid) { return !UID.test(String(uid || '')) || lees(ls, sleutel(uid)) === '1' }
// Onthoud: klaar. Aangeroepen vanuit spel.html zodra de uitnodiging verstuurd is, en bij het kruisje.
export function markeerKlaar(ls, uid) {
  if (!UID.test(String(uid || ''))) return false
  try { ls.setItem(sleutel(uid), '1'); return true } catch (e) { return false }
}

// Bouwt de kaart. vrienden = aantal vrienden (getal). open(spelId) opent het spel; naarVrienden() gaat naar Vrienden.
// Geeft null als de kaart niet getoond hoeft te worden.
export function maakStartKaart({ uid, vrienden, ls, T = s => s, open, naarVrienden, document: doc = globalThis.document }) {
  if (isKlaar(ls, uid) || !Number.isFinite(vrienden)) return null
  const kaart = doc.createElement('section')
  kaart.className = 'start-kaart'
  kaart.setAttribute('aria-label', T('Speel met een vriend'))
  kaart.style.cssText = 'position:relative;margin:0 12px 14px;padding:16px;border-radius:16px;border:1px solid rgba(192,132,252,0.5);background:rgba(192,132,252,0.12);text-align:left'
  const kop = doc.createElement('h2'); kop.style.cssText = 'font-size:17px;margin:0 28px 4px 0'; kop.textContent = '🎮 ' + T('Speel met een vriend')
  const tekst = doc.createElement('p'); tekst.style.cssText = 'font-size:14px;line-height:1.5;margin:0 0 12px;opacity:0.9'
  const sluit = doc.createElement('button'); sluit.type = 'button'; sluit.className = 'start-kaart-sluit'
  sluit.textContent = '×'; sluit.setAttribute('aria-label', T('Sluiten'))
  sluit.style.cssText = 'position:absolute;top:8px;right:8px;width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,0.1);color:inherit;font-size:18px;cursor:pointer'
  sluit.onclick = () => { markeerKlaar(ls, uid); kaart.remove() }
  kaart.append(kop, tekst, sluit)
  const knopStijl = 'min-height:44px;border-radius:12px;border:none;background:#8b3fd1;color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit'
  if (vrienden > 0) {
    tekst.textContent = T('Kies een spel en nodig een vriend uit.')
    const rij = doc.createElement('div'); rij.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'
    for (const s of KAART_SPELLEN) {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'start-kaart-spel'; b.dataset.spel = s.id
      b.style.cssText = knopStijl + ';flex:1 1 90px;padding:8px 10px'
      b.textContent = s.icon + ' ' + s.naam
      b.onclick = () => open(s.id)
      rij.appendChild(b)
    }
    kaart.appendChild(rij)
  } else {
    tekst.textContent = T('Nodig eerst een vriend uit, dan kun je samen spelen.')
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'start-kaart-vrienden'
    b.style.cssText = knopStijl + ';width:100%'; b.textContent = T('+ Vriend uitnodigen')
    b.onclick = () => naarVrienden()
    kaart.appendChild(b)
  }
  return kaart
}
