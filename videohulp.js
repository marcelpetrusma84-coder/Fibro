// videohulp.js — codec-detectie, remuxen en omzetten voor Fibro
// 2 september 2026: detectie en remuxen (mp4box).
// 4 oktober 2026: maakH264() zet elke video om naar H.264 in MP4 (Mediabunny).
//   Kiest zelf het geluidsspoor (AAC eerst), zodat video's met een extra spoor
//   (ruimtelijk geluid van nieuwe iPhones, iMovie) hun geluid houden.
//   Controleert of de uitkomst nog beeld heeft; o.veilig = tweede poging
//   (kleiner, 30 beelden per seconde). info.diag = technische samenvatting.
// 4 oktober 2026 (middag): elke video wordt omgezet naar 720p H.264 met een vaste
//   bitrate. Wordt hij dan te groot of is hij te lang, dan weigeren we hem
//   ('te-groot' / 'te-lang') in plaats van de kwaliteit te verlagen.
//   Fout opgelost: new Quality(getal) is een kwaliteitsfactor, geen bitrate.

let mp4boxPromise = null

// Laadt mp4box.js pas als het nodig is.
async function laadMp4box() {
  if (window.MP4Box) return window.MP4Box
  if (!mp4boxPromise) {
    mp4boxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js'
      s.onload = () => resolve(window.MP4Box)
      s.onerror = () => reject(new Error('mp4box laden mislukt'))
      document.head.appendChild(s)
    })
  }
  return mp4boxPromise
}

// Leest de codec-informatie uit een videobestand.
// Geeft terug: { container, videoCodec, audioCodec, duur, afspeelbaar, reden }
export async function onderzoekVideo(file) {
  const uit = {
    container: file.type || '(onbekend)',
    naam: file.name,
    bytes: file.size,
    videoCodec: null,
    audioCodec: null,
    duur: null,
    afspeelbaar: false,
    reden: ''
  }
  try {
    const MP4Box = await laadMp4box()
    const buf = await file.arrayBuffer()
    buf.fileStart = 0
    const mp4 = MP4Box.createFile()

    const info = await new Promise((resolve, reject) => {
      const tijd = setTimeout(() => reject(new Error('tijd op')), 15000)
      mp4.onReady = i => { clearTimeout(tijd); resolve(i) }
      mp4.onError = e => { clearTimeout(tijd); reject(new Error(String(e))) }
      mp4.appendBuffer(buf)
      mp4.flush()
    })

    uit.duur = info.duration / info.timescale
    for (const t of info.tracks) {
      if (t.video) uit.videoCodec = t.codec
      else if (t.audio) uit.audioCodec = t.codec
    }
    uit.merk = info.brands ? info.brands.join(',') : ''

    const v = String(uit.videoCodec || '')
    if (/^avc1/i.test(v)) {
      uit.afspeelbaar = true
      uit.reden = 'H.264 — werkt overal'
    } else if (/^(hvc1|hev1)/i.test(v)) {
      uit.afspeelbaar = false
      uit.reden = 'HEVC (H.265) — werkt niet op Linux en de meeste Android-toestellen'
    } else if (/^(vp09|vp8|av01)/i.test(v)) {
      uit.afspeelbaar = false
      uit.reden = 'VP9/AV1 — werkt niet op oudere iPhones'
    } else {
      uit.reden = 'onbekende codec: ' + v
    }
  } catch (e) {
    uit.reden = 'kon niet lezen: ' + (e && e.message)
  }
  return uit
}

// Voor de BROWSER-CONSOLE: kies een bestand en zie wat erin zit.
window.testVideo = function () {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'video/*'
  inp.onchange = async () => {
    const f = inp.files[0]
    if (!f) return
    console.log('[video] onderzoeken:', f.name, Math.round(f.size / 1048576) + ' MB')
    console.log(await onderzoekVideo(f))
  }
  inp.click()
}

