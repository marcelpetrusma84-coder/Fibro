// fediverse.js (25 nov 2026) - liken en reageren op PeerTube-video's met je EIGEN fediverse-account.
//
// In gewone woorden: onder een PeerTube-video staan "❤️ Liken" en "💬 Reageren". De eerste keer vul je je eigen
// fediverse-server in (bijvoorbeeld mastodon.social) en log je in op de pagina van die server zelf: Stekky ziet je
// wachtwoord nooit. Daarna like of reageer je met jouw account; PeerTube toont je reactie onder de video.
//  - Alles gaat via de server van Stekky (edge function fediverse): zo blijft de huisregel van de app streng.
//  - De inlogsleutel staat ALLEEN op dit toestel (localStorage 'fibro_fediverse_<uid>'). Hij gaat niet mee naar
//    vrienden (sync.js kent deze sleutel niet) en de Stekky-server bewaart hem niet.
//  - De sleutel mag alleen zoeken, liken en reageren. Uitloggen trekt hem ook bij je server in.
//
// Gebruik:
//   maakFedi({ uid, geefPas })     -> { account(), startInloggen(server), zoek(video), like(id, aan), reageer(id, tekst), uitloggen() }
//   verwerkTerug(zoekdeel, { geefPas })  -> { ok, terugNaar } of { fout }   (op fediverse-terug.html)
//   terugAdres()                   -> het adres waar de fediverse-server na het inloggen naar terugstuurt

Object.assign(window.FIBRO_EN ||= {}, {
  '❤️ Liken': '❤️ Like', '❤️ Geliket': '❤️ Liked', '💬 Reageren': '💬 Reply', 'Plaatsen': 'Post', 'Annuleren': 'Cancel',
  'Inloggen met je fediverse-account': 'Log in with your fediverse account',
  'Je server, bijvoorbeeld mastodon.social': 'Your server, for example mastodon.social',
  'Inloggen': 'Log in', 'Uitloggen': 'Log out', 'Ingelogd als {acct}': 'Logged in as {acct}',
  'Je logt in op de pagina van je eigen server. Stekky ziet je wachtwoord niet.': 'You log in on the page of your own server. {app} never sees your password.',
  'Dit is geen geldige server.': 'This is not a valid server.',
  'Je server is nu niet te bereiken.': 'Your server cannot be reached right now.',
  'Je bent uitgelogd bij je server. Log opnieuw in.': 'You were logged out by your server. Please log in again.',
  'Even wachten, je doet het te vaak.': 'Please wait a moment, you are doing this too often.',
  'Je server kent deze video (nog) niet.': 'Your server does not know this video (yet).',
  'Dit lukt nu niet. Probeer het later nog eens.': 'This does not work right now. Please try again later.',
  'Je reactie (hoogstens 500 tekens)': 'Your reply (500 characters max)',
  '✓ Geplaatst': '✓ Posted', 'Schrijf eerst iets.': 'Write something first.',
  'Je reactie staat openbaar onder de video.': 'Your reply is public under the video.',
  'Inloggen lukte niet. Probeer het nog eens.': 'Logging in did not work. Please try again.',
  'Je bent ingelogd. Je gaat zo terug naar Stekky…': 'You are logged in. Going back to {app}…',
  'Bezig met inloggen…': 'Logging in…',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const FUNCTIE_URL = 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/fediverse'
const ANON_KEY = 'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
export const SCOPES = 'read:search read:accounts read:statuses write:favourites write:statuses'
export const MAX_TEKST = 500
const WACHT = 'fibro_fediverse_wacht'
const APPS = 'fibro_fediverse_apps'
const sleutel = uid => 'fibro_fediverse_' + uid

const lees = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } }
const zet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

// Zelfde regels als de server (supabase/functions/fediverse/regels.js netteServer)
const PRIVE_NAAM = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa|onion)$/
export function netteServer(s) {
  if (typeof s !== 'string') return null
  let t = s.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/+$/, '')
  if (t.startsWith('@')) t = t.split('@').pop()
  if (!t || t.length > 120 || !/^[a-z0-9.-]+$/.test(t)) return null
  if (!t.includes('.') || t.startsWith('.') || t.endsWith('.') || t.includes('..') || /^[\d.]+$/.test(t)) return null
  if (t.split('.').some(d => !d || d.length > 63 || d.startsWith('-') || d.endsWith('-'))) return null
  if (PRIVE_NAAM.test(t)) return null
  return t
}

