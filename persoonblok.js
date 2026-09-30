// persoonblok.js - gebruikers blokkeren elkaar zelf (versie 2, 30-09-2026)
// Blokkeren zet de vriendschap op 'geblokkeerd'; de geblokkeerde staat
// onderaan in je vriendenlijst. Menu's: kiesVriendActie en kiesGeblokkeerdActie.
// toonGeblokkeerden(id): lijstje met Deblokkeren-knoppen (profiel.html).
import { supabase } from './supabase.js?v=95'

async function roep(naam, args) {
  const { data, error } = await supabase.rpc(naam, args)
  if (error) { console.warn('[persoonblok] ' + naam + ' mislukt:', error.message); return false }
  return data === true
}

export const blokkeerPersoon = id => roep('blokkeer_persoon', { ander: id })
export const deblokkeerPersoon = id => roep('deblokkeer_persoon', { ander: id })
export const verwijderGeblokkeerde = id => roep('verwijder_geblokkeerde', { ander: id })

export async function haalGeblokkeerden() {
  const { data, error } = await supabase.rpc('mijn_geblokkeerden')
  if (error) { console.warn('[persoonblok] lijst mislukt:', error.message); return [] }
  return Array.isArray(data) ? data : []
}

// Keuzemenu onderaan het scherm. opties: [tekst, kleur, rand, waarde].
function kiesUit(naam, sub, opties) {
  return new Promise(resolve => {
    const oud = document.getElementById('fibroVriendActie')
    if (oud && oud._klaar) oud._klaar(null)

    const achter = document.createElement('div')
    achter.id = 'fibroVriendActie'
    achter.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);' +
      'display:flex;align-items:flex-end;justify-content:center'

    const blad = document.createElement('div')
    blad.style.cssText = 'width:100%;max-width:480px;background:#241036;color:#f3e8ff;' +
      'border-top:0.5px solid rgba(255,255,255,.15);border-radius:18px 18px 0 0;' +
      'padding:16px 16px calc(16px + env(safe-area-inset-bottom, 0px));box-sizing:border-box'

    const titel = document.createElement('div')
    titel.textContent = naam
    titel.style.cssText = 'text-align:center;font-weight:600;font-size:16px;margin-bottom:4px;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
    const onder = document.createElement('div')
    onder.textContent = sub
    onder.style.cssText = 'text-align:center;font-size:12px;opacity:.6;margin-bottom:14px'
    blad.append(titel, onder)

    function klaar(waarde) {
      document.removeEventListener('keydown', opEsc)
      achter.remove()
      resolve(waarde)
    }
    function opEsc(e) { if (e.key === 'Escape') klaar(null) }
    achter._klaar = klaar

    for (const [tekst, kleur, rand, waarde] of opties) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = tekst
      b.style.cssText = 'display:block;width:100%;min-height:48px;margin-top:8px;border-radius:12px;' +
        'font-size:15px;font-family:inherit;cursor:pointer;background:rgba(255,255,255,.06);' +
        'color:' + kleur + ';border:0.5px solid ' + rand
      b.addEventListener('click', () => klaar(waarde))
      blad.appendChild(b)
    }

    achter.addEventListener('click', e => { if (e.target === achter) klaar(null) })
    document.addEventListener('keydown', opEsc)
    achter.appendChild(blad)
    document.body.appendChild(achter)
  })
}

const ANNULEER = ['Annuleren', 'rgba(243,232,255,.6)', 'rgba(255,255,255,.1)', null]

// Geeft 'blokkeren', 'verwijderen' of null.
export function kiesVriendActie(naam) {
  return kiesUit(naam, 'Wat wil je doen?', [
    ['\u{1F6AB} Blokkeren', '#f87171', 'rgba(248,113,113,.35)', 'blokkeren'],
    ['\u{1F5D1}\uFE0F Verwijderen uit vriendenlijst', '#f3e8ff', 'rgba(255,255,255,.15)', 'verwijderen'],
    ANNULEER
  ])
}

// Geeft 'deblokkeren', 'verwijderen' of null.
export function kiesGeblokkeerdActie(naam) {
  return kiesUit(naam, '\u{1F6AB} Geblokkeerd', [
    ['\u2705 Deblokkeren', '#22c55e', 'rgba(34,197,94,.35)', 'deblokkeren'],
    ['\u{1F5D1}\uFE0F Verwijderen', '#f87171', 'rgba(248,113,113,.35)', 'verwijderen'],
    ANNULEER
  ])
}

function datum(iso) {
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function toonGeblokkeerden(id) {
  const vak = document.getElementById(id)
  if (!vak) return
  const regel = tekst => {
    const r = document.createElement('div')
    r.textContent = tekst
    r.style.cssText = 'font-size:14px;color:var(--muted)'
    vak.appendChild(r)
  }

  const { data, error } = await supabase.rpc('mijn_geblokkeerden')
  vak.textContent = ''
  if (error) { regel('Laden mislukt.'); console.warn('[persoonblok]', error.message); return }
  if (!data || data.length === 0) { regel('Je hebt niemand geblokkeerd.'); return }

  for (const p of data) {
    const rij = document.createElement('div')
    rij.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)'
    const info = document.createElement('div')
    info.style.cssText = 'flex:1;min-width:0'
    const naam = document.createElement('div')
    naam.textContent = '\u{1F6AB} @' + (p.username || 'onbekend')
    naam.style.cssText = 'font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
    const sinds = document.createElement('div')
    sinds.textContent = 'Geblokkeerd op ' + datum(p.sinds)
    sinds.style.cssText = 'font-size:12px;color:var(--muted)'
    info.append(naam, sinds)

    const knop = document.createElement('button')
    knop.type = 'button'
    knop.textContent = 'Deblokkeren'
    knop.style.cssText = 'flex-shrink:0;padding:8px 12px;min-height:36px;border-radius:20px;font-size:13px;' +
      'font-family:inherit;cursor:pointer;background:var(--card);color:var(--text);border:0.5px solid var(--border)'
    knop.addEventListener('click', async () => {
      const n = '@' + (p.username || 'onbekend')
      if (!confirm(n + ' deblokkeren?\n\nAls jullie vrienden waren, zijn jullie dat daarna weer.')) return
      knop.disabled = true
      const ok = await deblokkeerPersoon(p.id)
      if (!ok) { knop.disabled = false; alert('Het is niet gelukt. Probeer het later opnieuw.'); return }
      await toonGeblokkeerden(id)
    })

    rij.append(info, knop)
    vak.appendChild(rij)
  }
}
