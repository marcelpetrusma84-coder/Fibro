// ========================
// FIBRO VRIEND CACHE
// ========================

export function slaVriendCacheOp(vriendId, data) {
  try {
    const cache = {
      naam: data.display_name || data.username || '',
      bio: data.bio || '',
      mood: data.mood || '',
      avatar: data.avatar_url || '👤',
      accent_kleur: data.accent_kleur || '',
      accent_kleur2: data.accent_kleur2 || '',
      achtergrond_kleur: data.achtergrond_kleur || '',
      lettertype: data.lettertype || '',
      online_status: data.online_status || false,
      offline_emoji: data.offline_emoji || '🌙',
      offline_bericht: data.offline_bericht || 'Offline',
      bijgewerkt: new Date().toISOString()
    }
    localStorage.setItem('vriend_cache_' + vriendId, JSON.stringify(cache))
  } catch(e) {}
}

export function laadVriendCache(vriendId) {
  try {
    const data = localStorage.getItem('vriend_cache_' + vriendId)
    return data ? JSON.parse(data) : null
  } catch(e) { return null }
}

export function verwijderVriendCache(vriendId) {
  try {
    localStorage.removeItem('vriend_cache_' + vriendId)
  } catch(e) {}
}
