// sleutelcontrole.js (v266, 5 nov 2026): "Sleutel controleren" in de chat, met een QR-code of 60 cijfers.
//
// In gewone woorden: Fibro versleutelt elk bericht met de sleutel van je vriend. Die sleutel komt via de server. Met
// deze controle zie je zelf dat het echt de sleutel van je vriend is (en niet die van iemand die de server hackte):
// naast elkaar scan je elkaars QR-code, of je vergelijkt 60 cijfers (bijvoorbeeld in een videogesprek). Klopt het,
// dan staat er ✅ bij je vriend. Verandert daarna de sleutel van één van jullie, dan is het ✅ vanzelf weg (en de gele
// balk "De sleutel van ... is veranderd" in chat.html verscheen al).
//  - Aan of uit: ☰ > Instellingen > 🔐 Sleutels controleren (standaard uit). Uit = je ziet niets van deze functie.
//  - Het veiligheidsnummer is voor jullie allebei hetzelfde: SHA-256 over beide accounts en beide publieke sleutels,
//    gesorteerd. De vergelijking gebeurt op de toestellen; de server ziet niets.
//  - Scannen: de camera met jsQR (vendor/jsqr/jsQR.js, pas geladen bij het scannen). Het beeld gaat nergens heen.
const T = (s, v) => (window.T ? window.T(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const SCHAKELAAR = 'fibro_sleutelcontrole'
const VOORVOEGSEL = 'fibro-sleutel:1:'
const gecontroleerdSleutel = (mijnId, vriendId) => 'fibro_gecontroleerd_' + mijnId + '_' + vriendId

export function controleAan() { try { return localStorage.getItem(SCHAKELAAR) === '1' } catch (e) { return false } }
export function zetControle(aan) { try { localStorage.setItem(SCHAKELAAR, aan ? '1' : '0') } catch (e) {} }

function b64NaarBytes(b64) { const s = atob(b64), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b }

// Het veiligheidsnummer van twee accounts: 60 cijfers, voor allebei hetzelfde (de volgorde van de accounts telt niet)
export async function veiligheidsnummer(idA, pubA, idB, pubB) {
  if (!idA || !idB || !pubA || !pubB || idA === idB) throw new Error('onvolledig')
  const [[id1, p1], [id2, p2]] = [[idA, pubA], [idB, pubB]].sort((x, y) => (x[0] < y[0] ? -1 : 1))
  const enc = new TextEncoder()
  const delen = [enc.encode('fibro-veiligheidsnummer-v1|' + id1 + '|'), b64NaarBytes(p1), enc.encode('|' + id2 + '|'), b64NaarBytes(p2)]
  const data = new Uint8Array(delen.reduce((n, d) => n + d.length, 0))
  let i = 0; for (const d of delen) { data.set(d, i); i += d.length }
  const h1 = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  const h2 = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...data, 1])))
  const bytes = new Uint8Array([...h1, ...h2]) // 64 bytes; we gebruiken er 60: 12 groepjes van 5 bytes
  let cijfers = ''
  for (let g = 0; g < 12; g++) {
    let n = 0
    for (let j = 0; j < 5; j++) n = n * 256 + bytes[g * 5 + j]
    cijfers += String(n % 100000).padStart(5, '0')
  }
  return cijfers
}
export const groepjes = cijfers => String(cijfers).match(/.{1,5}/g) || []

// Wat er in de QR-code staat: beide accounts en het nummer
export function qrTekst(mijnId, vriendId, cijfers) { return VOORVOEGSEL + mijnId + ':' + vriendId + ':' + cijfers }
export function leesQr(tekst) {
  if (typeof tekst !== 'string' || !tekst.startsWith(VOORVOEGSEL)) return null
  const [van, naar, cijfers] = tekst.slice(VOORVOEGSEL.length).split(':')
  if (!van || !naar || !/^\d{60}$/.test(cijfers || '')) return null
  return { van, naar, cijfers }
}
// Klopt een gescande code? 'goed' | 'anders' (nummer klopt niet!) | 'ander-account' (code van iemand anders) | 'geen'
export function vergelijkScan(gescand, mijnId, vriendId, mijnCijfers) {
  const q = leesQr(gescand)
  if (!q) return 'geen'
  if (q.van !== vriendId || q.naar !== mijnId) return 'ander-account'
  return q.cijfers === mijnCijfers ? 'goed' : 'anders'
}

export function isGecontroleerd(mijnId, vriendId, cijfers) {
  try { return !!cijfers && localStorage.getItem(gecontroleerdSleutel(mijnId, vriendId)) === cijfers } catch (e) { return false }
}
function markeer(mijnId, vriendId, cijfers) { try { localStorage.setItem(gecontroleerdSleutel(mijnId, vriendId), cijfers) } catch (e) {} }
function vergeet(mijnId, vriendId) { try { localStorage.removeItem(gecontroleerdSleutel(mijnId, vriendId)) } catch (e) {} }

