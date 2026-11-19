// node tests/bellen/test-microfoonmeldingen.mjs (17 nov 2026) - foutmeldingen 7 nov: een pc zonder microfoon
// (NotFoundError) en een spelgesprek zonder eigen microfoon kwamen als fout in Moderatie > Fouten. Dat zijn geen fouten
// in Stekky (de speler krijgt al een tip), dus niet meer melden. Een andere microfoonfout gaat wel nog mee.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const bellen = readFileSync(new URL('../../bellen.js', import.meta.url), 'utf8')
const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
let ok = 0
const test = async (naam, f) => { await f(); ok++; console.log('OK  ', naam) }

// meldMediaFout los uit bellen.js halen en draaien met een nep-foutmelder
const begin = bellen.indexOf('export function meldMediaFout')
const eind = bellen.indexOf('\n}\n', begin) + 2
assert.ok(begin > 0 && eind > begin, 'meldMediaFout gevonden')
function draai (fout, staat = 'prompt') {
  const gemeld = []
  const ctx = {
    window: { __fibroFoutmelder: { meld: (...a) => gemeld.push(a) }, isSecureContext: true },
    navigator: { mediaDevices: {}, permissions: { query: () => ({ then: (ja) => ja({ state: staat }) }) } },
    String, fout
  }
  vm.createContext(ctx)
  vm.runInContext(bellen.slice(begin, eind).replace('export ', '') + '; meldMediaFout("microfoon (spel)", fout)', ctx)
  return gemeld
}

await test('geen microfoon in het toestel (NotFoundError): niet melden', async () => {
  assert.equal(draai({ name: 'NotFoundError', message: 'Requested device not found' }).length, 0)
})
await test('19 nov: NotAllowedError door de keuze van de speler (prompt, denied, onbekend): niet melden', async () => {
  for (const staat of ['prompt', 'denied', 'onbekend']) {
    assert.equal(draai({ name: 'NotAllowedError', message: 'Permission denied' }, staat).length, 0, staat)
  }
})
await test('19 nov: NotAllowedError terwijl de microfoon WEL is toegestaan: wel melden', async () => {
  const g = draai({ name: 'NotAllowedError', message: 'Permission denied' }, 'granted')
  assert.equal(g.length, 1)
  assert.match(g[0][2], /toestemming microfoon: granted/)
})
await test('andere microfoonfouten wel melden (bijvoorbeeld NotReadableError)', async () => {
  for (const name of ['NotReadableError', 'OverconstrainedError']) {
    const g = draai({ name, message: 'x' })
    assert.equal(g.length, 1, name)
    assert.match(g[0][1], new RegExp('^' + name + ': x$'))
    assert.match(g[0][2], /microfoon \(spel\) · toestemming microfoon: prompt/)
  }
})
await test('spelgesprek na 20 s: zonder eigen microfoon geen extra melding, met microfoon wel', async () => {
  const eindBlok = chat.indexOf("meld('belofte', 'Spelgesprek: na 20 s nog geen goed geluid'")
  const blok = chat.slice(chat.lastIndexOf('spelGeluidControle = setTimeout', eindBlok), eindBlok)
  assert.ok(blok.length > 0 && blok.length < 1500, 'controleblok gevonden')
  const stop = blok.indexOf('if (!st.localAudioAvailable) return')
  assert.ok(stop > 0, 'stopt als de eigen microfoon er niet is')
  assert.ok(stop > blok.indexOf('if (st.connected && st.localAudio && st.remoteAudio'), 'na de controle op goed geluid')
  assert.ok(blok.indexOf("if (st.remoteMic === 'uit') return") > stop, '19 nov: stopt als de microfoon van de ander uit staat')
  assert.match(chat.slice(eindBlok, eindBlok + 800), /mic ander=' \+ st\.remoteMic/, 'stand van de ander staat in de melding')
})
await test('19 nov: bellen.js stuurt en ontvangt mic-status', async () => {
  assert.match(bellen, /stuurSignaal\('mic-status', \{ aan: status\.localAudio \}\)/)
  assert.match(bellen, /type === 'mic-status'[\s\S]{0,80}remoteMic = !!\(data && data\.aan\)/)
  assert.match(bellen, /remoteMic: remoteMic === null \? 'onbekend'/)
  // bij een nieuw en een beeindigd gesprek weer 'onbekend'
  assert.ok((bellen.match(/remoteMic = null\n  verstuurdeMic = null/g) || []).length >= 2)
})

console.log(`\n${ok} van ${ok} goed`)
