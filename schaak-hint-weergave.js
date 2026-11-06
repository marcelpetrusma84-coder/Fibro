const SVG_NS = 'http://www.w3.org/2000/svg'
const validSquare = square => Array.isArray(square) && square.length === 2 && square.every(value => Number.isInteger(value) && value >= 0 && value < 8)
const validPiece = piece => typeof piece === 'string' && /^[wz][PNBRQK]$/.test(piece)
const text = value => typeof value === 'string' ? value : ''

// This view owns drawings and explanatory text only. It never changes a piece,
// chooses a move, or communicates with the game engine or its opponent.
export function maakHintWeergave({ board, panel, playerColor = 'w', stukSVG,
  t = (key, values = {}) => key.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match),
  reducedMotion = false, documentTarget = board?.ownerDocument || globalThis.document, onClose,
} = {}) {
  const doc = documentTarget
  if (!board?.querySelector || !panel?.querySelector || !doc?.createElement) throw new TypeError('Hint view needs a board, panel, and document.')
  const move = panel.querySelector('[data-hint-move]'), reasons = panel.querySelector('[data-hint-reasons]')
  const meta = panel.querySelector('[data-hint-meta]'), replay = panel.querySelector('[data-hint-replay]'), close = panel.querySelector('[data-hint-close]')
  const cleanups = []
  let disposed = false, model = null, arrow = null, destination = null, destinationWasHighlighted = false
  let ghost = null, animation = null

  function listen(target, type, handler) {
    if (!target?.addEventListener) return
    target.addEventListener(type,handler); cleanups.push(()=>target.removeEventListener(type,handler))
  }
  function motionReduced() {
    try { const preference=typeof reducedMotion==='function'?reducedMotion():reducedMotion; return preference===true||preference?.matches===true } catch { return true }
  }
  function translate(key, values) {
    try { return String(t(key,values)) } catch { return key }
  }
  function normalize(input) {
    if (!input || !validSquare(input.from) || !validSquare(input.to) || !validPiece(input.piece) || input.from.every((value,index)=>value===input.to[index])) return null
    const entries = []
    for (const reason of Array.isArray(input.reasons) ? input.reasons.slice(0,8) : []) {
      if (typeof reason?.key !== 'string' || !reason.key) continue
      const values = {}
      for (const [name,value] of Object.entries(reason.values && typeof reason.values === 'object' && !Array.isArray(reason.values) ? reason.values : {})) {
        if (/^[a-zA-Z0-9_]+$/.test(name) && (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value))) values[name] = value
      }
      entries.push({ key:reason.key.slice(0,500), values })
    }
    return { from:input.from.slice(), to:input.to.slice(), piece:input.piece,
      moveLabel:text(input.moveLabel).slice(0,500), reasons:entries, meta:text(input.meta).slice(0,2000) }
  }
  function square(position) { return board.querySelector(`[data-r="${position[0]}"][data-k="${position[1]}"]`) }
  function display(position) { return playerColor === 'z' ? [7-position[0],7-position[1]] : position }
  function svgElement(tag, attributes = {}) {
    const node = doc.createElementNS ? doc.createElementNS(SVG_NS,tag) : doc.createElement(tag)
    for (const [name,value] of Object.entries(attributes)) node.setAttribute(name,String(value))
    return node
  }
  function stopGhost() {
    const previous = animation; animation = null
    try { previous?.cancel?.() } catch { /* cleanup still removes the owned copy */ }
    ghost?.remove(); ghost = null
  }
  function removeDrawings() {
    stopGhost(); arrow?.remove(); arrow = null
    if (destination && !destinationWasHighlighted) destination.classList.remove('sch-hint-destination')
    destination = null; destinationWasHighlighted = false
  }
  function drawArrow(current) {
    const [fromRow,fromColumn] = display(current.from), [toRow,toColumn] = display(current.to)
    const sx=(fromColumn+.5)*100, sy=(fromRow+.5)*100, tx=(toColumn+.5)*100, ty=(toRow+.5)*100
    const length=Math.hypot(tx-sx,ty-sy), ux=(tx-sx)/length, uy=(ty-sy)/length
    const startX=sx+ux*27, startY=sy+uy*27, tipX=tx-ux*17, tipY=ty-uy*17
    const baseX=tipX-ux*31, baseY=tipY-uy*31
    const path=`M ${startX} ${startY} L ${baseX} ${baseY}`
    arrow=svgElement('svg',{viewBox:'0 0 800 800',class:'sch-hint-route','aria-hidden':'true',focusable:'false'})
    for (const [stroke,width] of [['#07101e',20],['#ffffff',12],['#67e8f9',6]]) arrow.append(svgElement('path',{d:path,fill:'none',stroke,'stroke-width':width,'stroke-linecap':'round'}))
    const points=`${tipX},${tipY} ${baseX-uy*18},${baseY+ux*18} ${baseX+uy*18},${baseY-ux*18}`
    arrow.append(svgElement('polygon',{points,fill:'#67e8f9',stroke:'#07101e','stroke-width':8,'stroke-linejoin':'round'}))
    arrow.append(svgElement('polygon',{points,fill:'none',stroke:'#ffffff','stroke-width':3,'stroke-linejoin':'round'}))
    board.append(arrow)
    destination=square(current.to); destinationWasHighlighted=destination.classList.contains('sch-hint-destination')
    destination.classList.add('sch-hint-destination')
  }
  function safeSourceSvg(current) {
    const svg=square(current.from)?.querySelector('.sch-stuk')?.querySelector('svg')
    if (!svg?.cloneNode || !svg.classList?.contains('sch-figuur') || !svg.classList.contains('sch-type-'+current.piece[1]) ||
      !svg.classList.contains(current.piece[0]==='w'?'sch-ivoor':'sch-ebben')) return null
    // Clone the existing repository artwork, never markup from a renderer or
    // hint payload. Reject active/link-bearing DOM even if a foreign caller
    // has replaced the source SVG after the board was rendered.
    const allowedTags=new Set(['svg','g','path','circle'])
    const allowedAttributes=new Set(['viewbox','aria-hidden','focusable','class','fill','stroke','stroke-width','stroke-linejoin','stroke-linecap','d','cx','cy','r','xmlns'])
    for (const node of [svg,...svg.querySelectorAll('*')]) {
      if (!allowedTags.has(String(node.tagName).toLowerCase())) return null
      for (const attribute of Array.from(node.attributes || [])) {
        const name=attribute.name.toLowerCase(),value=attribute.value
        if (!allowedAttributes.has(name) || /(?:url\s*\(|javascript\s*:|data\s*:|https?\s*:|[<>])/i.test(value) && !(name==='xmlns'&&value===SVG_NS)) return null
      }
    }
    return svg
  }
  function demonstrate() {
    stopGhost()
    if (disposed || !model || motionReduced()) return false
    const sourceSvg=safeSourceSvg(model)
    if (!sourceSvg) return false
    const [fromRow,fromColumn]=display(model.from),[toRow,toColumn]=display(model.to)
    const copy=doc.createElement('span'); copy.className='sch-hint-ghost'; copy.setAttribute('aria-hidden','true')
    copy.style.setProperty('left',fromColumn*12.5+'%'); copy.style.setProperty('top',fromRow*12.5+'%')
    const piece=doc.createElement('span'); piece.className='sch-stuk'; piece.append(sourceSvg.cloneNode(true)); copy.append(piece)
    board.append(copy); ghost=copy
    if (typeof copy.animate!=='function') { stopGhost(); return false }
    const x=(toColumn-fromColumn)*100,y=(toRow-fromRow)*100
    try {
      const running=copy.animate([
        {transform:'translate(0%,0%) scale(.9)',opacity:.2,offset:0},
        {transform:`translate(${x*.12}%,${y*.12}%) scale(1.12)`,opacity:.95,offset:.16},
        {transform:`translate(${x}%,${y}%) scale(1.05)`,opacity:.95,offset:.82},
        {transform:`translate(${x}%,${y}%) scale(1)`,opacity:0,offset:1},
      ],{duration:1000,easing:'cubic-bezier(.3,.05,.25,1)',fill:'forwards'})
      animation=running
      const finish=()=>{if(animation===running){animation=null;copy.remove();if(ghost===copy)ghost=null}}
      Promise.resolve(running.finished).then(finish,finish)
      return true
    } catch { stopGhost(); return false }
  }
  function clear() {
    model=null; removeDrawings(); panel.hidden=true
    if (move) move.textContent=''
    if (meta) meta.textContent=''
    reasons?.replaceChildren()
    if (replay) replay.disabled=true
  }
  function show(input,{animate=false,reveal=false}={}) {
    if (disposed) return false
    const current=normalize(input)
    if (!current || board.isConnected===false || !square(current.from) || !square(current.to)) { clear(); return false }
    removeDrawings(); model=current; drawArrow(current)
    if(move)move.textContent=current.moveLabel
    if(meta)meta.textContent=current.meta
    reasons?.replaceChildren()
    if(reasons)for(const reason of current.reasons){const item=doc.createElement('li');item.textContent=translate(reason.key,reason.values);reasons.append(item)}
    panel.hidden=false
    if(replay)replay.disabled=false
    if(animate)demonstrate()
    if(reveal)panel.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:motionReduced()?'auto':'smooth'})
    return true
  }
  listen(replay,'click',()=>{if(!disposed&&model)demonstrate()})
  listen(close,'click',()=>{if(disposed||!model)return;clear();onClose?.()})
  listen(reducedMotion,'change',()=>{if(motionReduced())stopGhost()})
  clear()
  return {show,clear,destroy(){if(disposed)return;clear();disposed=true;while(cleanups.length)cleanups.pop()()}}
}
