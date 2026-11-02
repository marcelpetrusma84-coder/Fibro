// titelscherm.js - het titelscherm van elk spel (v5, 2 nov 2026; v4: muziek speelt door in het menu van het spel;
// v5: het spel opent in een venster op Home, zodat de muziek ook op de iPhone doorspeelt in de menu's)
// v2: openSpelMetTitel(): op Home, het profiel van een vriend en de uitnodiging komt het titelscherm al op die pagina,
//     meteen bij je tik. Zo kan de muziek ook op de iPhone meteen beginnen (geluid mag alleen tijdens een tik, en een
//     nieuwe pagina telt een tik op de vorige pagina niet mee). Na je tweede tik ga je naar het spel (spel.html?titel=1).
//
// In gewone woorden: voordat een spel opent, zie je groot de naam van het spel op een bewegend plaatje
// (titelscenes.js) met een eigen deuntje (titelmuziek.js). Eén tik (of Enter/spatie) en je bent in het menu van het spel.
// De muziek speelt daar nog even door en stopt als het spel echt begint (stopTitelMuziek) of na een minuut.
// Linksboven zit een knopje 🔊/🔇 voor de muziek; dat onthoudt Fibro.
//
// Gebruik: await toonTitelscherm({ spelId: 'breakout', naam: 'Block It', ouder: element })
//          Geeft true als je erdoor tikte, false als het scherm van buitenaf weg moest (sluitTitelscherm).
import { SCENES } from './titelscenes.js?v=4'
import { speelTitelMuziek, stopTitelMuziek, muziekAan, zetMuziek } from './titelmuziek.js?v=4'

export { stopTitelMuziek }

const vertaal = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)))
let huidig = null
let naMuziekTimer = null

// De namen zoals in de spellen (schaken in de taal van de schaakinstellingen is aan spel.html; hier Schaken/Chess)
const NAMEN = { botkaaseiren: 'Tic-Tac-Toe', vieroprij: 'Four in a Row', dammen: 'Draughts', pong: 'Neo Paddle', pacman: 'Ghost Tag',
    breakout: 'Block It', swarm: 'The Swarm', pinball: 'Twin Snakes', endlessrunner: 'Runner & Gunner', flappybird: 'Flapper', shmup: 'Neon Raiders' }
export function titelNaam(spelId) {
    if (spelId === 'schaken') return window.T && window.T.taal === 'en' ? 'Chess' : 'Schaken'
    return NAMEN[spelId] || spelId
}

// Tik op een spel (Home, profiel van een vriend, uitnodiging): eerst het titelscherm hier, dan het spel.
// v5: het spel opent in een venster óp deze pagina (spel.html?...&titel=1&ingebed=1), niet als nieuwe pagina. Zo speelt
// de muziek door in het menu van het spel, ook op de iPhone (een nieuwe pagina mag daar pas na een tik geluid maken).
// De muziek stopt als het spel echt begint (spel.html stuurt dan 'spel-begint') of als je het venster sluit.
export function openSpelMetTitel(spelId, adres) {
    if (!heeftTitelscherm(spelId)) { location.href = adres; return }
    toonTitelscherm({ spelId, naam: titelNaam(spelId) }).then(getikt => {
        if (getikt) openSpelVenster(adres + (adres.includes('?') ? '&' : '?') + 'titel=1&ingebed=1')
    })
}

let venster = null, oudeOverflow = ''
function openSpelVenster(adres) {
    sluitSpelVenster(true)
    venster = document.createElement('iframe')
    venster.className = 'fibro-spelvenster'
    venster.title = 'Fibro'
    venster.setAttribute('allow', 'autoplay; fullscreen; gyroscope; accelerometer')
    // binnen het venster kent de iPhone de inkeping van het scherm niet, dus houdt het venster daar zelf rekening mee
    venster.style.cssText = 'position:fixed;left:0;right:0;top:env(safe-area-inset-top,0px);width:100%;height:calc(100% - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border:0;margin:0;padding:0;z-index:10045;background:#08040f;'
    venster.src = adres
    document.body.appendChild(venster)
    oudeOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    try { history.pushState({ fibroSpel: true }, '') } catch (e) {}
    venster.addEventListener('load', () => { try { venster && venster.contentWindow.focus() } catch (e) {} })
}
function sluitSpelVenster(viaTerugknop) {
    if (!venster) return
    venster.remove()
    venster = null
    document.documentElement.style.overflow = oudeOverflow
    stopTitelMuziek(0.3)
    if (!viaTerugknop && history.state && history.state.fibroSpel) { try { history.back() } catch (e) {} }
}
if (typeof window !== 'undefined') {
    // de terugknop van de telefoon sluit het spelvenster
    window.addEventListener('popstate', () => { if (venster) sluitSpelVenster(true) })
    // berichten uit het spelvenster (alleen van onze eigen pagina in dat venster)
    window.addEventListener('message', (e) => {
        if (!venster || e.source !== venster.contentWindow || e.origin !== location.origin) return
        const d = e.data || {}
        if (d.fibro === 'sluit-spel') sluitSpelVenster(false)
        else if (d.fibro === 'spel-begint') stopTitelMuziek(0.8)
        else if (d.fibro === 'ga-naar' && typeof d.adres === 'string' && d.adres.startsWith('chat.html?')) location.href = d.adres
    })
}

