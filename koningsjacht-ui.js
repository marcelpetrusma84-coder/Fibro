// koningsjacht-ui.js - Koningsjacht, een kaartspel voor alleen (v1, 13 nov 2026). Op de BLAUWDRUK voor kaartspellen.
// Gebaseerd op het idee van Regicide (Badgers From Mars); de naam, de teksten en de uitwerking zijn van Stekky.
//
// In gewone woorden: de regels staan in koningsjacht.js, de tafel in kaartspel-hulp.js (met de perkamentkaarten en
// een houten tafelblad). Bovenin staat de vijand uit het kasteel, met zijn leven, zijn aanval en je schild.
// Kies kaarten en veeg ze omhoog (of tik op Aanvallen). Slaat de vijand terug, kies dan kaarten om af te werpen.
// Alleen tegen het kasteel: er is geen spelkanaal (solo.js: zonderKanaal). Het spel wordt op dit toestel bewaard,
// zodat je later verder kunt (fibro_koningsjacht_stand), net als je beste medaille per niveau (fibro_koningsjacht_best).
import * as K from './koningsjacht.js?v=1'
import { maakKaartTafel, kaartSvg, achterkantSvg, KLEUR_TEKEN, zetStijl } from './kaartspel-hulp.js?v=5'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const STIJL = 'perkament'
const BEWAAR = 'fibro_koningsjacht_stand', BESTE = 'fibro_koningsjacht_best'
const SOORT = { B: 'Boer', V: 'Vrouw', H: 'Heer' }
const KLEURNAAM = { h: 'harten', r: 'ruiten', k: 'klaveren', s: 'schoppen' }
const KLEURKLEUR = { h: '#ff6b7a', r: '#e7a8ff', k: '#86efac', s: '#93c5fd' }
const MEDAILLE = { goud: '🥇', zilver: '🥈', brons: '🥉' }
const NIVEAU_NAAM = { schildknaap: 'Schildknaap', ridder: 'Ridder', koning: 'Koning' }
const lees = (k, std) => { try { const w = localStorage.getItem(k); return w === null ? std : JSON.parse(w) } catch (e) { return std } }
const schrijf = (k, w) => { try { if (w === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(w)) } catch (e) {} }
export const vijandNaam = id => T('{soort} van {kleur}', { soort: T(SOORT[id.slice(1)]), kleur: T(KLEURNAAM[id[0]]) })

