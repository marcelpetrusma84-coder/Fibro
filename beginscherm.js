// beginscherm.js (v248, 31 okt 2026): uitleg met tekeningen om Fibro op het beginscherm te zetten.
// Gebruikt door Home (menu: 📲 Fibro als app installeren, en de tip voor iPhone-gebruikers in Safari) en Profiel
// (Meldingen aanzetten: op de iPhone kan dat alleen als Fibro op het beginscherm staat).
//
// iPhone: de knoppen in Safari verschillen per iOS-versie (gecontroleerd 31 okt 2026):
//   iOS 27: de knop rechts naast het adres opent nu de tabbladen; Delen zit onder het knopje links naast het adres,
//           of houd je vinger op de adresbalk (Cult of Mac, "Safari in iOS 27").
//   iOS 26: ••• rechts naast het adres > Deel (MacRumors, "iOS 26: Add Web App or Bookmark to iPhone Home Screen").
//   ouder:  de deelknop (vierkantje met pijl) in de balk onderaan.
//   Daarna overal: Zet op beginscherm > Open als webapp aan > Voeg toe.
// De versie komt uit 'Version/27' in de browsergegevens van Safari; je kunt ook zelf een andere versie kiezen.
// De tekeningen zijn vereenvoudigd: ze laten zien wáár je tikt, niet hoe elk scherm er precies uitziet.
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export function toestel() {
  const ua = navigator.userAgent || ''
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = !ios && /Android/.test(ua)
  let app = false
  try { app = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true } catch (e) {}
  const v = ua.match(/Version\/(\d+)/)
  const safari = ios && v ? Number(v[1]) : 0
  const iosVersie = !ios ? null : safari >= 27 ? 'ios27' : safari === 26 || !safari ? 'ios26' : 'ouder'
  const anderBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return { ios, android, app, iosVersie, anderBrowser }
}

// Op de iPhone werken meldingen alleen in de app op het beginscherm (Safari zelf heeft geen PushManager)
export function iphoneZonderApp() {
  const t = toestel()
  return t.ios && !t.app
}

// ── Tekeningen (SVG). Kleuren: lichte telefoon (zoals Safari standaard), paars = waar je tikt ──
const PAARS = '#c084fc'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function scherm(inhoud, h = 150) {
  // het onderste of bovenste stuk van een telefoon, 200 breed
  return `<svg viewBox="0 0 200 ${h}" width="100%" style="max-width:240px;display:block;margin:6px auto 0" role="img" aria-hidden="true">
    <rect x="4" y="4" width="192" height="${h - 8}" rx="22" fill="#f2f2f7" stroke="#3b2f55" stroke-width="5"/>${inhoud}</svg>`
}
const tik = (x, y, r = 15) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${PAARS}" stroke-width="3.5"/><circle cx="${x}" cy="${y}" r="${r + 7}" fill="none" stroke="${PAARS}" stroke-width="1.5" opacity="0.5"/>`
const vinger = (x, y) => `<text x="${x}" y="${y}" font-size="22" text-anchor="middle">\u{1F446}</text>`
const tekst = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-family="-apple-system,system-ui,sans-serif" font-size="${o.g || 10}" fill="${o.k || '#1c1c1e'}" font-weight="${o.w || 400}" text-anchor="${o.a || 'start'}">${esc(t)}</text>`
const deelIcoon = (x, y, k = '#0a84ff') => `<g stroke="${k}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${x - 5} ${y - 2} h-2 v10 h14 v-10 h-2"/><path d="M${x} ${y + 3} v-12 M${x - 4} ${y - 5} l4 -4 4 4"/></g>`
const plusIcoon = (x, y) => `<g stroke="#1c1c1e" stroke-width="1.5" fill="none"><rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3.5"/><path d="M${x} ${y - 4} v8 M${x - 4} ${y} h8"/></g>`
const fibroIcoon = (x, y, s = 30) => `<image href="icon-192.png" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" clip-path="inset(0 round ${s * 0.22}px)"/>`