// ── De knop in de chat (🔐 / ✅) ──
let huidig = null // { mijnId, mijnPub, vriendId, naam, vriendPub, cijfers }
export async function werkKnopBij(knop, { mijnId, mijnPub, vriendId, naam, vriendPub }) {
  if (!knop) return
  huidig = null
  if (!controleAan() || !mijnId || !mijnPub || !vriendId || !vriendPub || vriendPub.length <= 10) { knop.hidden = true; return }
  let cijfers
  try { cijfers = await veiligheidsnummer(mijnId, mijnPub, vriendId, vriendPub) } catch (e) { knop.hidden = true; return }
  huidig = { mijnId, mijnPub, vriendId, naam, vriendPub, cijfers }
  const ok = isGecontroleerd(mijnId, vriendId, cijfers)
  knop.textContent = ok ? '✅' : '\u{1F510}'
  const label = ok ? T('Sleutel van {naam} gecontroleerd', { naam }) : T('Sleutel van {naam} controleren', { naam })
  knop.title = label; knop.setAttribute('aria-label', label)
  knop.hidden = false
  knop.onclick = () => openControle(() => werkKnopBij(knop, huidig || { mijnId, mijnPub, vriendId, naam, vriendPub }))
}

const KNOP = 'display:block;width:100%;min-height:46px;border-radius:12px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;'
const HOOFD = KNOP + 'border:none;background:linear-gradient(135deg,var(--accent,#c084fc),var(--accent2,#f0abfc));color:#1a0a2e'
const LICHT = KNOP + 'border:1px solid #c084fc66;background:#ffffff0d;color:#f3e8ff;font-weight:600'

function laadScript(src) {
  return new Promise((ok, fout) => {
    if (document.querySelector('script[data-bron="' + src + '"]')) { ok(); return }
    const s = document.createElement('script'); s.src = src; s.dataset.bron = src
    s.onload = () => ok(); s.onerror = () => fout(new Error('laden mislukt: ' + src))
    document.head.appendChild(s)
  })
}

