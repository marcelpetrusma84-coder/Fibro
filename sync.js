// sync.js — P2P widget-sync: presence (stap A), DataChannel volgt (stap B)
// Zelfde patroon als bellen.js: Supabase Realtime, gedeeld kanaal met gesorteerde IDs
import { supabase } from './supabase.js'

let presenceKanaal = null
let huidigeUserId = null
let onlineGebruikers = new Set()
let onOnlineChangeCallback = null

export function initSync(userId, callbacks = {}) {
  huidigeUserId = userId
  onOnlineChangeCallback = callbacks.onOnlineChange || null
  startPresence()
}

function startPresence() {
  if (presenceKanaal) { supabase.removeChannel(presenceKanaal); presenceKanaal = null }
  presenceKanaal = supabase
    .channel('fibro-online', { config: { presence: { key: huidigeUserId } } })
    .on('presence', { event: 'sync' }, () => {
      const state = presenceKanaal.presenceState()
      onlineGebruikers = new Set(Object.keys(state).filter((id) => id !== huidigeUserId))
      console.log('[sync] Online gebruikers:', [...onlineGebruikers])
      if (onOnlineChangeCallback) onOnlineChangeCallback([...onlineGebruikers])
      toonDebugBadge()
    })
    .subscribe(async (status) => {
      console.log('[sync] Presence-kanaal status:', status)
      if (status === 'SUBSCRIBED') {
        await presenceKanaal.track({ online_sinds: new Date().toISOString() })
      }
    })
}

function toonDebugBadge() {
  let b = document.getElementById('sync-debug-badge')
  if (!b) {
    b = document.createElement('div')
    b.id = 'sync-debug-badge'
    b.style.cssText = 'position:fixed;bottom:70px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;padding:6px 10px;border-radius:8px;font-size:13px;z-index:9999;font-family:monospace'
    document.body.appendChild(b)
  }
  b.textContent = 'sync: ' + onlineGebruikers.size + ' online'
}

export function isOnline(userId) {
  return onlineGebruikers.has(userId)
}

export function getOnlineGebruikers() {
  return [...onlineGebruikers]
}
