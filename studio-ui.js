// studio-ui.js (23 nov 2026, Stekky Studio stap 1) - het scherm van studio.html: een plaat met stickers inladen, de stickers
// losknippen, er 12 kiezen, naam/beweging/geluid bepalen en een pakketbestand (naam.stekkypakket.json) maken.
// Het knippen zit in studio-knippen.js, het pakketbestand in studio-pakket.js (beide zonder scherm, met tests).
// Alleen voor moderators (zoals moderatie.html): ben_ik_moderator.
import { supabase } from './supabase.js?v=95'
import { BEWEGINGEN, GELUIDEN, speel } from './stickerfx.js?v=236'
import { vindStickers, knipRooster, maakUitsnede } from './studio-knippen.js?v=1'
import { AANTAL, MAX_PLAATJE, voorstelFx, maakPakket, valideerPakket, maakSlug } from './studio-pakket.js?v=1'
import { maakPrompt, roosterOpmerking } from './studio-prompt.js?v=1'

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
async function kopieerPrompt() {
  const m = $('kopieerMelding'), veld = $('promptTekst')
  let gelukt = false
  try { await navigator.clipboard.writeText(veld.value); gelukt = true } catch (e) {
    // geen toegang tot het klembord (oudere browser, of een venster zonder rechten): selecteren en het oude kopieerkommando
    try { veld.focus(); veld.select(); gelukt = document.execCommand('copy') } catch (e2) { gelukt = false }
  }
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
        keuzeveld('Geluid', GELUIDEN, inst.g, k => { inst.g = k }),
      ]),
      el('button', { type: 'button', klas: 'speel', tekst: '▶ Kijk en luister', onclick: () => speel(plaatje, { b: inst.b, g: inst.g }) }),
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
      stickers.push({ naam: inst.naam, b: inst.b, g: inst.g, webp: await naarBase64(blob) })
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