export function terugAdres(loc = globalThis.location) {
  return new URL('fediverse-terug.html', loc.href).href.split('?')[0].split('#')[0]
}

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const willekeurig = n => b64url(crypto.getRandomValues(new Uint8Array(n)))
export async function pkce() {
  const verifier = willekeurig(48) // 64 tekens
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return { verifier, challenge: b64url(hash) }
}

const MELDING = {
  server: 'Dit is geen geldige server.', 'niet bereikbaar': 'Je server is nu niet te bereiken.', 'te langzaam': 'Je server is nu niet te bereiken.',
  'te groot': 'Je server is nu niet te bereiken.', uitgelogd: 'Je bent uitgelogd bij je server. Log opnieuw in.',
  'even wachten': 'Even wachten, je doet het te vaak.', 'niet gevonden': 'Je server kent deze video (nog) niet.',
}
export const melding = reden => T(MELDING[reden] || 'Dit lukt nu niet. Probeer het later nog eens.')

// Eén vraag aan de functie. Geeft het antwoord ({ ok: true, ... }) of { fout: reden }.
async function vraag(geefPas, body, f = globalThis.fetch) {
  let pas = null
  try { pas = await geefPas() } catch (e) {}
  if (!pas) return { fout: 'niet ingelogd' }
  const c = typeof AbortController === 'function' ? new AbortController() : null
  const klok = c ? setTimeout(() => c.abort(), 15000) : null
  try {
    const r = await f(FUNCTIE_URL, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', signal: c ? c.signal : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pas, apikey: ANON_KEY },
      body: JSON.stringify(body),
    })
    let d = null
    try { d = await r.json() } catch (e) {}
    if (r.ok && d && d.ok) return d
    return { fout: (d && typeof d.reden === 'string') ? d.reden : 'niet bereikbaar' }
  } catch (e) {
    return { fout: 'niet bereikbaar' }
  } finally { if (klok) clearTimeout(klok) }
}

export function maakFedi({ uid, geefPas, fetch: f = globalThis.fetch, loc = globalThis.location, ga = url => { loc.href = url } } = {}) {
  const k = sleutel(uid)
  const account = () => { const a = lees(k); return a && a.token && a.server ? a : null }
  const metSleutel = async (body) => {
    const a = account()
    if (!a) return { fout: 'uitgelogd' }
    const d = await vraag(geefPas, { ...body, server: a.server, token: a.token }, f)
    if (d.fout === 'uitgelogd') zet(k, null) // de server kent de sleutel niet meer: opnieuw inloggen
    return d
  }
  return {
    account,
    async startInloggen(invoer, terugNaar = loc.href) {
      const server = netteServer(invoer)
      if (!server) return { fout: 'server' }
      const terug = terugAdres(loc)
      const apps = lees(APPS) || {}
      let app = apps[server + ' ' + terug]
      if (!app) {
        const d = await vraag(geefPas, { actie: 'app', server, terug }, f)
        if (d.fout) return d
        app = { client_id: d.client_id, client_secret: d.client_secret }
        apps[server + ' ' + terug] = app
        zet(APPS, apps)
      }
      const { verifier, challenge } = await pkce()
      const state = willekeurig(24)
      zet(WACHT, { state, verifier, server, uid, terug, terugNaar, tijd: Date.now(), ...app })
      const q = new URLSearchParams({ response_type: 'code', client_id: app.client_id, redirect_uri: terug, scope: SCOPES,
        state, code_challenge: challenge, code_challenge_method: 'S256' })
      ga('https://' + server + '/oauth/authorize?' + q.toString())
      return { ok: true }
    },
    zoek: video => metSleutel({ actie: 'zoek', video }),
    like: (id, aan) => metSleutel({ actie: 'like', id, aan: aan !== false }),
    reageer: (id, tekst) => metSleutel({ actie: 'reageer', id, tekst }),
    async uitloggen() {
      const a = account()
      zet(k, null)
      if (a) await vraag(geefPas, { actie: 'uit', server: a.server, token: a.token, client_id: a.client_id, client_secret: a.client_secret }, f)
    },
  }
}

