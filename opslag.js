// opslag.js - vraagt de browser de opslag van Fibro niet op te ruimen, en toont
// een tip als Fibro op iPhone/iPad in een gewoon browsertabblad draait
// (daar kan de opslag na 7 dagen zonder bezoek gewist worden). 29 september 2026

const LATER_KEY = 'fibro_opslagtip_later'
const WEEK = 7 * 24 * 60 * 60 * 1000

function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isApp() {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch (e) {}
  return navigator.standalone === true
}

async function vraagBlijvend() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return 'niet ondersteund'
    if (await navigator.storage.persisted()) return 'al blijvend'
    return (await navigator.storage.persist()) ? 'nu blijvend' : 'geweigerd'
  } catch (e) {
    return 'fout'
  }
}

function onlangsWeggeklikt() {
  try {
    const t = Number(localStorage.getItem(LATER_KEY) || 0)
    return Date.now() - t < WEEK
  } catch (e) { return false }
}

function toonTip() {
  if (document.getElementById('opslagTip')) return
  const d = document.createElement('div')
  d.id = 'opslagTip'
  d.setAttribute('role', 'dialog')
  d.setAttribute('data-geen-swipe', '')
  d.style.cssText =
    'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top, 0px) + 12px);z-index:99999;' +
    'max-width:480px;margin:0 auto;background:rgba(20,20,28,0.96);color:#fff;' +
    'border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:14px 16px;' +
    'box-shadow:0 8px 30px rgba(0,0,0,0.5);font:15px/1.45 system-ui,-apple-system,sans-serif'
  d.innerHTML =
    '<div style="font-weight:700;font-size:16px;margin-bottom:6px">\u{1F4F1} Zet Fibro op je beginscherm</div>' +
    '<div style="margin-bottom:8px">In een gewoon browsertabblad kan je iPhone de gegevens van Fibro wissen ' +
    'als je een week niet kijkt. Dan moet je je sleutel opnieuw herstellen.</div>' +
    '<div style="margin-bottom:8px"><b>Zo doe je het:</b> tik op de deelknop (vierkantje met pijl omhoog; ' +
    'bij nieuwere iPhones eerst op <b>\u2022\u2022\u2022</b>) en kies <b>Zet op beginscherm</b>.</div>' +
    '<div style="margin-bottom:12px;opacity:0.85">Open Fibro daarna via het nieuwe icoon. Dat heeft eigen opslag: ' +
    'log daar opnieuw in en herstel je sleutel met Face ID (of je herstelcode).</div>' +
    '<div style="text-align:right"><button type="button" id="opslagTipOk" style="min-height:44px;padding:0 22px;' +
    'border-radius:10px;border:0;background:#22c55e;color:#06210f;font-weight:700;font-size:15px">Begrepen</button></div>'
  document.body.appendChild(d)
  document.getElementById('opslagTipOk').addEventListener('click', () => {
    try { localStorage.setItem(LATER_KEY, String(Date.now())) } catch (e) {}
    d.remove()
  })
}

export async function beschermOpslag() {
  const blijvend = await vraagBlijvend()
  const app = isApp()
  const ios = isIOS()
  window._opslagStatus = { blijvend, app, ios }
  console.log('[opslag]', window._opslagStatus)
  const forceer = /[?&]opslagtip=1/.test(location.search)
  if (forceer || (ios && !app && !onlangsWeggeklikt())) toonTip()
}
