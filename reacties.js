import { kiesAntwoordOp } from './reply.js?v=54'
let _ctx = null

export function initReacties(ctx){ _ctx = ctx }

export async function haalReacties(berichtIds){
  if(!_ctx||!berichtIds||!berichtIds.length) return {}
  const { data, error } = await _ctx.supabase
    .from('reacties')
    .select('id,bericht_id,user_id,soort,inhoud')
    .in('bericht_id', berichtIds)
  if(error||!data) return {}
  const uit = {}
  for(const r of data){
    if(!uit[r.bericht_id]) uit[r.bericht_id] = []
    uit[r.bericht_id].push(r)
  }
  return uit
}

export async function leesInhoud(r){
  if(!r||!r.inhoud) return ''
  if(!String(r.inhoud).startsWith('e2e:')) return r.inhoud
  if(!_ctx) return 'onleesbaar'
  const sl = _ctx.geefSleutels()
  if(!sl||!sl.mijn||!sl.vriend) return 'onleesbaar'
  try{
    return await _ctx.ontsleutel(r.inhoud, sl.mijn, sl.vriend)
  }catch(e){
    return 'onleesbaar'
  }
}

export async function zetReactie(berichtId, soort, tekst){
  if(!_ctx) return false
  const sl = _ctx.geefSleutels()
  let inhoud = String(tekst||'').slice(0, 30)
  if(!inhoud) return false
  if(!sl||!sl.mijn||!sl.vriend){ console.warn('sleutels ontbreken'); return false }
  {
    try{ inhoud = await _ctx.versleutel(inhoud, sl.mijn, sl.vriend) }catch(e){ console.warn('versleutelen mislukt'); return false }
  }
  await verwijderReactie(berichtId)
  const { error } = await _ctx.supabase.from('reacties').insert({
    bericht_id: berichtId,
    user_id: _ctx.mijnId(),
    soort: soort,
    inhoud: inhoud
  })
  if(error){ console.warn('[reacties] insert mislukt:', error.message); return false }
  if(_ctx.herteken) _ctx.herteken()
  return true
}

export async function verwijderReactie(berichtId){
  if(!_ctx) return false
  const { error } = await _ctx.supabase.from('reacties').delete()
    .eq('bericht_id', berichtId).eq('user_id', _ctx.mijnId())
  return !error
}

const STIJL = '.reactie-menu{position:fixed;z-index:9999;background:#fff;border-radius:22px;padding:6px 10px;display:flex;gap:12px;box-shadow:0 4px 16px rgba(0,0,0,0.4)}'
  + '.reactie-menu button{background:none;border:0;font-size:22px;cursor:pointer;line-height:1}'
  + '.msg-row{user-select:none;-webkit-user-select:none;touch-action:pan-y}'
  + '.reactie-rij{display:flex;gap:4px;margin:2px 36px;flex-wrap:wrap}'
  + '.reactie-bub{background:#3d2a5c;border:0.5px solid #6b4f96;color:#ffffff;border-radius:10px;padding:2px 8px;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.5)}'

function zorgVoorStijl(){
  if(document.getElementById('reactie-stijl')) return
  const s = document.createElement('style')
  s.id = 'reactie-stijl'
  s.textContent = STIJL
  document.head.appendChild(s)
}

const EMOJIS = ['\uD83D\uDC4D','\u274C','\uD83D\uDE02','\uD83D\uDE2E','\uD83D\uDE22','\uD83D\uDD25']
let _menu = null

function sluitMenu(){
  if(_menu&&_menu.parentNode) _menu.parentNode.removeChild(_menu)
  _menu = null
}

function maakKnop(tekst, actie){
  const b = document.createElement('button')
  b.textContent = tekst
  b.addEventListener('click', (e)=>{ e.stopPropagation(); actie() })
  return b
}

function toonMenu(x, y, knoppen){
  zorgVoorStijl()
  sluitMenu()
  const m = document.createElement('div')
  m.className = 'reactie-menu'
  for(const k of knoppen) m.appendChild(k)
  document.body.appendChild(m)
  const b = m.getBoundingClientRect()
  let lx = Math.max(8, Math.min(x - b.width/2, innerWidth - b.width - 8))
  let ly = Math.max(8, y - b.height - 10)
  m.style.left = lx + 'px'
  m.style.top = ly + 'px'
  _menu = m
}

function vraagTekst(berichtId){
  sluitMenu()
  const t = prompt('Jouw reactie (max 30 tekkens):')
  if(t&&t.trim()) zetReactie(berichtId, 'tekst', t.trim())
}

function toonEmojiKiezer(x, y, id){
  const kn = EMOJIS.map(e => maakKnop(e, ()=>{ sluitMenu(); zetReactie(id, 'emoji', e) }))
  toonMenu(x, y, kn)
}

function openVoor(row, x, y){
  const id = row.dataset.mid
  if(!id) return
  const k1 = maakKnop('\uD83D\uDE03', ()=> toonEmojiKiezer(x, y, id))
  const k2 = maakKnop('\uD83D\uDCAC', ()=> vraagTekst(id))
  const k3 = maakKnop('\u21A9', ()=> { sluitMenu(); kiesAntwoordOp(id, row.dataset.mtekst || 'bericht') })
  toonMenu(x, y, [k1, k2, k3])
}

export function startLangIndrukken(c){
  if(!c) return
  c.setAttribute('data-geen-swipe', '1')
  let tm = null, sx = 0, sy = 0
  c.addEventListener('pointerdown', (e)=>{
    const r = e.target.closest && e.target.closest('[data-mid]')
    if(!r) return
    sx = e.clientX; sy = e.clientY
    clearTimeout(tm)
    tm = setTimeout(()=> openVoor(r, sx, sy), 500)
  })
  c.addEventListener('pointermove', (e)=>{
    if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy) > 6) clearTimeout(tm)
  })
  c.addEventListener('pointerup', ()=> clearTimeout(tm))
  c.addEventListener('scroll', ()=> clearTimeout(tm))
  document.addEventListener('pointerdown', (e)=>{
    if(_menu && !e.target.closest('.reactie-menu')) sluitMenu()
  }, true)
}

export async function tekenReacties(container){
  if(!container) return
  zorgVoorStijl()
  for(const oud of Array.from(container.querySelectorAll('.reactie-rij'))) oud.remove()
  const rows = Array.from(container.querySelectorAll('[data-mid]'))
  const ids = rows.map(r => r.dataset.mid).filter(Boolean)
  if(!ids.length) return
  const perBericht = await haalReacties(ids)
  for(const row of rows){
    const lijst = perBericht[row.dataset.mid]
    if(!lijst || !lijst.length) continue
    const rij = document.createElement('div')
    rij.className = 'reactie-rij'
    if(row.classList.contains('out')) rij.style.justifyContent = 'flex-end'
    for(const r of lijst){
      const bub = document.createElement('span')
      bub.className = 'reactie-bub'
      bub.textContent = await leesInhoud(r)
      rij.appendChild(bub)
    }
    row.insertAdjacentElement('afterend', rij)
  }
}
