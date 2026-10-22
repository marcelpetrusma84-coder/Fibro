import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakSnelkoppelingen, maakZip } from '../../device-shortcuts.js'

const icon = new Uint8Array(readFileSync(new URL('../../icon-192.png', import.meta.url)))
const decoder = new TextDecoder()
const entries = await maakSnelkoppelingen({
  baseUrl: 'https://example.com/Fibro/chat.html?vriend=private-user-id&access_token=secret#secret-key',
  iconPng: icon
})
const text = name => decoder.decode(entries.find(entry => entry.name === name).data)
assert.equal(entries.length, 8)
assert.ok(entries.every(entry => entry.data instanceof Uint8Array))
assert.match(text('Home.url'), /URL=https:\/\/example\.com\/Fibro\/index\.html\r\n/u)
assert.match(text('Key recovery.url'), /URL=https:\/\/example\.com\/Fibro\/login\.html#herstellen\r\n/u)
for (const entry of entries.filter(entry => !['Fibro.ico', 'Fibro.png'].includes(entry.name))) {
  assert.doesNotMatch(decoder.decode(entry.data), /private-user-id|secret-key|access_token|[?]vriend=/u)
}
assert.match(text('Fibro.html'), /data:image\/png;base64,/u)
assert.match(text('Fibro.html'), /no private key, recovery code or login credentials/u)
assert.match(text('README.txt'), /do not bypass login/u)
assert.deepEqual(entries.find(entry => entry.name === 'Fibro.png').data, icon)
const ico = entries.find(entry => entry.name === 'Fibro.ico').data
const icoHeader = new DataView(ico.buffer)
assert.equal(icoHeader.getUint16(0, true), 0)
assert.equal(icoHeader.getUint16(2, true), 1)
assert.equal(icoHeader.getUint16(4, true), 1)
assert.equal(ico[6], 192)
assert.equal(ico[7], 192)
assert.equal(icoHeader.getUint32(14, true), icon.length)
assert.equal(icoHeader.getUint32(18, true), 22)
assert.deepEqual(ico.subarray(22), icon)

for (const baseUrl of [
  'file:///tmp/Fibro/', 'javascript:alert(1)', 'data:text/html,test',
  'https://user:password@example.com/Fibro/', 'https://example.com/Fibro/\r\nIconFile=evil',
  'https://example.com/Fibro/%0d%0aevil/', 'https://example.com/Fibro/\ttest/',
  'https://example.com/Fibro\\evil/',
  'https://example.com/Fibro/8a396131-2591-47ee-a8b3-229e4100f9f7/',
  'https://example.com/Fibro/%38a396131-2591-47ee-a8b3-229e4100f9f7/',
  'https://example.com/Fibro/recovery/private-token/'
]) await assert.rejects(maakSnelkoppelingen({ baseUrl, iconPng: icon }), TypeError)

for (const [baseUrl, expected] of [
  ['https://example.com', 'https://example.com/index.html'],
  ['https://example.com/Fibro', 'https://example.com/Fibro/index.html'],
  ['https://example.com/a/Fibro/', 'https://example.com/a/Fibro/index.html'],
  ['http://127.0.0.1:8127/login.html#herstellen', 'http://127.0.0.1:8127/index.html']
]) {
  const created = await maakSnelkoppelingen({ baseUrl, iconPng: new Blob([icon]) })
  assert.ok(decoder.decode(created[0].data).includes(`URL=${expected}\r\n`))
}
const escaped = await maakSnelkoppelingen({ baseUrl: 'https://example.com/A&B/', iconPng: icon })
assert.ok(decoder.decode(escaped.find(entry => entry.name === 'Home.webloc').data).includes('A&amp;B'))
assert.ok(decoder.decode(escaped.find(entry => entry.name === 'Fibro.html').data).includes('href="https://example.com/A&amp;B/index.html"'))
await assert.rejects(maakSnelkoppelingen({ baseUrl: 'https://example.com/', iconPng: new Uint8Array(50) }), TypeError)

for (const name of ['../bad', '/bad', 'a/../../bad', 'a\\bad', 'C:bad', 'a/./b', 'a\nb', 'bad.']) {
  assert.throws(() => maakZip([{ name, data: icon }]), TypeError)
}
assert.throws(() => maakZip([{ name: 'Home.url', data: icon }, { name: 'HOME.URL', data: icon }]), TypeError)
assert.throws(() => maakZip(entries, '../bad'), TypeError)

// --zip-base64 lets an independent reader (for example Python zipfile) inspect
// the actual archive without requiring child processes or temporary files.
const archive = maakZip([...entries, { name: 'Café.txt', data: new TextEncoder().encode('☕ Fibro') }])
const zipHeader = new DataView(archive.buffer)
assert.equal(zipHeader.getUint32(0, true), 0x04034b50)
assert.equal(zipHeader.getUint32(archive.length - 22, true), 0x06054b50)
assert.equal(zipHeader.getUint16(archive.length - 14, true), 9)
if (process.argv.includes('--zip-base64')) process.stdout.write(Buffer.from(archive).toString('base64'))
else console.log('PASS: safe public shortcuts, escaped links, icon container, no personal URL data, ZIP structure and entry-name validation.')
