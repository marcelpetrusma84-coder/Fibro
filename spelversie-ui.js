import { versieLabel } from './spelversie-data.js?v=5'

const mounted = new WeakMap()
const labels = {
  nl:{ group:'Versiehistorie', latest:'Laatste update', current:'Actueel', history:'Historie', newer:'Nieuwere versie', older:'Oudere versie', restore:'Toon de huidige versie', unknown:'Datum onbekend', first:'Begin registratie', noPrevious:'Geen eerdere update', unknownGap:'Tussenpoos onbekend', sameDay:'Minder dan 1 dag na vorige', days:n=>`+${n} ${n === 1 ? 'dag' : 'dagen'} na vorige`, viewing:(version,current)=>`Historie ${version}; de speelbare versie is ${current}` },
  en:{ group:'Version history', latest:'Latest update', current:'Current', history:'History', newer:'Newer version', older:'Older version', restore:'Show the current version', unknown:'Date unknown', first:'First recorded version', noPrevious:'No earlier update', unknownGap:'Update interval unknown', sameDay:'Less than 1 day after previous', days:n=>`+${n} ${n === 1 ? 'day' : 'days'} after previous`, viewing:(version,current)=>`History ${version}; the playable version is ${current}` },
}
const validDate = value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? new Date(value) : null

export function dagenTussenVersies(current, previous) {
  const newer = validDate(current?.updatedAt), older = validDate(previous?.updatedAt)
  if (!newer || !older || newer < older) return null
  return Math.floor((newer - older) / 86_400_000)
}

const STYLES = `
.spelversie-controller{display:block;flex:none;min-width:0;max-width:100%;margin:0;padding:0;border:0;background:none;white-space:normal;text-align:left;text-transform:none;letter-spacing:normal}
.sv-shell{display:grid;grid-template-columns:minmax(0,1fr) 28px;column-gap:7px;align-items:center;box-sizing:border-box;width:100%;min-width:0;max-width:210px;padding:7px 7px 7px 10px;border:1px solid #d8ddff42;border-radius:11px;background:radial-gradient(ellipse at 0 0,#d9d7ff14,transparent 70%),linear-gradient(145deg,#312845e8,#191927e8);color:#f4f3ff;box-shadow:0 2px 0 #0b0b1b,0 5px 11px #0003,inset 0 1px #fff2;font:500 10px/1.35 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums;isolation:isolate}
.sv-content{display:grid;gap:2px;min-width:0}
.sv-heading{display:flex;flex-wrap:wrap;align-items:center;gap:2px 7px;min-width:0}
.sv-version{display:inline-flex;align-items:center;justify-content:flex-start;min-height:22px;margin:0;padding:0;border:0;background:none;color:#fff;font:800 14px/1.2 system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.02em;text-transform:none;cursor:pointer;white-space:nowrap}
.sv-version:disabled{opacity:1;color:#fff;cursor:default}
.sv-state{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#a7efd8;font-size:8px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.sv-shell[data-history="true"] .sv-state{color:#ffe2a7}
.sv-date,.sv-gap,.sv-context{display:block;min-width:0;white-space:normal;overflow-wrap:anywhere}
.sv-date{color:#e0dbe9;font-size:10px}
.sv-gap{color:#bbb5ca;font-size:9px}
.sv-context{color:#c9e8e2;font-size:9px;min-height:12px}
.sv-shell[data-history="false"] .sv-context{display:none}
.sv-controls{display:grid;gap:3px;align-self:stretch;align-content:center}
.sv-arrow{display:grid;place-items:center;box-sizing:border-box;width:28px;height:28px;min-width:28px;min-height:28px;margin:0;padding:0;border:1px solid #d8ddff36;border-radius:7px;background:linear-gradient(145deg,#ffffff18,#ffffff07);color:#f1efff;box-shadow:inset 0 1px #ffffff20,0 2px 3px #0003;cursor:pointer;touch-action:manipulation}
.sv-arrow:disabled{opacity:.23;cursor:default;box-shadow:none}
.sv-chevron{display:block;width:6px;height:6px;border-top:1.5px solid currentColor;border-left:1.5px solid currentColor;transform:translateY(2px) rotate(45deg);pointer-events:none}
.sv-arrow-down .sv-chevron{transform:translateY(-2px) rotate(225deg)}
.sv-arrow:focus-visible,.sv-version:focus-visible{outline:2px solid #a5ffe0;outline-offset:3px}
.sv-arrow:active:not(:disabled){transform:translateY(1px);box-shadow:inset 0 2px 4px #0004}
@media(hover:hover){.sv-arrow:hover:not(:disabled){border-color:#b7ffe2a8;background:linear-gradient(145deg,#86e4c332,#ffffff0b)}.sv-version:hover:not(:disabled){color:#b9ffe2}}
@media(pointer:coarse){.sv-shell{grid-template-columns:minmax(0,1fr) 32px}.sv-arrow{width:32px;height:32px;min-width:32px;min-height:32px}}
@media(prefers-reduced-motion:reduce){.sv-arrow:active:not(:disabled){transform:none}}
`

