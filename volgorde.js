// volgorde.js — blokken verslepen door ze ingedrukt te houden
// Gebruik: startVolgorde(container, ids => { ...opslaan... })
// ids = de widget-id's in de nieuwe volgorde (uit data-id op elk blok)

const WACHT = 500     // ms stilhouden voordat een blok loskomt
const SPELING = 10    // px die je vinger mag bewegen tijdens het wachten
const RAND = 70       // px van de rand waar automatisch gescrold wordt
const NIET = 'input, textarea, select, video, audio, [contenteditable="true"], .wbg-bewerk, .wbg-knop, [data-geen-sleep]'

function zetCss() {
    if (document.getElementById('volgorde-css')) return
        const s = document.createElement('style')
        s.id = 'volgorde-css'
        s.textContent = `
        .widget-blok { -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
        .widget-blok input, .widget-blok textarea, .widget-blok [contenteditable="true"] { -webkit-user-select:text; user-select:text; }
        .widget-blok img { -webkit-user-drag:none; }
        .widget-grid.sleept { --blok-kantel:none; }
        .widget-grid.sleept .widget-blok { transition:none; }
        .widget-blok.sleep-blok { z-index:50; opacity:0.95; box-shadow:0 18px 40px rgba(0,0,0,0.55) !important; }`
        document.head.appendChild(s)
}

function zoekScroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
    }
    return null
}

// Plek van een blok in de layout, zonder de lopende schuif-animatie
function laag(el) {
    const r = el.getBoundingClientRect()
    const t = getComputedStyle(el).transform
    const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : { e: 0, f: 0 }
    return { l: r.left - m.e, t: r.top - m.f, r: r.right - m.e, b: r.bottom - m.f }
}

