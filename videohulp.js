// videohulp.js — codec-detectie en remuxen voor Fibro (2 september 2026)
// Stap 1: alleen detectie. Remuxen volgt in stap 2.

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
        if (entry.avcC) opties.avcDecoderConfigRecord = pakConfig(entry.avcC)
        else if (entry.hvcC) opties.hevcDecoderConfigRecord = pakConfig(entry.hvcC)
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