export function openControle(naSluiten) {
  if (!huidig) return
  const { mijnId, vriendId, naam, cijfers } = huidig
  document.getElementById('sleutelControle')?.remove()
  const laag = document.createElement('div')
  laag.id = 'sleutelControle'
  laag.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,0,15,0.78);backdrop-filter:blur(8px);overflow-y:auto'
  const kaart = document.createElement('div')
  kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-modal', 'true'); kaart.setAttribute('aria-labelledby', 'scKop')
  kaart.style.cssText = 'width:min(380px,100%);margin:auto;padding:18px;border-radius:18px;border:1px solid rgba(192,132,252,0.45);background:linear-gradient(150deg,#2a1530,#160b24);color:#f3e8ff;box-shadow:0 18px 48px rgba(0,0,0,0.6);font-family:inherit;text-align:center'
  kaart.innerHTML = '<h2 id="scKop" style="margin:0 0 6px;font-size:18px"></h2><p class="sc-stand" style="margin:0 0 10px;font-size:14px;font-weight:700"></p>' +
    '<p class="sc-uitleg" style="margin:0 0 12px;font-size:13.5px;line-height:1.45;color:#e4d6f5"></p>' +
    '<div class="sc-qr" style="display:inline-block;padding:10px;border-radius:12px;background:#fff;line-height:0"></div>' +
    '<div class="sc-cijfers" aria-label="" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px 10px;margin:12px auto 4px;max-width:300px;font:600 17px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em"></div>' +
    '<div class="sc-scan" hidden style="position:relative;margin-top:10px"><video playsinline muted style="width:100%;border-radius:12px;background:#000"></video>' +
    '<div class="sc-scan-tekst" style="margin-top:6px;font-size:13px"></div></div>' +
    '<div class="sc-uitslag" role="status" aria-live="polite" style="min-height:20px;margin-top:8px;font-size:14px;font-weight:700"></div>' +
    '<button type="button" class="sc-scanknop"></button><button type="button" class="sc-kloppen"></button>' +
    '<button type="button" class="sc-vergeet" hidden></button><button type="button" class="sc-sluit"></button>'
  const q = s => kaart.querySelector(s)
  q('#scKop').textContent = T('🔐 Sleutel controleren met {naam}', { naam })
  q('.sc-uitleg').textContent = T('Zit je naast {naam}? Scan dan elkaars QR-code. Niet bij elkaar? Lees elkaar de 60 cijfers voor, bijvoorbeeld in een videogesprek. Zien jullie allebei dezelfde cijfers, dan leest niemand mee.', { naam })
  q('.sc-cijfers').setAttribute('aria-label', T('Veiligheidsnummer'))
  for (const g of groepjes(cijfers)) { const s = document.createElement('span'); s.textContent = g; q('.sc-cijfers').appendChild(s) }
  const scanKnop = q('.sc-scanknop'), kloppen = q('.sc-kloppen'), vergeetKnop = q('.sc-vergeet'), sluitKnop = q('.sc-sluit')
  scanKnop.style.cssText = HOOFD; kloppen.style.cssText = LICHT; vergeetKnop.style.cssText = LICHT; sluitKnop.style.cssText = LICHT
  scanKnop.textContent = T('📷 Scan de code van {naam}', { naam })
  kloppen.textContent = T('✅ De cijfers kloppen')
  vergeetKnop.textContent = T('Toch niet gecontroleerd')
  sluitKnop.textContent = T('Sluiten')
  const uitslag = q('.sc-uitslag')
  function toonStand() {
    const ok = isGecontroleerd(mijnId, vriendId, cijfers)
    q('.sc-stand').textContent = ok ? T('✅ Gecontroleerd') : T('Nog niet gecontroleerd')
    q('.sc-stand').style.color = ok ? '#86efac' : '#e4d6f5'
    kloppen.style.display = ok ? 'none' : 'block'; vergeetKnop.style.display = ok ? 'block' : 'none' // (hidden helpt niet: de stijl zet display)
  }
  toonStand()
  // De QR-code met qrcode.min.js (dezelfde als bij uitnodigen)
  laadScript('qrcode.min.js?v=1').then(() => {
    try { new window.QRCode(q('.sc-qr'), { text: qrTekst(mijnId, vriendId, cijfers), width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M }) } catch (e) { q('.sc-qr').hidden = true }
  }, () => { q('.sc-qr').hidden = true })

  let stroom = null, timer = null
  function stopScan() {
    if (timer) { clearTimeout(timer); timer = null }
    if (stroom) { stroom.getTracks().forEach(t => t.stop()); stroom = null }
    q('.sc-scan').hidden = true
    scanKnop.textContent = T('📷 Scan de code van {naam}', { naam })
  }
  scanKnop.onclick = async () => {
    if (stroom) { stopScan(); return }
    uitslag.textContent = ''
    let video = q('.sc-scan video')
    try {
      stroom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    } catch (e) { uitslag.style.color = '#fca5a5'; uitslag.textContent = T('Fibro mag de camera niet gebruiken. Vergelijk dan de 60 cijfers.'); return }
    q('.sc-scan').hidden = false
    q('.sc-scan-tekst').textContent = T('Richt de camera op de QR-code van {naam}.', { naam })
    scanKnop.textContent = T('Stoppen met scannen')
    video.srcObject = stroom
    try { await video.play() } catch (e) {}
    try { await laadScript('vendor/jsqr/jsQR.js?v=1') } catch (e) { stopScan(); uitslag.textContent = T('Scannen lukt hier niet. Vergelijk dan de 60 cijfers.'); return }
    const doek = document.createElement('canvas'), ctx = doek.getContext('2d', { willReadFrequently: true })
    const kijk = () => {
      if (!stroom || !laag.isConnected) return
      if (video.readyState >= 2 && video.videoWidth) {
        const schaal = Math.min(1, 640 / video.videoWidth)
        doek.width = Math.round(video.videoWidth * schaal); doek.height = Math.round(video.videoHeight * schaal)
        ctx.drawImage(video, 0, 0, doek.width, doek.height)
        const beeld = ctx.getImageData(0, 0, doek.width, doek.height)
        const code = window.jsQR && window.jsQR(beeld.data, doek.width, doek.height, { inversionAttempts: 'dontInvert' })
        if (code && code.data) {
          const r = vergelijkScan(code.data, mijnId, vriendId, cijfers)
          if (r === 'goed') {
            markeer(mijnId, vriendId, cijfers); stopScan(); toonStand()
            uitslag.style.color = '#86efac'; uitslag.textContent = T('✅ Klopt! De sleutel van {naam} is echt. Laat {naam} nu ook jouw code scannen.', { naam })
            return
          }
          if (r === 'anders') {
            vergeet(mijnId, vriendId); stopScan(); toonStand()
            uitslag.style.color = '#fca5a5'; uitslag.textContent = T('⚠️ Klopt NIET. De sleutels zijn anders dan bij {naam}. Stuur nog niets geheims en vraag {naam} om Fibro opnieuw te openen.', { naam })
            return
          }
          if (r === 'ander-account') q('.sc-scan-tekst').textContent = T('Dit is de code van iemand anders, niet van {naam}.', { naam })
        }
      }
      timer = setTimeout(kijk, 200)
    }
    kijk()
  }
  kloppen.onclick = () => {
    if (!confirm(T('Heb je de 60 cijfers vergeleken met die op het scherm van {naam}, en zijn ze allemaal hetzelfde?', { naam }))) return
    markeer(mijnId, vriendId, cijfers); toonStand()
    uitslag.style.color = '#86efac'; uitslag.textContent = T('✅ Gecontroleerd')
  }
  vergeetKnop.onclick = () => { vergeet(mijnId, vriendId); toonStand(); uitslag.textContent = '' }
  const terug = document.activeElement
  const sluit = () => { stopScan(); laag.remove(); document.removeEventListener('keydown', esc); try { terug && terug.focus && terug.focus() } catch (e) {}; if (naSluiten) naSluiten() }
  const esc = e => { if (e.key === 'Escape') sluit() }
  sluitKnop.onclick = sluit
  laag.addEventListener('click', e => { if (e.target === laag) sluit() })
  document.addEventListener('keydown', esc)
  laag.appendChild(kaart); document.body.appendChild(laag)
  sluitKnop.focus()
}