// v4: spellen met een eigen menu na het titelscherm. Daar speelt de muziek door tot het spel echt begint (het spel
// stuurt dan 'fibro-spel-begint'). Bij de andere spellen begin je meteen te spelen, dus stopt de muziek bij de start.
const MET_MENU = ['breakout', 'swarm', 'pacman', 'pinball', 'endlessrunner', 'shmup', 'pong']
const MENU_MAX = 3 * 60 * 1000
export function spelStart(spelId) {
    if (!MET_MENU.includes(spelId)) stopTitelMuziek()
}
// Na het titelscherm op een andere pagina (Home, profiel, uitnodiging): op spel.html de muziek weer aanzetten voor het menu.
// Op de iPhone begint hij bij de eerste tik in het menu (een nieuwe pagina mag pas na een tik geluid maken).
export function menuMuziek(spelId) {
    if (!heeftTitelscherm(spelId)) return
    speelTitelMuziek(spelId)
    clearTimeout(naMuziekTimer)
    naMuziekTimer = setTimeout(() => stopTitelMuziek(2), MENU_MAX)
}

export function heeftTitelscherm(spelId) {
    return Object.prototype.hasOwnProperty.call(SCENES, spelId)
}

function laadLettertype(scene) {
    if (!scene.css) return Promise.resolve()   // een gewoon lettertype (Courier New) hoeft niet geladen
    if (!document.querySelector('link[data-titelfont="' + scene.css + '"]')) {
        const l = document.createElement('link')
        l.rel = 'stylesheet'
        l.href = 'lettertypen/' + scene.css + '.css?v=1'
        l.dataset.titelfont = scene.css
        document.head.appendChild(l)
    }
    try { return document.fonts.load('48px "' + scene.font + '"').catch(() => {}) } catch (e) { return Promise.resolve() }
}

// Weg van buitenaf (spel gesloten): geen muziek meer
export function sluitTitelscherm() {
    if (huidig) huidig(false)
    stopTitelMuziek(0.3)
}

