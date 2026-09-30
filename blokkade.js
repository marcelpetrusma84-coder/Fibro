// blokkade.js - toont een balk als je account geblokkeerd is (30-09-2026)
// Vraagt mijn_blokkade() op (alleen over jezelf). Testen zonder blokkade:
// zet ?blokkadetest=1 achter het adres.
import { supabase } from './supabase.js?v=95'

function datumTekst(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toonBalk(b) {
  if (document.getElementById('fibroBlokkadeBalk')) return
  const balk = document.createElement('div')
  balk.id = 'fibroBlokkadeBalk'
  balk.setAttribute('role', 'alert')
  balk.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;' +
    'padding:calc(10px + env(safe-area-inset-top, 0px)) 40px 10px 14px;' +
    'background:#7f1d1d;color:#fff;font:14px/1.4 system-ui,-apple-system,sans-serif;' +
    'text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35)'

  const kop = document.createElement('div')
  kop.style.fontWeight = '600'
  let tekst = '\u{1F6AB} Je account is geblokkeerd'
  const tot = b.tot ? datumTekst(b.tot) : ''
  if (tot) tekst += ' tot ' + tot
  kop.textContent = tekst + '.'
  balk.appendChild(kop)

  if (b.reden) {
    const r = document.createElement('div')
    r.textContent = 'Reden: ' + b.reden
    balk.appendChild(r)
  }

  const uitleg = document.createElement('div')
  uitleg.style.cssText = 'opacity:.85;font-size:12px;margin-top:2px'
  uitleg.textContent = 'Je kunt je berichten nog lezen, maar niets versturen, schrijven of stemmen.'
  balk.appendChild(uitleg)

  const sluit = document.createElement('button')
  sluit.type = 'button'
  sluit.textContent = '\u00D7'
  sluit.setAttribute('aria-label', 'Melding sluiten')
  sluit.style.cssText = 'position:absolute;right:6px;top:calc(4px + env(safe-area-inset-top, 0px));' +
    'width:32px;height:32px;border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer'
  sluit.addEventListener('click', () => balk.remove())
  balk.appendChild(sluit)

  document.body.appendChild(balk)
}

async function controleer() {
  try {
    if (new URLSearchParams(location.search).get('blokkadetest') === '1') {
      toonBalk({ geblokkeerd: true, tot: new Date(Date.now() + 3 * 864e5).toISOString(), reden: 'Voorbeeld van een reden (testmodus)' })
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data, error } = await supabase.rpc('mijn_blokkade')
    if (error) { console.warn('[blokkade] opvragen mislukt:', error.message); return }
    const b = Array.isArray(data) ? data[0] : data
    window._fibroBlokkade = b || null
    if (!b || !b.geblokkeerd) return
    console.log('[blokkade] account geblokkeerd', b.tot || '(geen einddatum)')
    toonBalk(b)
  } catch (e) {
    console.warn('[blokkade]', e)
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', controleer)
else controleer()
