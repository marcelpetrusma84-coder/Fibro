// studio-ui.js (23 nov 2026, Stekky Studio stap 1) - het scherm van studio.html: een plaat met stickers inladen, de stickers
// losknippen, er 12 kiezen, naam/beweging/geluid bepalen en een pakketbestand (naam.stekkypakket.json) maken.
// Het knippen zit in studio-knippen.js, het pakketbestand in studio-pakket.js (beide zonder scherm, met tests).
// Alleen voor moderators (zoals moderatie.html): ben_ik_moderator.
import { supabase } from './supabase.js?v=95'
import { BEWEGINGEN, GELUIDEN, speel, speelBeweging } from './stickerfx.js?v=237'
import { vindStickers, knipRooster, maakUitsnede } from './studio-knippen.js?v=1'
import { AANTAL, MAX_PLAATJE, MAX_MP3, MAX_BRON, voorstelFx, maakPakket, valideerPakket, maakSlug } from './studio-pakket.js?v=2'
import { maakPrompt, roosterOpmerking, maakGeluidPrompt } from './studio-prompt.js?v=2'
import { SAMPLERATE, MAX_SEC, verwerk, codeerMp3 } from './studio-geluid.js?v=1'

const $ = id => document.getElementById(id)
const MAX_KANT = 2000        // grotere platen worden eerst kleiner gemaakt (sneller knippen)
const VEL = 384              // elk sticker-plaatje is 384 x 384, zoals de stickers die er al zijn
const PASSEN = 336           // de sticker zelf past in dit vak (er blijft een rand over)

// ── Wat er nu is ──
const plaat = { w: 0, h: 0, data: null, beeld: null, naam: '' }   // de ingeladen plaat
let gevonden = []                                                   // de gevonden stickers (leesvolgorde)
const gekozen = new Set()                                           // indexen in 'gevonden'
const instelling = new Map()                                        // index -> { naam: [nl, en], b, g }
let uitsnedeUrl = []                                                // index -> preview (data-url)

// Kleine hulpjes om het scherm te bouwen zonder innerHTML (namen kunnen van alles zijn)
function el(tag, opties = {}, kinderen = []) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(opties)) {
    if (k === 'tekst') e.textContent = v
    else if (k === 'klas') e.className = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v)
  }
  for (const kind of [].concat(kinderen)) if (kind) e.append(kind)
  return e
}
function melding(doel, tekst, soort = '', lijst = []) {
  doel.className = 'melding' + (soort ? ' ' + soort : '')
  doel.textContent = tekst
  if (lijst.length) doel.append(el('ul', {}, lijst.map(t => el('li', { tekst: t }))))
}

// ── Toegang: alleen moderators ──
async function start() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return geweigerd()
    const { data: isMod, error } = await supabase.rpc('ben_ik_moderator')
    if (error || isMod !== true) return geweigerd()
  } catch (e) { return geweigerd() }
  $('laden').classList.add('verborgen')
  $('inhoud').classList.remove('verborgen')
  koppel()
}
function geweigerd() {
  $('laden').classList.add('verborgen')
  $('toegangGeweigerd').classList.remove('verborgen')
}

