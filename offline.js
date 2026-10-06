// offline.js - Fibro zonder internet (v125)
// 1. Een balkje "Geen internet" bovenaan, zolang het toestel geen verbinding heeft.
//    Het verdwijnt vanzelf zodra er weer internet is.
// 2. bewaardeSessieZonderInternet(): zonder internet kan een verlopen inlogpas niet
//    vernieuwd worden. In plaats van naar het inlogscherm te gaan, toont de pagina dan
//    wat er op dit toestel bewaard is. Zodra er weer internet is, laadt de pagina
//    opnieuw en wordt de pas gewoon vernieuwd.

const BALK_ID = 'fibro-offline-balk'

function werkBalkBij() {
  if (!document.body) return
  let balk = document.getElementById(BALK_ID)
  if (navigator.onLine) {
    if (balk) balk.style.display = 'none'
    return
  }
  if (!balk) {
    balk = document.createElement('div')
    balk.id = BALK_ID
    balk.setAttribute('role', 'status')
    balk.textContent = '\u{1F4F4} Geen internet \u00B7 je ziet wat er op dit toestel bewaard is'
    balk.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 6px);left:50%;transform:translateX(-50%);' +
      'z-index:99998;max-width:calc(100% - 24px);padding:5px 12px;border-radius:999px;background:rgba(40,24,60,0.94);' +
      'border:0.5px solid rgba(255,255,255,0.25);color:#f3e8ff;font:12px "DM Sans",sans-serif;text-align:center;' +
      'box-shadow:0 2px 10px rgba(0,0,0,0.45);pointer-events:none;'
    document.body.appendChild(balk)
  }
  balk.style.display = 'block'
}

window.addEventListener('online', werkBalkBij)
window.addEventListener('offline', werkBalkBij)
document.addEventListener('visibilitychange', () => { if (!document.hidden) werkBalkBij() })
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', werkBalkBij)
else werkBalkBij()

let herladenGepland = false
export function bewaardeSessieZonderInternet() {
  if (navigator.onLine) return null
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('sb-') || !k.endsWith('-auth-token')) continue
      const s = JSON.parse(localStorage.getItem(k) || 'null')
      if (s && s.user && s.user.id) {
        console.log('[offline] geen internet: de bewaarde gegevens worden getoond')
        if (!herladenGepland) {
          herladenGepland = true
          window.addEventListener('online', () => location.reload(), { once: true })
        }
        return { user: s.user }
      }
    }
  } catch (e) {}
  return null
}
