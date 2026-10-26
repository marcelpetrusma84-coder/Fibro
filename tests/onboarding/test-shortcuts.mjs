import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maakSnelkoppelingen, maakZip, schrijfSnelkoppelingMap } from '../../device-shortcuts.js'

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
function fsError(name) { return Object.assign(new Error(name), { name }) }

function fakeDirectory(name, { existing = new Map(), writeError = null, closeError = null,
  writableError = null, abortError = null } = {}) {
  const calls = { getFile:[], written:[], closed:[], aborted:[] }
  return {
    name, calls, files:existing,
    async getFileHandle(filename, { create = false } = {}) {
      calls.getFile.push({ filename, create })
      const old = existing.get(filename)
      if (old?.kind === 'directory') throw fsError('TypeMismatchError')
      if (old) return old
      if (!create) throw fsError('NotFoundError')
      const handle = {
        kind:'file',
        async createWritable() {
          if (writableError) throw writableError
          return {
            async write(data) {
              calls.written.push({ filename, data:new Uint8Array(data) })
              if (writeError) throw writeError
            },
            async close() {
              calls.closed.push(filename)
              if (closeError) throw closeError
            },
            async abort() { calls.aborted.push(filename); if (abortError) throw abortError }
          }
        }
      }
      existing.set(filename, handle)
      return handle
    }
  }
}

function fakeParent({ occupied = new Map(), target = fakeDirectory('Fibro'), lookupError = null,
  createError = null } = {}) {
  const calls = []
  return {
    calls, target,
    async getDirectoryHandle(name, { create = false } = {}) {
      calls.push({ name, create })
      if (create) {
        if (createError) throw createError
        target.name = name
        return target
      }
      if (lookupError) throw lookupError
      const old = occupied.get(name)
      if (old?.kind === 'file') throw fsError('TypeMismatchError')
      if (old) return old
      throw fsError('NotFoundError')
    }
  }
}

const smallEntries = [
  { name:'Home.url', data:new TextEncoder().encode('home') },
  { name:'Key recovery.url', data:new TextEncoder().encode('recovery') }
]
{
  const first = fakeDirectory('Fibro'), third = fakeDirectory('Fibro 3')
  const parent = fakeParent({ occupied:new Map([
    ['Fibro', first], ['Fibro 2', { kind:'file' }], ['Fibro 3', third]
  ]) })
  assert.deepEqual(await schrijfSnelkoppelingMap(parent, smallEntries), { name:'Fibro 4', fileCount:2 })
  assert.equal(first.calls.getFile.length, 0, 'existing directories are never entered or overwritten')
  assert.equal(third.calls.getFile.length, 0)
  assert.deepEqual(parent.calls.filter(call => call.create), [{ name:'Fibro 4', create:true }])
  assert.deepEqual(parent.target.calls.written.map(file => file.filename), ['Home.url','Key recovery.url'])
  assert.deepEqual(parent.target.calls.closed, ['Home.url','Key recovery.url'])
  assert.deepEqual(parent.target.calls.aborted, [])
  assert.deepEqual(parent.target.calls.written[0].data, smallEntries[0].data)
}
for (const name of ['../bad','/bad','folder/child.url','a\\bad','C:bad','bad\nfile','bad.','bad ',
  'bad*file','bad?file','bad<file','bad>file','bad|file','bad"file','CON','con.txt','LPT9.url']) {
  const parent = fakeParent()
  await assert.rejects(schrijfSnelkoppelingMap(parent, [{ name, data:icon }]), TypeError)
  assert.deepEqual(parent.calls, [], 'unsafe names must not create or even choose a directory')
}
for (const invalid of [
  [{ name:'Home.url', data:icon }, { name:'HOME.URL', data:icon }],
  [{ name:'Café.url', data:icon }, { name:'Cafe\u0301.url', data:icon }],
  [{ name:'Home.url', data:'not bytes' }], [null], new Array(1), null
]) {
  const parent = fakeParent()
  await assert.rejects(schrijfSnelkoppelingMap(parent, invalid), TypeError)
  assert.deepEqual(parent.calls, [], 'invalid payloads are rejected before filesystem writes')
}
for (const stage of ['lookupError','createError']) {
  const denied = fsError('NotAllowedError'), parent = fakeParent({ [stage]:denied })
  await assert.rejects(schrijfSnelkoppelingMap(parent, smallEntries), error => error === denied)
  assert.deepEqual(parent.target.calls.written, [], 'permission errors never write files')
  if (stage === 'lookupError') assert(!parent.calls.some(call => call.create), 'a failed lookup is not mistaken for a free name')
}
{
  const occupied = new Map(Array.from({ length:100 }, (_, i) => [i ? `Fibro ${i + 1}` : 'Fibro', { kind:'directory' }]))
  const parent = fakeParent({ occupied })
  await assert.rejects(schrijfSnelkoppelingMap(parent, smallEntries), /unused Fibro folder/)
  assert(!parent.calls.some(call => call.create), 'exhausting names never overwrites the last occupied folder')
}
{
  let overwritten = false
  const existing = new Map([['Home.url', { kind:'file', createWritable() { overwritten = true } }]])
  const target = fakeDirectory('Fibro', { existing })
  await assert.rejects(schrijfSnelkoppelingMap(fakeParent({ target }), smallEntries), { name:'InvalidModificationError' })
  assert.equal(overwritten, false, 'an unexpected existing file in a returned handle is never truncated')
  assert.deepEqual(target.calls.written, [])
}
for (const stage of ['writableError','writeError','closeError']) {
  const failure = fsError('NotAllowedError')
  const target = fakeDirectory('Fibro', { [stage]:failure, abortError:fsError('AbortError') })
  await assert.rejects(schrijfSnelkoppelingMap(fakeParent({ target }), smallEntries), error => error === failure,
    'the original filesystem failure remains visible even if abort also fails')
  assert.deepEqual(target.calls.aborted, stage === 'writableError' ? [] : ['Home.url'])
  assert(!target.calls.written.some(file => file.filename === 'Key recovery.url'), 'a failure stops later writes')
}

if (process.argv.includes('--zip-base64')) process.stdout.write(Buffer.from(archive).toString('base64'))
else console.log('PASS: public shortcut/ZIP safety, collision-safe folders, validation before creation, preserved existing files, permission failures and writer aborts.')