// De adresbalk van Safari onderaan, per versie (y = midden van de balk)
function safariBalk(versie, y = 118) {
  const pil = `<rect x="44" y="${y - 13}" width="112" height="26" rx="13" fill="#fff" stroke="#d1d1d6"/>${tekst(100, y + 3.5, 'fibro', { a: 'middle', g: 11, k: '#3a3a3c' })}`
  if (versie === 'ouder') {
    // een rij knoppen onder het adres: < > deel boek tabs
    return `<rect x="10" y="${y - 40}" width="180" height="26" rx="13" fill="#fff" stroke="#d1d1d6"/>${tekst(100, y - 23.5, 'fibro', { a: 'middle', g: 11, k: '#3a3a3c' })}
      ${tekst(28, y + 5, '‹', { a: 'middle', g: 20, k: '#0a84ff' })}${tekst(62, y + 5, '›', { a: 'middle', g: 20, k: '#c7c7cc' })}
      ${deelIcoon(100, y + 1)}
      <g stroke="#0a84ff" stroke-width="1.6" fill="none"><path d="M131 ${y - 5} q6 -2 8 1 q2 -3 8 -1 v12 q-6 -2 -8 1 q-2 -3 -8 -1z"/><rect x="164" y="${y - 6}" width="10" height="10" rx="2"/><rect x="167" y="${y - 9}" width="10" height="10" rx="2"/></g>`
  }
  const links = versie === 'ios27'
    ? `<g stroke="#3a3a3c" stroke-width="1.5" fill="none"><rect x="15" y="${y - 8}" width="13" height="16" rx="2.5"/><path d="M18 ${y - 3} h7 M18 ${y + 1} h7 M18 ${y + 5} h5"/></g>`
    : tekst(22, y + 6, '‹', { a: 'middle', g: 22, k: '#3a3a3c' })
  const rechts = versie === 'ios27'
    ? `<g stroke="#3a3a3c" stroke-width="1.5" fill="none"><rect x="172" y="${y - 6}" width="11" height="11" rx="2.5"/><rect x="175" y="${y - 9}" width="11" height="11" rx="2.5"/></g>`
    : `<circle cx="179" cy="${y}" r="13" fill="#fff" stroke="#d1d1d6"/>${tekst(179, y + 4, '•••', { a: 'middle', g: 10, k: '#3a3a3c', w: 700 })}`
  return links + pil + rechts
}