const CSS = `
.kj-start{width:100%;height:100%;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 18px 22px;box-sizing:border-box;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;
  background:radial-gradient(ellipse at 50% 40%,#0000 30%,#000a 100%),url(kaarten/hout.webp?v=1) center/cover #4a2c16}
.kj-start *{box-sizing:border-box}
.kj-titel{font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:900;letter-spacing:1px;text-shadow:0 2px 0 #3a1d08,0 0 18px #f5b30188;color:#fde68a}
.kj-uitleg{max-width:340px;font-size:14px;line-height:1.45;opacity:.92;text-shadow:0 1px 3px #000}
.kj-kaarten{display:flex;justify-content:center;margin:2px 0 6px}
.kj-kaarten>div{width:62px;height:87px;border-radius:5px;box-shadow:0 4px 12px #000a}
.kj-kaarten>div+div{margin-left:-18px}
.kj-kaarten>div:nth-child(1){transform:rotate(-12deg) translateY(6px)}.kj-kaarten>div:nth-child(3){transform:rotate(12deg) translateY(6px)}
.kj-niveaus{display:flex;flex-direction:column;gap:9px;width:100%;max-width:330px}
.kj-niveau{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;border:1px solid #f5d08a66;background:#2a1608d9;color:#fff;font:inherit;text-align:left;cursor:pointer;box-shadow:0 3px 10px #0008}
.kj-niveau:active{transform:scale(.98)}
.kj-niveau b{display:block;font-size:16px}.kj-niveau small{display:block;font-size:12px;opacity:.8}
.kj-niveau .kj-ico{font-size:26px}.kj-niveau .kj-med{margin-left:auto;font-size:22px}
.kj-knop{min-height:42px;padding:9px 16px;border-radius:12px;border:1px solid #c084fc;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 0 14px #8b3fd1aa}
.kj-knop.kj-zacht{background:#ffffff1c;border-color:#ffffff40;box-shadow:none}
.kj-bron{font-size:11px;opacity:.7;max-width:320px;text-shadow:0 1px 2px #000}
.kj-regels{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:#000b;padding:16px}
.kj-regelkaart{max-width:420px;max-height:86vh;overflow:auto;padding:18px 18px 14px;border-radius:16px;background:#f3e6c8;color:#2a1608;border:3px solid #8a5a2b;box-shadow:0 10px 40px #000;text-align:left;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.45}
.kj-regelkaart h2{margin:0 0 8px;font-size:22px;text-align:center}
.kj-regelkaart h3{margin:12px 0 4px;font-size:16px}
.kj-regelkaart p{margin:0 0 6px}.kj-regelkaart ul{margin:0 0 6px;padding-left:20px}
.kj-regelkaart .kj-knop{display:block;margin:12px auto 0;font-family:system-ui,sans-serif}
.kt-tafel.kj .kt-ander{min-height:132px;padding-top:4px;gap:14px}
.kt-tafel.kj .kt-ander>:not(.kj-vijand){display:none!important}
.kt-tafel.kj .kt-zetel-ik{display:none}
.kt-tafel.kj .kt-status{order:1;margin-top:10px}.kt-tafel.kj .kt-ander{order:0}.kt-tafel.kj .kt-midden{order:2}.kt-tafel.kj .kt-hand{order:3}.kt-tafel.kj .kt-onder{order:4}
.kj-vijand{display:flex;align-items:center;gap:12px}
.kj-kasteel{position:relative;width:46px;height:64px;flex:none}
.kj-kasteel>div{position:absolute;inset:0;border-radius:4px;box-shadow:0 1px 4px #0009}
.kj-kasteel>div:nth-child(2){transform:translate(-2px,-3px)}.kj-kasteel>div:nth-child(3){transform:translate(-4px,-6px)}
.kj-kasteel>span{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);font-size:11px;font-weight:800;white-space:nowrap;text-shadow:0 1px 3px #000}
.kj-kaart{position:relative;width:86px;height:120px;flex:none;border-radius:7%;box-shadow:0 6px 18px #000b}
.kj-kaart.kj-geraakt{animation:kjRaak .45s}
@keyframes kjRaak{0%,100%{transform:none;filter:none}20%{transform:translateX(-7px) rotate(-3deg);filter:brightness(1.6) sepia(1) hue-rotate(-50deg) saturate(4)}45%{transform:translateX(6px) rotate(2deg)}70%{transform:translateX(-3px)}}
.kj-stats{display:flex;flex-direction:column;gap:5px;min-width:126px;text-shadow:0 1px 3px #000}
.kj-naam{font-weight:800;font-size:15px;font-family:Georgia,'Times New Roman',serif}
.kj-balk{position:relative;height:17px;border-radius:9px;background:#000a;border:1px solid #ffffff55;overflow:hidden}
.kj-vul{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#991b1b,#ef4444);transition:width .55s cubic-bezier(.3,.7,.3,1)}
.kj-balk span{position:absolute;inset:0;text-align:center;font-size:11px;font-weight:800;line-height:16px}
.kj-regel{font-size:13px;font-weight:700;display:flex;gap:10px}
.kj-immuun{font-size:12px;opacity:.9}
.kj-raakgetal{position:fixed;z-index:50;font-weight:900;font-size:34px;color:#fecaca;text-shadow:0 0 10px #ef4444,0 2px 0 #450a0a;pointer-events:none;white-space:nowrap}
.kj-flits{position:absolute;inset:0;z-index:40;pointer-events:none;background:radial-gradient(ellipse at 50% 20%,#ef444466,#0000 70%)}
.kj .kt-kaart.kt-mag{box-shadow:0 2px 8px #0007}
.kj-pil{padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #f5d08a88;font-weight:800;font-size:13px}
`
function zetCss() {
  if (document.getElementById('kj-stijl')) return
  const s = document.createElement('style'); s.id = 'kj-stijl'; s.textContent = CSS; document.head.appendChild(s)
}