// ── Remuxen: haalt de tracks uit een .mov en schrijft ze in een MP4-doos.
// Geen hercodering, dus verliesloos en snel. Zelfde bestandsgrootte.
export async function remuxNaarMp4(file, opLog) {
  const log = opLog || (() => {})
  const MP4Box = await laadMp4box()
  const buf = await file.arrayBuffer()
  buf.fileStart = 0

  const bron = MP4Box.createFile()
  const info = await new Promise((resolve, reject) => {
    const tijd = setTimeout(() => reject(new Error('lezen duurde te lang')), 30000)
    bron.onReady = i => { clearTimeout(tijd); resolve(i) }
    bron.onError = e => { clearTimeout(tijd); reject(new Error('lezen mislukt: ' + e)) }
    bron.appendBuffer(buf)
    bron.flush()
  })
  log('gelezen: ' + info.tracks.length + ' tracks')

  const doel = MP4Box.createFile()
  const koppeling = {}

  for (const t of info.tracks) {
    if (!t.video && !t.audio) { log('track ' + t.id + ' overgeslagen (' + t.codec + ')'); continue }
    const opties = {
      timescale: t.timescale,
      duration: t.duration,
      language: t.language,
      type: t.codec.split('.')[0]
    }
    if (t.video) {
      opties.width = t.video.width
      opties.height = t.video.height
    }
    if (t.audio) {
      opties.channel_count = t.audio.channel_count
      opties.samplerate = t.audio.sample_rate
      opties.samplesize = t.audio.sample_size
    }
    const trak = bron.getTrackById(t.id)
    if (trak && trak.mdia && trak.mdia.minf && trak.mdia.minf.stbl) {
      for (const entry of trak.mdia.minf.stbl.stsd.entries) {
        if (entry.avcC) opties.description = entry.avcC
        else if (entry.hvcC) opties.description = entry.hvcC
        else if (entry.esds) opties.description = entry.esds
      }
    }
    koppeling[t.id] = doel.addTrack(opties)
  }
  return { bron, doel, koppeling, info, log }
}

function pakConfig(box) {
  const DS = window.DataStream || (window.MP4Box && window.MP4Box.DataStream)
  if (!DS) throw new Error('DataStream niet gevonden in mp4box')
  const stream = new DS(undefined, 0, DS.BIG_ENDIAN)
  box.write(stream)
  return new Uint8Array(stream.buffer, 8)
}

// Kopieert alle samples van bron naar doel en levert een MP4-Blob op.
export async function maakMp4(file, opLog) {
  const log = opLog || (() => {})
  const { bron, doel, koppeling, info } = await remuxNaarMp4(file, log)

  const teDoen = {}
  const gedaan = {}
  for (const t of info.tracks) {
    if (!koppeling[t.id]) continue
    teDoen[t.id] = t.nb_samples
    gedaan[t.id] = 0
  }

  await new Promise((resolve, reject) => {
    const tijd = setTimeout(() => reject(new Error('samples ophalen duurde te lang')), 120000)

    bron.onSamples = (id, gebruiker, samples) => {
      for (const s of samples) {
        doel.addSample(koppeling[id], s.data, {
          duration: s.duration,
          dts: s.dts,
          cts: s.cts,
          is_sync: s.is_sync
        })
      }
      gedaan[id] = (gedaan[id] || 0) + samples.length
      let klaar = true
      for (const k in teDoen) if (gedaan[k] < teDoen[k]) klaar = false
      if (klaar) { clearTimeout(tijd); resolve() }
    }

    for (const k in teDoen) {
      bron.setExtractionOptions(parseInt(k, 10), null, { nbSamples: teDoen[k] })
    }
    bron.start()
  })

  const totaal = Object.keys(gedaan).map(k => k + '=' + gedaan[k]).join(' ')
  log('samples gekopieerd: ' + totaal)
  const buffer = doel.getBuffer()
  return new Blob([buffer], { type: 'video/mp4' })
}

// Voor de BROWSER-CONSOLE: kies een .mov, pak hem om, speel hem af.
window.testRemux = function () {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'video/*'
  inp.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:#fff;padding:8px'
  document.body.appendChild(inp)
  inp.onchange = async () => {
    const f = inp.files[0]
    if (!f) return
    console.log('[remux] start:', f.name, Math.round(f.size / 1048576 * 10) / 10 + ' MB')
    const begin = Date.now()
    try {
      const blob = await maakMp4(f, m => console.log('[remux]', m))
      const sec = Math.round((Date.now() - begin) / 100) / 10
      console.log('[remux] klaar in', sec + 's', '-', Math.round(blob.size / 1048576 * 10) / 10 + ' MB')
      const v = document.createElement('video')
      v.src = URL.createObjectURL(blob)
      v.controls = true
      v.style.cssText = 'position:fixed;top:60px;left:10px;width:420px;z-index:99999;background:#000'
      document.body.appendChild(v)
      window._remuxVideo = v
      console.log('[remux] speler toegevoegd. Weghalen: _remuxVideo.remove()')
    } catch (e) {
      console.error('[remux] mislukt:', e)
    }
    inp.remove()
  }
}

