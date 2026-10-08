// account.js - mijn gegevens downloaden en account verwijderen (v1, 8 oktober 2026)
// Geopend via het menu (☰) op Home; index.html laadt dit bestand pas als je erop tikt.
// Het echte werk doet de server (sql/account-verwijderen.sql):
// - mijn_gegevens(): alles wat Fibro op de server over jou bewaart. Berichten staan daar
//   versleuteld; hier zetten we de leesbare tekst erbij (met de sleutel op dit toestel) en
//   bewaren we alles als een JSON-bestand. Eerst ophalen, dan een tweede tik om te bewaren
//   (de iPhone wil voor "Bewaar in Bestanden" een verse tik).
// - verwijder_mijn_account(naam): na het intypen van je gebruikersnaam is alles in een keer
//   weg, ook de gesprekken bij je vrienden. Daarna wissen we wat er op dit toestel van jou
//   staat (ook je sleutel) en ga je naar het inlogscherm. Van een ander account op dit
//   toestel blijft alles staan.
import { supabase } from './supabase.js?v=95'
import { haalPrivateKeyOp, ontsleutel } from './crypto.js?v=95'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const NIET_TE_LEZEN = '(niet te lezen op dit toestel)'
// wat ontsleutel() teruggeeft als het niet lukt (crypto.js)
const ONLEESBAAR = '\u{1F512} [versleuteld bericht — kan niet lezen]'

function foutTekst(e) {
  return String((e && e.message) || '') + ' ' + String((e && e.code) || '')
}
function serverOud(e) {
  return /PGRST202|42883|Could not find the function/i.test(foutTekst(e))
}
function geenVerbinding(e) {
  return /Failed to fetch|NetworkError|Load failed|network/i.test(foutTekst(e))
}

// --- Een vel dat van onderen opkomt (zoals Berichten bewaren) ---
function knop(tekst, soort) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = tekst
  let s = 'display:block;margin-top:8px;width:100%;min-height:44px;border-radius:12px;font-size:15px;cursor:pointer;font-family:inherit;padding:10px 14px;'
  if (soort === 'hoofd') s += 'border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#1a0a2e;font-weight:600'
  else if (soort === 'gevaar') s += 'border:none;background:#b91c1c;color:#ffffff;font-weight:600'
  else s += 'border:0.5px solid var(--border);background:rgba(255,255,255,0.08);color:var(--text)'
  b.style.cssText = s
  return b
}
function zetAan(b, aan) {
  b.disabled = !aan
  b.style.opacity = aan ? '1' : '0.5'
  b.style.cursor = aan ? 'pointer' : 'default'
}
function alinea(tekst) {
  const p = document.createElement('p')
  p.textContent = tekst
  p.style.cssText = 'font-size:14px;line-height:1.5;margin:0 0 12px;color:var(--text)'
  return p
}
function maakVel(id, titelTekst) {
  const oud = document.getElementById(id)
  if (oud) oud.remove()
  const achter = document.createElement('div')
  achter.id = id
  achter.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center'
  const kaart = document.createElement('div')
  kaart.setAttribute('role', 'dialog')
  kaart.setAttribute('aria-modal', 'true')
  kaart.setAttribute('aria-labelledby', id + 'Titel')
  kaart.style.cssText = 'width:100%;max-width:480px;max-height:90dvh;overflow-y:auto;background:#1a0a2e;border:0.5px solid var(--border);border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));color:var(--text)'
  const titel = document.createElement('h2')
  titel.id = id + 'Titel'
  titel.textContent = titelTekst
  titel.style.cssText = 'font-size:18px;margin:0 0 8px;color:var(--accent)'
  const status = document.createElement('div')
  status.setAttribute('role', 'status')
  status.style.cssText = 'min-height:22px;font-size:13px;line-height:1.5;margin-top:12px;color:var(--text)'
  const sluit = knop('Sluiten')
  let vast = false
  const esc = (e) => { if (e.key === 'Escape' && !vast) dicht() }
  const dicht = () => { achter.remove(); document.removeEventListener('keydown', esc, true) }
  document.addEventListener('keydown', esc, true)
  sluit.onclick = () => { if (!vast) dicht() }
  achter.onclick = (e) => { if (e.target === achter && !vast) dicht() }
  achter.appendChild(kaart)
  kaart.appendChild(titel)
  return {
    kaart, status, sluit, dicht,
    zetVast(v) { vast = v; zetAan(sluit, !v) },
    toon() { kaart.append(this.status, this.sluit); document.body.appendChild(achter) }
  }
}

