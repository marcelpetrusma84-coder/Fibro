const SLEUTEL = 'fibro_blokstijl'
const STANDAARD = { kleur: '#ffffff', doorzicht: 12, hoek: 14, kantel: false }

export function haalBlokstijl(){
    try {
        const r = JSON.parse(localStorage.getItem(SLEUTEL) || '{}')
        return Object.assign({}, STANDAARD, r)
    } catch(e) { return Object.assign({}, STANDAARD) }
}

export function bewaarBlokstijl(s){
    try { localStorage.setItem(SLEUTEL, JSON.stringify(s)) } catch(e) {}
    pasBlokstijlToe(s)
}

function naarRgba(hex, procent){
    const h = String(hex || '#ffffff').replace('#','')
    const r = parseInt(h.slice(0,2),16)
    const g = parseInt(h.slice(2,4),16)
    const b = parseInt(h.slice(4,6),16)
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (procent/100) + ')'
}

export function pasBlokstijlToe(s){
    const st = s || haalBlokstijl()
    const w = document.documentElement.style
    w.setProperty('--blok-kleur', naarRgba(st.kleur, st.doorzicht))
    w.setProperty('--blok-hoek', st.hoek + 'px')
    if (st.kantel) startKantelen(); else stopKantelen()
}

let _kantelAan = false
function opBeweging(e){
    const x = Math.max(-14, Math.min(14, (e.gamma || 0) / 5))
    const y = Math.max(-14, Math.min(14, (e.beta || 0) / 5))
    document.documentElement.style.setProperty('--blok-kantel',
                                               'perspective(300px) rotateY(' + x + 'deg) rotateX(' + (-y) + 'deg)')
  const sx = Math.round(-x * 1.2)
  const sy = Math.round(y * 1.2)
  document.documentElement.style.setProperty('--blok-schaduw',
    sx + 'px ' + sy + 'px ' + (14 + Math.abs(x)) + 'px rgba(0,0,0,0.55)')
}

export async function startKantelen(){
    if (_kantelAan) return
        if (typeof DeviceOrientationEvent === 'undefined') return
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const ok = await DeviceOrientationEvent.requestPermission()
                    if (ok !== 'granted') return
                } catch(e) { return }
            }
            window.addEventListener('deviceorientation', opBeweging)
            _kantelAan = true
}

export function stopKantelen(){
    window.removeEventListener('deviceorientation', opBeweging)
    _kantelAan = false
    document.documentElement.style.setProperty('--blok-kantel', 'none')
}
