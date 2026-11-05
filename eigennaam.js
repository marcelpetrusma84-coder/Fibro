// eigennaam.js (v1, 5 nov 2026, v270): heb je nog geen eigen naam (weergavenaam), dan vraagt Home het je EEN keer.
//
// Sinds v270 vul je bij het registreren je eigen naam in (verplicht). Wie al een account had, heeft vaak alleen een
// grappige gebruikersnaam. Dan zien vrienden een vreemde naam en weten ze niet wie het is. Daarom komt er op Home
// een keer een vraag "Hoe heet je?". Je kunt hem ook overslaan; daarna komt hij niet meer terug (je kunt je naam
// altijd nog invullen bij Profiel bewerken > Weergavenaam).
//
// De naam staat alleen op dit toestel (fibro_profiel_<id>.naam) en gaat versleuteld naar je vrienden (sync.js en
// postbus.js lezen hem daar). De server krijgt hem niet.

export const NAAM_MAX = 40

export function schoonNaam(naam) { return String(naam == null ? '' : naam).replace(/\s+/g, ' ').trim().slice(0, NAAM_MAX).trim() }

function leesProfiel(uid, ls) {
  try { const p = JSON.parse(ls.getItem('fibro_profiel_' + uid) || '{}'); return p && typeof p === 'object' && !Array.isArray(p) ? p : {} } catch (e) { return {} }
}
export function heeftNaam(uid, ls = localStorage) { return !!schoonNaam(leesProfiel(uid, ls).naam) }
function gevraagdSleutel(uid) { return 'fibro_eigennaam_gevraagd_' + uid }
export function moetVragen(uid, ls = localStorage) {
  if (!uid || heeftNaam(uid, ls)) return false
  try { return ls.getItem(gevraagdSleutel(uid)) !== '1' } catch (e) { return false }
}
export function bewaarNaam(uid, naam, ls = localStorage) {
  const n = schoonNaam(naam)
  if (!uid || n.length < 2) return false
  const p = leesProfiel(uid, ls)
  p.naam = n
  try { ls.setItem('fibro_profiel_' + uid, JSON.stringify(p)); ls.setItem(gevraagdSleutel(uid), '1'); return true } catch (e) { return false }
}
export function overslaan(uid, ls = localStorage) { try { ls.setItem(gevraagdSleutel(uid), '1') } catch (e) {} }

const t = (zin) => (typeof window !== 'undefined' && typeof window.T === 'function' ? window.T(zin) : zin)

// Toont de vraag (als dat moet). naOpslaan(naam) wordt aangeroepen na het bewaren.
export function vraagEigenNaam(uid, { naOpslaan } = {}) {
  if (!moetVragen(uid) || document.getElementById('eigenNaamVraag')) return false
  const doos = document.createElement('div')
  doos.id = 'eigenNaamVraag'
  doos.setAttribute('role', 'dialog')
  doos.setAttribute('aria-modal', 'true')
  doos.setAttribute('aria-labelledby', 'eigenNaamTitel')
  doos.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,4,20,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)'
  doos.innerHTML = `
    <div style="width:100%;max-width:360px;background:#2a1240;border:1px solid rgba(192,132,252,.45);border-radius:18px;padding:20px 18px 14px;color:#f3e8ff;font-family:inherit;box-shadow:0 14px 40px #0009">
      <div style="font-size:30px;line-height:1;margin-bottom:8px">👋</div>
      <h2 id="eigenNaamTitel" style="margin:0 0 6px;font-size:19px"></h2>
      <p class="env-uitleg" style="margin:0 0 14px;font-size:14px;line-height:1.45;opacity:.85"></p>
      <input id="eigenNaamInvoer" type="text" maxlength="${NAAM_MAX}" autocomplete="name"
        style="box-sizing:border-box;width:100%;min-height:48px;border-radius:12px;border:1px solid rgba(192,132,252,.6);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:16px;padding:10px 12px">
      <div class="env-fout" role="alert" style="min-height:20px;margin:6px 0 4px;font-size:13px;color:#fca5a5"></div>
      <button type="button" class="env-opslaan" style="display:block;width:100%;min-height:48px;border:none;border-radius:24px;background:linear-gradient(135deg,#c084fc,#f0abfc);color:#1a0a2e;font:inherit;font-weight:700;font-size:16px;cursor:pointer"></button>
      <button type="button" class="env-later" style="display:block;width:100%;min-height:44px;margin-top:6px;border:none;background:none;color:#f3e8ff;opacity:.75;font:inherit;font-size:14px;text-decoration:underline;cursor:pointer"></button>
    </div>`
  doos.querySelector('h2').textContent = t('Hoe heet je?')
  doos.querySelector('.env-uitleg').textContent = t('Vul je eigen naam in, zodat je vrienden weten wie je bent. Alleen je vrienden zien deze naam; hij komt niet op de server.')
  const invoer = doos.querySelector('#eigenNaamInvoer')
  invoer.placeholder = t('bijv. Sanne de Vries')
  doos.querySelector('.env-opslaan').textContent = t('Opslaan')
  doos.querySelector('.env-later').textContent = t('Later (via Profiel bewerken)')
  const sluit = () => doos.remove()
  doos.querySelector('.env-opslaan').addEventListener('click', () => {
    const n = schoonNaam(invoer.value)
    if (n.length < 2) { doos.querySelector('.env-fout').textContent = t(n ? 'Je eigen naam is te kort.' : 'Vul je eigen naam in, zodat je vrienden weten wie je bent.'); invoer.focus(); return }
    if (!bewaarNaam(uid, n)) { doos.querySelector('.env-fout').textContent = t('Dat lukte niet. Probeer het nog eens.'); return }
    sluit()
    try { naOpslaan && naOpslaan(n) } catch (e) {}
  })
  invoer.addEventListener('keydown', e => { if (e.key === 'Enter') doos.querySelector('.env-opslaan').click() })
  doos.querySelector('.env-later').addEventListener('click', () => { overslaan(uid); sluit() })
  document.body.append(doos)
  setTimeout(() => { try { invoer.focus() } catch (e) {} }, 50)
  return true
}
