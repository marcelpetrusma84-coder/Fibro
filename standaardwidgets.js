// standaardwidgets.js (v1, 5 nov 2026): wat een nieuw account meteen op Home ziet.
//
// In gewone woorden: wie net een account heeft, zag een lege Home ("Geen widgets actief"). Nu staan er bij de eerste
// start vijf widgets klaar: Mood, een foto-widget (2×2), het spel Four in a Row, een sticker (Blij) en het gastenboek.
// Ze staan in "Jouw profiel", dus je vrienden zien ze ook. Je kunt ze daarna gewoon uitzetten of verslepen.
// Alleen voor NIEUWE accounts (jonger dan 14 dagen) en alleen als er op dit toestel nog nooit een indeling bewaard is:
// wie alles bewust uitzette of al een eigen indeling heeft, houdt die. Een ouder account op een nieuw toestel krijgt
// ook niets: dan zou zijn echte indeling bij vrienden overschreven worden.

// Precies dezelfde vakjes als profiel.html (WMAP en stickerWidgetDef) bij Opslaan maakt
export const STANDAARD_LAYOUT = [
  { id: 'mood',           icon: '😊', titel: 'Mood',          w: 4, h: 1 },
  { id: 'fotos_2x2',      icon: '🖼', titel: 'Foto grid 2×2', w: 2, h: 2 },
  { id: 'spel_vieroprij', icon: '🔴', titel: 'Four in a Row', w: 2, h: 1 },
  { id: 'sticker_f6-05',  icon: '\u{1F3A8}', titel: 'Sticker', w: 1, h: 1, geenHeader: true },
  { id: 'gastenboek',     icon: '📖', titel: 'Gastenboek',    w: 4, h: 4 },
]
// Dezelfde widgets zoals de schakelaars in profiel.html (Stijl) ze noemen
export const STANDAARD_SCHAKELAARS = ['mood', 'fotos2x2', 'spel_vieroprij', 'sticker_f6-05', 'gastenboek']

const NIEUW_DAGEN = 14
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function lees(ls, k) { try { return ls.getItem(k) } catch (e) { return null } }

// Wanneer is dit account gemaakt? Uit de inlogsessie van Supabase op dit toestel (sb-...-auth-token). null = onbekend.
export function accountGemaakt(ls, uid) {
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (!k || !k.startsWith('sb-') || !k.endsWith('-auth-token')) continue
      const u = JSON.parse(ls.getItem(k) || 'null')?.user
      if (u && u.id === uid && u.created_at) {
        const t = Date.parse(u.created_at)
        return Number.isFinite(t) ? t : null
      }
    }
  } catch (e) {}
  return null
}

export function isNieuwAccount(ls, uid, nu = Date.now()) {
  const t = accountGemaakt(ls, uid)
  return t !== null && t <= nu + 60000 && nu - t < NIEUW_DAGEN * 86400000
}

// Zet de standaard-widgets klaar als dat mag. Geeft true als er iets is klaargezet.
export function zetStandaardWidgets(ls, uid, nu = Date.now()) {
  if (!ls || !UID.test(String(uid || ''))) return false
  const sleutel = 'fibro_widgets_profiel_' + uid
  if (lees(ls, sleutel) !== null) return false // er is al eens iets bewaard (ook "alles uit" telt)
  if (!isNieuwAccount(ls, uid, nu)) return false
  try {
    ls.setItem(sleutel, JSON.stringify(STANDAARD_LAYOUT.map((w, i) => ({ ...w, volgorde: i, aan: true }))))
    return true
  } catch (e) { return false }
}

// profiel.html (Stijl): zijn er nog geen schakelaars bewaard, neem dan over wat er op Home staat; anders de standaard.
// Zo zet Opslaan nooit per ongeluk iets anders neer dan wat je op Home ziet.
const NAAR_SCHAKELAAR = { fotos_3x3: 'fotos', fotos_2x2: 'fotos2x2', fotos_groot: 'fotosgroot', fotos_banner: 'fotosbanner',
  fotos_1x3: 'fotos1x3', fotos_featured: 'fotosfeatured', fotos_masonry: 'fotosmasonry', fotos_zwevend: 'fotoszwevend',
  afteltimer: 'countdown' }
export function beginSchakelaars(ls, uid) {
  try {
    const l = JSON.parse(lees(ls, 'fibro_widgets_profiel_' + uid) || 'null')
    if (Array.isArray(l) && l.length) {
      const uit = []
      l.filter(w => w && typeof w.id === 'string' && w.aan).sort((a, b) => (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0))
        .forEach(w => {
          uit.push(NAAR_SCHAKELAAR[w.id] || w.id)
          if (w.id === 'gastenboek' && w.papier === false) uit.push('gastenboek_effen')
        })
      return uit
    }
  } catch (e) {}
  return [...STANDAARD_SCHAKELAARS]
}