// ── Omzetten naar H.264 in MP4 (4 oktober 2026)
// iPhones filmen in HEVC (H.265). Dat speelt niet af op Linux en op veel
// Android-toestellen. maakH264() zet de video om met de video-hardware van
// het toestel zelf (WebCodecs, via Mediabunny). De server doet niets.
// Geeft altijd een nieuwe MP4 (720p, H.264) terug. o.opInfo(info) krijgt te horen wat er met het geluid gebeurt:
// info.geluid = 'meegenomen' | 'weg' | 'geen', info.sporen = codecs van de geluidssporen.
let mbPromise = null
function laadMediabunny() {
  if (!mbPromise) {
    mbPromise = import('./mediabunny.js?v=1').catch(e => { mbPromise = null; throw e })
  }
  return mbPromise
}

export async function maakH264(file, opties) {
  const o = opties || {}
  const opVoortgang = o.opVoortgang || (() => {})
  const opInfo = o.opInfo || (() => {})
  const maxBytes = o.maxBytes || 100 * 1024 * 1024
  const maxDuur = o.maxDuur || 300
  const veilig = !!o.veilig
  const KORT = veilig ? 540 : 720          // korte zijde: 720p (veilige stand 540p)
  const LANG = veilig ? 960 : 1280         // lange zijde
  const BITS = veilig ? 1500000 : 2500000  // beeld, bits per seconde
  const log = m => console.log('[omzetten]', m)

  const mb = await laadMediabunny()
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  let formaat
  try { formaat = await input.getFormat() } catch (e) { throw new Error('onbekend') }
  const vtrack = await input.getPrimaryVideoTrack()
  if (!vtrack) throw new Error('onbekend')
  const bronCodec = vtrack.codec
  log('bron: ' + (formaat && formaat.name) + ', ' + bronCodec + ', ' +
      vtrack.displayWidth + 'x' + vtrack.displayHeight + ', ' + Math.round(file.size / 1048576) + ' MB')

  const geluidSporen = await input.getAudioTracks()
  const sporen = geluidSporen.map(t => t.codec || 'onbekend')
  log('geluidssporen: ' + (sporen.join(', ') || 'geen'))
  let fps = 0
  try { fps = (await vtrack.computePacketStats(120)).averagePacketRate || 0 } catch (e) {}
  let diag = (veilig ? '[veilig] ' : '') + 'bron: ' + ((formaat && formaat.name) || '?') + ' ' + bronCodec + ' ' +
    vtrack.displayWidth + 'x' + vtrack.displayHeight + (fps ? ' ' + Math.round(fps) + 'fps' : '') +
    ' ' + Math.round(file.size / 1048576) + 'MB, geluid ' + (sporen.join('+') || 'geen')
  const meldInfo = extra => {
    try { localStorage.setItem('fibro_video_diag', diag) } catch (e) {}
    log(diag)
    opInfo(Object.assign({ sporen, diag }, extra))
  }

  // Geluidsspoor kiezen: eerst AAC (kan zonder omzetten mee), anders het eerste dat te lezen is
  let geluid = geluidSporen.find(t => t.codec === 'aac') || null
  if (!geluid) {
    for (const t of geluidSporen) {
      try { if (t.codec && await t.canDecode()) { geluid = t; break } } catch (e) {}
    }
  }
  if (geluid) log('gekozen geluidsspoor: ' + geluid.codec + ' (spoor ' + geluid.id + ')')

  const duur = await input.computeDuration()
  if (duur > maxDuur + 0.5) {
    diag += ' | te lang (' + Math.round(duur) + 's)'
    meldInfo({ geluid: 'onbekend', duur })
    throw new Error('te-lang')
  }

  // Afmetingen: hoogstens 720p (korte zijde 720, lange zijde 1280), nooit groter maken
  const w = vtrack.displayWidth, h = vtrack.displayHeight
  const schaal = Math.min(1, KORT / Math.min(w, h), LANG / Math.max(w, h))
  const nw = Math.max(2, Math.round(w * schaal / 2) * 2)
  const nh = Math.max(2, Math.round(h * schaal / 2) * 2)
  // Vaste bitrate; kleiner beeld krijgt naar verhouding minder, en nooit meer dan de bron had
  let bits = Math.round(BITS * Math.min(1, (nw * nh) / (LANG * KORT)))
  if (duur > 0) bits = Math.min(bits, Math.round(file.size * 8 / duur))
  bits = Math.max(500000, bits)
  // Past het straks? Zo niet, dan meteen weigeren (niet eerst minutenlang omzetten)
  const schatting = Math.round(duur * (bits + 160000) / 8 * 1.05)
  if (schatting > maxBytes) {
    diag += ' | te groot: ~' + Math.round(schatting / 1048576) + 'MB na omzetten, max ' + Math.round(maxBytes / 1048576) + 'MB'
    meldInfo({ geluid: 'onbekend', duur, schatting })
    throw new Error('te-groot')
  }
  if (!(await vtrack.canDecode())) { diag += ' | kan bron niet lezen'; meldInfo({ geluid: 'onbekend' }); throw new Error('niet-te-lezen') }
  // Let op: new Quality(getal) is een kwaliteitsfactor; een bitrate moet als { bitrate } (dat ging mis)
  const kwaliteit = new mb.Quality({ bitrate: bits })
  const kan = await mb.canEncodeVideo('avc', { width: nw, height: nh, quality: kwaliteit })
  if (!kan) { diag += ' | kan geen H.264 ' + nw + 'x' + nh + ' maken'; meldInfo({ geluid: 'onbekend' }); throw new Error('niet-te-maken') }
  const videoOpties = { codec: 'avc', width: nw, height: nh, fit: 'contain', quality: kwaliteit }
  // Meer dan 30 beelden per seconde past niet bij het H.264-niveau dat gekozen wordt
  if (veilig || fps > 31) videoOpties.frameRate = 30
  diag += ' | omzetten naar ' + nw + 'x' + nh + ' ' + Math.round(bits / 1000) + 'kbit/s' + (videoOpties.frameRate ? ' 30fps' : '')
  log('omzetten naar ' + nw + 'x' + nh + ', ' + Math.round(bits / 1000) + ' kbit/s')

  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new mb.BufferTarget()
  })
  let conv
  try {
    conv = await mb.Conversion.init({
      input, output,
      tracks: 'all',
      video: t => (t.id === vtrack.id ? videoOpties : { discard: true }),
      audio: t => (geluid && t.id === geluid.id ? { codec: 'aac' } : { discard: true }),
      showWarnings: false
    })
  } catch (e) {
    diag += ' | fout bij voorbereiden: ' + String((e && e.message) || e).slice(0, 120)
    meldInfo({ geluid: 'onbekend' })
    throw new Error('niet-te-maken')
  }
  for (const d of conv.discardedTracks) {
    log('spoor ' + d.track.id + ' (' + d.track.type + ') weggelaten: ' + d.reason)
    if (d.reason !== 'discarded_by_user') diag += ' | ' + d.track.type + ' weg: ' + d.reason
  }
  const geluidMee = !!geluid && conv.utilizedTracks.some(t => t.id === geluid.id)
  const geluidStand = geluidMee ? 'meegenomen' : (sporen.length ? 'weg' : 'geen')
  if (!conv.isValid || !conv.utilizedTracks.some(t => t.id === vtrack.id)) {
    diag += ' | beeld kan niet mee'
    meldInfo({ geluid: geluidStand })
    throw new Error('geen-beeld')
  }
  conv.onProgress = p => opVoortgang(p)
  try { await conv.execute() } catch (e) {
    diag += ' | fout bij omzetten: ' + String((e && e.message) || e).slice(0, 120)
    meldInfo({ geluid: geluidStand })
    throw new Error('niet-te-maken')
  }
  const blob = new Blob([output.target.buffer], { type: 'video/mp4' })
  // Uitkomst nalezen: zit er nog een beeldspoor in, en welk?
  let uitBeeld = null
  try {
    const uit = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS })
    const ut = await uit.getPrimaryVideoTrack()
    if (ut) uitBeeld = ((await ut.getCodecParameterString()) || ut.codec) + ' ' + ut.displayWidth + 'x' + ut.displayHeight
  } catch (e) { uitBeeld = null }
  diag += ' | uit: ' + (uitBeeld || 'GEEN BEELD') + ' ' + Math.round(blob.size / 1048576 * 10) / 10 + 'MB'
  meldInfo({ geluid: geluidStand })
  if (!uitBeeld) throw new Error('geen-beeld')
  return blob
}