// Op fediverse-terug.html: de server stuurt terug met ?code=...&state=...
export async function verwerkTerug(zoekdeel, { geefPas, fetch: f = globalThis.fetch } = {}) {
  const q = new URLSearchParams(zoekdeel || '')
  const w = lees(WACHT)
  zet(WACHT, null) // één keer bruikbaar
  const terugNaar = w && typeof w.terugNaar === 'string' && /^https?:\/\//.test(w.terugNaar) && new URL(w.terugNaar).origin === globalThis.location.origin ? w.terugNaar : 'index.html'
  if (!w || !q.get('code') || q.get('state') !== w.state || Date.now() - (w.tijd || 0) > 15 * 60 * 1000) return { fout: 'inloggen', terugNaar }
  const d = await vraag(geefPas, { actie: 'token', server: w.server, terug: w.terug, client_id: w.client_id, client_secret: w.client_secret,
    code: q.get('code'), verifier: w.verifier }, f)
  if (d.fout || !d.token) return { fout: d.fout || 'inloggen', terugNaar }
  const ik = await vraag(geefPas, { actie: 'ik', server: w.server, token: d.token }, f)
  zet(sleutel(w.uid), { server: w.server, token: d.token, client_id: w.client_id, client_secret: w.client_secret,
    acct: ik.acct ? '@' + String(ik.acct).replace(/^@/, '') + (String(ik.acct).includes('@') ? '' : '@' + w.server) : '@' + w.server, naam: ik.naam || '' })
  return { ok: true, terugNaar }
}