// ── Stap 1: de plaat ──
function koppel() {
  const drop = $('drop'), bestand = $('bestand')
  drop.addEventListener('click', () => bestand.click())
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bestand.click() } })
  bestand.addEventListener('change', () => { if (bestand.files[0]) laadPlaat(bestand.files[0]) })
  for (const s of ['dragenter', 'dragover']) drop.addEventListener(s, e => { e.preventDefault(); drop.classList.add('boven') })
  for (const s of ['dragleave', 'drop']) drop.addEventListener(s, e => { e.preventDefault(); drop.classList.remove('boven') })
  drop.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) laadPlaat(f) })
  // de hele pagina: een plaatje dat naast het vak valt, mag niet de pagina vervangen
  for (const s of ['dragover', 'drop']) window.addEventListener(s, e => e.preventDefault())

  $('gevoelig').addEventListener('input', () => { $('gevoeligWaarde').textContent = $('gevoelig').value })
  $('samen').addEventListener('input', () => { $('samenWaarde').textContent = (Number($('samen').value) / 10).toLocaleString('nl-NL') })
  for (const id of ['gevoelig', 'samen']) $(id).addEventListener('change', knip)
  $('roosterAan').addEventListener('change', knip)
  for (const id of ['kolommen', 'rijen']) $(id).addEventListener('change', () => { if ($('roosterAan').checked) knip() })
  $('opnieuwKnippen').addEventListener('click', knip)

  $('kiesEerste').addEventListener('click', () => { gekozen.clear(); for (let i = 0; i < Math.min(AANTAL, gevonden.length); i++) gekozen.add(i); verversKeuze() })
  $('kiesGeen').addEventListener('click', () => { gekozen.clear(); verversKeuze() })
  $('maakPakket').addEventListener('click', maakBestand)
  koppelPrompt()
}

// ── De prompt voor Gemini (bovenaan): invullen en kopiëren ──
function promptOpties() {
  return { thema: $('promptThema').value, stijl: $('promptStijl').value, achtergrond: $('promptAchtergrond').value,
    kolommen: $('promptKolommen').value, rijen: $('promptRijen').value }
}
function verversPrompt() {
  const o = promptOpties()
  $('promptTekst').value = maakPrompt(o)
  const tekst = roosterOpmerking(o)
  melding($('promptOpmerking'), tekst, /nodig/.test(tekst) ? 'let-op' : '')
}
function koppelPrompt() {
  for (const id of ['promptThema', 'promptStijl', 'promptAchtergrond', 'promptKolommen', 'promptRijen']) $(id).addEventListener('input', verversPrompt)
  $('kopieerPrompt').addEventListener('click', kopieerPrompt)
  verversPrompt()
}
// Tekst op het klembord zetten. Lukt dat niet (oudere browser, of een venster zonder rechten): een tijdelijk tekstvak
// selecteren en het oude kopieerkommando proberen. Geeft true als het gelukt is.
async function kopieerTekst(tekst) {
  try { await navigator.clipboard.writeText(tekst); return true } catch (e) {}
  const veld = el('textarea', { 'aria-hidden': 'true', readonly: '' })
  veld.value = tekst; veld.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.append(veld)
  try { veld.focus(); veld.select(); return document.execCommand('copy') } catch (e) { return false } finally { veld.remove() }
}
async function kopieerPrompt() {
  const m = $('kopieerMelding')
  const gelukt = await kopieerTekst($('promptTekst').value)
  melding(m, gelukt ? '✓ Gekopieerd. Plak het nu in Gemini.' : 'Kopiëren lukte niet. Selecteer de tekst zelf en kopieer met Ctrl+C.', gelukt ? 'goed' : 'let-op')
  m.style.margin = '0'
  if (gelukt) setTimeout(() => { if (m.textContent.startsWith('✓')) m.textContent = '' }, 4000)
}

