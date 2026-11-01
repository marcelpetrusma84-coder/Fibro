// camerafilters.js — camerafilters voor het videobellen (Fibro). v2.
// v2 (1 nov 2026): Oude film echt zwart-wit; Oude tv met vervorming, duidelijke lijnen en een beetje 'kapot';
// 3D-bril duidelijker; Nieuws is nu de zender FAKE NIEUWS met één balk onderaan vol grappige berichten over jou en
// wie je belt (zetNamen). De tekst zelf instellen kan niet meer.
//
// Alles gebeurt op het toestel zelf: de camerabeelden gaan door een onzichtbaar
// tekenvel (<canvas>), daar komt een effect op, en van dat tekenvel maken we met
// captureStream() een nieuwe videostroom. Die sturen we door (en tonen we lokaal),
// zodat je gesprekspartner het filter ook ziet. Geen server, geen AI-model.
//
// Gebruik:
//   const f = maakCameraFilter()
//   f.zetBron(track)                 // de rauwe camera-track (of null)
//   f.kies('oudefilm')               // een filter aanzetten ('geen' = niets)
//   const track = f.uitTrack()       // de bewerkte track om te versturen/tonen
//   f.zetNamen(['ik', 'vriend'])     // de gebruikersnamen voor FAKE NIEUWS
//   f.stop()                         // alles opruimen
//
// 'geen' geeft gewoon de rauwe track terug (geen tekenvel, geen kosten), zodat
// bellen zonder filter precies werkt als voorheen.

export const FILTERS = [
  { id: 'geen', naam: 'Geen', emoji: '🚫' },
  { id: 'oudefilm', naam: 'Oude film', emoji: '🎞️' },
  { id: 'oudetv', naam: 'Oude tv', emoji: '📺' },
  { id: 'anaglyph', naam: '3D-bril', emoji: '🔴' },
  { id: 'beveiliging', naam: 'Beveiliging', emoji: '🎥' },
  { id: 'nieuws', naam: 'Fake nieuws', emoji: '📰' },
]

// FAKE NIEUWS: de berichten in de lopende balk. {a} = een van de namen, {b} = de ander (of 'de buurman').
export const FAKE_NIEUWS = [
  '{a} overvalt bank met een banaan als wapen',
  '{a} bakt de grootste taart ter wereld: 3 kilometer lang',
  '{a} wint de Tour de France op een step',
  'Wetenschappers verbijsterd: {a} kan praten met duiven',
  '{a} benoemd tot koning van de bank (de zitbank)',
  '{a} en {b} beroven snoepwinkel, buit: vier dropjes',
  '{a} vindt goudschat onder de bank, blijkt chocolade',
  '{a} breekt wereldrecord langst slapen: drie dagen',
  'Politie zoekt {a}: te knap voor deze camera',
  '{a} verkoopt de maan aan {b} voor 12 euro',
  '{a} eet 400 frikandellen en vraagt om een toetje',
  '{a} ontsnapt uit dierentuin: "Ik was gewoon op bezoek"',
  '{a} wint songfestival met een fluitsolo op een kam',
  '{a} landt op Mars en is de sleutels vergeten',
  '{a} uitgeroepen tot slechtste parkeerder van Europa',
  '{a} adopteert een pinguïn en noemt hem {b}',
  '{a} bakt pannenkoek zo groot als een voetbalveld',
  '{a} betrapt op dansen in de supermarkt, publiek klapt',
  '{a} en {b} graven tunnel naar Australië, komen uit in Zeeland',
  '{a} wint de loterij en koopt alleen maar sokken',
  'BREAKING: {a} heeft eindelijk de afwas gedaan',
  '{a} traint kat om de krant te bezorgen',
  '{a} zingt zo vals dat in heel Utrecht de glazen breken',
  '{a} gearresteerd voor het sturen van te veel memes',
  '{a} vindt nieuwe kleur uit: blauwrood',
  'Weerbericht: {a} veroorzaakt storm door hard te niezen',
  '{a} rijdt in een kruiwagen naar Parijs, aankomst 2031',
  '{a} beklimt de Mount Everest op slippers',
  '{b} beschuldigt {a} van het stelen van het laatste koekje',
  '{a} wint wedstrijd wie het langst "ja" kan zeggen',
  '{a} opent restaurant met alleen maar tosti\'s',
  '{a} ziet ufo, blijkt een frisbee van {b}',
  '{a} is een dag de baas van de Efteling',
  '{a} rent marathon achteruit en wint toch',
  '{a} schrijft boek van één bladzijde: bestseller',
  '{a} vergeet eigen verjaardag, taart is al op',
  'Sport: {a} scoort eigen doelpunt van 80 meter',
  '{a} leert hond fietsen, hond wint race van {b}',
  '{a} kondigt aan: "Ik word astronaut. Morgen al."',
  '{a} bouwt zandkasteel zo groot als een paleis',
  '{a} lost raadsel op: waar blijven alle sokken?',
  '{a} en {b} zingen een duet, de buren verhuizen',
  '{a} breekt record: 87 spruitjes in één hap',
  '{a} ruilt auto voor levenslang gratis drop',
  '{a} houdt toespraak bij de Verenigde Naties in pyjama',
  '{a} spreekt vloeiend dolfijn en vertaalt voor {b}',
  '{a} plant boompje, nu de hoogste boom van Nederland',
  '{a} ontdekt: maandag is eigenlijk gewoon vrijdag',
  '{a} wint goud op de Olympische Spelen hangmatliggen',
  'Laatste nieuws: {a} officieel de leukste beller van het land',
]

