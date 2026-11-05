// herstel-herinnering.js (v1, 6 nov 2026, v270): een vriendelijke herinnering op Home voor wie HERSTEL nog niet aan heeft.
//
// Zonder herstel (Face ID-herstel of een herstelcode) ben je je berichten kwijt als je een nieuwe telefoon krijgt.
// Na het registreren vraagt Stekky het meteen (een korte stap). Wie dat overslaat, krijgt na een paar dagen op Home
// een klein kaartje: "Zet herstel aan". Niet meteen (eerst de app leren kennen), niet als er al een ander kaartje
// staat (meldingen), en na wegtikken een week niet. Een tik op Aanzetten:
//  - kan dit toestel Face ID / vingerafdruk gebruiken: Face ID-herstel aanzetten (passkey-kluis.js);
//  - anders: een herstelcode maken, in de kluis zetten (sleutel_kluis, versleuteld) en hem een keer laten zien.
// De server ziet nooit je sleutel: alleen een dichte doos / een versleutelde kluis (zoals bij het registreren).

import { passkeyStatus, lijstDozen, maakDoos } from './passkey-kluis.js?v=3'
import { haalPrivateKeyOp, versleutelPrivateKey, maakHerstelSleutel } from './crypto.js?v=182'

export const NA_DAGEN = 3        // pas een paar dagen na het aanmaken van je account
export const RUST_DAGEN = 7      // weggetikt: een week niet
const DAG = 86400000
const WEG = uid => 'fibro_herstelkaart_weg_' + uid

// Moet het kaartje komen? (los te testen)
export function moetHerinneren({ nu, aangemaakt, heeftHerstel, heeftSleutel, wegSinds, anderKaartje }) {
  if (heeftHerstel || !heeftSleutel || anderKaartje) return false
  const t = Date.parse(aangemaakt || '')
  if (!Number.isFinite(t) || nu - t < NA_DAGEN * DAG) return false
  if (wegSinds && nu - wegSinds < RUST_DAGEN * DAG) return false
  return true
}

const t = (zin, w) => (typeof window !== 'undefined' && typeof window.T === 'function' ? window.T(zin, w) : zin)

async function heeftHerstelAan(supabase, uid) {
  let dozen = []
  try { dozen = await lijstDozen(supabase, uid) } catch (e) { return true } // twijfel: niet zeuren
  if (dozen.length) return true
  try {
    const { data, error } = await supabase.from('sleutel_kluis').select('user_id').eq('user_id', uid).limit(1)
    if (error) return true
    return !!(data && data.length)
  } catch (e) { return true }
}

async function kanFaceId() {
  try { const s = await passkeyStatus(); return !!(s.passkeys && s.prf !== false) } catch (e) { return false }
}

function knop(tekst, hoofd) {
  const k = document.createElement('button')
  k.type = 'button'
  k.textContent = tekst
  k.style.cssText = hoofd
    ? 'flex-shrink:0;min-height:40px;padding:8px 16px;border-radius:20px;border:none;background:var(--accent,#c084fc);color:#1a0a2e;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit'
    : 'flex-shrink:0;width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.1);color:var(--text,#fff);font-size:18px;cursor:pointer'
  return k
}