// --- Mijn gegevens downloaden ---
async function maakLeesbaar(data, uid) {
  const berichten = Array.isArray(data && data.berichten) ? data.berichten : []
  const personen = new Map()
  for (const p of (Array.isArray(data && data.personen) ? data.personen : [])) if (p && p.id) personen.set(p.id, p)
  const ik = (data && data.profiel) || {}
  const naamVan = (id) => id === uid ? 'ik' : ((personen.get(id) || {}).username || 'onbekend')
  const sleutelVan = (id) => id === uid ? ik.public_key : (personen.get(id) || {}).public_key
  let priv = null
  try { priv = haalPrivateKeyOp(uid) } catch (e) {}
  let cache = {}
  try { cache = JSON.parse(localStorage.getItem('fibro_msg_cache_' + uid) || '{}') || {} } catch (e) {}
  let leesbaar = 0
  for (const m of berichten) {
    if (!m || typeof m !== 'object') continue
    const mijn = m.sender_id === uid
    const ander = mijn ? m.receiver_id : m.sender_id
    m.van = naamVan(m.sender_id)
    m.naar = naamVan(m.receiver_id)
    const c = typeof m.content === 'string' ? m.content : ''
    let tekst = null
    if (!c.startsWith('e2e:')) tekst = c
    else if (mijn && typeof cache[m.id] === 'string') tekst = cache[m.id]
    else {
      const pub = sleutelVan(ander)
      if (priv && pub && String(pub).length > 10) {
        try {
          const t = await ontsleutel(c, priv, pub)
          if (typeof t === 'string' && t !== ONLEESBAAR) tekst = t
        } catch (e) {}
      }
    }
    if (tekst !== null) leesbaar++
    m.tekst = tekst !== null ? tekst : NIET_TE_LEZEN
  }
  return { berichten: berichten.length, leesbaar }
}

