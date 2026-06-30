// vriendverzoek.js — in-app vriendverzoeken met realtime melding
import { supabase } from './supabase.js'

let verzoekKanaal = null

export async function startVriendverzoekLuisteraar() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const mij = session.user.id
  if (verzoekKanaal) supabase.removeChannel(verzoekKanaal)
  verzoekKanaal = supabase
    .channel('vriendverzoek-' + mij, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'verzoek' }, (msg) => {
      const { vanId, vanNaam, vanAvatar } = msg.payload
      toonVriendverzoekPopup(vanId, vanNaam, vanAvatar)
    })
    .subscribe()
}

export async function stuurVriendverzoek(naarId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const mij = session.user.id
  if (mij === naarId) { alert('Je kunt jezelf niet toevoegen.'); return }
  const { data: bestaat } = await supabase
    .from('friendships').select('id').eq('user_id', mij).eq('friend_id', naarId).maybeSingle()
  if (bestaat) { alert('Jullie zijn al vrienden!'); return }
  const { data: ik } = await supabase
    .from('profiles').select('username, display_name, avatar_url').eq('id', mij).single()
  const kanaal = supabase.channel('vriendverzoek-' + naarId)
  await new Promise((resolve) => { kanaal.subscribe((s) => { if (s === 'SUBSCRIBED') resolve() }) })
  await kanaal.send({
    type: 'broadcast', event: 'verzoek',
    payload: { vanId: mij, vanNaam: ik?.display_name || ik?.username || 'Iemand', vanAvatar: ik?.avatar_url || '👤' }
  })
  supabase.removeChannel(kanaal)
  alert('Vriendverzoek verstuurd!')
}

function toonVriendverzoekPopup(vanId, vanNaam, vanAvatar) {
  const oud = document.getElementById('vvPopup')
  if (oud) oud.remove()
  const popup = document.createElement('div')
  popup.id = 'vvPopup'
  popup.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#1e1e2e;border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;align-items:center;gap:12px;max-width:90%;'
  popup.innerHTML = `
    <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#c084fc,#f0abfc);display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden;">${vanAvatar && vanAvatar.startsWith('http') ? `<img src="${vanAvatar}" style="width:100%;height:100%;object-fit:cover;">` : vanAvatar}</div>
    <div style="flex:1;color:white;font-size:14px;"><strong>${vanNaam}</strong> wil je toevoegen</div>
    <button id="vvBevestig" style="background:#4caf50;color:white;border:none;border-radius:16px;padding:8px 14px;font-size:13px;font-weight:bold;cursor:pointer;">Bevestigen</button>
    <button id="vvWeiger" style="background:rgba(255,255,255,0.1);color:#aaa;border:none;border-radius:16px;padding:8px 14px;font-size:13px;cursor:pointer;">Annuleren</button>
  `
  document.body.appendChild(popup)
  document.getElementById('vvBevestig').onclick = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const mij = session.user.id
    await supabase.rpc('maak_vriendschap', { vriend: vanId })
    popup.remove()
    const terugKanaal = supabase.channel('vriendverzoek-' + vanId)
    await new Promise((resolve) => { terugKanaal.subscribe((s) => { if (s === 'SUBSCRIBED') resolve() }) })
    await terugKanaal.send({ type: 'broadcast', event: 'geaccepteerd', payload: { doorId: mij } })
    supabase.removeChannel(terugKanaal)
    alert('Vriend toegevoegd!')
  }
  document.getElementById('vvWeiger').onclick = () => popup.remove()
  setTimeout(() => { if (document.getElementById('vvPopup')) popup.remove() }, 30000)
}
