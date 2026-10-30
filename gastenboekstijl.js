// gastenboekstijl.js (v235): het uiterlijk van het gastenboek-widget, gedeeld door Home (index.html) en het profiel
// van een vriend (vriend-profiel.html), zodat beide er precies hetzelfde uitzien.
// - Lijntjespapier: elke regel tekst is precies een lijntje hoog (REGEL), en de lijst met berichten is altijd een
//   heel aantal regels hoog. Zo staat de tekst altijd op de lijntjes.
// - Zonder lijntjes ('gastenboek_effen' aan bij Profiel > Widgets): gewoon een widget in je eigen kleuren en lettertype.
//   Profiel zet dan papier: false in de widget-indeling, die ook naar vrienden gaat (sync.js).
export const REGEL = 26 // hoogte van een lijntje, in pixels

const PAPIER = {
  tekst: '#3a3226', naam: '#33415c', klein: '#8a7f6d', tijd: '#9a8f7c', knop: '#4a5a7a', invoer: '#2f2a20',
  avatar: 'rgba(74,90,122,0.15)', scheiding: 'transparent', invoerRand: 'transparent'
}
const EFFEN = {
  tekst: 'var(--text, #f3e8ff)', naam: 'var(--accent, #c084fc)', klein: 'rgba(255,255,255,0.6)', tijd: 'rgba(255,255,255,0.5)',
  knop: 'var(--accent, #c084fc)', invoer: 'var(--text, #f3e8ff)', avatar: 'rgba(255,255,255,0.1)',
  scheiding: 'rgba(255,255,255,0.08)', invoerRand: 'rgba(255,255,255,0.15)'
}
export const kleuren = papier => (papier ? PAPIER : EFFEN)
// een lijntje per REGEL, net onder de tekst
const VOUW = 'linear-gradient(90deg,rgba(120,90,60,0.22),rgba(120,90,60,0) 22px)'
const LIJNTJES = `repeating-linear-gradient(to bottom,transparent 0 ${REGEL - 5}px,rgba(70,90,130,0.2) ${REGEL - 5}px ${REGEL - 4}px,transparent ${REGEL - 4}px ${REGEL}px)`

// Staat het gastenboek van deze gebruiker op lijntjespapier? (uit de eigen widget-indeling op dit toestel)
export function papierAan(uid) {
  try {
    const l = JSON.parse(localStorage.getItem('fibro_widgets_profiel_' + uid) || '[]')
    const gb = Array.isArray(l) ? l.find(w => w && w.id === 'gastenboek') : null
    return !(gb && gb.papier === false)
  } catch (e) { return true }
}

// De stijl van het widget zelf
export function containerStijl(papier) {
  const gemeen = ['display:flex', 'flex-direction:column', 'align-items:stretch', 'text-align:left', 'gap:0', 'position:relative', 'perspective:900px']
  if (!papier) return gemeen.concat(['color:' + EFFEN.tekst]).join(';')
  // Papier: warme ondergrond, blauwe lijntjes (een per REGEL, net onder de tekst), rode kantlijn, vouw links.
  // Boven en onder geen witruimte: dan begint het eerste lijntje precies bij de eerste regel.
  return gemeen.concat([
    'background-color:#f3ead6',
    `background-image:${LIJNTJES},${VOUW}`,
    'border-radius:4px 10px 10px 4px',
    'box-shadow:inset 3px 0 6px rgba(90,60,30,0.18),0 2px 10px rgba(0,0,0,0.35)',
    'font-family:Georgia,"Iowan Old Style","Times New Roman",serif',
    'color:' + PAPIER.tekst,
    `padding:0 14px 0 26px`
  ]).join(';')
}

