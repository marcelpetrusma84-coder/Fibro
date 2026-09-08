let _antwoordOp = null

export function geefAntwoordOp(){ return _antwoordOp }
export function wisAntwoordOp(){
    _antwoordOp = null
    const b = document.getElementById('reply-balk')
    if(b) b.style.display = 'none'
}

export function kiesAntwoordOp(berichtId, tekst){
    _antwoordOp = berichtId
    zorgVoorReplyBalk()
    const b = document.getElementById('reply-balk')
    const t = document.getElementById('reply-balk-tekst')
    if(t) t.textContent = String(tekst || 'bericht').slice(0, 60)
        if(b) b.style.display = 'flex'
}

function zorgVoorReplyBalk(){
    if(document.getElementById('reply-balk')) return
        const wrap = document.querySelector('.input-wrap')
        const invoer = document.querySelector('.input-area')
        if(!wrap || !invoer) return
            const balk = document.createElement('div')
            balk.id = 'reply-balk'
            balk.style.cssText = 'display:none;align-items:center;gap:8px;padding:6px 14px;border-left:3px solid var(--accent);margin:0 14px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:12px;color:var(--muted)'
            const tekst = document.createElement('div')
            tekst.id = 'reply-balk-tekst'
            tekst.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
            const kruis = document.createElement('button')
            kruis.textContent = '\u2715'
            kruis.style.cssText = 'background:none;border:0;color:var(--muted);font-size:14px;cursor:pointer;min-width:auto;min-height:auto;padding:2px 6px'
            kruis.addEventListener('click', wisAntwoordOp)
            balk.appendChild(tekst)
            balk.appendChild(kruis)
            wrap.insertBefore(balk, invoer)
}