export async function toonHerstelKaart(plek, supabase, uid) {
  if (!plek || !uid || document.getElementById('herstelkaart')) return null
  const lokaal = haalPrivateKeyOp(uid)
  let wegSinds = 0
  try { wegSinds = Number(localStorage.getItem(WEG(uid)) || 0) } catch (e) {}
  let profiel = null
  try { ({ data: profiel } = await supabase.from('profiles').select('username, created_at').eq('id', uid).single()) } catch (e) {}
  const basis = { nu: Date.now(), aangemaakt: profiel && profiel.created_at, heeftSleutel: !!lokaal, wegSinds,
    anderKaartje: !!document.getElementById('meldkaart') }
  if (!moetHerinneren({ ...basis, heeftHerstel: false })) return null   // eerst de goedkope controles
  if (await heeftHerstelAan(supabase, uid)) return null
  if (document.getElementById('meldkaart') || document.getElementById('herstelkaart')) return null

  const kaart = document.createElement('div')
  kaart.id = 'herstelkaart'
  kaart.setAttribute('role', 'note')
  kaart.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0 4px;padding:12px;border-radius:14px;border:1px solid rgba(192,132,252,0.55);background:rgba(192,132,252,0.13);font-size:14px;line-height:1.4'
  const tekst = document.createElement('div')
  tekst.style.cssText = 'flex:1;min-width:0'
  tekst.innerHTML = t('\u{1F510} <b>Zet herstel aan.</b> Krijg je ooit een nieuwe telefoon, dan krijg je zo je berichten terug.')
  const aan = knop(t('Aanzetten'), true)
  const weg = knop('×', false)
  weg.setAttribute('aria-label', t('Nu niet'))
  weg.title = t('Nu niet')
  weg.onclick = () => { try { localStorage.setItem(WEG(uid), String(Date.now())) } catch (e) {}; kaart.remove() }

  const klaar = html => { tekst.innerHTML = html; aan.remove(); setTimeout(() => kaart.remove(), 3000) }
  async function metCode() {
    aan.disabled = true
    try {
      const code = maakHerstelSleutel()
      const blob = await versleutelPrivateKey(lokaal, code)
      const { error } = await supabase.from('sleutel_kluis').upsert({ user_id: uid, blob })
      if (error) throw error
      tekst.textContent = ''
      const kop = document.createElement('div'); kop.innerHTML = t('\u{1F510} <b>Je herstelcode</b>')
      const uitleg = document.createElement('div'); uitleg.style.cssText = 'font-size:13px;opacity:.85;margin:4px 0 8px'
      uitleg.textContent = t('Schrijf hem op: zonder deze code ben je je berichten kwijt op een nieuwe telefoon.')
      const c = document.createElement('div')
      c.style.cssText = "font-family:'DM Mono',monospace;font-size:17px;letter-spacing:1px;padding:10px;border-radius:10px;border:1.5px solid var(--accent,#c084fc);text-align:center;user-select:all"
      c.textContent = code
      const rij = document.createElement('div'); rij.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap'
      const kopie = knop(t('\u{1F4CB} Kopiëren'), true)
      kopie.onclick = async () => { try { await navigator.clipboard.writeText(code); kopie.textContent = t('✅ Gekopieerd') } catch (e) { kopie.textContent = t('Kopiëren lukte niet. Schrijf hem over.') } }
      const op = knop(t('Ik heb hem opgeschreven'), true)
      op.style.background = 'rgba(255,255,255,0.15)'; op.style.color = 'var(--text,#fff)'
      op.onclick = () => kaart.remove()
      rij.append(kopie, op)
      tekst.append(kop, uitleg, c, rij)
      aan.remove(); weg.remove()
    } catch (e) {
      aan.disabled = false
      tekst.textContent = t('Dat lukte niet. Probeer het later nog eens.')
    }
  }
  aan.onclick = async () => {
    if (!(await kanFaceId())) return metCode()
    aan.disabled = true
    try {
      await maakDoos(supabase, { userId: uid, gebruikersnaam: (profiel && profiel.username) || '', privateKeyB64: lokaal })
      klaar(t('✅ <b>Herstel staat aan!</b> Je berichten zijn veilig, ook op een nieuwe telefoon.'))
    } catch (e) {
      aan.disabled = false
      tekst.innerHTML = t('Face ID lukte niet.') + ' '
      const code = document.createElement('button')
      code.type = 'button'; code.textContent = t('Gebruik een herstelcode')
      code.style.cssText = 'background:none;border:none;padding:0;color:inherit;text-decoration:underline;font:inherit;cursor:pointer'
      code.onclick = metCode
      tekst.append(code)
    }
  }
  kaart.append(tekst, aan, weg)
  plek.appendChild(kaart)
  return kaart
}
