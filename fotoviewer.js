// fotoviewer.js — Fibro
//
// Klik op een foto in een widget en hij opent groot over de pagina heen.
// Staan er meer foto's in dezelfde widget, dan kun je doorbladeren met de
// pijltjes, de pijltjestoetsen of een veegbeweging.
//
// Werkt op elke pagina met widgets, zonder dat de fotowidgets zelf iets
// hoeven te weten: de klik wordt opgevangen op documentniveau. Ook foto's
// die pas later verschijnen doen dus mee.
//
// Inhaken:  <script src="./fotoviewer.js?v=1"></script>  vlak voor </body>

(function () {
  'use strict'

  var MINIMALE_BREEDTE = 60   // kleiner dan dit is een avatar of pictogram
  var overlay = null
  var fotos = []
  var huidig = 0

  function komtInAanmerking(img) {
    if (!img || img.tagName !== 'IMG') return false
    if (!img.closest('.widget-blok')) return false
    // Avatars in het gastenboek en andere kleine plaatjes overslaan.
    if (img.closest('#gbl') || img.closest('#gbwLijst')) return false
    if (img.getBoundingClientRect().width < MINIMALE_BREEDTE) return false
    if (!img.src || img.src.indexOf('data:image') !== 0) {
      if (!/^https?:|^blob:/.test(img.src || '')) return false
    }
    return true
  }

  function maakOverlay() {
    var el = document.createElement('div')
    el.id = 'fibro-fotoviewer'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', 'Foto groot bekijken')
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(8,4,16,0.94)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'touch-action:none', 'user-select:none'
    ].join(';')

    el.innerHTML =
      '<img id="fv-foto" alt="" style="max-width:94vw;max-height:88vh;object-fit:contain;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,0.6)">' +
      '<button id="fv-sluit" aria-label="Sluiten" style="position:absolute;top:14px;right:16px;width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,0.12);color:#fff;font-size:22px;line-height:1;cursor:pointer">\u00d7</button>' +
      '<button id="fv-vorige" aria-label="Vorige foto" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:44px;height:64px;border:0;border-radius:10px;background:rgba(255,255,255,0.10);color:#fff;font-size:26px;line-height:1;cursor:pointer">\u2039</button>' +
      '<button id="fv-volgende" aria-label="Volgende foto" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:44px;height:64px;border:0;border-radius:10px;background:rgba(255,255,255,0.10);color:#fff;font-size:26px;line-height:1;cursor:pointer">\u203a</button>' +
      '<div id="fv-teller" style="position:absolute;bottom:16px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.75);font-size:13px"></div>'

    el.addEventListener('click', function (e) {
      if (e.target === el) sluit()
    })
    el.querySelector('#fv-sluit').addEventListener('click', sluit)
    el.querySelector('#fv-vorige').addEventListener('click', function (e) {
      e.stopPropagation(); ga(-1)
    })
    el.querySelector('#fv-volgende').addEventListener('click', function (e) {
      e.stopPropagation(); ga(1)
    })

    // Vegen op een telefoon.
    var startX = null
    el.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX
    }, { passive: true })
    el.addEventListener('touchend', function (e) {
      if (startX === null) return
      var verschil = e.changedTouches[0].clientX - startX
      startX = null
      if (Math.abs(verschil) > 50) ga(verschil < 0 ? 1 : -1)
    }, { passive: true })

    document.body.appendChild(el)
    return el
  }

  function toon() {
    var img = overlay.querySelector('#fv-foto')
    img.src = fotos[huidig].src

    var meerdere = fotos.length > 1
    overlay.querySelector('#fv-vorige').style.display = meerdere ? '' : 'none'
    overlay.querySelector('#fv-volgende').style.display = meerdere ? '' : 'none'
    overlay.querySelector('#fv-teller').textContent =
      meerdere ? (huidig + 1) + ' van ' + fotos.length : ''
  }

  function ga(stap) {
    if (fotos.length < 2) return
    huidig = (huidig + stap + fotos.length) % fotos.length
    toon()
  }

  function open(img) {
    var blok = img.closest('.widget-blok')
    fotos = Array.prototype.slice.call(blok.querySelectorAll('img'))
      .filter(komtInAanmerking)
    if (!fotos.length) fotos = [img]
    huidig = Math.max(0, fotos.indexOf(img))

    if (!overlay) overlay = maakOverlay()
    overlay.style.display = 'flex'
    document.documentElement.style.overflow = 'hidden'
    toon()
    overlay.querySelector('#fv-sluit').focus()
  }

  function sluit() {
    if (!overlay) return
    overlay.style.display = 'none'
    document.documentElement.style.overflow = ''
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest ? e.target.closest('img') : null
    if (!komtInAanmerking(img)) return
    e.preventDefault()
    open(img)
  })

  document.addEventListener('keydown', function (e) {
    if (!overlay || overlay.style.display === 'none') return
    if (e.key === 'Escape') sluit()
    else if (e.key === 'ArrowLeft') ga(-1)
    else if (e.key === 'ArrowRight') ga(1)
  })

  // Muisaanwijzer laten zien dat foto's aanklikbaar zijn.
  var stijl = document.createElement('style')
  stijl.textContent = '.widget-blok img { cursor: zoom-in }' +
    '#gbl img, #gbwLijst img { cursor: default }'
  document.head.appendChild(stijl)
})()