const TEKENING = {
  // iPhone, stap 1 per versie
  ios27_1: () => scherm(`${tekst(100, 40, 'fibro.app', { a: 'middle', g: 12, k: '#8e8e93' })}${safariBalk('ios27')}${tik(100, 118, 18)}${vinger(112, 146)}`, 160),
  ios26_1: () => scherm(`${tekst(100, 40, 'fibro.app', { a: 'middle', g: 12, k: '#8e8e93' })}${safariBalk('ios26')}${tik(179, 118)}${vinger(186, 150)}`, 160),
  ouder_1: () => scherm(`${tekst(100, 40, 'fibro.app', { a: 'middle', g: 12, k: '#8e8e93' })}${safariBalk('ouder')}${tik(100, 118)}${vinger(108, 150)}`, 160),
  // iPhone, stap 2: het menuutje met Deel
  menu: (versie) => scherm(`<rect x="${versie === 'ios27' ? 30 : 70}" y="18" width="116" height="78" rx="12" fill="#fff" stroke="#d1d1d6"/>
    ${[T('Kopieer'), T('Deel'), T('Voeg bladwijzer toe')].map((r, i) => (i ? `<line x1="${versie === 'ios27' ? 30 : 70}" x2="${versie === 'ios27' ? 146 : 186}" y1="${18 + i * 26}" y2="${18 + i * 26}" stroke="#e5e5ea"/>` : '') +
      tekst((versie === 'ios27' ? 30 : 70) + 12, 35 + i * 26, r, { g: 10.5, w: i === 1 ? 700 : 400 }) + (i === 1 ? deelIcoon((versie === 'ios27' ? 30 : 70) + 102, 31 + i * 26, '#1c1c1e') : '')).join('')}
    <rect x="${versie === 'ios27' ? 32 : 72}" y="46" width="112" height="24" rx="7" fill="none" stroke="${PAARS}" stroke-width="3"/>
    ${safariBalk(versie, 128)}`, 160),
  // iPhone, stap 3: het deelmenu met Zet op beginscherm
  delen: () => scherm(`<rect x="14" y="14" width="172" height="120" rx="14" fill="#fff" stroke="#d1d1d6"/>
    ${fibroIcoon(36, 34, 22)}${tekst(54, 31, 'Fibro', { g: 10.5, w: 700 })}${tekst(54, 43, 'fibro.app', { g: 8.5, k: '#8e8e93' })}
    <line x1="14" x2="186" y1="54" y2="54" stroke="#e5e5ea"/>
    ${tekst(26, 72, T('Kopieer'), { g: 10.5 })}<line x1="14" x2="186" y1="80" y2="80" stroke="#e5e5ea"/>
    ${tekst(26, 98, T('Voeg toe aan leeslijst'), { g: 10.5 })}<line x1="14" x2="186" y1="106" y2="106" stroke="#e5e5ea"/>
    ${tekst(26, 124, T('Zet op beginscherm'), { g: 10.5, w: 700 })}${plusIcoon(168, 120)}
    <rect x="17" y="108" width="166" height="23" rx="7" fill="none" stroke="${PAARS}" stroke-width="3"/>
    ${tekst(100, 146, '↓ ' + T('scrol omlaag als je het niet ziet'), { a: 'middle', g: 8.5, k: '#8e8e93' })}`, 156),
  // iPhone, stap 4: Open als webapp aan, Voeg toe
  toevoegen: () => scherm(`${tekst(24, 30, T('Annuleer'), { g: 10.5, k: '#0a84ff' })}
    ${tekst(178, 30, T('Voeg toe'), { a: 'end', g: 10.5, k: '#0a84ff', w: 700 })}<rect x="128" y="15" width="57" height="21" rx="10.5" fill="none" stroke="${PAARS}" stroke-width="3"/>${vinger(170, 58)}
    <rect x="14" y="44" width="172" height="44" rx="12" fill="#fff"/>${fibroIcoon(38, 66, 28)}${tekst(60, 63, 'Fibro', { g: 11, w: 600 })}${tekst(60, 76, 'fibro.app', { g: 8.5, k: '#8e8e93' })}
    <rect x="14" y="96" width="172" height="32" rx="12" fill="#fff"/>${tekst(26, 116, T('Open als webapp'), { g: 10.5 })}
    <rect x="148" y="103" width="30" height="18" rx="9" fill="#34c759"/><circle cx="169" cy="112" r="7.5" fill="#fff"/>
    <rect x="144" y="99" width="38" height="26" rx="13" fill="none" stroke="${PAARS}" stroke-width="2.5" stroke-dasharray="4 3"/>`, 140),
  // stap 5: het icoon op het beginscherm
  icoon: () => scherm(`${[0, 1, 2, 3].map((k) => [0, 1].map((r) => (k === 1 && r === 1) ? '' :
      `<rect x="${24 + k * 42}" y="${22 + r * 52}" width="30" height="30" rx="7" fill="${['#ffd60a', '#30d158', '#0a84ff', '#ff453a', '#bf5af2', '#64d2ff', '#ff9f0a', '#5e5ce6'][k + r * 4]}" opacity="0.55"/>`).join('')).join('')}
    ${fibroIcoon(81, 89, 30)}${tik(81, 89, 19)}${tekst(81, 126, 'Fibro', { a: 'middle', g: 9.5, w: 600 })}${vinger(112, 128)}`, 140),
  // Android (Chrome): ⋮ rechtsboven, App installeren, Installeren
  android_1: () => scherm(`<rect x="14" y="16" width="146" height="26" rx="13" fill="#fff" stroke="#d1d1d6"/>${tekst(30, 33, 'fibro.app', { g: 11, k: '#3a3a3c' })}
    ${tekst(177, 34, '⋮', { a: 'middle', g: 20, k: '#3a3a3c', w: 700 })}${tik(177, 29)}${vinger(170, 72)}
    ${tekst(100, 100, 'Fibro', { a: 'middle', g: 13, k: '#8e8e93' })}`, 130),
  android_2: () => scherm(`<rect x="60" y="14" width="128" height="104" rx="10" fill="#fff" stroke="#d1d1d6"/>
    ${[T('Nieuw tabblad'), T('Bladwijzers'), T('App installeren'), T('Delen…')].map((r, i) => tekst(72, 35 + i * 24, r, { g: 10.5, w: i === 2 ? 700 : 400 })).join('')}
    <rect x="63" y="70" width="122" height="22" rx="7" fill="none" stroke="${PAARS}" stroke-width="3"/>`, 130),
  android_3: () => scherm(`<rect x="22" y="22" width="156" height="92" rx="16" fill="#fff" stroke="#d1d1d6"/>
    ${fibroIcoon(46, 50, 26)}${tekst(66, 47, T('App installeren'), { g: 11, w: 700 })}${tekst(66, 60, 'Fibro', { g: 9.5, k: '#8e8e93' })}
    ${tekst(84, 98, T('Annuleren'), { a: 'middle', g: 10.5, k: '#5e5ce6' })}${tekst(140, 98, T('Installeren'), { a: 'middle', g: 10.5, k: '#5e5ce6', w: 700 })}${tik(140, 94, 17)}`, 136),
}