function installStyle(doc) {
  if (doc.getElementById?.('spelversie-ui-style')) return
  const style = doc.createElement('style')
  style.id = 'spelversie-ui-style'; style.textContent = STYLES
  ;(doc.head || doc.documentElement).append(style)
}

function recordsFor(options) {
  const records = [], seen = new Set()
  for (const record of Array.isArray(options.history) ? options.history : []) {
    if (!record || typeof record.version !== 'string' || !/^\d+\.\d+(?:\.\d+)?(?:-[\da-z.-]+)?$/i.test(record.version) || seen.has(record.version)) continue
    seen.add(record.version); records.push({ ...record })
  }
  const current = String(options.currentVersion || records[0]?.version || '')
  if (current && !seen.has(current)) records.unshift({ version:current, updatedAt:null })
  return { records, current }
}

export function mountSpelVersie(element, options = {}) {
  if (!element?.ownerDocument?.createElement) throw new TypeError('A version history needs a DOM element.')
  mounted.get(element)?.destroy()
  const doc = element.ownerDocument
  installStyle(doc)
  const original = {
    nodes:[...element.childNodes], hidden:element.hidden,
    hadClass:element.classList.contains('spelversie-controller'),
    attributes:new Map(['role','aria-label','lang'].map(name=>[name,element.getAttribute(name)])),
  }
  let settings = { ...options }, records = [], current = '', index = 0, destroyed = false
  const cleanups = []
  const make = (tag, className) => { const node = doc.createElement(tag); if (className) node.className = className; return node }
  const shell = make('span','sv-shell'), content = make('span','sv-content'), heading = make('span','sv-heading')
  const version = make('button','sv-version'), state = make('span','sv-state'), date = make('time','sv-date')
  const gap = make('span','sv-gap'), context = make('span','sv-context'), controls = make('span','sv-controls')
  const newer = make('button','sv-arrow sv-arrow-up'), older = make('button','sv-arrow sv-arrow-down')
  for (const button of [version,newer,older]) button.type = 'button'
  for (const button of [newer,older]) { const icon=make('span','sv-chevron'); icon.setAttribute('aria-hidden','true'); button.append(icon) }
  heading.append(version,state); content.append(heading,date,gap,context); controls.append(newer,older); shell.append(content,controls)
  element.replaceChildren(shell); element.classList.add('spelversie-controller'); element.setAttribute('role','group')
  content.setAttribute('aria-live','polite'); content.setAttribute('aria-atomic','true')
  function listen(target, type, fn) { target.addEventListener(type,fn); cleanups.push(()=>target.removeEventListener(type,fn)) }
  function stop(event) { event.stopPropagation() }
  // The surrounding card launches a game. Browsing release metadata must never
  // bubble a click or keyboard activation into that independent play action.
  listen(element,'click',stop)
  listen(element,'dblclick',stop)
  listen(element,'keydown',event=>{
    stop(event)
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
    else if (event.key === 'Home') { event.preventDefault(); goCurrent() }
  })
  listen(element,'keyup',stop)
  listen(newer,'click',event=>{event.preventDefault();move(-1)})
  listen(older,'click',event=>{event.preventDefault();move(1)})
  listen(version,'click',event=>{event.preventDefault();goCurrent()})

  function goCurrent() { if (destroyed) return; index=Math.max(0,records.findIndex(record=>record.version===current)); render() }
  function move(direction) { if (destroyed) return; index=Math.max(0,Math.min(records.length-1,index+direction)); render() }
  function render() {
    const language = settings.language === 'en' ? 'en' : 'nl', text = labels[language]
    element.setAttribute('lang',language)
    element.setAttribute('aria-label',text.group+(settings.game ? ': '+settings.game : ''))
    element.hidden = records.length === 0
    if (!records.length) return
    const record = records[index], previous = records[index+1], isCurrent = record.version === current
    const display = versieLabel(record.version), currentDisplay = versieLabel(current), timestamp = validDate(record.updatedAt)
    const focused=doc.activeElement
    shell.setAttribute('data-history',String(!isCurrent))
    version.textContent=display; version.disabled=isCurrent; version.title=isCurrent ? `${text.current}: ${display}` : text.restore
    version.setAttribute('aria-label',isCurrent ? `${text.current}: ${display}` : `${text.restore}: ${currentDisplay}. ${text.viewing(display,currentDisplay)}`)
    state.textContent=isCurrent ? text.current : text.history
    context.textContent=isCurrent ? text.latest : `${text.current}: ${currentDisplay}`
    newer.disabled=index===0; older.disabled=index>=records.length-1
    if(focused===older&&older.disabled&&!newer.disabled)newer.focus?.({preventScroll:true})
    else if(((focused===newer&&newer.disabled)||(focused===version&&version.disabled))&&!older.disabled)older.focus?.({preventScroll:true})
    newer.setAttribute('aria-label',text.newer); newer.title=text.newer
    older.setAttribute('aria-label',text.older); older.title=text.older
    if (timestamp) {
      const locale=language==='en'?'en-GB':'nl-NL'
      const format={day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(settings.timeZone?{timeZone:settings.timeZone}:{})}
      date.textContent=new Intl.DateTimeFormat(locale,format).format(timestamp)
      date.setAttribute('datetime',timestamp.toISOString())
      date.title=new Intl.DateTimeFormat(locale,{dateStyle:'full',timeStyle:'long',...(settings.timeZone?{timeZone:settings.timeZone}:{})}).format(timestamp)
    } else { date.textContent=text.unknown; date.removeAttribute('datetime'); date.title=text.unknown }
    const days=dagenTussenVersies(record,previous)
    gap.textContent=record.firstRecorded ? text.first : days===null ? (previous ? text.unknownGap : text.noPrevious) : days===0 ? text.sameDay : text.days(days)
    gap.title=gap.textContent
    shell.title=(language==='en' ? record.summaryEn || record.summary : record.summary) || ''
  }

  const api = {
    update(next = {}) {
      if (destroyed) return api
      const selected=records[index]?.version, wasCurrent=!selected||selected===current
      settings={...settings,...next}
      ;({records,current}=recordsFor(settings))
      const preserve=wasCurrent ? records.findIndex(record=>record.version===current) : records.findIndex(record=>record.version===selected)
      index=Math.max(0,preserve); render(); return api
    },
    destroy() {
      if (destroyed) return
      destroyed=true
      while(cleanups.length)cleanups.pop()()
      element.replaceChildren(...original.nodes); element.hidden=original.hidden
      if(!original.hadClass)element.classList.remove('spelversie-controller')
      for(const[name,value]of original.attributes){if(value===null)element.removeAttribute(name);else element.setAttribute(name,value)}
      if(mounted.get(element)===api)mounted.delete(element)
    },
    get selectedVersion(){return records[index]?.version||null},
  }
  mounted.set(element,api); api.update(); return api
}
