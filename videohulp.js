// videohulp.js — video omzetten voor Fibro
// 4 oktober 2026: maakH264() zet elke video om naar H.264 in MP4 (Mediabunny).
//   Kiest zelf het geluidsspoor (AAC eerst), zodat video's met een extra spoor
//   (ruimtelijk geluid van nieuwe iPhones, iMovie) hun geluid houden.
//   Controleert of de uitkomst nog beeld heeft; o.veilig = tweede poging
//   (kleiner, 30 beelden per seconde). info.diag = technische samenvatting.
// 4 oktober 2026 (middag): elke video wordt omgezet naar 720p H.264 met een vaste
//   bitrate. Wordt hij dan te groot of is hij te lang, dan weigeren we hem
//   ('te-groot' / 'te-lang') in plaats van de kwaliteit te verlagen.
//   Fout opgelost: new Quality(getal) is een kwaliteitsfactor, geen bitrate.
// 6 oktober 2026 (v123): de oude mp4box-code (detectie en remuxen, sinds 2 september)
//   is weg. Die werd niet meer gebruikt en laadde mp4box van jsdelivr (Amerikaans).
//   index.html laadt dit bestand nu pas als je een video kiest.

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