// De stappen per toestel; elke stap: [tekst (mag <b> bevatten), tekening]
function stappenIphone(versie) {
  const eerste = {
    ios27: [T('Houd je vinger op de <b>adresbalk</b> onderaan in Safari. (Of tik op het knopje <b>links</b> naast het adres.)'), TEKENING.ios27_1()],
    ios26: [T('Tik in Safari rechts naast het adres op <b>•••</b>.'), TEKENING.ios26_1()],
    ouder: [T('Tik onderaan in Safari op de <b>deelknop</b> (vierkantje met een pijl omhoog).'), TEKENING.ouder_1()],
  }[versie]
  return [
    eerste,
    ...(versie === 'ouder' ? [] : [[T('Tik op <b>Deel</b>.'), TEKENING.menu(versie)]]),
    [T('Tik op <b>Zet op beginscherm</b>. Zie je het niet? Scrol dan omlaag.'), TEKENING.delen()],
    [T('Laat <b>Open als webapp</b> aan staan (groen) en tik rechtsboven op <b>Voeg toe</b>.'), TEKENING.toevoegen()],
    [T('Klaar! Open Fibro voortaan via het <b>nieuwe icoon</b> op je beginscherm.'), TEKENING.icoon()],
  ]
}
function stappenAndroid() {
  return [
    [T('Tik in Chrome rechtsboven op <b>⋮</b> (drie puntjes).'), TEKENING.android_1()],
    [T('Tik op <b>App installeren</b> (of <b>Toevoegen aan startscherm</b>).'), TEKENING.android_2()],
    [T('Tik op <b>Installeren</b>.'), TEKENING.android_3()],
    [T('Klaar! Open Fibro voortaan via het <b>nieuwe icoon</b>.'), TEKENING.icoon()],
  ]
}