async function laadPlaat(bestand) {
  const m = $('knipMelding')
  if (!/^image\/(png|jpeg|webp)$/.test(bestand.type)) return melding(m, 'Dit is geen PNG, JPG of WebP-plaatje.', 'fout')
  melding(m, 'Plaat laden…')
  let beeld
  try { beeld = await laadBeeld(bestand) } catch (e) { return melding(m, 'Dit plaatje kon niet gelezen worden. Probeer een ander bestand.', 'fout') }
  const schaal = Math.min(1, MAX_KANT / Math.max(beeld.naturalWidth, beeld.naturalHeight))
  plaat.w = Math.max(1, Math.round(beeld.naturalWidth * schaal)); plaat.h = Math.max(1, Math.round(beeld.naturalHeight * schaal))
  const c = document.createElement('canvas'); c.width = plaat.w; c.height = plaat.h
  const cx = c.getContext('2d', { willReadFrequently: true })
  cx.imageSmoothingQuality = 'high'
  cx.drawImage(beeld, 0, 0, plaat.w, plaat.h)
  plaat.data = cx.getImageData(0, 0, plaat.w, plaat.h).data
  plaat.beeld = c
  plaat.naam = bestand.name.replace(/\.[^.]+$/, '')
  $('knipBesturing').classList.remove('verborgen')
  $('plaatWrap').classList.remove('verborgen')
  gekozen.clear(); instelling.clear()
  knip()
}
function laadBeeld(bestand) {
  return new Promise((ok, mis) => {
    const url = URL.createObjectURL(bestand), i = new Image()
    i.onload = () => { URL.revokeObjectURL(url); ok(i) }
    i.onerror = () => { URL.revokeObjectURL(url); mis(new Error('plaatje')) }
    i.src = url
  })
}

// ── Knippen ──
function knip() {
  if (!plaat.data) return
  const m = $('knipMelding')
  const kort = Math.min(plaat.w, plaat.h)
  const opties = { gevoeligheid: Number($('gevoelig').value), samenvoegen: Math.max(1, Math.round(kort * Number($('samen').value) / 1000)) }
  let uit
  try {
    if ($('roosterAan').checked) {
      const k = parseInt($('kolommen').value, 10), r = parseInt($('rijen').value, 10)
      if (!(k >= 1 && k <= 20 && r >= 1 && r <= 20)) return melding(m, 'Vul bij de vaste indeling een aantal kolommen en rijen in (1 tot 20).', 'let-op')
      uit = knipRooster(plaat.data, plaat.w, plaat.h, k, r, opties)
    } else uit = vindStickers(plaat.data, plaat.w, plaat.h, opties)
  } catch (e) { return melding(m, 'Het knippen is mislukt. Probeer een andere gevoeligheid.', 'fout') }
  gevonden = uit.stickers
  // wat al gekozen was, blijft alleen bestaan als het nummer nog bestaat; bij nieuw knippen begint de keuze opnieuw
  gekozen.clear(); instelling.clear()
  tekenPlaat()
  maakVoorbeelden()
  const klonter = gevonden.filter(s => s.samengeklonterd).length
  if (!gevonden.length) {
    melding(m, 'Geen stickers gevonden. Draai aan de gevoeligheid, of probeer de vaste indeling.', 'let-op')
    $('stap2').classList.add('verborgen'); $('stap3').classList.add('verborgen'); $('stap4').classList.add('verborgen')
    return
  }
  const regels = []
  if (klonter) regels.push(klonter + ' van de stukken zijn veel groter dan de rest. Zitten daar twee stickers aan elkaar? Zet de gevoeligheid of "stukken samenvoegen" dan lager.')
  if (gevonden.length < AANTAL) regels.push('Er zijn maar ' + gevonden.length + ' stickers gevonden en er zijn er ' + AANTAL + ' nodig. Draai aan de gevoeligheid, of gebruik een plaat met meer stickers.')
  melding(m, gevonden.length + ' stickers gevonden.', regels.length ? 'let-op' : 'goed', regels)
  $('stap2').classList.remove('verborgen')
  bouwVakken()
  verversKeuze()
}

function tekenPlaat() {
  const c = $('plaat')
  c.width = plaat.w; c.height = plaat.h
  const cx = c.getContext('2d')
  cx.drawImage(plaat.beeld, 0, 0)
  const dik = Math.max(2, Math.round(Math.min(plaat.w, plaat.h) / 300))
  cx.lineWidth = dik; cx.font = 'bold ' + Math.max(14, Math.round(Math.min(plaat.w, plaat.h) / 40)) + 'px sans-serif'; cx.textBaseline = 'top'
  gevonden.forEach((s, i) => {
    cx.strokeStyle = s.samengeklonterd ? '#fcd34d' : '#c026d3'
    cx.strokeRect(s.x - dik, s.y - dik, s.w + 2 * dik, s.h + 2 * dik)
    const tekst = String(i + 1), br = cx.measureText(tekst).width + 8
    cx.fillStyle = s.samengeklonterd ? '#fcd34d' : '#c026d3'
    cx.fillRect(s.x - dik, s.y - dik, br, parseInt(cx.font, 10) + 6)
    cx.fillStyle = s.samengeklonterd ? '#000' : '#fff'
    cx.fillText(tekst, s.x - dik + 4, s.y - dik + 3)
  })
}

