// pushmeldingen.js (v266, 5 nov 2026): het kopje "Pushmeldingen" in het menu (☰) op Home.
//
// In gewone woorden: hier kies je zelf welke pushmeldingen je krijgt. Alles staat standaard aan. Berichten en bellen
// staan er niet bij: die komen altijd, anders werkt Fibro niet (je mist dan berichten en oproepen).
// Nieuw: "🟢 Vriend komt online". Handig, want berichten, foto's en spellen gaan rechtstreeks van toestel naar toestel:
// dat gaat het best als jullie er allebei zijn. De server houdt het rustig (sql/pushmeldingen.sql en stuur-push,
// kiesOnlineOntvangers): alleen na minstens 30 minuten weg, niet 's nachts, niet als je zelf al online bent, dezelfde
// vriend hoogstens eens per 3 uur, hoogstens een per 20 minuten en 6 per dag. Een nieuwe vervangt de vorige.
// De keuzes staan in de database (chat_instellingen.push_uit: wat je uitzette), want de server beslist; hier een kopie.
import { zetMeldingenAan } from './meldingen-aan.js?v=3'

// Dezelfde soorten als in sql/pushmeldingen.sql en PUSH_GROEP in stuur-push
export const PUSH_SOORTEN = [
  { id: 'online', tekst: '\u{1F7E2} Vriend komt online' },
  { id: 'buzz', tekst: '⚡ Buzz' },
  { id: 'spel', tekst: '\u{1F3AE} Uitdagingen voor een spel' },
  { id: 'vriend', tekst: '\u{1F389} Nieuwe vriend' },
  { id: 'gastenboek', tekst: '\u{1F4D6} Gastenboek' },
  { id: 'like', tekst: '❤️ Likes op je profiel' },
]
const IDS = PUSH_SOORTEN.map(s => s.id)
export const SLEUTEL = 'fibro_push_uit'

function leesUit() {
  try { const l = JSON.parse(localStorage.getItem(SLEUTEL) || '[]'); return Array.isArray(l) ? l.filter(x => IDS.includes(x)) : [] } catch (e) { return [] }
}
function bewaarUit(lijst) { try { localStorage.setItem(SLEUTEL, JSON.stringify(lijst.filter(x => IDS.includes(x)))) } catch (e) {} }

// Staat deze soort aan (volgens dit toestel)? Standaard aan.
export function pushAan(soort) { return !leesUit().includes(soort) }

// De keuzes uit de database overnemen (bijvoorbeeld op een ander toestel gezet). Geeft de lijst met wat uit staat,
// of null als het niet lukte.
export async function haalPushKeuzes(supabase, uid) {
  if (!supabase || !uid) return null
  try {
    const { data, error } = await supabase.from('chat_instellingen').select('push_uit').eq('gebruiker_id', uid).maybeSingle()
    if (error) return null
    const uit = data && Array.isArray(data.push_uit) ? data.push_uit : [] // geen rij = alles aan
    bewaarUit(uit)
    return leesUit()
  } catch (e) { return null }
}

// Bij een tik op een schakelaar. Aanzetten vraagt meteen (nog tijdens de tik) of meldingen mogen: anders komt er niets.
// Geeft { aan, reden } terug. reden: 'ok', of waarom het niet lukte ('geweigerd', 'iphone-zonder-app', 'niet-mogelijk',
// 'uit', 'mislukt', 'server').
export function wisselPush(supabase, uid, soort) {
  if (!IDS.includes(soort)) return Promise.resolve({ aan: true, reden: 'onbekend' })
  const nieuw = !pushAan(soort)
  const toestemming = nieuw ? zetMeldingenAan(supabase, uid) : Promise.resolve('aan') // niet eerst iets afwachten (iPhone)
  return toestemming.then(async (stand) => {
    if (nieuw && stand !== 'aan') return { aan: false, reden: stand }
    try {
      const { data, error } = await supabase.rpc('zet_push', { p_soort: soort, p_aan: nieuw })
      if (error) { console.warn('[pushmeldingen] bewaren mislukt', error.message); return { aan: !nieuw, reden: 'server' } }
      if (Array.isArray(data)) bewaarUit(data)
      else bewaarUit(nieuw ? leesUit().filter(x => x !== soort) : leesUit().concat(soort))
    } catch (e) { console.warn('[pushmeldingen] bewaren mislukt', e); return { aan: !nieuw, reden: 'server' } }
    return { aan: pushAan(soort), reden: 'ok' }
  })
}

// Een korte uitleg als aanzetten niet lukte (null = niets te zeggen)
export function uitlegPush(reden) {
  const T = window.T || (s => s)
  if (reden === 'geweigerd') return T('Meldingen staan uit voor Stekky op dit toestel. Zet ze eerst aan in de instellingen van je telefoon of browser.')
  if (reden === 'niet-mogelijk') return T('Dit toestel of deze browser kan geen meldingen ontvangen.')
  if (reden === 'mislukt' || reden === 'server') return T('Dat lukte niet. Controleer je internet en probeer het nog eens.')
  return null // 'uit' (vraag weggetikt) en 'iphone-zonder-app' (daar opent al de uitleg)
}