// De spelregels in gewone woorden (ook in het Engels via taal-en.js)
function regelsHtml() {
  const p = t => '<p>' + esc(T(t)) + '</p>'
  const li = t => '<li>' + esc(T(t)) + '</li>'
  return '<h2>👑 ' + esc(T('Koningsjacht')) + '</h2>'
    + p('Versla de 12 vijanden uit het kasteel: eerst de boeren, dan de vrouwen, dan de heren. Je speelt alleen.')
    + '<h3>⚔️ ' + esc(T('Aanvallen')) + '</h3>'
    + p('Speel een kaart: hij doet zoveel schade als erop staat (aas = 1). Samen spelen mag ook:')
    + '<ul>' + li('een aas met één andere kaart') + li('2 tot 4 kaarten met dezelfde waarde, samen niet meer dan 10') + '</ul>'
    + p('Elke soort geeft een kracht, zo sterk als je aanval:')
    + '<ul>' + li('♥ harten: kaarten van de aflegstapel gaan terug onder de taveerne') + li('♦ ruiten: pak kaarten (tot je er 8 hebt)')
    + li('♣ klaveren: dubbele schade') + li('♠ schoppen: een schild, de vijand slaat minder hard') + '</ul>'
    + p('Een vijand kan niet tegen zijn eigen soort: die kracht werkt dan niet.')
    + '<h3>🛡️ ' + esc(T('Afweren')) + '</h3>'
    + p('Daarna slaat de vijand terug. Gooi kaarten weg die samen minstens zijn aanval waard zijn (min je schild). Lukt dat niet, dan heb je verloren.')
    + p('Een boer in je hand is 10 waard, een vrouw 15, een heer 20.')
    + '<h3>👑 ' + esc(T('Verslagen')) + '</h3>'
    + p('Precies op nul? Dan komt de vijand bovenop de taveerne en vecht hij later met jou mee. Een nieuwe vijand slaat de eerste keer niet terug.')
    + '<h3>🃏 ' + esc(T('Narren')) + '</h3>'
    + p('Een nar gooit je hele hand weg en geeft je 8 nieuwe kaarten. Schildknaap: 4 narren, Ridder: 2, Koning: geen. Winnen zonder nar = goud, met 1 nar = zilver, meer = brons.')
    + p('Passen mag, maar niet twee beurten achter elkaar.')
    + '<p style="font-size:12px;opacity:.75;margin-top:10px">' + esc(T('Gebaseerd op het kaartspel Regicide van Badgers From Mars.')) + '</p>'
}
function toonRegels() {
  const d = document.createElement('div'); d.className = 'kj-regels'
  d.innerHTML = '<div class="kj-regelkaart" role="dialog" aria-modal="true">' + regelsHtml() + '<button type="button" class="kj-knop">' + esc(T('Sluiten')) + '</button></div>'
  d.querySelector('.kj-knop').onclick = () => d.remove()
  d.addEventListener('click', e => { if (e.target === d) d.remove() })
  document.body.appendChild(d)
}

