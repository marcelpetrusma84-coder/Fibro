// ═══════════════════════════════════════════════════
// widgets.js — Drag, resize, volgorde opslaan
// ═══════════════════════════════════════════════════

const STORAGE_KEY_HOME    = 'fibro_widgets_home'
const STORAGE_KEY_PROFIEL = 'fibro_widgets_profiel'

// ── Standaard widget definities ──
export const HOME_WIDGETS = [
  { id:'klok',        icon:'🌍', titel:'Wereldklok',       w:4, h:2, minW:2, minH:1 },
  { id:'datum',       icon:'📅', titel:'Datum',            w:2, h:1, minW:1, minH:1 },
  { id:'online',      icon:'👥', titel:'Online vrienden',  w:2, h:1, minW:2, minH:1 },
  { id:'laastbericht',icon:'💬', titel:'Laatste bericht',  w:4, h:1, minW:2, minH:1 },
  { id:'batterij',    icon:'🔋', titel:'Batterij',         w:2, h:1, minW:1, minH:1 },
  { id:'activiteit',  icon:'📊', titel:'Activiteit',       w:2, h:2, minW:2, minH:2 },
  { id:'poll',        icon:'📊', titel:'Poll',             w:4, h:3, minW:4, minH:2, aan:false },
  { id:'afteltimer',  icon:'⏳', titel:'Afteltimer',       w:4, h:2, minW:2, minH:2, aan:false },
  { id:'gastenboek',  icon:'📖', titel:'Gastenboek',       w:4, h:4, minW:4, minH:3, aan:false },
]

export const PROFIEL_WIDGETS = [
  { id:'mood',           icon:'😊', titel:'Mood',                 w:4, h:1, minW:2, minH:1 },
  { id:'muziek',         icon:'🎵', titel:'Muziek player',        w:4, h:2, minW:2, minH:2 },
  { id:'quote',          icon:'✍️', titel:'Quote',                w:4, h:1, minW:2, minH:1 },
  { id:'fotos_3x3',      icon:'📷', titel:'Foto grid 3×3',        w:4, h:3, minW:4, minH:3 },
  { id:'fotos_2x2',      icon:'🖼️', titel:'Foto grid 2×2',        w:2, h:2, minW:2, minH:2 },
  { id:'fotos_groot',    icon:'🌅', titel:'Grote foto',           w:4, h:2, minW:2, minH:2 },
  { id:'fotos_banner',   icon:'🎞️', titel:'Foto strip',           w:4, h:1, minW:4, minH:1 },
  { id:'fotos_1x3',      icon:'📸', titel:'Portret strip',        w:2, h:3, minW:2, minH:3 },
  { id:'fotos_featured', icon:'🎨', titel:'Uitgelicht + 4 klein', w:4, h:3, minW:4, minH:3 },
  { id:'fotos_masonry',  icon:'🗃️', titel:'Polaroid grid',        w:4, h:3, minW:4, minH:3 },
  { id:'fotos_zwevend',  icon:'📌', titel:'Zwevende Polaroids',   w:4, h:3, minW:4, minH:3 },
  { id:'poll',           icon:'🗳️', titel:'Poll',                 w:4, h:3, minW:4, minH:2 },
  { id:'afteltimer',     icon:'⏳', titel:'Afteltimer',           w:4, h:2, minW:2, minH:2 },
  { id:'gastenboek',     icon:'📖', titel:'Gastenboek',           w:4, h:4, minW:4, minH:3 },
]

// ── Laad opgeslagen layout of default ──
export function laadLayout(pagina) {
  const key   = pagina === 'home' ? STORAGE_KEY_HOME : STORAGE_KEY_PROFIEL
  const defs  = pagina === 'home' ? HOME_WIDGETS      : PROFIEL_WIDGETS
  try {
    const opgeslagen = JSON.parse(localStorage.getItem(key))
    if (opgeslagen && opgeslagen.length) return opgeslagen
  } catch(e) {}
  return defs.map((w, i) => ({ ...w, volgorde: i, aan: false }))
}

// ── Sla layout op ──
export function slaLayoutOp(pagina, layout) {
  const key = pagina === 'home' ? STORAGE_KEY_HOME : STORAGE_KEY_PROFIEL
  localStorage.setItem(key, JSON.stringify(layout))
}

