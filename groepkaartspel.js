// groepkaartspel.js (v1, 25 nov 2026) - kaartspellen met de groep, in de groepschat (groep.html). Stap 2 van multiplayer.
//
// In gewone woorden:
//  1. Tik op 🎲 in de groepschat en kies een spel (de kaartspellen die met meer spelers kunnen: GROEPSPELLEN).
//  2. De groep krijgt bovenin een balkje: "Marcel wil Eenendertigen spelen [Doe mee]". Wie meedoet, komt in de wachtkamer.
//  3. In de wachtkamer zie je wie er meedoet (hoogstens 6). Wie het spel opende, kan computers 🤖 erbij zetten en tikt
//     op Start. Dan gaat bij iedereen die meedoet het spel open.
//  4. Het spel loopt over het kanaal van de groep zelf (groep-<id>, alleen voor de leden). Alles krijgt het event 'gs' en
//     het nummer van dit spel (sessie), zodat de rest van de groepschat er niets van merkt. groepspel.js doet de rest
//     (wie het spel opende is de gastheer; de computer speelt lege zetels en wie weggaat).
//  5. In het spel: het spelmenu ☰ met geluid, microfoon (de voice chat van de groep), 🏠 = terug naar de chat (het spel
//     blijft open, een knop brengt je terug) en 🚪 = het spel verlaten.
//
//   const gk = maakGroepKaartspel({ ik, groepId, kanaal, leden, naamVan, toast, bel })
//   gk.kies()                 het keuzescherm (knop 🎲)
//   gk.ontvang(payload)       alles wat met event 'gs' over het groepskanaal binnenkomt
//   bel = { kan(), aan(), wissel() }   de voice chat van de groep (voor de microfoon in het spelmenu)
//   gk.hallo()                als het kanaal open is: wie een wachtkamer open heeft, stuurt zijn uitnodiging nog eens
//   meldPush(spel, sessie)    (v3, 25 nov 2026) een pushmelding naar de andere leden: "Marcel wil Eenendertigen spelen"
//                             (stuur-push, type groepspel). Tikken opent de groep; dan zegt de pagina 'hallo' en komt
//                             de uitnodiging bovenin (ook als je er eerst niet was).
import { STUDIO_SPELLEN, studioSpel, spelBestand, spelIcoon } from './studio-spellen.js?v=6'
import { maakSpelMenu } from './spelmenu.js?v=1'
import { molKnop } from './mollenmeppen.js?v=2' // 26 nov 2026: Mollen meppen terwijl je in de wachtkamer wacht

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Samen een spel spelen': 'Play a game together', 'Kies een spel. De groep krijgt een uitnodiging.': 'Choose a game. The group gets an invitation.',
  '{naam} wil {spel} spelen': '{naam} wants to play {spel}', 'Doe mee': 'Join', 'Wachtkamer': 'Waiting room',
  'Wie doet er mee? ({n} van {max})': "Who's playing? ({n} of {max})", '🤖 Computer erbij': '🤖 Add computer', '▶ Start': '▶ Start',
  'Wachten tot {naam} start...': 'Waiting for {naam} to start...', 'Minstens 2 spelers': 'At least 2 players', 'Het spel is vol.': 'The game is full.',
  'Annuleren': 'Cancel', 'Ik doe niet mee': "I'm out", '🎲 Terug naar het spel': '🎲 Back to the game', 'Het spel is gestopt.': 'The game has stopped.',
  'Er zijn nog geen spellen voor een groep.': 'There are no group games yet.', '{n} tot {max} spelers': '{n} to {max} players', 'Computer {n}': 'Computer {n}',
})
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const MAX = 6
// Welke spellen met de groep kunnen: kaartspellen uit Stekky Studio met max > 2 (studio-spellen.js)
export const groepSpellen = () => STUDIO_SPELLEN.filter(s => s.soort === 'kaart' && (s.max || 2) > 2 && s.met && s.met.vriend)
const GELDIG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const nieuweSessie = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const STIJL = `
.gk-laag{position:fixed;inset:0;z-index:300;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px}
.gk-kaart{background:var(--card,#2a1546);color:var(--text,#fff);border:0.5px solid var(--border,#ffffff33);border-radius:18px;padding:18px;width:min(420px,100%);max-height:86vh;overflow:auto;box-shadow:0 10px 40px #000a}
.gk-kaart h2{margin:0 0 6px;font-size:18px}.gk-kaart p{margin:0 0 12px;font-size:13px;opacity:.8}
.gk-spel{display:flex;align-items:center;gap:12px;width:100%;padding:10px;border-radius:12px;border:0.5px solid var(--border,#ffffff33);background:#ffffff0d;color:inherit;font:inherit;cursor:pointer;text-align:left;margin-bottom:8px}
.gk-spel img{width:40px;height:40px}
.gk-rij{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}
.gk-knop{border:none;border-radius:12px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;background:#ffffff1a;color:inherit}
.gk-knop.gk-hoofd{background:var(--knop,#8b3fd1);color:#fff}.gk-knop:disabled{opacity:.45;cursor:default}
.gk-spelers{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:6px}
.gk-spelers li{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#ffffff0d;font-size:14px}
.gk-balk{position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top));z-index:250;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);
  background:var(--card,#2a1546);color:var(--text,#fff);border:1px solid #c084fc;border-radius:999px;padding:6px 6px 6px 14px;box-shadow:0 6px 24px #000a;font-size:14px}
.gk-balk span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gk-overlay{position:fixed;inset:0;z-index:260;background:#0b0618;display:flex;flex-direction:column}
.gk-overlay[hidden]{display:none}
.gk-overlay #spelTitelBar{position:absolute;top:20px;left:50%;transform:translateX(-50%);color:#fff;font-weight:600;font-size:14px;opacity:.85;z-index:5;max-width:calc(100% - 150px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gk-overlay #spelInhoud{position:absolute;inset:0}
.gk-terug{position:fixed;right:14px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:240}
`