// ── De plaatjes van de stickers ──
function uitsnedeCanvas(s) {
  const u = maakUitsnede(plaat.data, plaat.w, plaat.h, s)
  const c = document.createElement('canvas'); c.width = u.w; c.height = u.h
  c.getContext('2d').putImageData(new ImageData(u.rgba, u.w, u.h), 0, 0)
  return c
}
// Het eindplaatje: 384 x 384, doorzichtig, de sticker in het midden
function eindCanvas(s) {
  const u = uitsnedeCanvas(s)
  const c = document.createElement('canvas'); c.width = VEL; c.height = VEL
  const cx = c.getContext('2d')
  const schaal = Math.min(PASSEN / u.width, PASSEN / u.height, 2)
  const w = Math.round(u.width * schaal), h = Math.round(u.height * schaal)
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'
  cx.drawImage(u, Math.round((VEL - w) / 2), Math.round((VEL - h) / 2), w, h)
  return c
}
function maakVoorbeelden() {
  uitsnedeUrl = gevonden.map(s => eindCanvas(s).toDataURL('image/png'))
}

// ── Stap 2: kiezen ──
function bouwVakken() {
  const doel = $('vakken'); doel.textContent = ''
  gevonden.forEach((s, i) => {
    const vak = el('div', { klas: 'vak', role: 'button', tabindex: '0', 'aria-pressed': 'false', 'data-nr': String(i), 'aria-label': 'Sticker ' + (i + 1) }, [
      el('span', { klas: 'vink' }),
      s.samengeklonterd ? el('span', { klas: 'waarsch', tekst: '⚠️', title: 'Misschien twee stickers aan elkaar' }) : null,
      el('img', { src: uitsnedeUrl[i], alt: '' }),
    ])
    const wissel = () => {
      if (gekozen.has(i)) gekozen.delete(i)
      else if (gekozen.size >= AANTAL) { teller('Er passen er maar ' + AANTAL + ' in. Haal er eerst één weg.'); return }
      else gekozen.add(i)
      verversKeuze()
    }
    vak.addEventListener('click', wissel)
    vak.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wissel() } })
    doel.append(vak)
  })
}
function teller(tekst) { $('teller').textContent = tekst }

function verversKeuze() {
  document.querySelectorAll('#vakken .vak').forEach(v => {
    const aan = gekozen.has(Number(v.dataset.nr))
    v.classList.toggle('gekozen', aan); v.setAttribute('aria-pressed', aan ? 'true' : 'false')
    v.querySelector('.vink').textContent = aan ? '✓' : ''
  })
  teller(gekozen.size + ' van ' + AANTAL + ' gekozen')
  const klaar = gekozen.size === AANTAL
  $('stap3').classList.toggle('verborgen', gekozen.size === 0)
  $('stap4').classList.toggle('verborgen', gekozen.size === 0)
  $('maakPakket').disabled = !klaar
  if (!klaar && gekozen.size) melding($('pakketMelding'), 'Kies er nog ' + (AANTAL - gekozen.size) + ' om het pakket te kunnen maken.', 'let-op')
  else if (klaar) melding($('pakketMelding'), '')
  bouwKaartjes()
}

