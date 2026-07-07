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
    })
    .subscribe(async (status) => {
      console.log('[sync] Presence-kanaal status:', status)
      if (status === 'SUBSCRIBED') {
        await presenceKanaal.track({ online_sinds: new Date().toISOString() })
      }
    })
}

export function isOnline(userId) {
  return onlineGebruikers.has(userId)
}

export function getOnlineGebruikers() {
  return [...onlineGebruikers]
}
