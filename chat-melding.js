// De melding in het meldingenpaneel gebruikt de serverstand voor privé- en groepschats.
export const CHAT_MELDING_TAG = 'stekky-chat-ongelezen'
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
let aanvraag = null, timer = null, bezig = false

function plan() {
  if (bezig || timer !== null || !aanvraag) return
  timer = setTimeout(werkBij, 150)
}

async function werkBij() {
  timer = null
  if (!aanvraag) return
  const { supabase, uid } = aanvraag
  aanvraag = null
  bezig = true
  try {
    const registratie = await globalThis.navigator?.serviceWorker?.getRegistration?.()
    if (!registratie?.active) return
    const { data, error } = await supabase.rpc('chat_melding_teller')
    if (error || !Number.isSafeInteger(data?.aantal) || data.aantal < 0 ||
        !Number.isSafeInteger(data.gemeten) || data.gemeten <= 0) return

    // Na een trage aanvraag kan de actieve sessie inmiddels van een ander account zijn.
    const { data: sessie } = await supabase.auth.getSession()
    if (sessie?.session?.user?.id !== uid || (aanvraag && aanvraag.uid !== uid)) return
    registratie.active?.postMessage({
      type: 'fibro-chat-melding-teller', ontvanger: uid,
      aantal: data.aantal, gemeten: data.gemeten, taal: globalThis.T?.taal === 'en' ? 'en' : 'nl',
    })
  } catch (e) {
    // Een ontbrekende of onbereikbare serverstand is geen nulstand.
  } finally {
    bezig = false
    plan()
  }
}

export function synchroniseerChatMelding(supabase, uid) {
  if (typeof uid !== 'string' || !UUID.test(uid)) return
  aanvraag = { supabase, uid }
  plan()
}

export async function wisChatMelding(uid) {
  if (!UUID.test(uid || '')) return
  if (aanvraag?.uid === uid) aanvraag = null
  try {
    const registratie = await globalThis.navigator?.serviceWorker?.getRegistration?.()
    registratie?.active?.postMessage({ type: 'fibro-chat-melding-wis', ontvanger: uid })
  } catch (e) {}
}
