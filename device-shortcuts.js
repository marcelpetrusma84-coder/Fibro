// This package contains public navigation links and the app icon only.
// It deliberately has no access to account storage, cookies or cryptographic keys.
const tekstEncoder = new TextEncoder()
const controleTekens = /[\u0000-\u001f\u007f]/u
const encodedControleTekens = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/iu
const uuidPad = /(?:^|\/)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/|$)/iu

function publiekeAppBasis(baseUrl) {
  const invoer = baseUrl instanceof URL ? baseUrl.href : baseUrl
  if (typeof invoer !== 'string' || controleTekens.test(invoer) || encodedControleTekens.test(invoer) || invoer.includes('\\')) {
    throw new TypeError('Use a public HTTP(S) app URL without control characters.')
  }
  const basis = new URL(invoer)
  if (!['https:', 'http:'].includes(basis.protocol) || !basis.hostname || basis.username || basis.password) {
    throw new TypeError('Use a public HTTP(S) app URL without embedded credentials.')
  }
  // Neither a friend/account ID nor a recovery token belongs in a shortcut.
  basis.search = ''
  basis.hash = ''
  let leesbaarPad
  try { leesbaarPad = decodeURIComponent(basis.pathname) } catch {
    throw new TypeError('Use a valid public app URL.')
  }
  if (uuidPad.test(leesbaarPad) || /(?:^|\/)(?:access_token|refresh_token|recovery|reset-password|token)(?:\/|$)/iu.test(leesbaarPad)) {
    throw new TypeError('Use the app folder URL, not a personal or recovery URL.')
  }
  if (!basis.pathname.endsWith('/')) {
    const laatste = basis.pathname.slice(basis.pathname.lastIndexOf('/') + 1)
    basis.pathname = /\.[a-z0-9]+$/iu.test(laatste)
      ? basis.pathname.slice(0, basis.pathname.lastIndexOf('/') + 1)
      : `${basis.pathname}/`
  }
  return basis
}

function bytes(data) {
  if (data instanceof Uint8Array) return new Uint8Array(data)
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0))
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  throw new TypeError('File data must be a Uint8Array or ArrayBuffer.')
}

function base64(data) {
  const alfabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const delen = []
  for (let i = 0; i < data.length; i += 3) {
    const waarde = (data[i] << 16) | ((data[i + 1] || 0) << 8) | (data[i + 2] || 0)
    delen.push(alfabet[(waarde >>> 18) & 63], alfabet[(waarde >>> 12) & 63],
      i + 1 < data.length ? alfabet[(waarde >>> 6) & 63] : '=',
      i + 2 < data.length ? alfabet[waarde & 63] : '=')
  }
  return delen.join('')
}

function icoVanPng(png) {
  const signatuur = [137, 80, 78, 71, 13, 10, 26, 10]
  if (png.length < 45 || !signatuur.every((waarde, i) => png[i] === waarde)) {
    throw new TypeError('The Fibro icon must be a PNG image.')
  }
  const bron = new DataView(png.buffer, png.byteOffset, png.byteLength)
  if (bron.getUint32(8) !== 13 || bron.getUint32(12) !== 0x49484452 || bron.getUint32(png.length - 8) !== 0x49454e44) {
    throw new TypeError('The Fibro icon must be a complete PNG image.')
  }
  const breedte = bron.getUint32(16), hoogte = bron.getUint32(20)
  if (!breedte || breedte !== hoogte || breedte > 256) {
    throw new TypeError('Use a square PNG icon between 1 and 256 pixels.')
  }
  const ico = new Uint8Array(22 + png.length)
  const doel = new DataView(ico.buffer)
  doel.setUint16(2, 1, true)
  doel.setUint16(4, 1, true)
  ico[6] = breedte === 256 ? 0 : breedte
  ico[7] = hoogte === 256 ? 0 : hoogte
  doel.setUint16(10, 1, true)
  doel.setUint16(12, 32, true)
  doel.setUint32(14, png.length, true)
  doel.setUint32(18, 22, true)
  ico.set(png, 22)
  return ico
}