function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// 'gedeeld' | 'gedownload' | 'geannuleerd' | 'mislukt'
async function bewaarBestand(naam, tekst) {
  if (isIOS() && typeof File === 'function' && navigator.canShare && navigator.share) {
    for (const type of ['application/json', 'text/plain']) {
      let f
      try { f = new File([tekst], naam, { type }) } catch (e) { break }
      let kan = false
      try { kan = navigator.canShare({ files: [f] }) } catch (e) {}
      if (!kan) continue
      try {
        await navigator.share({ files: [f], title: naam })
        return 'gedeeld'
      } catch (e) {
        if (e && e.name === 'AbortError') return 'geannuleerd'
        console.warn('[gegevens] delen lukte niet, dan downloaden', e)
        break
      }
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([tekst], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = naam
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return 'gedownload'
  } catch (e) {
    console.warn('[gegevens] downloaden lukte niet', e)
    return 'mislukt'
  }
}

function bestandsnaam(gebruikersnaam) {
  const n = String(gebruikersnaam || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30) || 'account'
  const d = new Date()
  const datum = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  return 'fibro-gegevens-' + n + '-' + datum + '.json'
}

export function openGegevens(uid) {
  if (!uid) return
  const v = maakVel('gegevensScherm', '\u{1F4E6} Mijn gegevens')
  v.kaart.appendChild(alinea('Je krijgt één bestand met alles wat Fibro op de server over jou bewaart: je account, profiel, vrienden, berichten, gastenboek, reacties en instellingen. Op de server zijn je berichten versleuteld; de app maakt ze hier leesbaar, op je eigen toestel.'))
  const haal = knop('\u{1F4E6} Gegevens ophalen', 'hoofd')
  const bewaar = knop('\u{1F4BE} Bestand bewaren', 'hoofd')
  bewaar.style.display = 'none'
  v.kaart.append(haal, bewaar)
  let bestand = null
  haal.onclick = async () => {
    if (navigator.onLine === false) { v.status.textContent = '\u{1F4F4} Geen internet. Probeer het later opnieuw.'; return }
    zetAan(haal, false)
    v.status.textContent = 'Ophalen…'
    try {
      const { data, error } = await supabase.rpc('mijn_gegevens')
      if (error) throw error
      if (!data || typeof data !== 'object') throw new Error('leeg antwoord')
      v.status.textContent = 'Berichten leesbaar maken…'
      const telling = await maakLeesbaar(data, uid)
      const tekst = JSON.stringify(data, null, 2)
      bestand = { naam: bestandsnaam(data.profiel && data.profiel.username), tekst }
      haal.style.display = 'none'
      bewaar.style.display = 'block'
      v.status.textContent = '✓ Klaar: ' + telling.berichten + (telling.berichten === 1 ? ' bericht' : ' berichten') +
        (telling.berichten ? ' (' + telling.leesbaar + ' leesbaar)' : '') + ', ' + Math.max(1, Math.round(tekst.length / 1024)) + ' kB. Tik op Bestand bewaren.'
      bewaar.focus()
    } catch (e) {
      console.warn('[gegevens] ophalen mislukt', e)
      v.status.textContent = serverOud(e) ? '⚠️ Dit kan nog niet: de server is nog niet bijgewerkt.'
        : geenVerbinding(e) ? '\u{1F4F4} Geen verbinding met de server. Probeer het later opnieuw.'
        : '⚠️ Ophalen lukte niet. Probeer het later opnieuw.'
      zetAan(haal, true)
    }
  }
  bewaar.onclick = async () => {
    if (!bestand) return
    const r = await bewaarBestand(bestand.naam, bestand.tekst)
    v.status.textContent = r === 'gedeeld' ? '✓ Bewaard: ' + bestand.naam
      : r === 'gedownload' ? '✓ Gedownload: ' + bestand.naam
      : r === 'geannuleerd' ? 'Niet bewaard. Tik nog eens op Bestand bewaren.'
      : '⚠️ Bewaren lukte niet.'
  }
  v.toon()
  haal.focus()
}

// --- Op dit toestel wissen wat van dit account is ---
function wisOpslag(opslag, uid) {
  try {
    const weg = []
    for (let i = 0; i < opslag.length; i++) {
      const k = opslag.key(i)
      if (!k) continue
      if (k.includes(uid) || (k.startsWith('sb-') && k.includes('-auth-token')) ||
          (!UUID.test(k) && /^(fibro_|vriend_)/.test(k) && k !== 'fibro_bewust_uitloggen')) weg.push(k)
    }
    for (const k of weg) opslag.removeItem(k)
    return weg.length
  } catch (e) { return 0 }
}

async function wisFotos(uid) {
  let db = null
  try {
    db = await new Promise((ok, nee) => {
      const r = indexedDB.open('FibroDB', 2)
      r.onupgradeneeded = (e) => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => nee(r.error)
      r.onblocked = () => nee(new Error('geblokkeerd'))
    })
    let n = 0
    await new Promise((klaar) => {
      const tx = db.transaction('fotos', 'readwrite')
      const st = tx.objectStore('fotos')
      const c = st.openKeyCursor ? st.openKeyCursor() : st.openCursor()
      c.onsuccess = (e) => {
        const cur = e.target.result
        if (!cur) return
        const k = String(cur.primaryKey)
        // van jou, van je vrienden, of van niemand in het bijzonder; van een ander account niet
        if (k.includes(uid) || k.startsWith('vriend_') || !UUID.test(k)) { st.delete(cur.primaryKey); n++ }
        cur.continue()
      }
      tx.oncomplete = klaar
      tx.onerror = klaar
      tx.onabort = klaar
    })
    return n
  } catch (e) {
    console.warn('[verwijderen] foto’s wissen lukte niet', e)
    return 0
  } finally {
    try { if (db) db.close() } catch (e) {}
  }
}

const wacht = (ms) => new Promise((r) => setTimeout(r, ms))

export async function wisToestel(uid) {
  if (!uid) return
  // sessie.js: dit is een bewuste uitlog, niet proberen de inlogpas terug te halen
  try { sessionStorage.setItem('fibro_bewust_uitloggen', '1') } catch (e) {}
  // eerst netjes uitloggen (supabase-js ruimt dan zelf zijn inlogpas op), niet langer dan 4 s
  try { await Promise.race([supabase.auth.signOut({ scope: 'local' }), wacht(4000)]) } catch (e) {}
  wisOpslag(localStorage, uid)
  wisOpslag(sessionStorage, uid)
  await wisFotos(uid)
  // pushmeldingen op dit toestel uit (op de server is het abonnement al weg)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([navigator.serviceWorker.ready, wacht(2000).then(() => null)])
      const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null
      if (sub) await Promise.race([sub.unsubscribe(), wacht(2000)])
    }
  } catch (e) {}
  wisOpslag(localStorage, uid)
}

// --- Account verwijderen ---
function naamUitGeheugen(uid) {
  try {
    const p = JSON.parse(localStorage.getItem('fibro_profielcache_' + uid) || 'null')
    return p && typeof p.username === 'string' ? p.username : null
  } catch (e) { return null }
}

