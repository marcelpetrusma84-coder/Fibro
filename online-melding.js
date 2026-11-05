// online-melding.js (v266, 5 nov 2026): de schakelaar "🟢 Melding als een vriend online komt" in het menu (☰) op Home.
//
// In gewone woorden: zet je hem aan, dan krijg je een pushmelding als een vriend online komt. Handig, want berichten,
// foto's en spellen gaan rechtstreeks van toestel naar toestel: dat gaat het best als jullie er allebei zijn.
// Standaard staat hij AAN. De server houdt het rustig (sql/online-melding.sql en stuur-push, kiesOnlineOntvangers):
// alleen na minstens 30 minuten weg, niet 's nachts, niet als je zelf al online bent, dezelfde vriend hoogstens eens
// per 3 uur, hoogstens een per 20 minuten en 6 per dag. Een nieuwe vervangt de vorige op je scherm.
// De keuze staat in de database (chat_instellingen.melding_online), want de server beslist; hier een kopie voor het menu.
import { zetMeldingenAan } from './meldingen-aan.js?v=1'

export const SLEUTEL = 'fibro_melding_online'

// Staat hij aan (volgens dit toestel)? Standaard aan.
export function onlineMeldingAan() {
  try { return localStorage.getItem(SLEUTEL) !== '0' } catch (e) { return true }
}
function bewaar(aan) { try { localStorage.setItem(SLEUTEL, aan ? '1' : '0') } catch (e) {} }

// De keuze uit de database overnemen (bijvoorbeeld op een ander toestel gezet). Geeft true/false, of null als onbekend.
export async function haalOnlineKeuze(supabase, uid) {
  if (!supabase || !uid) return null
  try {
    const { data, error } = await supabase.from('chat_instellingen').select('melding_online').eq('gebruiker_id', uid).maybeSingle()
    if (error) return null
    const aan = !(data && data.melding_online === false) // geen rij = aan
    bewaar(aan)
    return aan
  } catch (e) { return null }
}

// Bij een tik op de schakelaar. Aanzetten vraagt meteen (nog tijdens de tik) of meldingen mogen: anders komt er niets.
// Geeft { aan, reden } terug. reden: 'ok', of waarom het niet lukte ('geweigerd', 'iphone-zonder-app', 'niet-mogelijk',
// 'uit', 'mislukt', 'server').
export function wisselOnlineMelding(supabase, uid) {
  const nieuw = !onlineMeldingAan()
  const toestemming = nieuw ? zetMeldingenAan(supabase, uid) : Promise.resolve('aan') // niet eerst iets afwachten (iPhone)
  return toestemming.then(async (stand) => {
    if (nieuw && stand !== 'aan') return { aan: false, reden: stand }
    try {
      const { error } = await supabase.rpc('zet_melding_online', { p_aan: nieuw })
      if (error) { console.warn('[online-melding] bewaren mislukt', error.message); return { aan: !nieuw, reden: 'server' } }
    } catch (e) { console.warn('[online-melding] bewaren mislukt', e); return { aan: !nieuw, reden: 'server' } }
    bewaar(nieuw)
    return { aan: nieuw, reden: 'ok' }
  })
}

// Een korte uitleg als aanzetten niet lukte (null = niets te zeggen)
export function uitlegOnlineMelding(reden) {
  const T = window.T || (s => s)
  if (reden === 'geweigerd') return T('Meldingen staan uit voor Fibro op dit toestel. Zet ze eerst aan in de instellingen van je telefoon of browser.')
  if (reden === 'niet-mogelijk') return T('Dit toestel of deze browser kan geen meldingen ontvangen.')
  if (reden === 'mislukt' || reden === 'server') return T('Dat lukte niet. Controleer je internet en probeer het nog eens.')
  return null // 'uit' (vraag weggetikt) en 'iphone-zonder-app' (daar opent al de uitleg)
}
