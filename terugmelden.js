// terugmelden.js (v1, Fibro v222): "Fout of idee melden" (menu op Home en het beta-labeltje naast het logo).
// Je kiest fout of idee, bij een fout waar het misging, en schrijft een paar zinnen. Het gaat naar de tabel
// terugmeldingen (sql/terugmeldingen.sql); moderators lezen het op Moderatie > Feedback, met je gebruikersnaam erbij
// zodat ze kunnen terugvragen. Bij een fout gaat ook het soort toestel mee (zelfde beschrijving als de foutmelder).
import { supabase } from './supabase.js?v=95'

window.FIBRO_EN = Object.assign(window.FIBRO_EN || {}, {
  '💬 Fout of idee melden': '💬 Report a problem or idea',
  'Wat wil je melden?': 'What would you like to report?',
  '🐞 Er gaat iets mis': '🐞 Something is wrong',
  '💡 Ik heb een idee': '💡 I have an idea',
  'Waar ging het mis?': 'Where did it go wrong?',
  'Weet ik niet': "I don't know",
  'Home': 'Home', 'Vrienden': 'Friends', 'Chat': 'Chat', 'Mijn stijl': 'My style', 'Een spel': 'A game',
  'Bellen of videobellen': 'Calling or video calling', 'Profiel van een vriend': "A friend's profile",
  'Inloggen of account': 'Logging in or account', 'Iets anders': 'Something else',
  'Wat gebeurde er, en wat had je verwacht?': 'What happened, and what did you expect?',
  'Wat zou je graag willen?': 'What would you like?',
  '{n} tekens over': '{n} characters left',
  'Je gebruikersnaam gaat mee, zodat ik kan terugvragen. Bij een fout ook het soort toestel en browser.': 'Your username is included so I can ask you about it. For a problem, also your kind of device and browser.',
  'Annuleren': 'Cancel', 'Versturen': 'Send', 'Bezig met versturen...': 'Sending...',
  'Bedankt! Je melding is verstuurd.': 'Thanks! Your report has been sent.',
  'Schrijf eerst wat er is.': 'Write what it is about first.',
  'Je hebt vandaag al 20 meldingen gestuurd. Morgen kan het weer.': "You've already sent 20 reports today. You can send more tomorrow.",
  'Versturen lukte niet. Probeer het zo nog eens.': "Sending didn't work. Please try again in a moment.",
  'Je bent niet ingelogd.': "You're not logged in.",
  'Sluiten': 'Close'
})

const PLEKKEN = [
  ['', 'Weet ik niet'], ['home', 'Home'], ['vrienden', 'Vrienden'], ['chat', 'Chat'], ['stijl', 'Mijn stijl'],
  ['spel', 'Een spel'], ['bellen', 'Bellen of videobellen'], ['vriendprofiel', 'Profiel van een vriend'],
  ['account', 'Inloggen of account'], ['anders', 'Iets anders']
]
const MAX = 1000

function toestel () {
  try { if (window.__fibroFoutmelder && window.__fibroFoutmelder.toestel) return window.__fibroFoutmelder.toestel() } catch (e) {}
  return (navigator.userAgent || '').slice(0, 200)
}

function knopStijl (hoofd) {
  return 'flex:1;min-height:48px;border-radius:14px;font:inherit;font-size:15px;font-weight:600;cursor:pointer;padding:10px 14px;' +
    (hoofd ? 'background:linear-gradient(145deg,#f0d7ff,#cc9bf5 75%);color:#1e0d32;border:1px solid #f6e8ff'
      : 'background:rgba(255,255,255,0.06);color:var(--text,#f3e8ff);border:0.5px solid var(--border,rgba(255,255,255,0.12))')
}