export function openVerwijderen(uid) {
  if (!uid) return
  const v = maakVel('verwijderScherm', '\u{1F5D1}️ Account verwijderen')
  v.kaart.appendChild(alinea('Je account wordt meteen en voorgoed verwijderd. Alles verdwijnt: je profiel, je vrienden, je gastenboek en al je gesprekken, ook bij je vrienden. Wat er op dit toestel van je staat, wordt ook gewist. Dit kan niet ongedaan worden gemaakt.'))
  const eerst = knop('\u{1F4E6} Eerst mijn gegevens downloaden')
  eerst.onclick = () => { v.dicht(); openGegevens(uid) }
  const label = document.createElement('label')
  label.htmlFor = 'verwijderNaam'
  label.style.cssText = 'display:block;font-size:14px;line-height:1.5;margin:16px 0 6px;color:var(--text)'
  const invoer = document.createElement('input')
  invoer.id = 'verwijderNaam'
  invoer.type = 'text'
  invoer.autocomplete = 'off'
  invoer.spellcheck = false
  invoer.setAttribute('autocapitalize', 'none')
  invoer.setAttribute('autocorrect', 'off')
  invoer.style.cssText = 'display:block;width:100%;box-sizing:border-box;min-height:44px;border-radius:12px;border:0.5px solid var(--border);background:rgba(255,255,255,0.08);color:var(--text);font-size:16px;padding:10px 12px;font-family:inherit'
  const weg = knop('Account definitief verwijderen', 'gevaar')
  v.kaart.append(eerst, label, invoer, weg)

  let naam = naamUitGeheugen(uid) // null = nog niet bekend
  let bezig = false
  const verwacht = () => (naam || 'verwijder').trim().toLowerCase()
  const zetLabel = () => {
    label.textContent = naam === null ? 'Even kijken…' : 'Typ ter bevestiging je gebruikersnaam: ' + (naam.trim() || 'VERWIJDER')
  }
  const controleer = () => zetAan(weg, !bezig && naam !== null && invoer.value.trim().toLowerCase() === verwacht())
  invoer.oninput = controleer
  invoer.onkeydown = (e) => { if (e.key === 'Enter' && !weg.disabled) weg.click() }
  zetLabel()
  controleer()

  weg.onclick = async () => {
    if (bezig || weg.disabled) return
    if (navigator.onLine === false) { v.status.textContent = '\u{1F4F4} Geen internet. Probeer het later opnieuw.'; return }
    bezig = true
    v.zetVast(true)
    zetAan(weg, false)
    zetAan(eerst, false)
    invoer.disabled = true
    v.status.textContent = 'Bezig met verwijderen…'
    try {
      const { data, error } = await supabase.rpc('verwijder_mijn_account', { p_bevestiging: invoer.value.trim() })
      // 'Account niet gevonden': de vorige poging is wel aangekomen
      if (error && !/Account niet gevonden/i.test(error.message || '')) throw error
      if (!error && data !== true) throw new Error('onverwacht antwoord')
    } catch (e) {
      console.warn('[verwijderen] mislukt', e)
      v.status.textContent = serverOud(e) ? '⚠️ Dit kan nog niet: de server is nog niet bijgewerkt. Er is niets verwijderd.'
        : /Bevestiging klopt niet/i.test(foutTekst(e)) ? '⚠️ De naam klopt niet. Er is niets verwijderd.'
        : geenVerbinding(e) ? '\u{1F4F4} Geen verbinding met de server. Probeer het opnieuw.'
        : '⚠️ Verwijderen lukte niet. Er is niets verwijderd. Probeer het later opnieuw.'
      bezig = false
      v.zetVast(false)
      zetAan(eerst, true)
      invoer.disabled = false
      controleer()
      return
    }
    v.status.textContent = '✓ Je account is verwijderd. Even opruimen…'
    await wisToestel(uid)
    v.status.textContent = '✓ Je account is verwijderd. Tot ziens!'
    setTimeout(() => {
      wisOpslag(localStorage, uid) // wat andere onderdelen intussen nog bewaarden
      location.replace('login.html?logout=1')
    }, 2500)
  }

  v.toon()
  invoer.focus()
  // de gebruikersnaam van de server (die telt)
  if (navigator.onLine === false) {
    if (naam === null) v.status.textContent = '\u{1F4F4} Geen internet. Verwijderen kan alleen met internet.'
    return
  }
  supabase.from('profiles').select('username').eq('id', uid).single().then(({ data, error }) => {
    if (error || !data) return
    naam = typeof data.username === 'string' ? data.username : ''
    zetLabel()
    controleer()
  }).catch(() => {})
}