// Het binnenwerk: kantlijn (alleen papier), de lijst, de bladerknoppen en het invoervak
export function binnenHtml({ papier, lijstId, navId, invoerId, knopId, plaatsHouder, plaatsenTitel }) {
  const k = kleuren(papier)
  const rij = `height:${REGEL}px;line-height:${REGEL}px`
  return `
    ${papier ? '<div style="position:absolute;top:0;bottom:0;left:18px;width:1px;background:rgba(170,60,60,0.35);z-index:1;pointer-events:none"></div>' : ''}
    <div id="${lijstId}" class="gb-blad" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin${papier ? `;margin:0 -14px 0 -26px;padding:0 14px 0 26px;background-color:#f3ead6;background-image:${LIJNTJES},${VOUW};background-attachment:local,local;box-shadow:inset 3px 0 6px rgba(90,60,30,0.18);border-radius:4px 10px 0 0` : ''}"></div>
    <div id="${navId}" style="display:flex;align-items:center;gap:8px;font-size:12px;color:${k.klein};${rij};flex-shrink:0"></div>
    <div style="display:flex;align-items:center;gap:8px;${rij};flex-shrink:0;border-top:1px solid ${k.invoerRand};box-sizing:${papier ? 'border-box' : 'content-box'}">
      <input id="${invoerId}" maxlength="300" placeholder="${plaatsHouder}" style="flex:1;min-width:0;background:transparent;border:0;outline:0;font-family:inherit;font-size:14px;color:${k.invoer};padding:0;height:${REGEL - 2}px;line-height:${REGEL - 2}px">
      <button id="${knopId}" title="${plaatsenTitel}" style="background:transparent;border:0;cursor:pointer;font-size:17px;line-height:1;color:${k.knop};padding:2px 4px">✒</button>
    </div>`
}

// Een bericht: een regel met foto, naam en tijd, daaronder de tekst (elke regel precies een lijntje hoog)
export function berichtHtml({ papier, avSrc, avTekst, naam, tijd, tekst }) {
  const k = kleuren(papier)
  const av = avSrc
    ? `<img src="${avSrc}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;${papier ? 'filter:sepia(0.25)' : ''}">`
    : `<div style="width:22px;height:22px;border-radius:50%;background:${k.avatar};display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0">${avTekst}</div>`
  const rand = papier ? '' : `padding:4px 0;border-bottom:1px solid ${k.scheiding};`
  return `<div style="${rand}">
      <div style="display:flex;align-items:center;gap:7px;height:${REGEL}px">
        ${av}
        <span style="font-size:13px;font-weight:700;color:${k.naam};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${naam}</span>
        <span style="font-size:11px;color:${k.tijd};margin-left:auto;white-space:nowrap">${tijd}</span>
      </div>
      <div style="font-size:14px;line-height:${REGEL}px;word-break:break-word;padding-left:29px">${tekst}</div>
    </div>`
}

export function leegHtml(papier, tekst) {
  return `<div style="font-size:14px;font-style:italic;color:${kleuren(papier).klein};line-height:${REGEL}px;padding:0 4px">${tekst}</div>`
}

export function bladerKnopStijl(papier, uit) {
  return `background:transparent;border:0;font-family:inherit;font-size:16px;line-height:1;padding:2px 6px;color:${kleuren(papier).knop};cursor:${uit ? 'default' : 'pointer'};opacity:${uit ? 0.25 : 1}`
}

// De lijst altijd een heel aantal lijntjes hoog maken (ook als het widget groter of kleiner wordt).
// Past een bladzijde niet, dan kun je in de lijst scrollen; de lijntjes van de lijst scrollen mee (background-attachment:
// local), zodat de tekst ook dan op de lijntjes blijft. Geeft een functie terug om het opnieuw te doen (bijvoorbeeld
// als de bladerknoppen verschijnen); pas(true) zet de lijst ook weer bovenaan (een nieuwe bladzijde).
// Zonder lijntjes (papier = false) vult de lijst gewoon de ruimte.
export function houdOpDeLijntjes(c, lijst, nav, papier = true) {
  const pas = (bovenaan) => {
    if (!c.isConnected) return
    if (bovenaan === true) lijst.scrollTop = 0
    const nh = nav && nav.innerHTML.trim() ? REGEL : 0
    if (nav) nav.style.height = nh + 'px'
    if (!papier) return
    const cs = getComputedStyle(c)
    const binnen = c.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0)
    const rest = binnen - nh - REGEL // onderaan het invoervak
    const regels = Math.max(1, Math.floor(rest / REGEL))
    lijst.style.flex = 'none'
    lijst.style.height = regels * REGEL + 'px'
  }
  try { new ResizeObserver(() => pas()).observe(c) } catch (e) {}
  pas()
  return pas
}