export function toonTitelscherm({ spelId, naam, ouder }) {
    const scene = SCENES[spelId]
    if (!scene) return Promise.resolve(true)
    if (huidig) huidig(false)
    clearTimeout(naMuziekTimer)
    ouder = ouder || document.body
    laadLettertype(scene)

    const el = document.createElement('div')
    el.className = 'fibro-titelscherm'
    el.setAttribute('role', 'button')
    el.setAttribute('tabindex', '0')
    el.setAttribute('aria-label', naam + '. ' + vertaal('Tik om te beginnen'))
    el.style.cssText = 'position:fixed;inset:0;z-index:10040;background:#000;cursor:pointer;touch-action:manipulation;opacity:0;transition:opacity .35s ease;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;'
    const doek = document.createElement('canvas')
    doek.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;'
    el.appendChild(doek)
    const knop = document.createElement('button')
    knop.type = 'button'
    knop.className = 'fibro-titel-muziek'
    const zetKnop = () => {
        knop.textContent = muziekAan() ? '🔊' : '🔇'
        knop.setAttribute('aria-label', muziekAan() ? vertaal('Muziek uit') : vertaal('Muziek aan'))
    }
    zetKnop()
    knop.style.cssText = 'position:absolute;top:calc(14px + env(safe-area-inset-top));left:14px;width:42px;height:42px;border-radius:50%;border:none;background:rgba(0,0,0,0.35);color:#fff;font-size:19px;cursor:pointer;z-index:2;'
    el.appendChild(knop)
    ouder.appendChild(el)
    requestAnimationFrame(() => { el.style.opacity = '1' })

    const ctx = doek.getContext('2d')
    let b = 0, h = 0
    const maat = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        b = el.clientWidth || window.innerWidth
        h = el.clientHeight || window.innerHeight
        doek.width = Math.round(b * dpr)
        doek.height = Math.round(h * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    maat()
    window.addEventListener('resize', maat)

    const st = {}
    const begin = performance.now()
    let frame = 0
    const tekenTitel = (t) => {
        if (scene.eigenTitel) {   // v2: de titel zoals in het spel zelf
            ctx.save(); ctx.globalAlpha = glad(Math.min(1, t / 0.9)); scene.eigenTitel(ctx, b, h, t); ctx.restore()
            return tikTekst(t)
        }
        const regels = naam.length > 11 && naam.includes(' ') ? splits(naam) : [naam]
        let maatF = Math.min(b * (scene.klein ? 0.075 : 0.13), h * 0.11)
        ctx.font = maatF + 'px "' + scene.font + '", system-ui, sans-serif'
        const breedst = Math.max(...regels.map(r => ctx.measureText(r).width))
        if (breedst > b * 0.9) maatF *= (b * 0.9) / breedst
        ctx.font = maatF + 'px "' + scene.font + '", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const binnen = glad(Math.min(1, t / 0.9))
        const midY = h * 0.22 + Math.sin(t * 1.6) * 4 - (1 - binnen) * 40
        ctx.globalAlpha = binnen
        regels.forEach((r, i) => {
            const y = midY + (i - (regels.length - 1) / 2) * maatF * 1.15
            ctx.lineJoin = 'round'
            ctx.lineWidth = Math.max(4, maatF * 0.14)
            ctx.strokeStyle = scene.rand
            ctx.shadowColor = scene.gloed
            ctx.shadowBlur = 18 + 8 * Math.sin(t * 2.4)
            ctx.strokeText(r, b / 2, y)
            ctx.shadowBlur = 0
            ctx.fillStyle = scene.titel
            ctx.fillText(r, b / 2, y)
        })
        tikTekst(t)
    }
    // 'Tik om te beginnen', knipperend
    const tikTekst = (t) => {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const puls = 0.75 + 0.25 * Math.sin(t * 3.4)
        ctx.globalAlpha = Math.min(1, t / 1.4) * puls
        const tm = Math.max(14, Math.min(20, b * 0.045))
        ctx.font = '700 ' + tm + 'px "DM Sans", system-ui, sans-serif'
        const tekst = vertaal('Tik om te beginnen')
        const tw = ctx.measureText(tekst).width + 36
        const ty = h * 0.92
        ctx.fillStyle = 'rgba(0,0,0,0.62)'
        rondPad(ctx, b / 2 - tw / 2, ty - tm, tw, tm * 2, tm)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillText(tekst, b / 2, ty + 1)
        ctx.globalAlpha = 1
        ctx.textBaseline = 'alphabetic'
    }
    const lus = (nu) => {
        if (!el.isConnected) return
        const t = Math.max(0, (nu - begin) / 1000)   // de tijd van het beeldje kan net voor het begin liggen
        ctx.save()
        try { scene.teken(ctx, b, h, t, st) } catch (e) { console.error('[titelscherm]', e) }
        ctx.restore()
        ctx.save()
        tekenTitel(t)
        ctx.restore()
        frame = requestAnimationFrame(lus)
    }
    frame = requestAnimationFrame(lus)

    speelTitelMuziek(spelId)

    return new Promise(klaar => {
        let weg = false
        const sluit = (getikt) => {
            if (weg) return
            weg = true
            if (huidig === sluit) huidig = null
            el.removeEventListener('click', opTik)
            document.removeEventListener('keydown', opToets, true)
            window.removeEventListener('resize', maat)
            el.style.opacity = '0'
            el.style.pointerEvents = 'none'
            setTimeout(() => { cancelAnimationFrame(frame); el.remove() }, 380)
            if (getikt) {
                // v4: de muziek speelt door in het menu van het spel, hooguit drie minuten
                naMuziekTimer = setTimeout(() => stopTitelMuziek(2), MENU_MAX)
            }
            klaar(getikt)
        }
        const opTik = (e) => {
            if (e.target === knop) return
            sluit(true)
        }
        const opToets = (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                sluit(true)
            }
        }
        knop.addEventListener('click', (e) => {
            e.stopPropagation()
            const aan = !muziekAan()
            zetMuziek(aan)
            if (aan) speelTitelMuziek(spelId)
            zetKnop()
        })
        el.addEventListener('click', opTik)
        document.addEventListener('keydown', opToets, true)
        huidig = sluit
        el.focus({ preventScroll: true })
    })
}

function splits(naam) {
    const w = naam.split(' ')
    let beste = [naam], verschil = Infinity
    for (let i = 1; i < w.length; i++) {
        const a = w.slice(0, i).join(' '), z = w.slice(i).join(' ')
        if (Math.abs(a.length - z.length) < verschil) { verschil = Math.abs(a.length - z.length); beste = [a, z] }
    }
    return beste
}
const glad = x => x * x * (3 - 2 * x)
function rondPad(ctx, x, y, b, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + b, y, x + b, y + h, r)
    ctx.arcTo(x + b, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + b, y, r)
    ctx.closePath()
}