export function start() {
  zetCss(); zetStijl()
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '👑 ' + T('Koningsjacht')
  let staat = null, tafel = null, selectie = [], bezig = 0, rij = Promise.resolve()
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[koningsjacht]', e)); return rij }

  // ── Het beginscherm: kies een niveau (of ga verder) ──
  function startScherm() {
    tafel = null; staat = null
    const beste = lees(BESTE, {}) || {}
    const bewaard = lees(BEWAAR, null)
    const verder = K.geldigeStand(bewaard) && !bewaard.klaar ? bewaard : null
    const niveau = (id, ico) => '<button type="button" class="kj-niveau" data-niveau="' + id + '"><span class="kj-ico">' + ico + '</span><span><b>' + esc(T(NIVEAU_NAAM[id]))
      + '</b><small>' + esc(K.NIVEAUS[id].narren ? T('{n} narren', { n: K.NIVEAUS[id].narren }) : T('Geen narren')) + '</small></span><span class="kj-med">' + (MEDAILLE[beste[id]] || '') + '</span></button>'
    inhoud.innerHTML = '<div class="kj-start">'
      + '<div class="kj-kaarten"><div>' + kaartSvg('kB', STIJL) + '</div><div>' + kaartSvg('hH', STIJL) + '</div><div>' + kaartSvg('sV', STIJL) + '</div></div>'
      + '<div class="kj-titel">' + esc(T('Koningsjacht')) + '</div>'
      + '<div class="kj-uitleg">' + esc(T('Versla de twaalf vijanden uit het kasteel. Elke soort kaart heeft een eigen kracht.')) + '</div>'
      + (verder ? '<button type="button" class="kj-knop kj-verder">▶ ' + esc(T('Verder spelen')) + ' (' + esc(T(NIVEAU_NAAM[verder.niveau])) + ', ' + verder.verslagen + '/12)</button>' : '')
      + '<div class="kj-niveaus">' + niveau('schildknaap', '🛡️') + niveau('ridder', '⚔️') + niveau('koning', '👑') + '</div>'
      + '<button type="button" class="kj-knop kj-zacht kj-regelknop">📜 ' + esc(T('Hoe speel je?')) + '</button>'
      + '<div class="kj-bron">' + esc(T('Gebaseerd op het kaartspel Regicide van Badgers From Mars.')) + '</div></div>'
    for (const b of inhoud.querySelectorAll('.kj-niveau')) b.onclick = () => speel(K.nieuwSpel({ niveau: b.dataset.niveau }), true)
    inhoud.querySelector('.kj-regelknop').onclick = toonRegels
    const v = inhoud.querySelector('.kj-verder'); if (v) v.onclick = () => speel(verder, false)
  }

  // ── De tafel ──
  function speel(s, nieuw) {
    staat = s; selectie = []
    bewaar()
    tafel = maakKaartTafel(inhoud, {
      solo: true, naamAnder: '', stijl: STIJL, ondergrond: 'hout', stapelTekst: n => T('Taveerne: {n}', { n }),
      groep: () => 'alles',                              // je mag elke kaart erbij kiezen; magSpelen beslist
      magSpelen: ids => staat.fase === 'aanval' ? K.magAanvallen(staat, ids) : K.magAfweren(staat, ids),
      onSpeel: (ids, opts) => staat.fase === 'aanval' ? valAan(ids, opts) : weerAf(ids, opts),
      onPak: () => tafel.status(T('De taveerne: met ♦ ruiten pak je hier kaarten')),
      onSelectie: ids => { selectie = ids; if (!bezig) { tekenKnoppen(); tafel.status(statusTekst()) } },
    })
    tafel.element.classList.add('kj')
    const ander = tafel.element.querySelector('.kt-ander')
    const paneel = document.createElement('div'); paneel.className = 'kj-vijand'
    paneel.innerHTML = '<div class="kj-kasteel" aria-hidden="true"><div>' + achterkantSvg(STIJL) + '</div><div>' + achterkantSvg(STIJL) + '</div><div>'
      + achterkantSvg(STIJL) + '</div><span></span></div><div class="kj-kaart"></div><div class="kj-stats"><div class="kj-naam"></div>'
      + '<div class="kj-balk"><div class="kj-vul"></div><span></span></div><div class="kj-regel"></div><div class="kj-immuun"></div></div>'
    ander.appendChild(paneel)
    if (nieuw) inRij(async () => {
      tafel.toon(beeld(staat, { mijnBeurt: false, status: T('De kaarten worden geschud...') }))
      tekenVijand({ kasteel: [], schade: 0, schild: 0 })
      await tafel.deelAnimatie({ mijnKaarten: staat.hand, anderAantal: 0, open: null })
      await nieuweVijand(staat)
      teken()
    })
    else inRij(async () => { tafel.toon(beeld(staat, { mijnBeurt: false })); tekenInfo(staat); await nieuweVijand(staat); teken() })
  }

  function bewaar() { schrijf(BEWAAR, staat && !staat.klaar ? staat : null) }
  function beeld(s, extra = {}) {
    return { hand: s.hand, anderAantal: 0, stapelAantal: s.taveerne.length, afleg: s.tafel, mijnBeurt: !s.klaar,
      speelbaar: s.klaar ? [] : s.hand, status: statusTekst(s), ...extra }
  }
  function statusTekst(s = staat) {
    if (!s || s.klaar) return ''
    if (s.fase === 'verdedig') {
      const n = K.teAfweren(s), gekozen = K.som(selectie)
      return selectie.length ? T('Afweren: {s} van {n}', { s: gekozen, n }) : T('Weer {n} af: kies kaarten die samen {n} of meer zijn', { n })
    }
    if (!selectie.length) return s.hand.length ? T('Val aan: kies kaarten en veeg ze omhoog') : T('Geen kaarten meer: pas of zet een nar in')
    const u = K.aanvalUitkomst(s, selectie)
    if (!u) return T('Samen mag alleen: een aas met één kaart, of dezelfde waarden tot 10')
    const delen = [T('{n} schade', { n: u.schade })]
    if (u.werkt.includes('h')) delen.push('♥ ' + T('{n} terug', { n: Math.min(u.kracht, s.afleg.length) }))
    if (u.werkt.includes('r')) delen.push('♦ ' + T('pak {n}', { n: Math.min(u.kracht, K.MAX_HAND - (s.hand.length - selectie.length), s.taveerne.length) }))
    if (u.werkt.includes('s')) delen.push('♠ ' + T('schild {n}', { n: u.kracht }))
    if (u.immuun) delen.push(T('{k} werkt niet', { k: KLEUR_TEKEN[u.immuun] }))
    return delen.join(' · ')
  }
  function teken() {
    if (!tafel || !staat) return
    tafel.toon(beeld(staat))
    tekenVijand(staat); tekenKnoppen(); tekenInfo(staat)
  }
  function tekenKnoppen() {
    if (!tafel || !staat || staat.klaar) { tafel?.knoppen([]); return }
    const lijst = []
    if (staat.fase === 'aanval') {
      lijst.push({ naam: 'aanval', tekst: '⚔️ ' + T('Aanvallen'), nadruk: K.magAanvallen(staat, selectie), opKlik: () => valAan(selectie) })
      lijst.push({ naam: 'pas', tekst: T('Passen'), uit: !K.magPassen(staat), opKlik: pas })
    } else {
      lijst.push({ naam: 'afweer', tekst: '🛡️ ' + T('Afweren') + ' ' + K.som(selectie) + '/' + K.teAfweren(staat), nadruk: K.magAfweren(staat, selectie), opKlik: () => weerAf(selectie) })
    }
    if (staat.narren > 0) lijst.push({ naam: 'nar', tekst: '🃏 ' + T('Nar') + ' ×' + staat.narren, schud: staat.fase === 'verdedig' && K.som(staat.hand) < K.teAfweren(staat), opKlik: nar })
    lijst.push({ naam: 'regels', tekst: '📜', opKlik: toonRegels })
    tafel.knoppen(lijst)
  }
  function tekenInfo(s) {
    const pil = t => '<span class="kj-pil">' + t + '</span>'
    tafel.info(pil('👑 ' + s.verslagen + '/12') + pil('🃏 ' + s.narren) + pil('🗑️ ' + s.afleg.length))
  }
  // Het paneel bovenin: kasteel, de vijand, zijn leven, aanval, schild en waar hij niet tegen kan
  function tekenVijand(s, { kaart = true } = {}) {
    const p = tafel?.element.querySelector('.kj-vijand')
    if (!p) return
    const v = K.vijandInfo(s)
    p.querySelector('.kj-kasteel > span').textContent = T('Kasteel: {n}', { n: Math.max(0, s.kasteel.length - 1) })
    p.querySelector('.kj-kasteel').style.visibility = s.kasteel.length > 1 ? '' : 'hidden'
    const kaartEl = p.querySelector('.kj-kaart')
    if (!v) { kaartEl.innerHTML = ''; for (const c of ['.kj-naam', '.kj-regel', '.kj-immuun', '.kj-balk span']) p.querySelector(c).textContent = ''; p.querySelector('.kj-vul').style.width = '0%'; return }
    if (kaart && kaartEl.dataset.id !== v.id) { kaartEl.innerHTML = kaartSvg(v.id, STIJL); kaartEl.dataset.id = v.id }
    p.querySelector('.kj-naam').textContent = vijandNaam(v.id)
    p.querySelector('.kj-vul').style.width = (100 * v.over / v.leven) + '%'
    p.querySelector('.kj-balk span').textContent = '❤ ' + v.over + ' / ' + v.leven
    p.querySelector('.kj-regel').innerHTML = '<span>⚔️ ' + v.slag + (s.schild ? ' <s style="opacity:.6">' + v.aanval + '</s>' : '') + '</span>' + (s.schild ? '<span>🛡️ ' + s.schild + '</span>' : '')
    const im = p.querySelector('.kj-immuun')
    im.innerHTML = esc(T('Immuun voor')) + ' <b style="color:' + KLEURKLEUR[v.kleur] + '">' + KLEUR_TEKEN[v.kleur] + '</b>'
    p.setAttribute('aria-label', vijandNaam(v.id) + ': ' + v.over + '/' + v.leven)
  }
  const vijandKaart = () => tafel.element.querySelector('.kj-kaart')

  // ── Animaties van de vijand ──
  async function nieuweVijand(s) {
    tekenVijand(s)
    const k = vijandKaart()
    if (!k || !K.vijand(s)) return
    tafel.geluid.speciaal?.()
    try { await k.animate([{ transform: 'translateY(-90px) rotate(-14deg) scale(.6)', opacity: 0 }, { transform: 'translateY(6px) rotate(3deg) scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished } catch (e) {}
  }
  async function raak(schade, dubbel) {
    const k = vijandKaart()
    if (!k) return
    k.classList.remove('kj-geraakt'); void k.offsetWidth; k.classList.add('kj-geraakt')
    tafel.tril([20, 30, 20]); tafel.geluid.leg?.(1.5)
    const r = k.getBoundingClientRect()
    const g = document.createElement('div'); g.className = 'kj-raakgetal'; g.textContent = '−' + schade + (dubbel ? ' ♣×2' : '')
    g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height * 0.3) + 'px'
    document.body.appendChild(g)
    try { await g.animate([{ transform: 'translate(-50%,0) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.2)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-60px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).finished } catch (e) {}
    g.remove()
  }
  async function slaTerug(s) {
    const k = vijandKaart(), v = K.vijandInfo(s)
    if (!k || !v) return
    const f = document.createElement('div'); f.className = 'kj-flits'; tafel.element.appendChild(f)
    tafel.tril([40, 40, 60]); tafel.geluid.nee?.()
    try {
      await Promise.all([
        k.animate([{ transform: 'none' }, { transform: 'translateY(26px) scale(1.14) rotate(-4deg)', offset: 0.35 }, { transform: 'none' }], { duration: 520, easing: 'ease-in-out' }).finished,
        f.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 620 }).finished,
      ])
    } catch (e) {}
    f.remove()
    tafel.effect(T('{naam} slaat terug: {n}!', { naam: vijandNaam(v.id), n: v.slag }), { gloed: false, geluid: false })
    await wacht(500)
  }
  async function verslagen(l, oud) {
    const k = vijandKaart()
    tafel.effect(l.precies ? T('Precies raak!') : T('Verslagen!'))
    if (k) {
      const r = k.getBoundingClientRect()
      const doel = l.precies ? tafel.element.querySelector('.kt-stapel').getBoundingClientRect() : { left: r.left + 40, top: window.innerHeight + 40, width: r.width, height: r.height }
      const dx = doel.left + doel.width / 2 - (r.left + r.width / 2), dy = doel.top + doel.height / 2 - (r.top + r.height / 2)
      try { await k.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (l.precies ? 0 : 160) + 'deg) scale(' + (l.precies ? 0.85 : 0.6) + ')', opacity: l.precies ? 1 : 0 }], { duration: 650, easing: 'cubic-bezier(.5,0,.7,1)' }).finished } catch (e) {}
      k.innerHTML = ''; k.dataset.id = ''
    }
    if (l.precies) { tafel.toon(beeld(oud, { hand: tafelHand, afleg: [], stapelAantal: oud.taveerne.length + 1, mijnBeurt: false, status: T('{naam} ligt nu bovenop de taveerne', { naam: vijandNaam(l.vijand) }) })); await wacht(700) }
  }
  let tafelHand = []

  // ── Wat jij doet ──
  function valAan(ids, opts = {}) {
    if (bezig || !K.magAanvallen(staat, ids)) { if (!bezig && ids.length) tafel.status(statusTekst()); return }
    const oud = staat, nieuw = K.valAan(oud, ids), l = nieuw.laatste
    const vanRects = ids.map(id => tafel.kaartRechthoek(id))
    staat = nieuw; selectie = []; bewaar()
    inRij(async () => {
      tafel.wisSelectie(); tafel.knoppen([])
      const handNa = oud.hand.filter(id => !ids.includes(id))
      tafelHand = handNa
      tafel.toon(beeld(oud, { hand: handNa, afleg: [...oud.tafel, ...ids], mijnBeurt: false, status: '' }))
      await tafel.speelAnimatie(ids, { snelheid: opts.snelheid || 1, richting: opts.richting || { x: 0, y: -1 }, vanRects })
      if (l.immuun) { tafel.effect(T('{naam} is immuun voor {k}', { naam: vijandNaam(l.vijand), k: KLEUR_TEKEN[l.immuun] }), { gloed: false }); await wacht(650) }
      if (l.genezen) { tafel.effect('♥ ' + T('{n} kaarten terug', { n: l.genezen })); tafel.toon(beeld(oud, { hand: handNa, afleg: [...oud.tafel, ...ids], stapelAantal: oud.taveerne.length + l.genezen, mijnBeurt: false, status: '' })); await wacht(650) }
      const tussen = { kasteel: oud.kasteel, schade: Math.min(K.vijandInfo(oud).leven, oud.schade + l.schade), schild: oud.schild + l.schild }
      await Promise.all([raak(l.schade, l.werkt.includes('k')), wacht(150).then(() => tekenVijand(tussen))])
      if (l.schild) { tafel.effect('♠ ' + T('Schild {n}', { n: tussen.schild }), { gloed: false }); await wacht(600) }
      if (l.gepakt.length) {
        tafelHand = [...handNa, ...l.gepakt]
        tafel.toon(beeld(oud, { hand: tafelHand, afleg: [...oud.tafel, ...ids], stapelAantal: oud.taveerne.length + l.genezen - l.gepakt.length, mijnBeurt: false, status: '' }))
        await tafel.pakAnimatie(l.gepakt)
      }
      if (l.verslagen) {
        await verslagen(l, oud)
        tafel.toon(beeld(nieuw, { mijnBeurt: false }))
        if (!nieuw.klaar) await nieuweVijand(nieuw)
      } else if (nieuw.fase === 'verdedig') {
        tafel.toon(beeld(nieuw, { mijnBeurt: false }))
        await slaTerug(nieuw)
      } else if (l.geenSlag) { tafel.effect(T('Je schild houdt hem tegen!'), { gloed: false }); await wacht(500) }
      naZet()
    })
  }
  function pas() {
    if (bezig || !K.magPassen(staat)) return
    const nieuw = K.pas(staat)
    staat = nieuw; selectie = []; bewaar()
    inRij(async () => {
      tafel.wisSelectie(); tafel.knoppen([])
      tafel.toon(beeld(nieuw, { mijnBeurt: false, status: '' }))
      tafel.effect(T('Gepast'), { gloed: false, geluid: false }); await wacht(500)
      if (nieuw.fase === 'verdedig') await slaTerug(nieuw)
      else if (nieuw.laatste.geenSlag) { tafel.effect(T('Je schild houdt hem tegen!'), { gloed: false }); await wacht(500) }
      naZet()
    })
  }
  function weerAf(ids, opts = {}) {
    if (bezig || !K.magAfweren(staat, ids)) { if (!bezig) { tafel.status(statusTekst()); tafel.geluid.nee?.() } return }
    const oud = staat, nieuw = K.weerAf(oud, ids)
    const vanRects = ids.map(id => tafel.kaartRechthoek(id))
    staat = nieuw; selectie = []; bewaar()
    inRij(async () => {
      tafel.wisSelectie(); tafel.knoppen([])
      tafel.toon(beeld(oud, { hand: nieuw.hand, afleg: [...oud.tafel, ...ids], mijnBeurt: false, status: '' }))
      await tafel.speelAnimatie(ids, { snelheid: opts.snelheid || 0.6, richting: opts.richting || { x: 0, y: -1 }, vanRects })
      await wacht(250)
      tafel.effect('🛡️ ' + T('Afgeweerd!'), { gloed: false })
      naZet()
    })
  }
  function nar() {
    if (bezig || !K.magNar(staat)) return
    const zeker = staat.fase === 'verdedig' && K.som(staat.hand) < K.teAfweren(staat)
    const doe = () => {
      const nieuw = K.nar(staat), l = nieuw.laatste
      staat = nieuw; selectie = []; bewaar()
      inRij(async () => {
        tafel.wisSelectie(); tafel.knoppen([])
        tafel.effect('🃏 ' + T('Nar!'))
        tafel.toon(beeld(nieuw, { hand: [], mijnBeurt: false, status: '' }))
        await wacht(500)
        tafel.toon(beeld(nieuw, { mijnBeurt: false, status: '' }))
        await tafel.pakAnimatie(l.gepakt)
        naZet()
      })
    }
    if (zeker) return doe()
    tafel.kiesUit(T('Nar inzetten? Je hele hand gaat weg en je krijgt 8 nieuwe kaarten.'), [
      { html: '✔', label: T('Ja'), waarde: true, kleur: '#15803d' }, { html: '✖', label: T('Nee'), waarde: false, kleur: '#b91c1c' }])
      .then(ja => { if (ja) doe() })
  }

  function naZet() {
    teken()
    if (!staat.klaar) return
    schrijf(BEWAAR, null)
    const med = K.medaille(staat)
    if (med) { const b = lees(BESTE, {}) || {}; const volg = ['goud', 'zilver', 'brons']; if (!b[staat.niveau] || volg.indexOf(med) < volg.indexOf(b[staat.niveau])) { b[staat.niveau] = med; schrijf(BESTE, b) } }
    const v = staat.kasteel[0]
    tafel.einde({
      gewonnen: staat.gewonnen,
      titel: staat.gewonnen ? '👑 ' + T('Het kasteel is van jou!') : '💀 ' + T('Verslagen door de {naam}', { naam: v ? vijandNaam(v).toLowerCase() : '' }),
      sub: staat.gewonnen ? MEDAILLE[med] + ' ' + T('Medaille: {m}', { m: T(med) }) + ' · ' + T('Narren gebruikt: {n}', { n: staat.narrenGebruikt })
        : T('Je versloeg {n} van de 12 vijanden', { n: staat.verslagen }),
      opnieuw: startScherm,
    })
  }

  startScherm()
}