// De uitleg openen. reden: 'meldingen' (Profiel > Meldingen aanzetten op een iPhone in Safari) of leeg.
export function openBeginschermUitleg({ reden = '' } = {}) {
  document.getElementById('beginschermScherm')?.remove()
  const t = toestel()
  const achter = document.createElement('div')
  achter.id = 'beginschermScherm'
  achter.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center'
  const kaart = document.createElement('div')
  kaart.setAttribute('role', 'dialog')
  kaart.setAttribute('aria-modal', 'true')
  kaart.setAttribute('aria-labelledby', 'bsTitel')
  kaart.tabIndex = -1
  kaart.style.cssText = 'width:100%;max-width:480px;max-height:90vh;overflow-y:auto;outline:none;background:#1a0a2e;border:0.5px solid var(--border,rgba(255,255,255,.15));border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));color:var(--text,#f3e8ff);font-family:inherit'
  const el = (tag, css, html) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e }
  const titel = el('h2', 'font-size:18px;margin:0 0 10px;color:var(--accent,#c084fc)')
  titel.id = 'bsTitel'
  titel.textContent = reden === 'meldingen' ? T('\u{1F514} Meldingen op je iPhone') : T('\u{1F4F2} Fibro op je beginscherm zetten')
  kaart.appendChild(titel)
  const alinea = (html, css = '') => kaart.appendChild(el('p', 'font-size:14px;line-height:1.5;margin:0 0 12px;' + css, html))
  if (t.app) alinea(T('✓ Je gebruikt Fibro nu al als app.'), 'color:#86efac;font-weight:600')
  if (reden === 'meldingen') {
    alinea(T('Op de iPhone werken meldingen <b>alleen</b> als Fibro op je beginscherm staat. Zo zet je Fibro daar neer:'))
  } else {
    alinea(T('Dan opent Fibro als een gewone app: over het hele scherm, met meldingen en een bolletje bij ongelezen berichten.'))
  }
  if (t.anderBrowser) alinea(T('Je gebruikt nu een andere browser dan Safari. Open Fibro het makkelijkst in <b>Safari</b> en volg dan deze stappen.'), 'font-size:13px;opacity:0.9')

  // keuze: iPhone (met versie) of Android
  const keuzes = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px')
  const stappenPlek = el('ol', 'list-style:none;margin:0;padding:0')
  let soort = t.android ? 'android' : 'iphone'
  let versie = t.iosVersie || 'ios26'
  const knop = (label, actief, fn) => {
    const b = el('button', 'min-height:34px;padding:6px 12px;border-radius:17px;font:inherit;font-size:13px;cursor:pointer;border:1px solid ' +
      (actief ? 'var(--accent,#c084fc);background:rgba(192,132,252,0.22);color:#fff;font-weight:600' : 'rgba(255,255,255,0.18);background:transparent;color:rgba(255,255,255,0.75)'))
    b.type = 'button'
    b.textContent = label
    b.setAttribute('aria-pressed', actief ? 'true' : 'false')
    b.onclick = fn
    return b
  }
  let teken = function () {
    keuzes.textContent = ''
    keuzes.append(knop('iPhone', soort === 'iphone', () => { soort = 'iphone'; teken() }), knop('Android', soort === 'android', () => { soort = 'android'; teken() }))
    if (soort === 'iphone') {
      const rij = el('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;width:100%;margin-top:4px')
      rij.appendChild(el('span', 'font-size:12px;opacity:0.7;margin-right:2px', esc(T('Jouw iOS:'))))
      for (const [v, naam] of [['ios27', 'iOS 27'], ['ios26', 'iOS 26'], ['ouder', T('ouder')]]) {
        rij.appendChild(knop(naam + (t.iosVersie === v ? ' · ' + T('deze iPhone') : ''), versie === v, () => { versie = v; teken() }))
      }
      keuzes.appendChild(rij)
    }
    stappenPlek.textContent = ''
    const stappen = soort === 'iphone' ? stappenIphone(versie) : stappenAndroid()
    stappen.forEach(([html, svg], i) => {
      const li = el('li', 'border:0.5px solid var(--border,rgba(255,255,255,.15));border-radius:14px;padding:12px 12px 10px;margin:0 0 10px;background:rgba(255,255,255,0.04)')
      li.appendChild(el('div', 'display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.45',
        `<span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--accent,#c084fc);color:#1a0a2e;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center">${i + 1}</span><span>${html}</span>`))
      li.appendChild(el('div', '', svg))
      stappenPlek.appendChild(li)
    })
  }
  // na het installeren (iPhone): de app op het beginscherm heeft eigen opslag, dus opnieuw inloggen en de sleutel
  // terugzetten; voor meldingen nog de laatste stap. (Op Android deelt de app de opslag met Chrome.)
  const daarna = el('section', 'border:1px solid rgba(192,132,252,0.45);border-radius:14px;padding:12px 14px;margin:2px 0 12px;background:rgba(192,132,252,0.08);font-size:13.5px;line-height:1.5')
  function tekenDaarna() {
    daarna.textContent = ''
    daarna.appendChild(el('div', 'font-weight:700;margin-bottom:4px', esc(T('Daarna, in de app:'))))
    const lijst = el('ul', 'margin:0;padding-left:18px')
    if (soort === 'iphone') {
      lijst.appendChild(el('li', '', T('Log opnieuw in. De app op je beginscherm heeft eigen opslag.')))
      lijst.appendChild(el('li', '', T('Zet je sleutel terug met Face ID of je herstelcode, zodat je je berichten kunt lezen.')))
    }
    lijst.appendChild(el('li', '', T('Ga naar <b>Profiel</b> en tik op <b>Meldingen aanzetten</b>.')))
    daarna.appendChild(lijst)
  }
  const tekenStappen = teken
  teken = () => { tekenStappen(); tekenDaarna() }
  teken()
  kaart.append(keuzes, stappenPlek, daarna)
  kaart.appendChild(el('p', 'font-size:11.5px;opacity:0.6;margin:0 0 12px', esc(T('De tekeningen zijn vereenvoudigd: ze laten zien waar je tikt.'))))
  const sluit = el('button', 'width:100%;min-height:44px;border-radius:12px;border:0.5px solid var(--border,rgba(255,255,255,.15));background:rgba(255,255,255,0.08);color:var(--text,#fff);font-size:15px;cursor:pointer;font-family:inherit')
  sluit.type = 'button'
  sluit.textContent = T('Sluiten')
  const dicht = () => { achter.remove(); document.removeEventListener('keydown', escToets, true) }
  const escToets = (e) => { if (e.key === 'Escape') dicht() }
  document.addEventListener('keydown', escToets, true)
  sluit.onclick = dicht
  achter.onclick = (e) => { if (e.target === achter) dicht() }
  kaart.appendChild(sluit)
  achter.appendChild(kaart)
  document.body.appendChild(achter)
  kaart.focus()
  return achter
}
