import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
  'https://qmgatbphiplrfxrljtbe.supabase.co',
  'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
)

export async function laadThema() {

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
      return
  }

  const { data } = await supabase
    .from('profiles')
    .select('achtergrond_kleur, accent_kleur, accent_kleur2, lettertype, animatie')
    .eq('id', session.user.id)
    .single()

  if (!data) {
      return
  }

  if (data.achtergrond_kleur) document.documentElement.style.setProperty('--bg', data.achtergrond_kleur)
  if (data.accent_kleur) document.documentElement.style.setProperty('--accent', data.accent_kleur)
  if (data.accent_kleur2) document.documentElement.style.setProperty('--accent2', data.accent_kleur2)
  if (data.lettertype) document.body.style.fontFamily = data.lettertype
}
