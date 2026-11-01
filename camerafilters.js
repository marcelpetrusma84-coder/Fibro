// camerafilters.js — camerafilters voor het videobellen (Fibro). v3.
// v3 (1 nov 2026): 16-bit, zoals een Super Nintendo-spel: blokjes van ongeveer 6 pixels, beperkte kleuren met
// rasterstipjes, en een klein spelscherm (hartjes en 1UP).
// v2 (1 nov 2026): Oude film echt zwart-wit; Oude tv met vervorming, duidelijke lijnen en een beetje 'kapot';
// 3D-bril duidelijker; Beveiliging zoals in tekenfilms; Nieuws is nu de zender FAKE NEWS met één balk onderaan vol
// grappige Engelse berichten over jou en
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
  { id: 'zestienbit', naam: '16-bit', emoji: '👾' },
]

// FAKE NEWS: de berichten in de lopende balk, in het Engels. {a} = een van de namen, {b} = de ander
// (zonder gesprekspartner: the neighbour).
export const FAKE_NIEUWS = [
  '{a} robs a bank using a banana as a weapon',
  "{a} bakes the world's biggest cake: 3 kilometres long",
  '{a} wins the Tour de France on a kick scooter',
  'Scientists baffled: {a} can talk to pigeons',
  '{a} crowned king of the couch',
  '{a} and {b} rob a candy store, loot: four jelly beans',
  '{a} finds treasure under the sofa, turns out to be chocolate coins',
  '{a} breaks world record for longest nap: three days',
  'Police looking for {a}: too handsome for this camera',
  '{a} sells the moon to {b} for 12 dollars',
  '{a} eats 400 hot dogs, asks for dessert',
  '{a} escapes from the zoo: "I was just visiting"',
  '{a} wins Eurovision with a kazoo solo',
  '{a} lands on Mars, forgot the keys',
  "{a} named Europe's worst parallel parker",
  '{a} adopts a penguin and names it {b}',
  '{a} makes a pancake the size of a football field',
  '{a} caught dancing in the supermarket, crowd applauds',
  '{a} and {b} dig a tunnel to Australia, end up next door',
  '{a} wins the lottery, buys only socks',
  'BREAKING: {a} finally did the dishes',
  '{a} trains cat to deliver the newspaper',
  '{a} sings so badly that every glass in town shatters',
  '{a} arrested for sending too many memes',
  '{a} invents a brand new colour: bluered',
  'Weather: {a} causes a storm by sneezing too hard',
  '{a} rides a wheelbarrow to Paris, arriving in 2031',
  '{a} climbs Mount Everest in flip-flops',
  '{b} accuses {a} of stealing the last cookie',
  '{a} wins contest for saying "yes" the longest',
  '{a} opens a restaurant that only serves toasties',
  '{a} spots a UFO, turns out to be a frisbee from {b}',
  '{a} is boss of Disneyland for one day',
  '{a} runs a marathon backwards and still wins',
  '{a} writes a one-page book: instant bestseller',
  '{a} forgets own birthday, cake already gone',
  'Sports: {a} scores an own goal from 80 metres',
  '{a} teaches dog to ride a bike, dog beats {b} in a race',
  '{a} announces: "I am becoming an astronaut. Tomorrow."',
  '{a} builds a sandcastle the size of a palace',
  '{a} solves the mystery of the missing socks',
  '{a} and {b} sing a duet, the neighbours move out',
  '{a} breaks record: 87 sprouts in one bite',
  '{a} trades car for a lifetime supply of licorice',
  '{a} gives a speech at the United Nations in pyjamas',
  '{a} speaks fluent dolphin and translates for {b}',
  "{a} plants a seed, now the country's tallest tree",
  '{a} discovers that Monday is secretly Friday',
  '{a} wins Olympic gold in hammock lying',
  "Latest news: {a} officially the country's funniest caller",
]

// De tekst van de lopende balk: alle berichten in een willekeurige volgorde, met de namen erin.
export function maakNieuwsBalk(namen, toeval = Math.random) {
  const lijst = (Array.isArray(namen) ? namen : []).map(n => String(n || '').trim().slice(0, 24)).filter(Boolean)
  if (!lijst.length) lijst.push('Someone')
  const berichten = FAKE_NIEUWS.slice()
  for (let i = berichten.length - 1; i > 0; i--) { const j = Math.floor(toeval() * (i + 1)); [berichten[i], berichten[j]] = [berichten[j], berichten[i]] }
  return berichten.map((b, i) => {
    const a = lijst[i % lijst.length]
    const ander = lijst.length > 1 ? lijst[(i + 1) % lijst.length] : 'the neighbour'
    return b.replace(/\{a\}/g, a).replace(/\{b\}/g, ander)
  }).join('   ●   ') + '   ●   '
}

