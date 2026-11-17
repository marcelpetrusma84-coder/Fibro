// smileys.js (17 nov 2026, op verzoek van Marcel): typ je in de chat een smiley zoals :) of <3, dan wordt dat een emoji.
// Dat gebeurt meteen als je na de smiley een spatie (of . , ! ?) typt, en bij het versturen ook voor een smiley
// helemaal aan het eind. Alleen als de smiley los staat (begin van het bericht of een spatie ervoor), zodat een
// internetadres (https://...), een tijd of een woord met een dubbele punt niet verandert.
// Gebruikt in chat.html (gewone chat) en groep.html (groepschat).

// Langste eerst niet nodig: de regel hieronder sorteert zelf. Bewust NIET: 8) en B) (lijstjes zoals "punt 8)") en D:.
export const SMILEYS = {
  ':)': '🙂', ':-)': '🙂', '=)': '🙂', ':]': '🙂',
  ':(': '🙁', ':-(': '🙁', '=(': '🙁', ':[': '🙁',
  ':D': '😃', ':-D': '😃', '=D': '😃',
  'xD': '😆', 'XD': '😆',
  ';)': '😉', ';-)': '😉',
  ':P': '😛', ':-P': '😛', ':p': '😛', ':-p': '😛',
  ';P': '😜', ';p': '😜', 'xP': '😝', 'XP': '😝',
  ':O': '😮', ':-O': '😮', ':o': '😮', ':-o': '😮',
  ":'(": '😢', ":'-(": '😢', 'T_T': '😭', ';_;': '😭',
  ":')": '🥲', ":'D": '😂',
  ':*': '😘', ':-*': '😘',
  'B-)': '😎', '8-)': '😎',
  ':|': '😐', ':-|': '😐', '-_-': '😑',
  ':/': '😕', ':-/': '😕', ':\\': '😕', ':-\\': '😕',
  ':S': '😖', ':s': '😖',
  ':$': '😳', 'o.O': '🤨', 'O.o': '🤨',
  '>:(': '😠', ':@': '😡',
  'O:)': '😇', 'O:-)': '😇', '0:)': '😇',
  '>:)': '😈', '>:-)': '😈',
  '^^': '😊', '^_^': '😊', ':3': '😺',
  '<3': '❤️', '</3': '💔',
  '(y)': '👍', '(Y)': '👍', '(n)': '👎', '(N)': '👎',
}

const ontsnap = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const KEUZE = Object.keys(SMILEYS).sort((a, b) => b.length - a.length).map(ontsnap).join('|')
// Los: aan het begin of na een spatie/regel, en gevolgd door een spatie, . , ! ? of het einde
const LOS_EINDE = new RegExp('(^|\\s)(' + KEUZE + ')(?=$|[\\s.,!?])', 'g')
const LOS_MIDDEN = new RegExp('(^|\\s)(' + KEUZE + ')(?=[\\s.,!?])', 'g')

// Het hele bericht omzetten (bij versturen): ook een smiley helemaal aan het eind.
export function smileysNaarEmoji(tekst) {
  return String(tekst ?? '').replace(LOS_EINDE, (_, voor, s) => voor + SMILEYS[s])
}

// Tijdens het typen: alleen wat voor de cursor staat en al "af" is (er staat al een spatie of leesteken achter).
// Zo verandert er niets terwijl je nog bezig bent (bijvoorbeeld :- op weg naar :-) ), en springt de cursor niet.
export function zetOmTijdensTypen(waarde, cursor) {
  const voor = waarde.slice(0, cursor), na = waarde.slice(cursor)
  const nieuw = voor.replace(LOS_MIDDEN, (_, v, s) => v + SMILEYS[s])
  return nieuw === voor ? null : { waarde: nieuw + na, cursor: nieuw.length }
}

export function koppelSmileys(veld) {
  if (!veld || veld.dataset.smileys) return
  veld.dataset.smileys = '1'
  let bezigMetSamenstellen = false // toetsenborden met letters samenstellen (bijvoorbeeld Japans): niet storen
  veld.addEventListener('compositionstart', () => { bezigMetSamenstellen = true })
  veld.addEventListener('compositionend', () => { bezigMetSamenstellen = false })
  veld.addEventListener('input', e => {
    if (bezigMetSamenstellen || (e && e.inputType && e.inputType.startsWith('delete'))) return
    const cursor = veld.selectionStart
    if (cursor == null || cursor !== veld.selectionEnd) return
    const r = zetOmTijdensTypen(veld.value, cursor)
    if (!r) return
    veld.value = r.waarde
    try { veld.setSelectionRange(r.cursor, r.cursor) } catch (x) {}
  })
}
