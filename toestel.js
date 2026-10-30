// toestel.js (v228): voor de bèta-cijfers op Moderatie: op wat voor toestel wordt Fibro gebruikt?
// Home meldt een keer per dag het SOORT toestel: Android-app, Android in de browser, iPhone/iPad, computer of
// anders. De server telt alleen per dag hoeveel van elk soort (tabel toestel_per_dag: datum, soort, aantal).
// Niet wie, en niet welk merk, model of browser. Wie 'helemaal offline' staat, telt niet mee (de server kijkt).
// Elk toestel (en elke browser) telt apart: gebruik je Fibro op je telefoon en op je computer, dan tel je bij allebei.
const SLEUTEL = 'fibro_toestel_geteld' // 'JJJJ-MM-DD|soort': vandaag al gemeld vanaf dit toestel

export const SOORTEN = ['android_app', 'android_web', 'iphone', 'computer', 'anders']

// nav: { userAgent, maxTouchPoints }, inApp: draait dit in de Android-app (apk.js)?
export function soortToestel(nav, inApp) {
  const ua = String((nav && nav.userAgent) || '')
  if (/Android/i.test(ua)) return inApp ? 'android_app' : 'android_web'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone'
  // een iPad doet zich voor als Mac, maar heeft een aanraakscherm
  if (/Macintosh/i.test(ua) && Number(nav && nav.maxTouchPoints) > 1) return 'iphone'
  if (/Windows|Macintosh|CrOS|X11|Linux/i.test(ua) && !/Mobile/i.test(ua)) return 'computer'
  return 'anders'
}

function inDeApp() {
  try { if (window.FibroApk && typeof window.FibroApk.inApp === 'function') return window.FibroApk.inApp() } catch (e) {}
  try {
    if ((document.referrer || '').indexOf('android-app://nl.fibro.app') === 0) return true
    return sessionStorage.getItem('fibro_in_app') === '1'
  } catch (e) { return false }
}

function vandaag(nu = new Date()) {
  // de dag zoals in Nederland (dezelfde als op de server)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nu)
}

// Een keer per dag per toestel; mislukt het (geen internet, SQL nog niet uitgevoerd), dan morgen gewoon opnieuw
export async function meldToestel(supabase, { nav = navigator, inApp = inDeApp(), opslag = localStorage, nu = new Date() } = {}) {
  const soort = soortToestel(nav, inApp)
  const merk = vandaag(nu) + '|' + soort
  try { if (opslag.getItem(SLEUTEL) === merk) return false } catch (e) {}
  try { opslag.setItem(SLEUTEL, merk) } catch (e) {}
  try {
    const { error } = await supabase.rpc('tel_toestel', { soort_in: soort })
    return !error
  } catch (e) { return false }
}
