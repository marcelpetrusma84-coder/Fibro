// chatstatus.js (v261, 4 nov 2026): "… is aan het typen" en de gelezen-vinkjes in de chat.
//
// TYPEN. Tik je in het berichtveld, dan krijgt je vriend via jullie eigen afgeschermde kanaal (paren.js) een seintje
// 'typen', hoogstens om de 2,5 seconde. Bij hem staat dan onder je naam "… is aan het typen". Komt er 5 seconden geen
// seintje meer, of komt je bericht binnen, dan gaat het weg. Er gaat geen tekst mee, alleen dat je typt.
//
// GELEZEN. Je vriend opent jullie chat: ongelezen.js zet in de database 'gelezen tot nu' (markeer_gelezen) en geeft
// het seintje 'fibro-gelezen'. Deze module stuurt dan 'gelezen' naar de vriend. Bij hem vraagt de chat aan de
// database tot wanneer jij gelezen hebt (gelezen_door, sql/gelezen-vinkjes.sql). De database beslist dus, met de
// tijd van de server: staat bij een van jullie de schakelaar uit, dan geeft hij niets terug. Het seintje zelf zegt
// niets; het is alleen een duwtje om opnieuw te vragen.
//   ✓  = verstuurd      ✓✓ (blauw) = gelezen
//
// Schakelaar: menu > Instellingen > Gelezen-vinkjes (localStorage fibro_leesbevestiging, en in de database via
// zet_leesbevestiging). Uit = je vriend ziet niet dat jij gelezen hebt, en jij ziet het bij hem ook niet.
import { startParen, stuurNaar, opBericht } from './paren.js?v=2'

const TYPEN_ELKE = 2500
const TYPEN_DUUR = 5000
export const SLEUTEL = 'fibro_leesbevestiging'

export function leesbevestigingAan() {
  try { return localStorage.getItem(SLEUTEL) !== '0' } catch (e) { return true }
}

// De keuze bewaren, op dit toestel en in de database
export async function zetLeesbevestiging(supabase, aan) {
  try { localStorage.setItem(SLEUTEL, aan ? '1' : '0') } catch (e) {}
  try {
    const { error } = await supabase.rpc('zet_leesbevestiging', { p_aan: !!aan })
    if (error) console.warn('[chatstatus] schakelaar bewaren mislukt', error.message)
  } catch (e) { console.warn('[chatstatus] schakelaar bewaren mislukt', e) }
}

// opties: { supabase, mijnId, opTypen(vriendId), opGelezen(vriendId) }
export function startChatStatus({ supabase, mijnId, opTypen, opGelezen }) {
  startParen(mijnId)
  // De keuze uit de database overnemen (bijvoorbeeld op een nieuw toestel)
  supabase.from('chat_instellingen').select('leesbevestiging').eq('gebruiker_id', mijnId).maybeSingle()
    .then(({ data, error }) => { if (!error && data && typeof data.leesbevestiging === 'boolean') { try { localStorage.setItem(SLEUTEL, data.leesbevestiging ? '1' : '0') } catch (e) {} } }, () => {})
  const laatsteTypen = new Map()
  opBericht('typen', (data, van) => { if (van && van !== mijnId && opTypen) opTypen(van) })
  opBericht('gelezen', (data, van) => { if (van && van !== mijnId && opGelezen) opGelezen(van) })
  // ongelezen.js heeft net 'gelezen tot nu' bewaard: de vriend een duwtje geven (alleen als de schakelaar aan staat)
  document.addEventListener('fibro-gelezen', (e) => {
    const vriend = e && e.detail && e.detail.vriend
    if (vriend && leesbevestigingAan()) stuurNaar(vriend, 'gelezen', {}).catch(() => {})
  })
  return {
    // Roep aan bij elke toets in het berichtveld
    typt(vriendId) {
      if (!vriendId) return
      const nu = Date.now()
      if (nu - (laatsteTypen.get(vriendId) || 0) < TYPEN_ELKE) return
      laatsteTypen.set(vriendId, nu)
      stuurNaar(vriendId, 'typen', {}).catch(() => {})
    },
    // Bericht verstuurd: het volgende toetsje mag meteen weer een seintje geven
    verstuurd(vriendId) { laatsteTypen.delete(vriendId) },
    // Tot wanneer heeft deze vriend gelezen? Een getal (ms) of null
    async gelezenTot(vriendId) {
      if (!vriendId || !leesbevestigingAan()) return null
      try {
        const { data, error } = await supabase.rpc('gelezen_door', { p_vriend: vriendId })
        if (error || !data) return null
        const t = Date.parse(data)
        return Number.isFinite(t) ? t : null
      } catch (e) { return null }
    },
  }
}

// De vinkjes in de chat bijwerken. Elke eigen rij heeft data-ct (tijd van het bericht) en een <span class="vink">.
export function werkVinkjesBij(container, tot) {
  if (!container) return
  for (const v of container.querySelectorAll('.vink')) {
    const rij = v.closest('[data-ct]')
    const t = rij ? Date.parse(rij.dataset.ct) : NaN
    const gelezen = tot != null && Number.isFinite(t) && t <= tot
    v.textContent = gelezen ? '✓✓' : '✓'
    v.classList.toggle('gelezen', gelezen)
    v.title = gelezen ? (window.T ? window.T('Gelezen') : 'Gelezen') : (window.T ? window.T('Verstuurd') : 'Verstuurd')
  }
}

export const TYPEN_DUUR_MS = TYPEN_DUUR