// 16-bit: rasterstipjes (Bayer 4x4) en een pixelhartje (x = rand, r = rood, w = glans)
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const HARTJE = [
  ' xx xx ',
  'xwrxrrx',
  'xrrrrrx',
  ' xrrrx ',
  '  xrx  ',
  '   x   ',
]

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

    // 4. Beveiligingscamera, zoals in tekenfilms: groen-zwart monitorbeeld met dikke beeldlijnen, een bolle rand,
    //    zoekerhoeken, een kruisje, groot CAM 01, een knipperende REC en de tijd. Een langzame storingsstreep.
    beveiliging(w, h) {
      ctx.filter = 'grayscale(1) contrast(1.6) brightness(1.15)'
      ctx.drawImage(video, 0, 0, w, h)
      ctx.filter = 'none'
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#39ff7a'; ctx.fillRect(0, 0, w, h); ctx.restore()
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(0,60,20,0.35)'; ctx.fillRect(0, 0, w, h); ctx.restore()
      scanlijnen(0.45, 4)
      ruis(0.12, 'overlay')
      const sy = (tijd * 45) % (h + 40) - 20
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#b8ffcc'; ctx.fillRect(0, sy, w, 8); ctx.restore()
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.6)
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.95)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      const m = Math.round(Math.min(w, h) * 0.06), l = Math.round(Math.min(w, h) * 0.12), dik = Math.max(3, Math.round(w * 0.007))
      ctx.strokeStyle = 'rgba(200,255,210,0.95)'; ctx.lineWidth = dik; ctx.lineCap = 'square'
      ctx.beginPath()
      ctx.moveTo(m, m + l); ctx.lineTo(m, m); ctx.lineTo(m + l, m)
      ctx.moveTo(w - m - l, m); ctx.lineTo(w - m, m); ctx.lineTo(w - m, m + l)
      ctx.moveTo(m, h - m - l); ctx.lineTo(m, h - m); ctx.lineTo(m + l, h - m)
      ctx.moveTo(w - m - l, h - m); ctx.lineTo(w - m, h - m); ctx.lineTo(w - m, h - m - l)
      ctx.stroke()
      const k = Math.round(Math.min(w, h) * 0.035)
      ctx.lineWidth = Math.max(2, dik - 1); ctx.beginPath()
      ctx.moveTo(w / 2 - k, h / 2); ctx.lineTo(w / 2 + k, h / 2); ctx.moveTo(w / 2, h / 2 - k); ctx.lineTo(w / 2, h / 2 + k); ctx.stroke()
      const nu = new Date()
      const datum = nu.getFullYear() + '-' + tweeCijfers(nu.getMonth() + 1) + '-' + tweeCijfers(nu.getDate())
      const klok = tweeCijfers(nu.getHours()) + ':' + tweeCijfers(nu.getMinutes()) + ':' + tweeCijfers(nu.getSeconds())
      const groot = Math.max(14, Math.round(w * 0.045)), kleinM = Math.max(10, Math.round(w * 0.028))
      const mono = "'Courier New', Courier, monospace"
      ctx.save()
      ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(210,255,220,0.97)'
      ctx.shadowColor = 'rgba(0,255,90,0.8)'; ctx.shadowBlur = 6
      ctx.font = 'bold ' + groot + 'px ' + mono; ctx.textAlign = 'left'
      ctx.fillText('CAM 01', m + dik * 3, m + dik * 3)
      if (Math.floor(tijd * 1.5) % 2) {
        ctx.textAlign = 'right'; ctx.fillStyle = '#ff3030'; ctx.shadowColor = 'rgba(255,0,0,0.8)'
        ctx.fillText('REC', w - m - dik * 3, m + dik * 3)
        const tb = ctx.measureText('REC').width
        ctx.beginPath(); ctx.arc(w - m - dik * 3 - tb - groot * 0.55, m + dik * 3 + groot * 0.5, groot * 0.3, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = 'rgba(210,255,220,0.97)'; ctx.shadowColor = 'rgba(0,255,90,0.8)'
      ctx.font = 'bold ' + kleinM + 'px ' + mono; ctx.textBaseline = 'bottom'
      ctx.textAlign = 'left'; ctx.fillText(datum, m + dik * 3, h - m - dik * 3)
      ctx.textAlign = 'right'; ctx.fillText(klok, w - m - dik * 3, h - m - dik * 3)
      ctx.restore()
    },

    // 5. FAKE NIEUWS: het beeld in kleur, linksboven het logo met LIVE, en één balk onderaan met grappige
    //    berichten over jou en wie je belt (zie FAKE_NIEUWS en zetNamen).
    nieuws(w, h) {
      ctx.drawImage(video, 0, 0, w, h)
      const sans = "'Arial Black', 'Helvetica Neue', Arial, sans-serif"
      // logo linksboven
      const lm = Math.max(10, Math.round(w * 0.028)), lh = Math.round(lm * 2)
      ctx.font = 'bold ' + lm + 'px ' + sans; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      const logo = 'FAKE NEWS', lb = ctx.measureText(logo).width + lm * 1.4
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
      const kop = 'FAKE NEWS', kb = ctx.measureText(kop).width + bm * 1.2
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

    // 6. 16-bit: eerst klein tekenen (ongeveer 6 pixels per blokje, ±100 blokjes breed: je gezicht blijft herkenbaar),
    //    dan de kleuren terugbrengen naar 6 tinten per kleur (216 kleuren) met rasterstipjes (Bayer 4x4), grof opblazen,
    //    een fijn raster ertussen en een klein spelscherm: drie hartjes en 1UP.
    zestienbit(w, h) {
      const blok = Math.max(3, Math.round(w / 106))
      const kw = Math.max(8, Math.round(w / blok)), kh = Math.max(6, Math.round(h / blok))
      if (klein.width !== kw || klein.height !== kh) { klein.width = kw; klein.height = kh }
      kctx.imageSmoothingEnabled = true
      kctx.filter = 'saturate(1.35) contrast(1.15)'
      kctx.drawImage(video, 0, 0, kw, kh); kctx.filter = 'none'
      const beeld = kctx.getImageData(0, 0, kw, kh), d = beeld.data
      for (let y = 0; y < kh; y++) for (let x = 0; x < kw; x++) {
        const i = (y * kw + x) * 4, drempel = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 51
        for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] + drempel) / 51) * 51))
      }
      kctx.putImageData(beeld, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(klein, 0, 0, kw, kh, 0, 0, kw * blok, kh * blok)
      ctx.imageSmoothingEnabled = true
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#000'                 // fijn raster tussen de blokjes
      for (let x = 0; x < w; x += blok) ctx.fillRect(x, 0, 1, h)
      for (let y = 0; y < h; y += blok) ctx.fillRect(0, y, w, 1)
      ctx.restore()
      // spelscherm: drie pixelhartjes links, 1UP rechts
      const p = Math.max(2, Math.round(blok / 2)), marge = blok * 2
      for (let n = 0; n < 3; n++) {
        const ox = marge + n * p * 9, oy = marge
        for (let r = 0; r < HARTJE.length; r++) for (let c = 0; c < HARTJE[r].length; c++) {
          if (HARTJE[r][c] === ' ') continue
          ctx.fillStyle = HARTJE[r][c] === 'x' ? '#000' : HARTJE[r][c] === 'w' ? '#fff' : '#ff2448'
          ctx.fillRect(ox + c * p, oy + r * p, p, p)
        }
      }
      const m = Math.max(10, Math.round(w * 0.026))
      ctx.font = m + "px 'Press Start 2P', monospace"; ctx.textBaseline = 'top'; ctx.textAlign = 'right'
      ctx.fillStyle = '#000'; ctx.fillText('1UP', w - marge + p, marge + p)
      ctx.fillStyle = Math.floor(tijd * 2) % 2 ? '#ffe14a' : '#ffffff'; ctx.fillText('1UP', w - marge, marge)
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
  const NAMEN = { geen: vertaal('Geen'), oudefilm: vertaal('Oude film'), oudetv: vertaal('Oude tv'), anaglyph: vertaal('3D-bril'), beveiliging: vertaal('Beveiliging'), nieuws: vertaal('Fake nieuws'), zestienbit: vertaal('16-bit') }
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