// ── Bouw widget grid ──
export function bouwWidgetGrid(container, pagina, renderWidget) {
  const layout = laadLayout(pagina)
  const actief = layout.filter(w => w.aan).sort((a, b) => a.volgorde - b.volgorde)

  container.innerHTML = ''
  container.className = 'widget-grid'

  actief.forEach((widget, idx) => {
    const el = document.createElement('div')
    el.className = 'widget-blok'
    el.dataset.id = widget.id
    el.dataset.idx = idx
    el.style.gridColumn = `span ${widget.w}`
    el.style.gridRow    = `span ${widget.h}`

    el.innerHTML = `
      <div class="widget-header">
        <span class="widget-icon-sm">${widget.icon}</span>
        <span class="widget-titel">${widget.titel}</span>
        <div class="widget-acties">
          <button class="widget-drag-handle" title="Slepen">⠿</button>
        </div>
      </div>
      <div class="widget-inhoud" id="widget-inhoud-${widget.id}"></div>
      <div class="widget-resize-handle" title="Grootte aanpassen">◢</div>
    `
    container.appendChild(el)

    // Vul inhoud
    try { renderWidget(widget.id, el.querySelector('.widget-inhoud')) } catch(e) {}

    // Resize via drag op handle
    voegResizeToe(el, widget, pagina, layout, container, renderWidget)
  })

  // Drag & drop volgorde
  voegDragDropToe(container, pagina, layout, renderWidget)
}

