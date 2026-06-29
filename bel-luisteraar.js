// bel-luisteraar.js — luistert op elke pagina naar inkomende oproepen
import { supabase } from './supabase.js'
import { initBellen } from './bellen.js'

export async function startBelLuisteraar() {
  // Niet op de bellen-pagina zelf (die handelt het gesprek af)
  if (window.location.pathname.includes('bellen.html')) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  initBellen(session.user.id, {
    onOproep: async (info) => {
      // Haal naam van de beller op
      const { data: v } = await supabase
        .from('profiles')
        .select('display_name,username')
        .eq('id', info.van)
        .single()
      const naam = v?.display_name || v?.username || 'Onbekend'
      const videoParam = info.videoModus ? '&video=1' : ''
      // Stuur door naar bellen.html als inkomend gesprek
      window.location.href = 'bellen.html?vriend=' + info.van + '&naam=' + encodeURIComponent(naam) + '&inkomend=1' + videoParam
    },
    onEind: () => {}
  })
}
