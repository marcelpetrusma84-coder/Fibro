// slotuitleg.js — uitleg bij het open slotje 🔓 naast een vriend (v200), op Vrienden en in de Chat-lijst.
// Alleen een vriend ZONDER publieke sleutel krijgt een slotje (een dicht slotje is normaal en staat er niet meer).
// Tik erop = deze uitleg. Geen server-verkeer: alleen tekst.
const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

// De knop met het open slotje (html-tekst; naam wordt door de aanroeper al veilig gemaakt)
export function slotKnopHtml(naamVeilig) {
  const label = T('Nog geen versleuteling met {naam} — tik voor uitleg', { naam: naamVeilig }).replace(/"/g, '&quot;')
  return '<button type="button" class="slot-open" data-slotnaam="' + naamVeilig + '" aria-label="' + label + '" title="' + label + '"' +
    ' style="background:none;border:none;padding:6px;margin:-6px;min-width:32px;min-height:32px;font-size:16px;line-height:1;cursor:pointer;color:#f87171;">\u{1F513}</button>'
}

// Klikken op een open slotje opvangen in een lijst (de rij zelf opent anders een chat of profiel)
export function koppelSlotjes(container) {
  if (!container) return
  container.querySelectorAll('.slot-open').forEach(knop => {
    const stop = e => e.stopPropagation()
    knop.addEventListener('pointerdown', stop)   // geen lang-indrukken van de rij (Vrienden: ontvrienden)
    knop.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); toonSlotUitleg(knop.getAttribute('data-slotnaam') || '') })
  })
}

export function toonSlotUitleg(naam) {
  document.getElementById('slotUitleg')?.remove()
  const terug = document.activeElement
  const laag = document.createElement('div')
  laag.id = 'slotUitleg'
  laag.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,0,15,0.72);backdrop-filter:blur(8px)'
  const kaart = document.createElement('div')
  kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-modal', 'true'); kaart.setAttribute('aria-labelledby', 'slotUitlegKop')
  kaart.style.cssText = 'width:min(360px,100%);padding:20px;border-radius:18px;border:1px solid rgba(248,113,113,0.45);background:linear-gradient(150deg,#2a1530,#160b24);color:#f3e8ff;box-shadow:0 18px 48px rgba(0,0,0,0.6);font-family:inherit'
  const kop = document.createElement('h2')
  kop.id = 'slotUitlegKop'
  kop.style.cssText = 'margin:0 0 10px;font-size:17px;line-height:1.3'
  kop.textContent = T('🔓 Nog geen versleuteling met {naam}', { naam })
  const p1 = document.createElement('p'), p2 = document.createElement('p')
  p1.style.cssText = p2.style.cssText = 'margin:0 0 10px;font-size:14px;line-height:1.5;color:#e4d6f5'
  p1.textContent = T('{naam} heeft nog geen sleutel voor versleutelde berichten. Daarom kun je {naam} nu nog geen berichten sturen. Er leest niemand mee: Fibro stuurt nooit iets onversleuteld.', { naam })
  p2.textContent = T('Dit lost zich vanzelf op als {naam} Fibro opent en opnieuw inlogt. Daarna verdwijnt het open slotje.', { naam })
  const knop = document.createElement('button')
  knop.type = 'button'
  knop.textContent = T('Begrepen')
  knop.style.cssText = 'display:block;width:100%;margin-top:6px;min-height:44px;border:none;border-radius:12px;background:linear-gradient(135deg,var(--accent,#c084fc),var(--accent2,#f0abfc));color:#1a0a2e;font:inherit;font-size:15px;font-weight:700;cursor:pointer'
  const sluit = () => { laag.remove(); document.removeEventListener('keydown', esc); try { terug && terug.focus && terug.focus() } catch (e) {} }
  const esc = e => { if (e.key === 'Escape') sluit() }
  knop.addEventListener('click', sluit)
  laag.addEventListener('click', e => { if (e.target === laag) sluit() })
  document.addEventListener('keydown', esc)
  kaart.append(kop, p1, p2, knop); laag.append(kaart); document.body.append(laag)
  knop.focus()
}