function escapeMarkup(value) {
  return value.replace(/[&<>"']/gu, teken => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[teken])
}

function webloc(url) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>URL</key><string>${escapeMarkup(url)}</string></dict></plist>\n`
}

function windowsLink(url) {
  return `[InternetShortcut]\r\nURL=${url}\r\nIconFile=Fibro.ico\r\nIconIndex=0\r\n`
}

/** Build a portable folder. Pass the existing icon-192.png as bytes or a Blob. */
export async function maakSnelkoppelingen({ baseUrl, iconPng } = {}) {
  const basis = publiekeAppBasis(baseUrl)
  const home = new URL('index.html', basis).href
  const herstel = new URL('login.html#herstellen', basis).href
  const png = bytes(typeof Blob !== 'undefined' && iconPng instanceof Blob ? await iconPng.arrayBuffer() : iconPng)
  const ico = icoVanPng(png)
  const afbeelding = `data:image/png;base64,${base64(png)}`
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Fibro</title><link rel="icon" href="${afbeelding}">
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#160b27;color:#f9f4ff;font:1rem/1.6 system-ui,sans-serif;padding:24px}main{width:min(100%,460px)}header{display:flex;align-items:center;gap:16px;margin-bottom:24px}img{width:64px;height:64px;border-radius:16px}h1{font-size:2rem;margin:0}p{color:#d8cce4}a{display:block;color:inherit;text-decoration:none;border:1px solid #70518f;border-radius:18px;padding:18px 20px;margin:12px 0;background:linear-gradient(135deg,#3b2355,#241535)}a:hover,a:focus-visible{border-color:#d4a3ff;outline:2px solid #d4a3ff;outline-offset:3px}strong,small{display:block}small{color:#d8cce4}footer{font-size:.875rem;margin-top:24px}</style></head>
<body><main><header><img src="${afbeelding}" alt="" width="64" height="64"><h1>Fibro</h1></header>
<a href="${escapeMarkup(home)}"><strong>Home</strong><small>Your profile and guestbook</small></a>
<a href="${escapeMarkup(herstel)}"><strong>Key recovery</strong><small>Open the options to restore your device key</small></a>
<footer><p>These are ordinary links. Sign in when asked. This folder contains no private key, recovery code or login credentials.</p><p>Keep your recovery code separately in a safe place.</p></footer></main></body></html>\n`
  const readme = `FIBRO\n\nHome: ${home}\nKey recovery: ${herstel}\n\nWindows: open Home.url or Key recovery.url.\nMac: open Home.webloc or Key recovery.webloc.\nAny device: open Fibro.html, or use either link above in your browser.\n\nKeep all files together. Fibro.png and Fibro.ico are app icons.\nWindows may need you to choose Fibro.ico manually in the shortcut properties.\nA browser cannot automatically set your operating system's folder icon.\n\nThese are ordinary links and may ask you to sign in. They do not bypass login.\nThis folder contains no private key, recovery code, account ID or login credentials.\nKeep your recovery code separately in a safe place. Opening Key recovery does\nnot automatically replace a key; follow the instructions in Fibro.\n\nOn a phone, use your browser's Add to Home Screen or Install App option.\nThe phone's operating system controls app folders and home-screen placement.\n`
  return [
    { name: 'Home.url', data: tekstEncoder.encode(windowsLink(home)) },
    { name: 'Key recovery.url', data: tekstEncoder.encode(windowsLink(herstel)) },
    { name: 'Home.webloc', data: tekstEncoder.encode(webloc(home)) },
    { name: 'Key recovery.webloc', data: tekstEncoder.encode(webloc(herstel)) },
    { name: 'Fibro.html', data: tekstEncoder.encode(html) },
    { name: 'Fibro.ico', data: ico },
    { name: 'Fibro.png', data: png },
    { name: 'README.txt', data: tekstEncoder.encode(readme) }
  ]
}

/** Save into a new folder only; the caller owns the browser's directory picker. */
export async function schrijfSnelkoppelingMap(parent, entries) {
  if (!parent || typeof parent.getDirectoryHandle !== 'function' || !Array.isArray(entries)) {
    throw new TypeError('Use a directory handle and an array of shortcut files.')
  }
  const names = new Set()
  // Validate and copy every payload before creating anything on the device.
  const files = Array.from(entries, entry => {
    if (!entry || typeof entry.name !== 'string') throw new TypeError('Unsafe shortcut filename.')
    const name = entry.name.normalize('NFC')
    if (!veiligArchiefPad(name) || name.includes('/') || /[<>"|?*]/u.test(name)
      || name.length > 255 || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) {
      throw new TypeError('Use a safe, single shortcut filename.')
    }
    const unique = name.toLocaleLowerCase('en-US')
    if (names.has(unique)) throw new TypeError('Duplicate shortcut filename.')
    names.add(unique)
    return { name, data:bytes(entry.data) }
  })

  let target, folderName
  for (let number = 1; number <= 100; number++) {
    const name = number === 1 ? 'Fibro' : `Fibro ${number}`
    try { await parent.getDirectoryHandle(name) }
    catch (error) {
      if (error.name === 'TypeMismatchError') continue // A file occupies this name.
      if (error.name !== 'NotFoundError') throw error
      target = await parent.getDirectoryHandle(name, { create:true })
      folderName = name
      break
    }
  }
  if (!target) throw new Error('No unused Fibro folder name is available.')

  // A directory picker has no exclusive mkdir operation. Refuse existing files
  // in the returned handle too, rather than truncating an unexpected collision.
  for (const file of files) {
    try { await target.getFileHandle(file.name) }
    catch (error) {
      if (error.name === 'NotFoundError') continue
      throw error
    }
    const error = new Error('A shortcut file already exists in the new folder.')
    error.name = 'InvalidModificationError'
    throw error
  }
  for (const file of files) {
    const handle = await target.getFileHandle(file.name, { create:true })
    const writer = await handle.createWritable()
    try { await writer.write(file.data); await writer.close() }
    catch (error) { await writer.abort().catch(() => {}); throw error }
  }
  return { name:folderName, fileCount:files.length }
}

const crcTabel = Uint32Array.from({ length: 256 }, (_, i) => {
  let crc = i
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  return crc >>> 0
})

function crc32(data) {
  let crc = 0xffffffff
  for (const waarde of data) crc = (crc >>> 8) ^ crcTabel[(crc ^ waarde) & 255]
  return (crc ^ 0xffffffff) >>> 0
}

function veiligArchiefPad(naam) {
  return typeof naam === 'string' && naam.length > 0 && !controleTekens.test(naam)
    && !/[\\:]/u.test(naam) && naam.split('/').every(deel => deel && deel !== '.' && deel !== '..' && !/[. ]$/u.test(deel))
}

/** Dependency-free ZIP (stored entries, UTF-8 names, CRC-32; no ZIP64). */
export function maakZip(entries, root = 'Fibro') {
  if (!Array.isArray(entries) || entries.length > 65535 || !veiligArchiefPad(root) || root.includes('/')) {
    throw new TypeError('Use a safe folder name and at most 65535 files.')
  }
  const namen = new Set()
  let lokaalLengte = 0, centraalLengte = 0
  const bestanden = entries.map(entry => {
    if (!entry || !veiligArchiefPad(entry.name)) throw new TypeError('Unsafe ZIP entry name.')
    const naam = tekstEncoder.encode(`${root}/${entry.name}`)
    const uniek = entry.name.toLocaleLowerCase('en-US')
    if (namen.has(uniek)) throw new TypeError('Duplicate ZIP entry name.')
    namen.add(uniek)
    const data = bytes(entry.data)
    if (naam.length > 65535 || data.length > 0xffffffff) throw new RangeError('ZIP entry is too large.')
    const offset = lokaalLengte
    lokaalLengte += 30 + naam.length + data.length
    centraalLengte += 46 + naam.length
    return { naam, data, offset, crc: crc32(data) }
  })
  const totaleLengte = lokaalLengte + centraalLengte + 22
  if (totaleLengte > 0xffffffff) throw new RangeError('ZIP64 archives are not supported.')
  const archief = new Uint8Array(totaleLengte), view = new DataView(archief.buffer)
  let lokaal = 0, centraal = lokaalLengte
  for (const bestand of bestanden) {
    view.setUint32(lokaal, 0x04034b50, true)
    view.setUint16(lokaal + 4, 20, true)
    view.setUint16(lokaal + 6, 0x0800, true)
    view.setUint16(lokaal + 12, 33, true) // 1980-01-01, a deterministic DOS date.
    view.setUint32(lokaal + 14, bestand.crc, true)
    view.setUint32(lokaal + 18, bestand.data.length, true)
    view.setUint32(lokaal + 22, bestand.data.length, true)
    view.setUint16(lokaal + 26, bestand.naam.length, true)
    archief.set(bestand.naam, lokaal + 30)
    archief.set(bestand.data, lokaal + 30 + bestand.naam.length)
    lokaal += 30 + bestand.naam.length + bestand.data.length

    view.setUint32(centraal, 0x02014b50, true)
    view.setUint16(centraal + 4, 20, true)
    view.setUint16(centraal + 6, 20, true)
    view.setUint16(centraal + 8, 0x0800, true)
    view.setUint16(centraal + 14, 33, true)
    view.setUint32(centraal + 16, bestand.crc, true)
    view.setUint32(centraal + 20, bestand.data.length, true)
    view.setUint32(centraal + 24, bestand.data.length, true)
    view.setUint16(centraal + 28, bestand.naam.length, true)
    view.setUint32(centraal + 42, bestand.offset, true)
    archief.set(bestand.naam, centraal + 46)
    centraal += 46 + bestand.naam.length
  }
  view.setUint32(centraal, 0x06054b50, true)
  view.setUint16(centraal + 8, bestanden.length, true)
  view.setUint16(centraal + 10, bestanden.length, true)
  view.setUint32(centraal + 12, centraalLengte, true)
  view.setUint32(centraal + 16, lokaalLengte, true)
  return archief
}