export function openTerugmelden (beginSoort) {
  if (document.getElementById('terugmeldScherm')) return
  let soort = beginSoort === 'idee' ? 'idee' : 'fout'
  const vorigeFocus = document.activeElement

  const achter = document.createElement('div')
  achter.id = 'terugmeldScherm'
  achter.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center'
  const kaart = document.createElement('div')
  kaart.setAttribute('role', 'dialog')
  kaart.setAttribute('aria-modal', 'true')
  kaart.setAttribute('aria-labelledby', 'terugmeldTitel')
  kaart.style.cssText = 'width:100%;max-width:480px;max-height:calc(100dvh - 24px);overflow-y:auto;background:#1a0a2e;border:0.5px solid var(--border,rgba(255,255,255,0.12));border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));color:var(--text,#f3e8ff);display:flex;flex-direction:column;gap:12px'

  const titel = document.createElement('h2')
  titel.id = 'terugmeldTitel'
  titel.textContent = T('💬 Fout of idee melden')
  titel.style.cssText = 'font-size:18px;margin:0;color:var(--accent,#c084fc)'

  const vraag = document.createElement('div')
  vraag.id = 'terugmeldSoortLabel'
  vraag.textContent = T('Wat wil je melden?')
  vraag.style.cssText = 'font-size:14px'
  const keuze = document.createElement('div')
  keuze.setAttribute('role', 'radiogroup')
  keuze.setAttribute('aria-labelledby', 'terugmeldSoortLabel')
  keuze.style.cssText = 'display:flex;gap:8px'
  const maakKeuze = (waarde, tekst) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.id = 'terugmeldSoort-' + waarde
    b.setAttribute('role', 'radio')
    b.textContent = T(tekst)
    b.onclick = () => { soort = waarde; zetSoort() }
    keuze.appendChild(b)
    return b
  }
  const knopFout = maakKeuze('fout', '🐞 Er gaat iets mis')
  const knopIdee = maakKeuze('idee', '💡 Ik heb een idee')

  const plekRij = document.createElement('label')
  plekRij.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-size:14px'
  plekRij.textContent = T('Waar ging het mis?')
  const plek = document.createElement('select')
  plek.id = 'terugmeldPlek'
  plek.style.cssText = 'min-height:44px;border-radius:12px;padding:8px 10px;background:rgba(255,255,255,0.06);color:var(--text,#f3e8ff);border:0.5px solid var(--border,rgba(255,255,255,0.12));font:inherit;font-size:16px'
  for (const [w, t] of PLEKKEN) { const o = document.createElement('option'); o.value = w; o.textContent = T(t); o.style.background = '#1a0a2e'; plek.appendChild(o) }
  plekRij.appendChild(plek)

  const tekst = document.createElement('textarea')
  tekst.id = 'terugmeldTekst'
  tekst.maxLength = MAX
  tekst.rows = 5
  tekst.setAttribute('aria-label', T('Wat gebeurde er, en wat had je verwacht?'))
  tekst.style.cssText = 'width:100%;box-sizing:border-box;min-height:120px;resize:vertical;border-radius:12px;padding:10px 12px;background:rgba(255,255,255,0.06);color:var(--text,#f3e8ff);border:0.5px solid var(--border,rgba(255,255,255,0.12));font:inherit;font-size:16px;line-height:1.45'
  const teller = document.createElement('div')
  teller.style.cssText = 'font-size:12px;color:var(--muted,rgba(255,255,255,0.6));text-align:right;margin-top:-6px'
  const telBij = () => { teller.textContent = T('{n} tekens over', { n: MAX - tekst.value.length }) }
  tekst.addEventListener('input', () => { telBij(); status.textContent = '' })

  const uitleg = document.createElement('p')
  uitleg.textContent = T('Je gebruikersnaam gaat mee, zodat ik kan terugvragen. Bij een fout ook het soort toestel en browser.')
  uitleg.style.cssText = 'font-size:12px;line-height:1.5;margin:0;color:var(--muted,rgba(255,255,255,0.6))'

  const status = document.createElement('div')
  status.setAttribute('role', 'status')
  status.style.cssText = 'font-size:14px;min-height:1.2em'

  const knoppen = document.createElement('div')
  knoppen.style.cssText = 'display:flex;gap:8px'
  const annuleer = document.createElement('button')
  annuleer.type = 'button'
  annuleer.textContent = T('Annuleren')
  annuleer.style.cssText = knopStijl(false)
  const verstuur = document.createElement('button')
  verstuur.type = 'button'
  verstuur.id = 'terugmeldVersturen'
  verstuur.textContent = T('Versturen')
  verstuur.style.cssText = knopStijl(true)
  knoppen.append(annuleer, verstuur)

  function zetSoort () {
    for (const [b, w] of [[knopFout, 'fout'], [knopIdee, 'idee']]) {
      const aan = soort === w
      b.setAttribute('aria-checked', aan ? 'true' : 'false')
      b.style.cssText = knopStijl(aan) + (aan ? '' : ';opacity:.85')
    }
    plekRij.style.display = soort === 'fout' ? 'flex' : 'none'
    tekst.placeholder = T(soort === 'fout' ? 'Wat gebeurde er, en wat had je verwacht?' : 'Wat zou je graag willen?')
    tekst.setAttribute('aria-label', tekst.placeholder)
  }

  function sluit () {
    achter.remove()
    document.removeEventListener('keydown', toets, true)
    try { if (vorigeFocus && vorigeFocus.focus) vorigeFocus.focus() } catch (e) {}
  }
  function toets (e) { if (e.key === 'Escape') { e.preventDefault(); sluit() } }

  annuleer.onclick = sluit
  achter.addEventListener('click', e => { if (e.target === achter) sluit() })
  document.addEventListener('keydown', toets, true)

  verstuur.onclick = async () => {
    const inhoud = tekst.value.trim()
    if (!inhoud) { status.style.color = '#fca5a5'; status.textContent = T('Schrijf eerst wat er is.'); tekst.focus(); return }
    verstuur.disabled = true
    verstuur.textContent = T('Bezig met versturen...')
    status.textContent = ''
    const fout = soort === 'fout'
    const { error } = await supabase.rpc('stuur_terugmelding', {
      p_soort: soort,
      p_tekst: inhoud,
      p_pagina: fout ? (plek.value || null) : null,
      p_toestel: fout ? toestel() : null
    })
    if (error) {
      verstuur.disabled = false
      verstuur.textContent = T('Versturen')
      status.style.color = '#fca5a5'
      const m = String(error.message || '')
      status.textContent = /TE_VEEL/.test(m) ? T('Je hebt vandaag al 20 meldingen gestuurd. Morgen kan het weer.')
        : /ingelogd/i.test(m) ? T('Je bent niet ingelogd.')
        : T('Versturen lukte niet. Probeer het zo nog eens.')
      return
    }
    // gelukt: alleen een bedankje en een knop om te sluiten
    keuze.remove(); vraag.remove(); plekRij.remove(); tekst.remove(); teller.remove(); uitleg.remove()
    status.style.color = '#86efac'
    status.textContent = T('Bedankt! Je melding is verstuurd.')
    verstuur.remove()
    annuleer.textContent = T('Sluiten')
    annuleer.style.cssText = knopStijl(true)
    annuleer.focus()
  }

  kaart.append(titel, vraag, keuze, plekRij, tekst, teller, uitleg, status, knoppen)
  achter.appendChild(kaart)
  document.body.appendChild(achter)
  zetSoort(); telBij()
  ;(soort === 'fout' ? knopFout : knopIdee).focus()
}

window.openTerugmelden = openTerugmelden
