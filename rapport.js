// rapport.js — Rapporteer systeem voor Fibro

import { supabase } from './supabase.js'

// ─── Stuur een rapport in ───
export async function stuurRapport({ melderId, gemeldeId, berichtInhoud, reden }) {
  const { error } = await supabase.from('rapporten').insert({
    melder_id: melderId,
    gemelde_id: gemeldeId,
    bericht_inhoud: berichtInhoud || null,
    reden: reden
  })
  if (error) {
    console.error('Rapport versturen mislukt:', error)
    return false
  }
  return true
}

// ─── Haal alle rapporten op (alleen beheerder) ───
export async function haalRapportenOp() {
  const { data, error } = await supabase
    .from('rapporten')
    .select(`
      *,
      melder:melder_id(username, avatar_url),
      gemelde:gemelde_id(username, avatar_url)
    `)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Rapporten ophalen mislukt:', error)
    return []
  }
  return data || []
}

// ─── Update rapport status ───
export async function updateRapportStatus(id, status) {
  const { error } = await supabase
    .from('rapporten')
    .update({ status })
    .eq('id', id)
  return !error
}

// ─── Blokkeer een gebruiker ───
export async function blokkeerGebruiker(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ geblokkeerd: true })
    .eq('id', userId)
  return !error
}
