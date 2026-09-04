// sessie.js — sessiebewaking Fibro (2 september 2026)
// Onderscheid tussen een echte uitlog en een tijdelijke hapering.
import { supabase } from './supabase.js?v=15'

const BEWUST = 'fibro_bewust_uitloggen'
const slaap = ms => new Promise(r => setTimeout(r, ms))

function heeftToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.includes('-auth-token')) return true
    }
  } catch (e) {}
  return false
}

export async function haalSessie(pogingen = 5) {
  if (!heeftToken()) {
    console.log('[sessie] geen token in opslag - echt uitgelogd')
    return null
  }
  for (let i = 1; i <= pogingen; i++) {
    if (!navigator.onLine) {
      console.log('[sessie] offline, poging', i)
    } else {
      try {
        const g = await supabase.auth.getSession()
        if (g && g.data && g.data.session) {
          if (i > 1) console.log('[sessie] sessie terug na poging', i)
          return g.data.session
        }
        const v = await supabase.auth.refreshSession()
        if (v && v.data && v.data.session) {
          console.log('[sessie] token ververst na poging', i)
          return v.data.session
        }
        const fout = String((v && v.error && v.error.message) || (g && g.error && g.error.message) || '')
        if (/invalid|revoked|not found|already used/i.test(fout)) {
          console.log('[sessie] token definitief ongeldig:', fout)
          return null
        }
        console.log('[sessie] poging', i, 'mislukt:', fout || 'geen sessie')
      } catch (e) {
        console.log('[sessie] poging', i, 'fout:', e && e.message)
      }
    }
    if (i < pogingen) await slaap(500 * Math.pow(2, i - 1))
  }
  console.log('[sessie] herkansingen op')
  return null
}

export async function eisSessie() {
  const s = await haalSessie()
  if (s) return s
  if (!navigator.onLine) {
    console.log('[sessie] offline - niet doorsturen')
    return null
  }
  window.location.href = 'login.html'
  return null
}

export function startBewaking() {
  supabase.auth.onAuthStateChange(function (event) {
    console.log('[sessie] event:', event)
    if (event !== 'SIGNED_OUT') return
    if (sessionStorage.getItem(BEWUST) === '1') {
      console.log('[sessie] bewuste uitlog')
      return
    }
    console.log('[sessie] SIGNED_OUT zonder klik - herstel proberen')
    eisSessie()
  })
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') haalSessie(2)
  })
  window.addEventListener('online', function () { haalSessie(3) })
  console.log('[sessie] bewaking actief')
}

window.sessieStatus = async function () {
  const g = await supabase.auth.getSession()
  const s = g && g.data && g.data.session
  return {
    token_in_opslag: heeftToken(),
    sessie: !!s,
    uid: s ? s.user.id : null,
    verloopt_over_sec: s ? Math.round(s.expires_at - Date.now() / 1000) : null,
    online: navigator.onLine
  }
}