// ── Resize logica ──
function voegResizeToe(el, widget, pagina, layout, container, renderWidget) {
  const handle = el.querySelector('.widget-resize-handle')
  if (!handle) return

  let startX, startY, startW, startH

  handle.addEventListener('touchstart', e => {
    e.stopPropagation()
    const t = e.touches[0]
    startX = t.clientX; startY = t.clientY
    startW = widget.w; startH = widget.h
  }, { passive: true })

  handle.addEventListener('touchmove', e => {
    e.stopPropagation()
    const t = e.touches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    // Elke ~80px = 1 kolom/rij
    const nieuwW = Math.max(widget.minW, Math.min(4, startW + Math.round(dx / 80)))
    const nieuwH = Math.max(widget.minH, Math.min(6, startH + Math.round(dy / 80)))
    el.style.gridColumn = `span ${nieuwW}`
    el.style.gridRow    = `span ${nieuwH}`
    widget.w = nieuwW; widget.h = nieuwH
  }, { passive: true })

  handle.addEventListener('touchend', e => {
    e.stopPropagation()
    const w = parseInt(el.style.gridColumn.replace('span ', '')) || widget.w
    const h = parseInt(el.style.gridRow.replace('span ', ''))    || widget.h
    widget.w = w; widget.h = h
    // Update layout opslaan
    const opgeslagen = laadLayout(pagina)
    const item = opgeslagen.find(i => i.id === widget.id)
    if (item) { item.w = w; item.h = h }
    slaLayoutOp(pagina, opgeslagen)
  }, { passive: true })

  // Desktop mouse resize ook
  handle.addEventListener('mousedown', e => {
    e.stopPropagation(); e.preventDefault()
    startX = e.clientX; startY = e.clientY
    startW = widget.w; startH = widget.h

    const onMove = ev => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const nieuwW = Math.max(widget.minW, Math.min(4, startW + Math.round(dx / 80)))
      const nieuwH = Math.max(widget.minH, Math.min(6, startH + Math.round(dy / 80)))
      el.style.gridColumn = `span ${nieuwW}`
      el.style.gridRow    = `span ${nieuwH}`
      widget.w = nieuwW; widget.h = nieuwH
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const opgeslagen = laadLayout(pagina)
      const item = opgeslagen.find(i => i.id === widget.id)
      if (item) { item.w = widget.w; item.h = widget.h }
      slaLayoutOp(pagina, opgeslagen)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

// ── Drag & drop volgorde ──
function voegDragDropToe(container, pagina, layout, renderWidget) {
  let gesleept = null, plaatshouder = null

  container.querySelectorAll('.widget-blok').forEach(blok => {
    const handle = blok.querySelector('.widget-drag-handle')

    // Touch drag
    handle.addEventListener('touchstart', e => {
      gesleept = blok
      blok.classList.add('wordt-gesleept')
      plaatshouder = document.createElement('div')
      plaatshouder.className = 'widget-plaatshouder'
      plaatshouder.style.gridColumn = blok.style.gridColumn
      plaatshouder.style.gridRow    = blok.style.gridRow
    }, { passive: true })

    handle.addEventListener('touchmove', e => {
      if (!gesleept) return
      const t = e.touches[0]
      const onder = document.elementFromPoint(t.clientX, t.clientY)
      const doelBlok = onder?.closest('.widget-blok')
      if (doelBlok && doelBlok !== gesleept) {
        const rect = doelBlok.getBoundingClientRect()
        const midden = rect.top + rect.height / 2
        if (t.clientY < midden) {
          container.insertBefore(plaatshouder, doelBlok)
        } else {
          container.insertBefore(plaatshouder, doelBlok.nextSibling)
        }
      }
    }, { passive: true })

    handle.addEventListener('touchend', () => {
      if (!gesleept || !plaatshouder) { gesleept = null; return }
      container.insertBefore(gesleept, plaatshouder)
      plaatshouder.remove()
      gesleept.classList.remove('wordt-gesleept')
      slaVolgorde(container, pagina)
      gesleept = null; plaatshouder = null
    }, { passive: true })

    // Desktop drag
    handle.addEventListener('mousedown', e => {
      e.preventDefault()
      gesleept = blok
      blok.classList.add('wordt-gesleept')

      plaatshouder = document.createElement('div')
      plaatshouder.className = 'widget-plaatshouder'
      plaatshouder.style.gridColumn = blok.style.gridColumn
      plaatshouder.style.gridRow    = blok.style.gridRow

      const onMove = ev => {
        const onder = document.elementFromPoint(ev.clientX, ev.clientY)
        const doelBlok = onder?.closest('.widget-blok')
        if (doelBlok && doelBlok !== gesleept) {
          const rect = doelBlok.getBoundingClientRect()
          if (ev.clientY < rect.top + rect.height / 2) {
            container.insertBefore(plaatshouder, doelBlok)
          } else {
            container.insertBefore(plaatshouder, doelBlok.nextSibling)
          }
        }
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        if (plaatshouder.parentNode) {
          container.insertBefore(gesleept, plaatshouder)
          plaatshouder.remove()
        }
        gesleept.classList.remove('wordt-gesleept')
        slaVolgorde(container, pagina)
        gesleept = null; plaatshouder = null
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  })
}

// ── Sla nieuwe volgorde op ──
function slaVolgorde(container, pagina) {
  const opgeslagen = laadLayout(pagina)
  const blokken = container.querySelectorAll('.widget-blok')
  blokken.forEach((blok, i) => {
    const item = opgeslagen.find(w => w.id === blok.dataset.id)
    if (item) item.volgorde = i
  })
  slaLayoutOp(pagina, opgeslagen)
}

// ── Toggle widget aan/uit ──
export function toggleWidgetAan(id, pagina) {
  const layout = laadLayout(pagina)
  const item = layout.find(w => w.id === id)
  if (item) { item.aan = !item.aan; slaLayoutOp(pagina, layout) }
  return item?.aan
}

// ── CSS injecteren ──
export function injectWidgetCSS() {
  if (document.getElementById('widget-css')) return
  const s = document.createElement('style')
  s.id = 'widget-css'
  s.textContent = `
    .widget-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 12px 14px;
    }
    .widget-blok {
      background: var(--card);
      border: 0.5px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: box-shadow 0.2s, opacity 0.2s;
      min-height: 60px;
      touch-action: pan-y;
    }
    .widget-blok.wordt-gesleept {
      opacity: 0.4;
      box-shadow: 0 0 0 2px var(--accent);
    }
    .widget-plaatshouder {
      background: rgba(192,132,252,0.12);
      border: 1.5px dashed var(--accent);
      border-radius: 14px;
      min-height: 60px;
    }
    .widget-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px 4px;
      border-bottom: 0.5px solid var(--border);
    }
    .widget-icon-sm { font-size: 14px; flex-shrink: 0; }
    .widget-titel { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; flex: 1; }
    .widget-acties { display: flex; gap: 4px; }
    .widget-drag-handle {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 16px;
      cursor: grab;
      padding: 2px 4px;
      border-radius: 6px;
      line-height: 1;
      touch-action: none;
    }
    .widget-drag-handle:active { cursor: grabbing; }
    .widget-inhoud {
      flex: 1;
      padding: 10px;
      overflow: hidden;
    }
    .widget-resize-handle {
      position: absolute;
      bottom: 3px;
      right: 5px;
      font-size: 12px;
      color: rgba(255,255,255,0.2);
      cursor: se-resize;
      touch-action: none;
      user-select: none;
      line-height: 1;
    }
    .widget-resize-handle:hover { color: var(--accent); }

    /* Beheer paneel */
    .widget-beheer-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding: 12px 14px;
    }
    .widget-beheer-item {
      background: var(--card);
      border: 0.5px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .widget-beheer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .widget-beheer-info { display: flex; align-items: center; gap: 8px; }
    .widget-beheer-icon { font-size: 20px; }
    .widget-beheer-naam { font-size: 14px; font-weight: 500; }
    .widget-beheer-hint { font-size: 11px; color: var(--muted); }
  `
  document.head.appendChild(s)
}