export function startVolgorde(container, opOpslaan) {
    if (!container || container._volgorde) return
        container._volgorde = true
        zetCss()
        console.log('[volgorde] actief', import.meta.url)

        let timer = null, blok = null, sleept = false, raf = 0, scroller = null
        let sx = 0, sy = 0, lx = 0, ly = 0, grijpX = 0, grijpY = 0
        let geblokkeerd = null, startIds = '', geenKlikTot = 0

        const blokken = () => [...container.querySelectorAll(':scope > .widget-blok')]
        const ids = () => blokken().map(b => b.dataset.id).filter(Boolean)

        function basis(el) {
            const oud = el.style.transform
            el.style.transform = 'none'
            const r = el.getBoundingClientRect()
            el.style.transform = oud
            return r
        }

        function verschuif(doel, erna) {
            const anderen = blokken().filter(b => b !== blok)
            const voor = anderen.map(b => b.getBoundingClientRect())
            if (erna) doel.after(blok); else doel.before(blok)
                anderen.forEach(b => { b.style.transition = 'none'; b.style.transform = '' })
                const nu = anderen.map(b => b.getBoundingClientRect())
                anderen.forEach((b, i) => {
                    const dx = voor[i].left - nu[i].left, dy = voor[i].top - nu[i].top
                    if (dx || dy) b.style.transform = `translate(${dx}px, ${dy}px)`
                })
                void container.offsetHeight
                anderen.forEach(b => { b.style.transition = 'transform 0.2s ease'; b.style.transform = '' })
        }

        function zoekDoel() {
            const alle = blokken()
            let doel = null
            for (const b of alle) {
                if (b === blok) continue
                    const p = laag(b)
                    const binnen = lx >= p.l && lx <= p.r && ly >= p.t && ly <= p.b
                    if (b === geblokkeerd) { if (!binnen) geblokkeerd = null; continue }
                    if (binnen) doel = b
            }
            if (!doel) return
                verschuif(doel, alle.indexOf(blok) < alle.indexOf(doel))
                geblokkeerd = doel
        }

        function plaats() {
            if (!blok || !blok.isConnected) { stop(false); return }
            zoekDoel()
            const r = basis(blok)
            blok.style.transform = `translate(${lx - grijpX - r.left}px, ${ly - grijpY - r.top}px) scale(1.04)`
        }

        function rol() {
            if (!sleept) return
                const boven = scroller ? scroller.getBoundingClientRect().top : 0
                const onder = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight
                let v = 0
                if (ly < boven + RAND) v = -(boven + RAND - ly) / 5
                    else if (ly > onder - RAND) v = (ly - onder + RAND) / 5
                        v = Math.max(-15, Math.min(15, Math.round(v)))
                        if (v) { if (scroller) scroller.scrollTop += v; else window.scrollBy(0, v); plaats() }
                        raf = requestAnimationFrame(rol)
        }

        function begin() {
            timer = null
            if (!blok || !blok.isConnected) { blok = null; return }
            sleept = true
            scroller = zoekScroller(container)
            startIds = ids().join()
            const r = basis(blok)
            grijpX = lx - r.left; grijpY = ly - r.top
            container.classList.add('sleept')
            blok.classList.add('sleep-blok')
            blok.style.transition = 'box-shadow 0.15s'
            try { if (navigator.vibrate) navigator.vibrate(15) } catch (e) {}
            plaats()
            raf = requestAnimationFrame(rol)
        }

        function stop(bewaar) {
            sleept = false
            cancelAnimationFrame(raf)
            geenKlikTot = Date.now() + 400
            const b = blok
            blok = null; geblokkeerd = null
            if (b) {
                b.classList.remove('sleep-blok')
                b.style.transition = 'transform 0.2s ease'
                b.style.transform = ''
            }
            setTimeout(() => {
                container.classList.remove('sleept')
                blokken().forEach(x => { x.style.transition = ''; x.style.transform = '' })
            }, 220)
            if (!bewaar) return
                const nieuw = ids()
                if (!nieuw.length) { console.warn('[volgorde] blokken hebben geen data-id'); return }
                if (nieuw.join() === startIds) return
                    console.log('[volgorde] nieuwe volgorde:', nieuw.join(', '))
                    try { opOpslaan(nieuw) } catch (e) { console.error('[volgorde] opslaan mislukt', e) }
        }

        function neer(x, y, doel) {
            if (sleept || timer || !doel.closest || doel.closest(NIET)) return
                const b = doel.closest('.widget-blok')
                if (!b || b.parentElement !== container || b.querySelector('.wbg-bewerk')) return
                    blok = b; sx = lx = x; sy = ly = y
                    timer = setTimeout(begin, WACHT)
        }

        function beweeg(x, y) {
            lx = x; ly = y
            if (timer) {
                if (Math.hypot(x - sx, y - sy) > SPELING) { clearTimeout(timer); timer = null; blok = null }
            } else if (sleept) plaats()
        }

        function los() {
            if (timer) { clearTimeout(timer); timer = null; blok = null }
            if (sleept) stop(true)
        }

        container.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) { los(); return }
            neer(e.touches[0].clientX, e.touches[0].clientY, e.target)
        }, { passive: true })
        window.addEventListener('touchmove', e => {
            if (!timer && !sleept) return
                if (sleept) { if (e.cancelable) e.preventDefault(); e.stopPropagation() }
                beweeg(e.touches[0].clientX, e.touches[0].clientY)
        }, { passive: false, capture: true })
        window.addEventListener('touchend', los, true)
        window.addEventListener('touchcancel', los, true)

        container.addEventListener('mousedown', e => { if (e.button === 0) neer(e.clientX, e.clientY, e.target) })
        window.addEventListener('mousemove', e => { if (timer || sleept) beweeg(e.clientX, e.clientY) })
        window.addEventListener('mouseup', los)

        container.addEventListener('contextmenu', e => { if (timer || sleept) e.preventDefault() })
        container.addEventListener('dragstart', e => { if (timer || sleept) e.preventDefault() })
        window.addEventListener('click', e => {
            if (Date.now() < geenKlikTot) { e.preventDefault(); e.stopPropagation() }
        }, true)
}

// Zet de nieuwe volgorde in de bestaande widget-indeling (localStorage).
// Uitgezette widgets houden hun plek; alleen de zichtbare ruilen onderling.
export function bewaarVolgorde(sleutel, ids) {
    let layout = null
    try { layout = JSON.parse(localStorage.getItem(sleutel)) } catch (e) {}
    if (!Array.isArray(layout) || !layout.length) {
        console.warn('[volgorde] geen opgeslagen indeling onder', sleutel)
        return
    }
    const plek = new Map(ids.map((id, i) => [id, i]))
    const oud = layout.slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
    const zichtbaar = oud.filter(w => plek.has(w.id)).sort((a, b) => plek.get(a.id) - plek.get(b.id))
    let n = 0
    const nieuw = oud.map(w => plek.has(w.id) ? zichtbaar[n++] : w)
    nieuw.forEach((w, i) => { w.volgorde = i })
    localStorage.setItem(sleutel, JSON.stringify(nieuw))
    console.log('[volgorde] opgeslagen onder', sleutel)
}