// ── Stap 3: naam, beweging, geluid ──
function bouwKaartjes() {
  const lijst = $('gekozenLijst'); lijst.textContent = ''
  const volgorde = [...gekozen].sort((a, b) => a - b)
  volgorde.forEach((i, pos) => {
    if (!instelling.has(i)) { const v = voorstelFx(pos); instelling.set(i, { naam: ['Sticker ' + (pos + 1), 'Sticker ' + (pos + 1)], b: v.b, g: v.g }) }
    const inst = instelling.get(i)
    const plaatje = el('img', { src: uitsnedeUrl[i], alt: '' })
    const velden = el('div', { klas: 'velden' }, [
      el('div', { klas: 'nr', tekst: 'Sticker ' + (pos + 1) + ' (plaatje ' + (i + 1) + ')' }),
      el('div', { klas: 'twee' }, [
        tekstveld('Naam (Nederlands)', inst.naam[0], t => { inst.naam[0] = t }),
        tekstveld('Naam (Engels)', inst.naam[1], t => { inst.naam[1] = t }),
      ]),
      el('div', { klas: 'twee' }, [
        keuzeveld('Beweging', BEWEGINGEN, inst.b, k => { inst.b = k }),
        keuzeveld('Geluid uit de bibliotheek', GELUIDEN, inst.g, k => { inst.g = k }),
      ]),
      geluidBlok(inst),
      el('button', { type: 'button', klas: 'speel', tekst: '▶ Kijk en luister', onclick: () => speelProef(plaatje, inst) }),
    ])
    lijst.append(el('div', { klas: 'kaartje' }, [el('div', { klas: 'plaatje' }, [plaatje]), velden]))
  })
}
function tekstveld(label, waarde, bijWijziging) {
  const inv = el('input', { type: 'text', maxlength: '40', value: waarde })
  inv.addEventListener('input', () => bijWijziging(inv.value))
  return el('label', { klas: 'veld' }, [label, inv])
}
function keuzeveld(label, bron, waarde, bijWijziging) {
  const sel = el('select', {}, Object.entries(bron).map(([k, v]) => el('option', { value: k, tekst: v.naam[0] })))
  sel.value = waarde
  sel.addEventListener('change', () => bijWijziging(sel.value))
  return el('label', { klas: 'veld' }, [label, sel])
}

// ── Een eigen geluid per sticker (mp3) ──
// De Studio ruimt het geluid op (stilte eraf, even hard, kort, mono) en maakt er een kleine mp3 van (studio-geluid.js).
// Het geluid uit de bibliotheek blijft staan als terugval: dat klinkt als de mp3 op iemands toestel niet laadt.
class Uitleg extends Error {}
const MAX_BESTAND = 10 * 1024 * 1024, MAX_INVOER_SEC = 30
function laadLame() {
  if (window.lamejs) return Promise.resolve()
  if (!window._lameLaden) window._lameLaden = new Promise((klaar, mis) => {
    const sc = document.createElement('script')
    sc.src = 'lame.min.js?v=95'
    sc.onload = () => klaar()
    sc.onerror = () => { window._lameLaden = null; sc.remove(); mis(new Uitleg('De mp3-maker kon niet laden. Probeer het nog een keer.')) }
    document.head.appendChild(sc)
  })
  return window._lameLaden
}
async function maakEigenGeluid(bestand) {
  if (bestand.size > MAX_BESTAND) throw new Uitleg('Dit bestand is te groot (hoogstens 10 MB). Kies een kort geluid.')
  const buf = await bestand.arrayBuffer()
  const Ctx = window.AudioContext || window.webkitAudioContext
  let ab
  const cx = new Ctx()
  try { ab = await cx.decodeAudioData(buf) } catch (e) { throw new Uitleg('Dit bestand kon niet als geluid gelezen worden. Probeer een mp3 of wav.') } finally { try { cx.close() } catch (e) {} }
  if (ab.duration > MAX_INVOER_SEC) throw new Uitleg('Dit geluid is te lang (' + Math.round(ab.duration) + ' seconden). Knip er eerst een stukje uit van hoogstens ' + MAX_INVOER_SEC + ' seconden.')
  // naar mono op 44,1 kHz: de browser mengt en past de snelheid aan
  const uit = new OfflineAudioContext(1, Math.max(1, Math.ceil(ab.duration * SAMPLERATE)), SAMPLERATE)
  const bron = uit.createBufferSource(); bron.buffer = ab; bron.connect(uit.destination); bron.start()
  const mono = (await uit.startRendering()).getChannelData(0)
  const res = verwerk(mono, SAMPLERATE)
  if (res.fout) throw new Uitleg(res.fout)
  await laadLame()
  const mp3 = codeerMp3(res.samples, window.lamejs)
  if (mp3.length > MAX_MP3) throw new Uitleg('Dit geluid wordt te zwaar (' + Math.round(mp3.length / 1024) + ' kB). Kies een korter geluid.')
  return { mp3: await naarBase64(new Blob([mp3], { type: 'audio/mpeg' })), duur: res.duur, bytes: mp3.length, ingekort: res.ingekort }
}