export function maakGroepKaartspel({ ik, groepId, kanaal, leden, naamVan, toast = () => {}, bel = null, meldPush = null }) {
  if (!document.getElementById('gk-stijl')) { const s = document.createElement('style'); s.id = 'gk-stijl'; s.textContent = STIJL; document.head.appendChild(s) }
  const lid = id => (leden() || []).find(l => l.id === id)
  const naam = id => id === ik ? T('Jij') : (lid(id) ? naamVan(lid(id)) : '?')
  const stuur = (e, p) => { const k = kanaal(); if (!k) return false; try { k.send({ type: 'broadcast', event: 'gs', payload: { ...p, e, van: ik } }) } catch (x) { return false } return true }

  let lobby = null          // { sessie, spel, host, spelers: [id...], computers }
  let mol = null            // 26 nov 2026: Mollen meppen in de wachtkamer (mollenmeppen.js)
  let lopend = null         // { sessie, overlay, luisteraars, menu }
  const uitnodigingen = new Map()   // sessie -> { spel, host }
  let balkEl = null, laagEl = null, terugEl = null

  function sluitLaag() { laagEl?.remove(); laagEl = null }
  function laag(html) {
    sluitLaag()
    laagEl = document.createElement('div'); laagEl.className = 'gk-laag'; laagEl.setAttribute('role', 'dialog'); laagEl.setAttribute('aria-modal', 'true')
    laagEl.innerHTML = '<div class="gk-kaart">' + html + '</div>'
    document.body.appendChild(laagEl)
    return laagEl
  }

  // ── 1. Een spel kiezen ──
  function kies() {
    if (lopend) { toonSpel(); return }
    const lijst = groepSpellen()
    const l = laag('<h2>' + esc(T('Samen een spel spelen')) + '</h2><p>' + esc(T('Kies een spel. De groep krijgt een uitnodiging.')) + '</p>'
      + (lijst.length ? lijst.map(s => '<button type="button" class="gk-spel" data-spel="' + esc(s.id) + '"><img src="' + esc(spelIcoon(s)) + '" alt=""><span><b>' + esc(T(s.naam[0]))
        + '</b><br><small>' + esc(T('{n} tot {max} spelers', { n: 2, max: Math.min(MAX, s.max || 2) })) + '</small></span></button>').join('') : '<p>' + esc(T('Er zijn nog geen spellen voor een groep.')) + '</p>')
      + '<div class="gk-rij"><button type="button" class="gk-knop gk-annuleer">' + esc(T('Annuleren')) + '</button></div>')
    l.querySelector('.gk-annuleer').onclick = sluitLaag
    for (const b of l.querySelectorAll('.gk-spel')) b.onclick = () => open(b.dataset.spel)
  }
  function open(spel) {
    if (!studioSpel(spel)) return
    lobby = { sessie: nieuweSessie(), spel, host: ik, spelers: [ik], computers: 0 }
    stuur('open', { sessie: lobby.sessie, spel })
    try { meldPush?.(spel, lobby.sessie) } catch (e) { console.warn('[groepkaartspel] push', e) }
    toonLobby()
  }

  // ── 2. De uitnodiging bovenin ──
  function toonBalk(sessie) {
    const u = uitnodigingen.get(sessie); if (!u || lobby || lopend) return
    balkEl?.remove()
    balkEl = document.createElement('div'); balkEl.className = 'gk-balk'; balkEl.setAttribute('role', 'status')
    balkEl.innerHTML = '<span>🎲 ' + esc(T('{naam} wil {spel} spelen', { naam: naam(u.host), spel: T(studioSpel(u.spel).naam[0]) })) + '</span>'
      + '<button type="button" class="gk-knop gk-hoofd gk-mee">' + esc(T('Doe mee')) + '</button><button type="button" class="gk-knop gk-weg" aria-label="' + esc(T('Annuleren')) + '">✕</button>'
    balkEl.querySelector('.gk-mee').onclick = () => doeMee(sessie)
    balkEl.querySelector('.gk-weg').onclick = () => { balkEl?.remove(); balkEl = null }
    document.body.appendChild(balkEl)
  }
  function doeMee(sessie) {
    const u = uitnodigingen.get(sessie); if (!u) return
    balkEl?.remove(); balkEl = null
    lobby = { sessie, spel: u.spel, host: u.host, spelers: [u.host, ik], computers: 0 }
    stuur('mee', { sessie })
    toonLobby()
  }

  // ── 3. De wachtkamer ──
  function toonLobby() {
    if (!lobby) return
    const s = studioSpel(lobby.spel), max = Math.min(MAX, (s && s.max) || 2)
    const ikHost = lobby.host === ik, n = lobby.spelers.length + lobby.computers
    const l = laag('<h2>🎲 ' + esc(T(s.naam[0])) + ' · ' + esc(T('Wachtkamer')) + '</h2>'
      + '<p>' + esc(T('Wie doet er mee? ({n} van {max})', { n, max })) + '</p><ul class="gk-spelers">'
      + lobby.spelers.map(id => '<li data-id="' + esc(id) + '">' + (id === lobby.host ? '👑' : '🙂') + ' ' + esc(naam(id)) + '</li>').join('')
      + Array.from({ length: lobby.computers }, (_, i) => '<li class="gk-computer">🤖 ' + esc(T('Computer {n}', { n: i + 1 })) + '</li>').join('') + '</ul>'
      + (ikHost ? '' : '<p class="gk-wacht">' + esc(T('Wachten tot {naam} start...', { naam: naam(lobby.host) })) + '</p>')
      + '<div class="gk-rij">' + (ikHost
        ? '<button type="button" class="gk-knop gk-annuleer">' + esc(T('Annuleren')) + '</button><button type="button" class="gk-knop gk-computer-erbij"' + (n >= max ? ' disabled' : '') + '>' + esc(T('🤖 Computer erbij')) + '</button>'
          + '<button type="button" class="gk-knop gk-hoofd gk-start"' + (n < 2 ? ' disabled title="' + esc(T('Minstens 2 spelers')) + '"' : '') + '>' + esc(T('▶ Start')) + '</button>'
        : '<button type="button" class="gk-knop gk-annuleer">' + esc(T('Ik doe niet mee')) + '</button>') + '</div>')
    // 26 nov 2026: Mollen meppen terwijl je wacht. De wachtkamer wordt bij elke wijziging opnieuw getekend; een lopend
    // spelletje verhuist mee. Gaat de wachtkamer dicht (het spel begint), dan stopt het vanzelf (mollenmeppen.js).
    const kaart = l.querySelector('.gk-kaart')
    if (mol && !mol.gestopt) kaart.appendChild(mol.el)
    else { mol = null; const houder = document.createElement('div'); houder.className = 'gk-mollen'; kaart.appendChild(houder); houder.addEventListener('mollen', e => { mol = e.detail }); molKnop(houder) }
    l.querySelector('.gk-annuleer').onclick = () => { stuur(ikHost ? 'dicht' : 'weg', { sessie: lobby.sessie }); lobby = null; sluitLaag() }
    if (ikHost) {
      l.querySelector('.gk-computer-erbij').onclick = () => { if (lobby.spelers.length + lobby.computers < max) { lobby.computers++; stuurLobby(); toonLobby() } }
      l.querySelector('.gk-start').onclick = start
    }
  }
  function stuurLobby() { if (lobby && lobby.host === ik) stuur('lobby', { sessie: lobby.sessie, spel: lobby.spel, spelers: lobby.spelers, computers: lobby.computers }) }

  // ── 4. Start: het spel gaat open bij iedereen die meedoet ──
  function start() {
    if (!lobby || lobby.host !== ik || lobby.spelers.length + lobby.computers < 2) return
    const rooster = [...lobby.spelers.map(id => ({ id })), ...Array.from({ length: lobby.computers }, () => ({ computer: true }))]
    stuur('start', { sessie: lobby.sessie, spel: lobby.spel, rooster })
    speel(lobby.sessie, lobby.spel, rooster)
  }
  async function speel(sessie, spel, rooster) {
    const s = studioSpel(spel); if (!s) return
    const mijnZetel = rooster.findIndex(r => r.id === ik) + 1
    if (!mijnZetel) return
    sluitLaag(); balkEl?.remove(); balkEl = null; lobby = null
    let c = 0
    const spelers = rooster.map(r => r.computer ? { naam: T('Computer {n}', { n: ++c }), computer: true } : { naam: naam(r.id), id: r.id })
    // Het spelscherm (dezelfde ids als in de chat: spelTitelBar en spelInhoud)
    const overlay = document.createElement('div'); overlay.className = 'gk-overlay spel-overlay open met-spelmenu'; overlay.id = 'spelOverlay'
    overlay.innerHTML = '<div id="spelTitelBar"></div><div id="spelInhoud"></div>'
    document.body.appendChild(overlay)
    // Het kanaal voor dit spel: het groepskanaal, met het nummer van dit spel
    const luisteraars = {}
    const spelKanaal = {
      on(_, f, fn) { (luisteraars[f && f.event] ||= []).push(fn); return spelKanaal },
      send(b) { stuur('g', { sessie, ev: b && b.event, p: b && b.payload }); return Promise.resolve('ok') },
    }
    lopend = { sessie, overlay, luisteraars, menu: null }
    lopend.menu = maakSpelMenu({ ouder: overlay, solo: false, kanPauze: () => false,
      kanMic: () => Boolean(bel && bel.kan()), micAan: () => Boolean(bel && bel.aan()), onMic: () => bel && bel.wissel(),
      onMenu: () => verberg(), onExit: () => verlaat() })
    try {
      const m = await import(spelBestand(s))
      m.start({ spelKanaal, spelers, mijnZetel })
    } catch (e) { console.error('[groepkaartspel]', e); toast(T('Het spel is gestopt.')); verlaat() }
  }
  // 🏠: terug naar de chat; het spel blijft open (een knop brengt je terug)
  function verberg() {
    if (!lopend) return
    lopend.overlay.hidden = true
    terugEl?.remove()
    terugEl = document.createElement('button'); terugEl.type = 'button'; terugEl.className = 'gk-knop gk-hoofd gk-terug'; terugEl.textContent = T('🎲 Terug naar het spel')
    terugEl.onclick = toonSpel
    document.body.appendChild(terugEl)
  }
  function toonSpel() { if (!lopend) return; lopend.overlay.hidden = false; terugEl?.remove(); terugEl = null }
  function verlaat() {
    if (!lopend) return
    const l = lopend; lopend = null
    l.menu?.weg?.(); l.overlay.remove()   // het spel merkt dat het dicht is (groepspel stuurt 'weg')
    terugEl?.remove(); terugEl = null
  }

  // ── Wat er over het groepskanaal binnenkomt (event 'gs') ──
  function ontvang(p) {
    if (!p || typeof p !== 'object' || !GELDIG.test(String(p.van)) || p.van === ik || !lid(p.van)) return
    // iemand opent net de groep (bijvoorbeeld via de pushmelding): mijn open wachtkamer nog eens laten zien
    if (p.e === 'hallo') { if (lobby && lobby.host === ik) { stuur('open', { sessie: lobby.sessie, spel: lobby.spel }); stuurLobby() } return }
    const sessie = typeof p.sessie === 'string' && /^[0-9a-z]{6,24}$/.test(p.sessie) ? p.sessie : null
    if (!sessie) return
    if (p.e === 'g') {          // spelverkeer
      if (!lopend || lopend.sessie !== sessie || typeof p.ev !== 'string') return
      for (const fn of lopend.luisteraars[p.ev] || []) { try { fn({ type: 'broadcast', event: p.ev, payload: p.p }) } catch (e) { console.error('[groepkaartspel]', e) } }
      return
    }
    if (p.e === 'open' && studioSpel(p.spel)) { uitnodigingen.set(sessie, { spel: p.spel, host: p.van }); toonBalk(sessie); return }
    if (p.e === 'dicht') {
      uitnodigingen.delete(sessie)
      if (balkEl && !lobby) { balkEl.remove(); balkEl = null }
      if (lobby && lobby.sessie === sessie && lobby.host === p.van) { lobby = null; sluitLaag() }
      return
    }
    if (!lobby || lobby.sessie !== sessie) {
      // een start van een spel waar ik in de wachtkamer zat, maar die ik (nog) niet zag: alleen als ik in het rooster sta
      if (p.e === 'start' && uitnodigingen.get(sessie)?.host === p.van && Array.isArray(p.rooster) && p.rooster.some(r => r && r.id === ik)) speel(sessie, p.spel, schoonRooster(p.rooster))
      return
    }
    const s = studioSpel(lobby.spel), max = Math.min(MAX, (s && s.max) || 2)
    if (lobby.host === ik) {
      if (p.e === 'mee' && !lobby.spelers.includes(p.van)) {
        if (lobby.spelers.length + lobby.computers >= max) { if (lobby.computers) lobby.computers--; else return }
        lobby.spelers.push(p.van); stuurLobby(); toonLobby()
      } else if (p.e === 'weg' && lobby.spelers.includes(p.van)) { lobby.spelers = lobby.spelers.filter(id => id !== p.van); stuurLobby(); toonLobby() }
    } else if (p.van === lobby.host) {
      if (p.e === 'lobby' && Array.isArray(p.spelers)) {
        lobby.spelers = p.spelers.filter(id => GELDIG.test(String(id)) && (id === ik || lid(id))).slice(0, max)
        lobby.computers = Math.max(0, Math.min(max, Number(p.computers) || 0))
        if (!lobby.spelers.includes(ik)) { toast(T('Het spel is vol.')); lobby = null; sluitLaag(); return }
        toonLobby()
      } else if (p.e === 'start' && Array.isArray(p.rooster)) speel(sessie, lobby.spel, schoonRooster(p.rooster))
    }
  }
  const schoonRooster = r => r.slice(0, MAX).map(x => x && x.computer ? { computer: true } : { id: String(x && x.id) }).filter(x => x.computer || GELDIG.test(x.id))

  const hallo = () => stuur('hallo', {})
  // 26 nov 2026: open(spel) = meteen de wachtkamer voor dat spel (groep.html?spel=..., vanaf Home via samenspelen.js)
  return { kies, open: spel => { if (!lopend && !lobby && groepSpellen().some(s => s.id === spel)) open(spel) }, ontvang, hallo, bezig: () => Boolean(lopend), _staat: () => ({ lobby, lopend: Boolean(lopend), uitnodigingen: [...uitnodigingen.keys()] }) }
}
