// groepenlijst.js (10 nov 2026, groepschat stap 1): je groepen bovenaan de chatlijst, en de knop '+ Groep'.
// Haalt de groepen op met de functie mijn_groepen() (sql/groepen.sql). Bestaat die nog niet op de server, of is er
// geen internet, dan blijft het lijstje gewoon leeg (de knop '+ Groep' staat er wel).
const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
import { MAX_LEDEN } from './groepsleutel.js?v=2'
// 18 nov 2026: de groep heeft een paarse balk (zie .groep-item in chat.html) en toont hoeveel leden er zijn en hoeveel er
// maximaal in kunnen (bijvoorbeeld 3/8). Het maximum hangt af van de soort groep (chat, voice of webcam).
const GELDIG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function groepRijHtml(g) {
  if (!g || !GELDIG_ID.test(String(g.id))) return ''
  return '<a class="vriend-item groep-item" href="groep.html?id=' + esc(g.id) + '" data-gid="' + esc(g.id) + '" style="text-decoration:none;color:inherit">'
    + '<div class="vriend-av" aria-hidden="true">👥</div>'
    + '<div style="flex:1;min-width:0"><div class="vriend-naam" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(g.naam) + '</div>'
    + '<div class="groep-teller">' + esc(T('Groepschat · {n}/{max} leden', { n: Number(g.leden) || 0, max: MAX_LEDEN[g.soort] || MAX_LEDEN.chat })) + '</div></div></a>'
}

export async function toonGroepen(supabase, el) {
  if (!el || !navigator.onLine) return
  try {
    const { data, error } = await supabase.rpc('mijn_groepen')
    if (error || !Array.isArray(data)) return
    el.innerHTML = data.map(groepRijHtml).join('')
  } catch (e) {}
  // de schakelaar 'Groepen met onbekenden' (menu op Home) gelijk zetten met de server (een ander toestel kan hem veranderd hebben)
  try {
    const { data: s } = await supabase.from('chat_instellingen').select('groep_onbekenden').maybeSingle()
    if (s && typeof s.groep_onbekenden === 'boolean') localStorage.setItem('fibro_groep_onbekenden', s.groep_onbekenden ? '1' : '0')
  } catch (e) {}
}