// Het blok onder de keuzelijsten van één sticker: bestand kiezen, wat er van gemaakt is, bron, beschrijving kopiëren.
function geluidBlok(inst) {
  const blok = el('div', { klas: 'geluidblok' })
  const vul = (extra = null) => {
    blok.textContent = ''
    const status = el('div', { klas: 'geluidstatus' })
    if (extra) { status.className = 'geluidstatus ' + extra.soort; status.textContent = extra.tekst }
    else if (inst.mp3) status.textContent = '✓ Eigen geluid: ' + inst.mp3Info.duur.toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' seconden, ' +
      Math.max(1, Math.round(inst.mp3Info.bytes / 1024)) + ' kB' + (inst.mp3Info.ingekort ? ' (ingekort tot ' + MAX_SEC + ' seconden)' : '')
    const kies = el('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.m4a,.ogg' })
    kies.addEventListener('change', async () => {
      const f = kies.files[0]; if (!f) return
      vul({ soort: 'bezig', tekst: 'Bezig met opruimen…' })
      try {
        const g = await maakEigenGeluid(f)
        inst.mp3 = g.mp3; inst.mp3Info = g
        vul()
      } catch (e) { vul({ soort: 'fout', tekst: e instanceof Uitleg ? e.message : 'Dit geluid kon niet verwerkt worden. Probeer een ander bestand.' }) }
    })
    blok.append(el('label', { klas: 'veld' }, [inst.mp3 ? 'Ander eigen geluid kiezen (mp3, wav, m4a of ogg)' : 'Eigen geluid (mp3, wav, m4a of ogg; mag leeg)', kies]), status)
    if (inst.mp3) {
      const bron = el('input', { type: 'text', maxlength: String(MAX_BRON), value: inst.bron || '', placeholder: 'bijvoorbeeld Kenney.nl, CC0, of zelf opgenomen' })
      bron.addEventListener('input', () => { inst.bron = bron.value })
      blok.append(el('label', { klas: 'veld' }, ['Bron van dit geluid (verplicht)', bron]),
        el('button', { type: 'button', klas: 'speel stil', tekst: '✕ Eigen geluid weghalen', onclick: () => { delete inst.mp3; delete inst.mp3Info; delete inst.bron; vul() } }))
    }
    // de beschrijving voor een AI-geluidsmaker: met de naam en de beweging van deze sticker
    const kopieerRij = el('div', { klas: 'rij', style: 'gap:6px;margin-top:2px' })
    const terugmelding = el('span', { klas: 'nr' })
    for (const [taal, label] of [['en', '📋 Beschrijving (Engels)'], ['nl', '📋 Beschrijving (Nederlands)']]) {
      kopieerRij.append(el('button', { type: 'button', klas: 'speel stil', tekst: label, onclick: async () => {
        const b = inst.b === 'geen' ? '' : (BEWEGINGEN[inst.b]?.naam[taal === 'en' ? 1 : 0] || '')
        const ok = await kopieerTekst(maakGeluidPrompt({ naam: inst.naam[taal === 'en' ? 1 : 0] || inst.naam[0], beweging: b, taal }))
        terugmelding.textContent = ok ? '✓ Gekopieerd' : 'Kopiëren lukte niet'
      } }))
    }
    kopieerRij.append(terugmelding)
    blok.append(kopieerRij)
  }
  vul()
  return blok
}
// ▶ bij een sticker: de beweging, en het eigen geluid als dat er is (anders het geluid uit de bibliotheek)
function speelProef(plaatje, inst) {
  if (!inst.mp3) return speel(plaatje, { b: inst.b, g: inst.g })
  speelBeweging(plaatje, inst.b)
  const a = new Audio('data:audio/mpeg;base64,' + inst.mp3)
  a.play().catch(() => {})
}