// De tekst van de lopende balk: alle berichten in een willekeurige volgorde, met de namen erin.
export function maakNieuwsBalk(namen, toeval = Math.random) {
  const lijst = (Array.isArray(namen) ? namen : []).map(n => String(n || '').trim().slice(0, 24)).filter(Boolean)
  if (!lijst.length) lijst.push('Iemand')
  const berichten = FAKE_NIEUWS.slice()
  for (let i = berichten.length - 1; i > 0; i--) { const j = Math.floor(toeval() * (i + 1)); [berichten[i], berichten[j]] = [berichten[j], berichten[i]] }
  return berichten.map((b, i) => {
    const a = lijst[i % lijst.length]
    const ander = lijst.length > 1 ? lijst[(i + 1) % lijst.length] : 'de buurman'
    return b.replace(/\{a\}/g, a).replace(/\{b\}/g, ander)
  }).join('   ●   ') + '   ●   '
}

function tweeCijfers(n) { return (n < 10 ? '0' : '') + n }

export function maakCameraFilter() {
  const video = document.createElement('video')
  video.muted = true; video.autoplay = true; video.playsInline = true
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '')
  const canvas = document.createElement('canvas')
  canvas.width = 640; canvas.height = 480
  const ctx = canvas.getContext('2d')
  const hulp = document.createElement('canvas')          // voor de anaglyph-passes
  const hctx = hulp.getContext('2d')

  // een paar vaste ruis-tegels voor filmgrain/ruis (één keer gemaakt)
  const ruisTegels = []
  for (let t = 0; t < 6; t++) {
    const c = document.createElement('canvas'); c.width = 160; c.height = 120
    const g = c.getContext('2d'); const beeld = g.createImageData(160, 120)
    for (let i = 0; i < beeld.data.length; i += 4) { const v = (Math.random() * 255) | 0; beeld.data[i] = beeld.data[i + 1] = beeld.data[i + 2] = v; beeld.data[i + 3] = 255 }
    g.putImageData(beeld, 0, 0); ruisTegels.push(c)
  }

  let bronTrack = null, uit = null, filter = 'geen', draait = false, rafId = 0, tijd = 0
  let namen = [], balkTekst = maakNieuwsBalk(namen), balkStart = 0
  const kleine = () => ({ w: canvas.width, h: canvas.height })
  const klein = document.createElement('canvas')         // Oude tv: eerst klein tekenen, dan grof opblazen
  const kctx = klein.getContext('2d')

  // De gebruikersnamen voor FAKE NIEUWS (jij en wie je belt). Andere namen = de berichten opnieuw schudden.
  function zetNamen(lijst) {
    const nieuw = (Array.isArray(lijst) ? lijst : []).map(n => String(n || '').trim()).filter(Boolean)
    if (nieuw.join('\n') === namen.join('\n')) return
    namen = nieuw; balkTekst = maakNieuwsBalk(namen); balkStart = tijd
  }

  function pasMaatAan() {
    const w = video.videoWidth || 640, h = video.videoHeight || 480
    const schaal = Math.min(1, 640 / Math.max(1, w))
    const nw = Math.max(16, Math.round(w * schaal)), nh = Math.max(16, Math.round(h * schaal))
    if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; hulp.width = nw; hulp.height = nh }
    // v2: het hulpvel altijd even groot als het tekenvel (bleef 300x150 als de camera al 640x480 gaf: 3D-bril ingezoomd en wazig)
    if (hulp.width !== canvas.width || hulp.height !== canvas.height) { hulp.width = canvas.width; hulp.height = canvas.height }
  }

  function ruis(alpha, modus) {
    const { w, h } = kleine()
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = modus || 'overlay'
    const tegel = ruisTegels[(Math.random() * ruisTegels.length) | 0]
    ctx.drawImage(tegel, (Math.random() * 20) | 0, (Math.random() * 20) | 0, w, h)
    ctx.restore()
  }
  function vignet(sterkte) {
    const { w, h } = kleine()
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + sterkte + ')')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  }
  function scanlijnen(alpha, stap) {
    const { w, h } = kleine()
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#000'
    for (let y = 0; y < h; y += stap) ctx.fillRect(0, y, w, 1)
    ctx.restore()
  }
  function tekstBalk(x, y, bw, bh, vul, tekst, kleur, maat, lijn) {
    ctx.fillStyle = vul; ctx.fillRect(x, y, bw, bh)
    if (kleur) { ctx.fillStyle = kleur; ctx.font = (maat || 14) + "px 'Press Start 2P', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = lijn || 'left'
      ctx.fillText(tekst, lijn === 'center' ? x + bw / 2 : x + 8, y + bh / 2) }
  }

  const effecten = {
    geen(w, h) { ctx.drawImage(video, 0, 0, w, h) },

    // 1. Oude film: echt zwart-wit, flikkerend, met grove korrel, stofjes, krassen en een donkere rand.
    oudefilm(w, h) {
      const flikker = 0.82 + Math.random() * 0.26
      ctx.filter = 'grayscale(1) contrast(1.45) brightness(' + flikker.toFixed(2) + ')'
      const sprong = (Math.random() < 0.07) ? (Math.random() * 6 - 3) : 0
      ctx.drawImage(video, 0, sprong, w, h)
      ctx.filter = 'none'
      ruis(0.22, 'overlay')
      ctx.save()
      for (let i = 0; i < 1 + ((Math.random() * 3) | 0); i++) {     // krassen
        if (Math.random() < 0.55) { ctx.globalAlpha = 0.25 + Math.random() * 0.35; ctx.fillStyle = Math.random() < 0.6 ? '#fff' : '#000'
          const sx = (Math.random() * w) | 0; ctx.fillRect(sx, 0, 1 + (Math.random() < 0.3 ? 1 : 0), h) }
      }
      for (let i = 0; i < 6; i++) {                                     // stofjes en haartjes
        if (Math.random() < 0.5) continue
        ctx.globalAlpha = 0.5 + Math.random() * 0.4; ctx.fillStyle = Math.random() < 0.7 ? '#000' : '#fff'
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 2.2, 0, Math.PI * 2); ctx.fill()
      }
      if (Math.random() < 0.04) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }  // lichtflits
      ctx.restore()
      ctx.save(); ctx.fillStyle = '#000'; ctx.globalAlpha = 0.9                // filmrand boven en onder
      const rand = Math.round(h * 0.035); ctx.fillRect(0, 0, w, rand); ctx.fillRect(0, h - rand, w, rand); ctx.restore()
      vignet(0.75)
    },

    // 2. Oude tv: grof beeld, duidelijke beeldlijnen, golvende vervorming, kleuren die uit elkaar lopen,
    //    af en toe een hapering of een scheur, een rollende balk en sneeuw. Een beetje kapot.
    oudetv(w, h) {
      const kw = Math.max(16, Math.round(w / 2.6)), kh = Math.max(12, Math.round(h / 2.6))
      if (klein.width !== kw || klein.height !== kh) { klein.width = kw; klein.height = kh }
      kctx.filter = 'saturate(1.6) contrast(1.25) brightness(1.05)'
      kctx.drawImage(video, 0, 0, kw, kh); kctx.filter = 'none'
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = false
      const hapert = Math.random() < 0.035
      const scheurY = Math.random() < 0.06 ? Math.random() * h : -1
      const strook = 4
      for (let y = 0; y < h; y += strook) {
        let dx = Math.sin(y * 0.045 + tijd * 6) * 5 + Math.sin(y * 0.013 - tijd * 2.3) * 3.5
        if (hapert) dx += (Math.random() - 0.5) * 24
        if (scheurY >= 0 && Math.abs(y - scheurY) < 18) dx += 30
        ctx.drawImage(klein, 0, (y / h) * kh, kw, (strook / h) * kh, dx, y, w, strook)
      }
      ctx.imageSmoothingEnabled = true
      // kleuren uit elkaar: een rode schaduw links
      hctx.globalCompositeOperation = 'source-over'; hctx.clearRect(0, 0, w, h); hctx.drawImage(canvas, 0, 0)
      hctx.globalCompositeOperation = 'multiply'; hctx.fillStyle = '#ff0000'; hctx.fillRect(0, 0, w, h); hctx.globalCompositeOperation = 'source-over'
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(hulp, -4, 0, w, h); ctx.restore()
      scanlijnen(0.5, 3)                                          // duidelijke beeldlijnen
      const by = (tijd * 70) % (h + 80) - 40                      // rollende balk
      ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#fff'; ctx.fillRect(0, by, w, 50); ctx.restore()
      ruis(0.16, 'overlay')
      if (Math.random() < 0.05) ruis(0.45, 'screen')               // even sneeuw
      ctx.save(); ctx.globalAlpha = 0.06 + Math.random() * 0.05; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.restore() // flikkeren
      vignet(0.7)
    },

    // 3. Anaglyph (3D-bril): duidelijk rood links en cyaan rechts, op een zwart-wit beeld met veel contrast.
    anaglyph(w, h) {
      const d = Math.max(4, Math.round(w * 0.03))
      hctx.globalCompositeOperation = 'source-over'; hctx.clearRect(0, 0, w, h)
      hctx.filter = 'grayscale(1) contrast(1.35)'; hctx.drawImage(video, 0, 0, w, h); hctx.filter = 'none'
      hctx.globalCompositeOperation = 'multiply'; hctx.fillStyle = '#ff0000'; hctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.drawImage(hulp, -d, 0, w, h)
      hctx.globalCompositeOperation = 'source-over'; hctx.clearRect(0, 0, w, h)
      hctx.filter = 'grayscale(1) contrast(1.35)'; hctx.drawImage(video, 0, 0, w, h); hctx.filter = 'none'
      hctx.globalCompositeOperation = 'multiply'; hctx.fillStyle = '#00ffff'; hctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(hulp, d, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      hctx.globalCompositeOperation = 'source-over'
    },

    // 4. Beveiligingscamera: groenig, korrelig, met tijdstempel, 'REC' en een cameralabel.
    beveiliging(w, h) {
      ctx.filter = 'grayscale(0.55) contrast(1.35) brightness(1.05)'
      ctx.drawImage(video, 0, 0, w, h)
      ctx.filter = 'none'
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(40,255,120,0.10)'; ctx.fillRect(0, 0, w, h); ctx.restore()
      scanlijnen(0.12, 4); ruis(0.06, 'overlay'); vignet(0.6)
      const nu = new Date()
      const stempel = nu.getFullYear() + '-' + tweeCijfers(nu.getMonth() + 1) + '-' + tweeCijfers(nu.getDate()) + ' ' + tweeCijfers(nu.getHours()) + ':' + tweeCijfers(nu.getMinutes()) + ':' + tweeCijfers(nu.getSeconds())
      const m = Math.max(8, Math.round(w * 0.022))
      ctx.font = m + "px 'Press Start 2P', monospace"; ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(210,255,210,0.9)'; ctx.textAlign = 'left'; ctx.fillText('CAM 01', 8, 8)
      ctx.textAlign = 'right'; ctx.fillText(stempel, w - 8, 8)
      ctx.textAlign = 'left'; ctx.fillText(stempel.slice(0, 10), 8, h - m - 8)
      if (Math.floor(tijd * 1.5) % 2) { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(w - 14, h - 16, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,120,120,0.95)'; ctx.textAlign = 'right'; ctx.fillText('REC', w - 26, h - m - 6) }
    },

    // 5. FAKE NIEUWS: het beeld in kleur, linksboven het logo met LIVE, en één balk onderaan met grappige
    //    berichten over jou en wie je belt (zie FAKE_NIEUWS en zetNamen).
    nieuws(w, h) {
      ctx.drawImage(video, 0, 0, w, h)
      const sans = "'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      // logo linksboven
      const lm = Math.max(10, Math.round(w * 0.028)), lh = Math.round(lm * 2)
      ctx.font = 'bold ' + lm + 'px ' + sans; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      const logo = 'FAKE NIEUWS', lb = ctx.measureText(logo).width + lm * 1.4
      ctx.fillStyle = '#c20000'; ctx.fillRect(10, 10, lb, lh)
      ctx.fillStyle = '#fff'; ctx.fillText(logo, 10 + lm * 0.7, 10 + lh / 2)
      const live = '● LIVE', lvb = ctx.measureText(live).width + lm
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(10 + lb, 10, lvb, lh)
      ctx.fillStyle = Math.floor(tijd * 1.6) % 2 ? '#ff4040' : '#ffffff'; ctx.fillText(live, 10 + lb + lm * 0.5, 10 + lh / 2)
      // één balk onderaan: links het vaste blokje, daarnaast de lopende berichten
      const bm = Math.max(11, Math.round(h * 0.045)), bh = Math.round(bm * 2.1), by = h - bh
      ctx.fillStyle = 'rgba(10,18,48,0.95)'; ctx.fillRect(0, by, w, bh)
      ctx.fillStyle = '#ffd23c'; ctx.fillRect(0, by, w, 2)
      ctx.font = 'bold ' + bm + 'px ' + sans
      const kop = 'FAKE NIEUWS', kb = ctx.measureText(kop).width + bm * 1.2
      ctx.save(); ctx.beginPath(); ctx.rect(kb, by, w - kb, bh); ctx.clip()
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const tekst = balkTekst, breedte = ctx.measureText(tekst).width || 1
      const x = w - (((tijd - balkStart) * Math.max(70, w * 0.16)) % (breedte + w - kb))
      ctx.fillText(tekst, x, by + bh / 2 + 1)
      if (x + breedte < w) ctx.fillText(tekst, x + breedte, by + bh / 2 + 1)
      ctx.restore()
      ctx.fillStyle = '#c20000'; ctx.fillRect(0, by, kb, bh)
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(kop, kb / 2, by + bh / 2 + 1)
    },
  }

  function stap(nu) {
    if (!draait) return
    rafId = requestAnimationFrame(stap)
    tijd = (nu || performance.now()) / 1000
    if (!video.videoWidth) return
    pasMaatAan()
    const { w, h } = kleine()
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'
    try { (effecten[filter] || effecten.geen)(w, h) }
    catch (e) { ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(video, 0, 0, w, h) }
  }

  function startLus() {
    if (draait) return
    draait = true
    if (!uit) uit = canvas.captureStream(30)
    rafId = requestAnimationFrame(stap)
  }
  function stopLus() {
    draait = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  function zetBron(track) {
    bronTrack = track || null
    if (track) {
      const ms = new MediaStream([track]); video.srcObject = ms
      video.play().catch(() => {})
      if (filter !== 'geen') startLus()
    } else {
      video.srcObject = null; stopLus()
    }
  }

  // De track die bellen moet versturen/tonen: de rauwe track bij 'geen', anders die van het tekenvel.
  function uitTrack() {
    if (filter === 'geen' || !bronTrack) return bronTrack
    startLus()
    return uit ? uit.getVideoTracks()[0] : bronTrack
  }

  function kies(id) {
    if (!FILTERS.some(f => f.id === id)) return
    const vorig = filter
    filter = id
    if (id === 'geen') { stopLus() }
    else if (bronTrack) { startLus() }
    return vorig !== filter
  }

  function stop() {
    stopLus()
    try { video.srcObject = null } catch (e) {}
    if (uit) { uit.getTracks().forEach(t => t.stop()); uit = null }
    bronTrack = null
  }

  return { zetBron, uitTrack, kies, stop, zetNamen, namen: () => namen.slice(), balk: () => balkTekst, huidig: () => filter, get canvas() { return canvas } }
}

// Een knop met uitklapmenu om een filter te kiezen. Losgekoppeld van het bellen: de aanroeper geeft hoe te
// lezen en te kiezen. (v2: bij FAKE NIEUWS valt er niets meer in te stellen.)
export function bouwFilterKiezer(container, api) {
  if (!container || container.querySelector('.cf-knop')) return null
  const vertaal = (typeof window !== 'undefined' && window.T) || (s => s)
  const knop = document.createElement('button')
  knop.type = 'button'; knop.className = 'cf-knop'; knop.title = vertaal('Camerafilter'); knop.textContent = '🎭'
  knop.setAttribute('aria-label', vertaal('Camerafilter'))
  knop.style.cssText = 'background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;color:#fff'
  const paneel = document.createElement('div')
  paneel.className = 'cf-paneel'; paneel.hidden = true
  paneel.style.cssText = 'position:absolute;bottom:60px;left:50%;transform:translateX(-50%);z-index:60;background:rgba(14,10,30,0.97);border:1px solid #3a2f66;border-radius:14px;padding:12px;width:min(300px,92vw);box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:system-ui,sans-serif'
  const rij = document.createElement('div')
  rij.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center'
  const NAMEN = { geen: vertaal('Geen'), oudefilm: vertaal('Oude film'), oudetv: vertaal('Oude tv'), anaglyph: vertaal('3D-bril'), beveiliging: vertaal('Beveiliging'), nieuws: vertaal('Fake nieuws') }
  const chips = {}
  function werkChips() {
    const nu = api.huidig()
    for (const id in chips) chips[id].style.outline = id === nu ? '2px solid #5ff4ff' : 'none'
  }
  for (const f of FILTERS) {
    const chip = document.createElement('button')
    chip.type = 'button'; chip.dataset.id = f.id
    chip.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;width:78px;padding:8px 4px;background:#201841;border:1px solid #3a2f66;border-radius:10px;color:#fff;font-size:11px;cursor:pointer'
    chip.innerHTML = '<span style="font-size:20px">' + f.emoji + '</span>' + (NAMEN[f.id] || f.naam)
    chip.addEventListener('click', () => { api.kies(f.id); werkChips() })
    chips[f.id] = chip; rij.appendChild(chip)
  }
  paneel.append(rij)
  knop.addEventListener('click', e => { e.stopPropagation(); paneel.hidden = !paneel.hidden; if (!paneel.hidden) werkChips() })
  document.addEventListener('click', e => { if (!paneel.hidden && !paneel.contains(e.target) && e.target !== knop) paneel.hidden = true })
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  container.append(knop, paneel)
  return knop
}