// ── De knoppen onder een PeerTube-video ──
const KNOP = 'border:none;border-radius:10px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit'
const HOOFDKNOP = KNOP + ';background:var(--knop,#8b3fd1);color:#fff'
const GRIJSKNOP = KNOP + ';background:rgba(255,255,255,0.12);color:#fff'
const VELD = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:0.5px solid var(--border,rgba(255,255,255,0.18));border-radius:8px;padding:7px 9px;color:var(--text,#fff);font-size:13px;font-family:inherit;outline:none'
function el(tag, stijl, inhoud) {
  const e = document.createElement(tag)
  if (stijl) e.style.cssText = stijl
  if (inhoud != null) e.textContent = inhoud
  return e
}
const stil = f => e => { e.stopPropagation(); f() }

// el: het vakje onder de speler. video: https://<peertube-server>/videos/watch/<id>.
export function tekenActies(el0, fedi, video) {
  let status = null // { id, favoriet, likes, reacties } zodra de server de video kent
  const vak = el0
  vak.style.cssText = 'display:flex;flex-direction:column;gap:6px;width:100%;margin:2px 0'
  const rij = el('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center')
  const like = el('button', GRIJSKNOP, T('❤️ Liken'))
  like.className = 'fv-like'
  const reageer = el('button', GRIJSKNOP, T('💬 Reageren'))
  reageer.className = 'fv-reageer'
  rij.append(like, reageer)
  const onder = el('div', 'display:flex;flex-direction:column;gap:6px')
  const melden = el('div', 'font-size:12px;color:#fca5a5;text-align:center')
  melden.className = 'fv-melding'
  const wie = el('div', 'font-size:11px;color:rgba(255,255,255,0.6);text-align:center')
  wie.className = 'fv-wie'
  vak.append(rij, onder, melden, wie)

  function toonWie() {
    const a = fedi.account()
    wie.textContent = ''
    if (!a) return
    wie.append(T('Ingelogd als {acct}', { acct: a.acct || a.server }) + ' · ')
    const uit = el('button', 'background:none;border:none;color:var(--accent,#c084fc);font-size:11px;cursor:pointer;padding:0;font-family:inherit;text-decoration:underline', T('Uitloggen'))
    uit.className = 'fv-uit'
    uit.onclick = stil(async () => { await fedi.uitloggen(); status = null; tekenLike(); onder.textContent = ''; toonWie() })
    wie.appendChild(uit)
  }
  function tekenLike() {
    const aan = !!(status && status.favoriet)
    like.textContent = (aan ? T('❤️ Geliket') : T('❤️ Liken')) + (status && status.likes ? ' · ' + status.likes : '')
    like.style.cssText = aan ? HOOFDKNOP : GRIJSKNOP
    like.setAttribute('aria-pressed', aan ? 'true' : 'false')
  }
  function fout(d) {
    melden.textContent = melding(d.fout)
    if (d.fout === 'uitgelogd') { status = null; toonWie() }
  }
  // de video bij je eigen server opzoeken (één keer)
  async function zoek() {
    if (status) return status
    const d = await fedi.zoek(video)
    if (d.fout) { fout(d); return null }
    if (d.geen) { melden.textContent = melding('niet gevonden'); return null }
    status = d
    tekenLike()
    return status
  }
  function inlogVak() {
    onder.textContent = ''
    melden.textContent = ''
    const kop = el('div', 'font-size:12px;font-weight:600;text-align:center', T('Inloggen met je fediverse-account'))
    const veld = el('input', VELD)
    veld.className = 'fv-server'; veld.autocomplete = 'off'; veld.inputMode = 'url'; veld.spellcheck = false
    veld.placeholder = T('Je server, bijvoorbeeld mastodon.social')
    const knoppen = el('div', 'display:flex;gap:6px;justify-content:center')
    const ok = el('button', HOOFDKNOP, T('Inloggen'))
    ok.className = 'fv-inloggen'
    ok.onclick = stil(async () => {
      ok.disabled = true
      const d = await fedi.startInloggen(veld.value)
      ok.disabled = false
      if (d && d.fout) melden.textContent = melding(d.fout)
    })
    const weg = el('button', GRIJSKNOP, T('Annuleren'))
    weg.onclick = stil(() => { onder.textContent = ''; melden.textContent = '' })
    knoppen.append(ok, weg)
    for (const x of [veld]) { x.onclick = e => e.stopPropagation(); x.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ok.click() } }
    onder.append(kop, veld, knoppen, el('div', 'font-size:11px;color:rgba(255,255,255,0.6);text-align:center;line-height:1.35', T('Je logt in op de pagina van je eigen server. Stekky ziet je wachtwoord niet.')))
  }
  like.onclick = stil(async () => {
    if (!fedi.account()) return inlogVak()
    melden.textContent = ''
    like.disabled = true
    try {
      const s = await zoek()
      if (!s) return
      const d = await fedi.like(s.id, !s.favoriet)
      if (d.fout) return fout(d)
      status = { ...status, favoriet: d.favoriet, likes: d.likes }
      tekenLike()
    } finally { like.disabled = false }
  })
  reageer.onclick = stil(() => {
    if (!fedi.account()) return inlogVak()
    onder.textContent = ''
    melden.textContent = ''
    const veld = el('textarea', VELD + ';min-height:60px;resize:vertical')
    veld.className = 'fv-tekst'; veld.maxLength = MAX_TEKST
    veld.placeholder = T('Je reactie (hoogstens 500 tekens)')
    veld.onclick = e => e.stopPropagation(); veld.onkeydown = e => e.stopPropagation()
    const knoppen = el('div', 'display:flex;gap:6px;justify-content:center')
    const plaats = el('button', HOOFDKNOP, T('Plaatsen'))
    plaats.className = 'fv-plaats'
    plaats.onclick = stil(async () => {
      const t = veld.value.trim()
      if (!t) { melden.textContent = T('Schrijf eerst iets.'); return }
      plaats.disabled = true
      try {
        const s = await zoek()
        if (!s) return
        const d = await fedi.reageer(s.id, t)
        if (d.fout) return fout(d)
        onder.textContent = ''
        onder.appendChild(el('div', 'font-size:12px;color:#86efac;text-align:center', T('✓ Geplaatst')))
      } finally { if (plaats.isConnected) plaats.disabled = false }
    })
    const weg = el('button', GRIJSKNOP, T('Annuleren'))
    weg.onclick = stil(() => { onder.textContent = ''; melden.textContent = '' })
    knoppen.append(plaats, weg)
    onder.append(veld, knoppen, el('div', 'font-size:11px;color:rgba(255,255,255,0.6);text-align:center', T('Je reactie staat openbaar onder de video.')))
    try { veld.focus() } catch (e) {}
  })
  tekenLike()
  toonWie()
  if (fedi.account()) zoek() // ingelogd: meteen laten zien of je hem al geliket hebt
}
