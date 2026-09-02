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
