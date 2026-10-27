// menuschuif.js (v1, Fibro v220): met je vinger rustig over het menu onderin schuiven.
// Zet je vinger op het menu (Home, Vrienden, Chat, Stijl) en schuif opzij: een zachte gloed volgt je vinger en het
// knopje eronder komt omhoog. Laat je los, dan ga je naar die pagina. Gewoon tikken werkt zoals altijd.
// Loslaten gaat via een klik op het knopje zelf, dus alles wat al op een klik let (zoals de vraag op Mijn stijl of je
// zonder opslaan weg wilt) doet gewoon mee. Werkt met een vinger, een pen en met de muis (knop ingedrukt houden).
;(function () {
  if (typeof window === 'undefined' || window.__fibroMenuschuif) return
  window.__fibroMenuschuif = true

  const DREMPEL = 8 // zoveel pixels opzij voordat het schuiven begint (minder = gewoon tikken)

  const stijl = document.createElement('style')
  stijl.textContent = `
.bottom-nav { touch-action:none; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
.bottom-nav > .nav-item { position:relative; z-index:1; }
.bottom-nav .schuif-lens { position:absolute; z-index:0; top:4px; bottom:4px; left:0; width:var(--lens-b,80px);
  border-radius:16px; pointer-events:none; opacity:0; transform:translateX(var(--lens-x,0px));
  background:radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.22), rgba(240,215,255,.10) 55%, transparent 75%);
  box-shadow:0 0 18px rgba(208,145,255,.35); transition:opacity .18s ease; }
.bottom-nav.schuift .schuif-lens { opacity:1; }
.bottom-nav.schuift > .nav-item { transition:transform .16s ease, opacity .16s ease, color .16s ease; }
/* stijl.css zet kleur en doorzichtigheid van het menu met !important; tijdens het schuiven wint dit */
.bottom-nav.schuift > .nav-item:not(.schuif-doel) { opacity:.7 !important; }
.bottom-nav.schuift > .nav-item.active:not(.schuif-doel) { background:transparent !important; border-color:transparent !important;
  box-shadow:none !important; color:#fff !important; }
.bottom-nav.schuift > .nav-item.schuif-doel { transform:translateY(-5px) scale(1.1); opacity:1 !important; color:var(--accent,#c084fc) !important; }
@media (prefers-reduced-motion: reduce) {
  .bottom-nav.schuift > .nav-item.schuif-doel { transform:none; }
  .bottom-nav .schuif-lens { transition:none; }
}`
  document.head.appendChild(stijl)

  function start (nav) {
    const lens = document.createElement('div')
    lens.className = 'schuif-lens'
    lens.setAttribute('aria-hidden', 'true')
    nav.prepend(lens)

    let begin = null        // { x, y, id } van de vinger die op het menu staat
    let schuift = false
    let doel = null
    let onderdrukTot = 0    // na het schuiven geen 'losse' klik van de browser meer doorlaten

    const knoppen = () => [...nav.querySelectorAll(':scope > .nav-item')]

    function knopBij (x) {
      let beste = null, afstand = Infinity
      for (const k of knoppen()) {
        const r = k.getBoundingClientRect()
        if (x >= r.left && x <= r.right) return k
        const d = Math.min(Math.abs(x - r.left), Math.abs(x - r.right))
        if (d < afstand) { afstand = d; beste = k }
      }
      return beste
    }

    function volg (x) {
      const n = nav.getBoundingClientRect()
      const eerste = knoppen()[0]
      const breedte = eerste ? eerste.getBoundingClientRect().width : 80
      const links = Math.max(0, Math.min(n.width - breedte, x - n.left - breedte / 2))
      nav.style.setProperty('--lens-b', breedte + 'px')
      nav.style.setProperty('--lens-x', links + 'px')
      const nieuw = knopBij(x)
      if (nieuw !== doel) {
        if (doel) doel.classList.remove('schuif-doel')
        doel = nieuw
        if (doel) {
          doel.classList.add('schuif-doel')
          try { if (navigator.vibrate) navigator.vibrate(6) } catch (e) {} // Android: een tikje bij elk knopje
        }
      }
    }

    function stop () {
      nav.classList.remove('schuift')
      if (doel) doel.classList.remove('schuif-doel')
      const was = doel
      doel = null; schuift = false; begin = null
      return was
    }

    nav.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      begin = { x: e.clientX, y: e.clientY, id: e.pointerId }
      schuift = false
    })

    nav.addEventListener('pointermove', e => {
      if (!begin || e.pointerId !== begin.id) return
      if (!schuift) {
        if (Math.abs(e.clientX - begin.x) < DREMPEL) return
        schuift = true
        try { nav.setPointerCapture(e.pointerId) } catch (err) {}
        nav.classList.add('schuift')
      }
      volg(e.clientX)
    })

    nav.addEventListener('pointerup', e => {
      if (!begin || e.pointerId !== begin.id) return
      if (!schuift) { begin = null; return } // gewoon getikt: de gewone klik doet de rest
      onderdrukTot = Date.now() + 500
      const gekozen = stop()
      if (gekozen && !gekozen.classList.contains('active')) gekozen.click()
    })

    nav.addEventListener('pointercancel', () => { if (begin) stop() })
    window.addEventListener('blur', () => { if (begin) stop() })

    // De browser kan na het schuiven nog een eigen klik sturen op het knopje waar je begon: die telt niet.
    // Onze eigen klik (gekozen.click()) komt niet van de browser (isTrusted = false) en gaat gewoon door.
    window.addEventListener('click', e => {
      if (e.isTrusted && Date.now() < onderdrukTot && nav.contains(e.target)) {
        e.preventDefault(); e.stopImmediatePropagation()
      }
    }, true)
  }

  function zoek () { const nav = document.querySelector('.bottom-nav'); if (nav) start(nav) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zoek, { once: true })
  else zoek()
})()
