// uitnodigen.js (v1, 26 nov 2026, Marcel) - met één tik iemand uitnodigen via het deelmenu van de telefoon.
// Gebruikt door de ➕ bovenaan Home (zonder spel) en de knop 📤 Delen op het startscherm van een spel (met dat spel).
//
// Net zo veilig als de uitnodiging op de vriendenpagina (vrienden.html):
//  - de link werkt maar één keer (invite_tokens; invite.html markeert hem als gebruikt) en is 1 dag geldig;
//  - de code is 16 willekeurige tekens (crypto.getRandomValues);
//  - achter het hekje staan je sleutel-vingerafdruk en je naam; wat na # staat gaat nooit naar een server.
//
// Volgorde: eerst het deelmenu, dan pas wachten op Supabase. Een iPhone opent het deelmenu alleen vlak na een tik;
// wie eerst op de server wacht, krijgt soms niets te zien. Daarom zoekt bereidVoor() vooraf op wie je bent (je
// vingerafdruk en naam), en maakt de tik zelf de link meteen. Kon de link daarna niet bewaard worden, dan zegt een
// melding dat hij niet werkt.
import { supabase } from './supabase.js?v=95'
import { haalPrivateKeyOp, eigenPubliekeSleutel, sleutelVingerafdruk } from './crypto.js?v=182'
import { STUDIO_SPELLEN } from './studio-spellen.js?v=8'

// Hetzelfde adres als in vrienden.html
const UITNODIGING_ADRES = 'https://marcelpetrusma84-coder.github.io/Fibro/invite.html'
const DUUR = 86400 // 1 dag
// De spellen die invite.html kan laten zien (dezelfde namen als daar, in MEE_SPELLEN)
const MEE_SPELLEN = new Set(['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pong', 'pacman', 'breakout', 'swarm',
  'pinball', 'endlessrunner', 'flappybird', 'shmup', 'pesten', 'toepen', 'eenentwintigen', 'koningsjacht',
  ...STUDIO_SPELLEN.map(s => s.id)])

const T = (tekst, waarden) => {
  if (window.T) return window.T(tekst, waarden)
  return String(tekst).replace(/\{(\w+)\}/g, (m, k) => (waarden && k in waarden ? waarden[k] : m))
}

export function kanSpelMeesturen(spelId) { return MEE_SPELLEN.has(String(spelId || '')) }

function eigenNaam(uid) {
  try { const n = String(JSON.parse(localStorage.getItem('fibro_profiel_' + uid) || '{}').naam || '').trim(); if (n) return n.slice(0, 40) } catch (e) {}
  try { const p = JSON.parse(localStorage.getItem('fibro_profielcache_' + uid) || 'null'); if (p) return String(p.display_name || p.username || '').trim().slice(0, 40) } catch (e) {}
  return ''
}

// Vooraf: wie ben ik (alleen uit de opgeslagen sessie, zonder server), mijn vingerafdruk en mijn naam.
// Geeft null zonder account (dan is er niemand die kan uitnodigen).
let voorbereid = null, klaar = null
export function bereidVoor() {
  if (!voorbereid) voorbereid = (async () => {
    let uid = ''
    try { const { data } = await supabase.auth.getSession(); uid = data?.session?.user?.id || '' } catch (e) {}
    if (!uid) return null
    let vinger = ''
    try { const priv = haalPrivateKeyOp(uid); if (priv) vinger = (await sleutelVingerafdruk(await eigenPubliekeSleutel(priv))).slice(0, 32) } catch (e) { vinger = '' }
    klaar = { uid, vinger, naam: eigenNaam(uid) }
    return klaar
  })()
  return voorbereid
}

function nieuweCode() {
  const TEKENS = 'abcdefghijklmnopqrstuvwxyz234567'
  return 'fibro-' + Array.from(window.crypto.getRandomValues(new Uint8Array(16)), b => TEKENS[b % 32]).join('')
}

function deelTekst(naam, spelNaam) {
  const zin = naam
    ? (spelNaam ? T('{naam} nodigt je uit voor Stekky en daagt je uit voor een potje {spel}!', { naam, spel: spelNaam }) : T('{naam} nodigt je uit voor Stekky!', { naam }))
    : (spelNaam ? T('Je bent uitgenodigd voor Stekky en voor een potje {spel}!', { spel: spelNaam }) : T('Je bent uitgenodigd voor Stekky!'))
  return zin + ' ' + T('Tik binnen {duur} op de link om vrienden te worden:', { duur: T('1 dag') })
}

// Een korte melding onderin (hetzelfde paars als de rest van de app)
function melding(tekst) {
  try {
    document.querySelector('.uitnodig-melding')?.remove()
    const m = document.createElement('div')
    m.className = 'uitnodig-melding'
    m.setAttribute('role', 'status')
    m.textContent = tekst
    m.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:100000;'
      + 'max-width:min(90vw,420px);padding:12px 16px;border-radius:14px;background:#24103d;border:1px solid #c084fc;color:#fff;'
      + 'font:600 14px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px #000a'
    document.body.append(m)
    setTimeout(() => m.remove(), 4500)
  } catch (e) {}
}

// De tik: maak de link, open het deelmenu (of kopieer), en bewaar de code in Supabase.
// spelId/spelNaam: optioneel (alleen een spel dat invite.html kent gaat mee). Geeft true als er iets gedeeld of
// gekopieerd is en de link werkt.
export async function deelUitnodiging({ spelId = '', spelNaam = '' } = {}) {
  const ik = klaar || await bereidVoor()
  if (!ik) { melding(T('Log in om een vriend uit te nodigen.')); return false }
  const metSpel = kanSpelMeesturen(spelId)
  const code = nieuweCode()
  const verlooptOm = new Date(Date.now() + DUUR * 1000).toISOString()
  const hekje = [ik.vinger ? 's=' + ik.vinger : '', ik.naam ? 'n=' + encodeURIComponent(ik.naam) : ''].filter(Boolean).join('&')
  const url = UITNODIGING_ADRES + '?token=' + code + (metSpel ? '&spel=' + encodeURIComponent(spelId) : '') + (hekje ? '#' + hekje : '')
  const tekst = deelTekst(ik.naam, metSpel ? spelNaam : '') + '\n' + url
  // Meteen naar de server (niet wachten), dan meteen het deelmenu
  const bewaard = supabase.from('invite_tokens').insert({ token: code, expires_at: verlooptOm, created_by: ik.uid })
    .then(({ error }) => !error, () => false)
  let gedeeld = false
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ text: tekst }); gedeeld = true }
    catch (e) { if (e && e.name === 'AbortError') { bewaard.then(() => {}); return false } } // zelf weggetikt
  }
  if (!gedeeld) {
    // Geen deelmenu (computer, sommige apps): de hele uitnodiging kopiëren
    try { await navigator.clipboard.writeText(tekst); gedeeld = true; melding(T('✅ Gekopieerd! Plak het in WhatsApp of een bericht.')) }
    catch (e) { try { window.prompt(T('Kopieer deze tekst:'), tekst); gedeeld = true } catch (e2) {} }
  }
  if (!(await bewaard)) { melding(T('Let op: de uitnodiging kon niet bewaard worden, dus de link werkt niet. Probeer het opnieuw.')); return false }
  return gedeeld
}
