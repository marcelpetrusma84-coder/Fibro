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
  if(sl&&sl.mijn&&sl.vriend){
    try{ inhoud = await _ctx.versleutel(inhoud, sl.mijn, sl.vriend) }catch(e){}
  }
  await verwijderReactie(berichtId)
  const { error } = await _ctx.supabase.from('reacties').insert({
    bericht_id: berichtId,
    user_id: _ctx.mijnId(),
    soort: soort,
    inhoud: inhoud
  })
  if(error){ console.warn('[reacties] insert mislukt:', error.message); return false }
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
  + '.msg-row{user-select:none;-webkit-user-select:none}'
  + '.reactie-rij{display:flex;gap:4px;margin:2px 36px;flex-wrap:wrap}'
  + '.reactie-bub{background:rgba(255,255,255,0.12);border-radius:10px;padding:1px 6px;font-size:13px}'

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