// ── Stap 4: het pakketbestand ──
function alsWebp(canvas) {
  // WebP in de zwaarste kwaliteit die onder de grens blijft. Safari kan geen WebP maken: dan komt er een PNG uit.
  const probeer = (kw) => new Promise(ok => canvas.toBlob(b => ok(b), 'image/webp', kw))
  return (async () => {
    let blob = null
    for (const kw of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4]) {
      blob = await probeer(kw)
      if (!blob || blob.type !== 'image/webp') throw new Error('geen-webp')
      if (blob.size <= MAX_PLAATJE) break
    }
    return blob
  })()
}
const naarBase64 = blob => new Promise((ok, mis) => {
  const l = new FileReader()
  l.onload = () => ok(String(l.result).split(',')[1] || '')
  l.onerror = () => mis(new Error('lezen'))
  l.readAsDataURL(blob)
})

async function maakBestand() {
  const m = $('pakketMelding'), knop = $('maakPakket')
  if (gekozen.size !== AANTAL) return melding(m, 'Kies eerst precies ' + AANTAL + ' stickers.', 'let-op')
  knop.disabled = true
  melding(m, 'Pakket maken…')
  try {
    const volgorde = [...gekozen].sort((a, b) => a - b)
    const stickers = []
    for (const i of volgorde) {
      const inst = instelling.get(i)
      const blob = await alsWebp(eindCanvas(gevonden[i]))
      stickers.push({ naam: inst.naam, b: inst.b, g: inst.g, webp: await naarBase64(blob), ...(inst.mp3 ? { mp3: inst.mp3, bron: inst.bron || '' } : {}) })
    }
    const pakket = maakPakket({ titel: $('titel').value, uitleg: [$('uitlegNl').value, $('uitlegEn').value], stickers })
    const fouten = valideerPakket(pakket, { bewegingen: new Set(Object.keys(BEWEGINGEN)), geluiden: new Set(Object.keys(GELUIDEN)) })
    if (fouten.length) { melding(m, 'Het pakket is nog niet klaar:', 'fout', fouten); return }
    const bestandsnaam = (maakSlug($('titel').value) || 'pakket') + '.stekkypakket.json'
    download(bestandsnaam, JSON.stringify(pakket))
    melding(m, '✓ ' + bestandsnaam + ' is gemaakt en staat nu in je Downloads. Geef dit bestand aan Claude: die zet het pakket klaar in de app en jij (of Tijn) zegt "Merge".', 'goed')
  } catch (e) {
    melding(m, e && e.message === 'geen-webp'
      ? 'Deze browser kan geen WebP-plaatjes maken. Gebruik Chrome of Edge (op de pc), of Chrome op een Android-telefoon.'
      : 'Het pakket maken is mislukt. Probeer het nog een keer.', 'fout')
  } finally { knop.disabled = gekozen.size !== AANTAL }
}
function download(naam, tekst) {
  const url = URL.createObjectURL(new Blob([tekst], { type: 'application/json' }))
  const a = el('a', { href: url, download: naam })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

start()
