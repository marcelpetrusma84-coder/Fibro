// proef77.mjs - versleuteling v2 (v181) in crypto.js, zonder browser (Node 20+ heeft Web Crypto).
// Gebruik: node tests/tools/proef77.mjs <map met crypto.js> [<map met de oude crypto.js>]
// v182: eigenPubliekeSleutel, isZelfdeSleutel, herstelcode zonder Math.random.
// Met de oude map erbij worden oude berichten (v1) met de oude code gemaakt en met de nieuwe gelezen,
// en kijkt de proef wat een oudere app van een nieuw bericht maakt.
// Zonder tweede map: alleen de nieuwe code. Als controle met de oude code als eerste map: bijna alles MIS.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const map = process.argv[2], oudMap = process.argv[3]
if (!map) { console.log('gebruik: node proef77.mjs <map> [<oude map>]'); process.exit(2) }
const werk = mkdtempSync(join(tmpdir(), 'proef77-'))
async function laad(m, naam) {
  const p = join(werk, naam + '.mjs')
  writeFileSync(p, readFileSync(join(m, 'crypto.js')))
  return import(pathToFileURL(p).href)
}
const c = await laad(map, 'nieuw')
const o = oudMap ? await laad(oudMap, 'oud') : null

let goed = 0, mis = 0
async function check(naam, f) {
  let ok = false, info = ''
  try { const r = await f(); ok = r === true || (Array.isArray(r) && r[0] === true); if (Array.isArray(r)) info = r[1] } catch (e) { info = 'fout: ' + e.message }
  if (ok) goed++; else mis++
  console.log((ok ? 'GOED ' : 'MIS  ') + naam + (ok || !info ? '' : '  (' + String(info).slice(0, 160) + ')'))
}

const LOTTE = 'cccc0002-0000-4000-8000-000000000002', BRAM = 'bbbb0001-0000-4000-8000-000000000001', DERDE = 'dddd0003-0000-4000-8000-000000000003'
const L = await c.genereerKeypair(), B = await c.genereerKeypair(), D = await c.genereerKeypair()
const naarBram = { soort: 'bericht', van: LOTTE, naar: BRAM }
const ob = (blob, priv, pub, ctx) => c.ontsleutelBericht(blob, priv, pub, ctx)

const blob = await c.versleutel('Hoi Bram, dit is Lotte', L.privateKeyB64, B.publicKeyB64, naarBram).catch(() => null)
const nu = Date.now()

await check('nieuw formaat: e2e:2:<tijd>:<sleutel-id>:<data>, tekst niet leesbaar', () =>
  [typeof blob === 'string' && /^e2e:2:[0-9a-z]+:[0-9a-f]{12}:[A-Za-z0-9+/]+=*$/.test(blob) && !blob.includes('Lotte'), blob])
await check('Bram leest het (status v2)', async () => { const r = await ob(blob, B.privateKeyB64, L.publicKeyB64, naarBram); return [r.status === 'v2' && r.tekst === 'Hoi Bram, dit is Lotte', JSON.stringify(r)] })
await check('Lotte leest haar eigen bericht terug (ook zonder geheugen, ander toestel)', async () => { const r = await ob(blob, L.privateKeyB64, B.publicKeyB64, naarBram); return [r.status === 'v2' && r.tekst === 'Hoi Bram, dit is Lotte', JSON.stringify(r)] })
await check('afzender en ontvanger omgedraaid (server): vervalst, geen tekst', async () => {
  const r = await ob(blob, L.privateKeyB64, B.publicKeyB64, { soort: 'bericht', van: BRAM, naar: LOTTE })
  return [r.status === 'vervalst' && r.tekst === c.VERVALST, JSON.stringify(r)] })
await check('andere ontvanger erbij gezet: vervalst', async () => {
  const r = await ob(blob, B.privateKeyB64, L.publicKeyB64, { soort: 'bericht', van: LOTTE, naar: DERDE })
  return [r.status === 'vervalst', JSON.stringify(r)] })
await check('een teken in de data veranderd: vervalst', async () => {
  const i = blob.length - 6, ander = blob[i] === 'A' ? 'B' : 'A'
  const r = await ob(blob.slice(0, i) + ander + blob.slice(i + 1), B.privateKeyB64, L.publicKeyB64, naarBram)
  return [r.status === 'vervalst', JSON.stringify(r)] })
await check('verzendtijd veranderd (vast aan het bericht): vervalst', async () => {
  const d = blob.split(':'); d[2] = (parseInt(d[2], 36) - 3600000).toString(36)
  const r = await ob(d.join(':'), B.privateKeyB64, L.publicKeyB64, naarBram)
  return [r.status === 'vervalst', JSON.stringify(r)] })
await check('server-tijd binnen 15 min: v2', async () => {
  const r = await ob(blob, B.privateKeyB64, L.publicKeyB64, { ...naarBram, serverTijd: nu + 14 * 60000 })
  return [r.status === 'v2', JSON.stringify(r)] })
await check('server-tijd een uur later (oud bericht opnieuw neergezet): status tijd, tekst wel', async () => {
  const r = await ob(blob, B.privateKeyB64, L.publicKeyB64, { ...naarBram, serverTijd: nu + 3600000 })
  return [r.status === 'tijd' && r.tekst === 'Hoi Bram, dit is Lotte', JSON.stringify(r)] })
await check('sleutel past niet meer (vriend begon opnieuw): onleesbaar, niet vervalst', async () => {
  const r = await ob(blob, B.privateKeyB64, D.publicKeyB64, naarBram)
  return [r.status === 'onleesbaar' && r.tekst === c.ONLEESBAAR, JSON.stringify(r)] })
await check('zonder afzender/ontvanger versturen: weigert', async () => {
  let n = 0
  try { await c.versleutel('x', L.privateKeyB64, B.publicKeyB64) } catch (e) { n++ }
  try { await c.versleutel('x', L.privateKeyB64, B.publicKeyB64, { soort: 'bericht', van: LOTTE }) } catch (e) { n++ }
  return [n === 2, n + ' van 2 geweigerd'] })
await check('zonder afzender/ontvanger openen: onleesbaar', async () => { const r = await ob(blob, B.privateKeyB64, L.publicKeyB64); return [r.status === 'onleesbaar', JSON.stringify(r)] })
await check('elke keer een andere versleuteling (nieuwe iv)', async () => {
  const a = await c.versleutel('zelfde', L.privateKeyB64, B.publicKeyB64, naarBram), b = await c.versleutel('zelfde', L.privateKeyB64, B.publicKeyB64, naarBram)
  return [a !== b && a.split(':').pop() !== b.split(':').pop(), a + ' ' + b] })
await check('niet versleuteld: status open, tekst zoals hij is', async () => { const r = await ob('buzz:', B.privateKeyB64, L.publicKeyB64, naarBram); return [r.status === 'open' && r.tekst === 'buzz:', JSON.stringify(r)] })
await check('reactie: Bram leest de reactie van Lotte bij bericht 42', async () => {
  const ctx = { soort: 'reactie', van: LOTTE, bij: '42' }
  const x = await c.versleutel('\u{1F44D}', L.privateKeyB64, B.publicKeyB64, ctx)
  const r = await ob(x, B.privateKeyB64, L.publicKeyB64, ctx)
  const ander = await ob(x, B.privateKeyB64, L.publicKeyB64, { soort: 'reactie', van: LOTTE, bij: '43' })
  const alsBericht = await ob(x, B.privateKeyB64, L.publicKeyB64, { soort: 'bericht', van: LOTTE, naar: '42' })
  return [r.status === 'v2' && r.tekst === '\u{1F44D}' && ander.status === 'vervalst' && alsBericht.status === 'vervalst', [r.status, ander.status, alsBericht.status].join()] })
await check('groot bericht (sticker met plaatje, 120 kB) heen en weer', async () => {
  const groot = 'fxsticker:e1-03@k1#' + 'A'.repeat(120000)
  const x = await c.versleutel(groot, L.privateKeyB64, B.publicKeyB64, naarBram)
  const r = await ob(x, B.privateKeyB64, L.publicKeyB64, naarBram)
  return [r.status === 'v2' && r.tekst === groot, r.status] })
await check('ontsleutel() geeft gewoon tekst (voor de export en reacties)', async () => {
  const a = await c.ontsleutel(blob, B.privateKeyB64, L.publicKeyB64, naarBram)
  const b = await c.ontsleutel(blob, B.privateKeyB64, L.publicKeyB64, { soort: 'bericht', van: BRAM, naar: LOTTE })
  const d = await c.ontsleutel('spelinvite:pong:x:1', B.privateKeyB64, L.publicKeyB64)
  return [a === 'Hoi Bram, dit is Lotte' && b === c.VERVALST && d === 'spelinvite:pong:x:1', [a, b, d].join(' | ')] })
await check('vingerafdruk: zelfde sleutel gelijk, andere sleutel anders', async () => {
  const a = await c.sleutelVingerafdruk(B.publicKeyB64), b = await c.sleutelVingerafdruk(B.publicKeyB64), d = await c.sleutelVingerafdruk(D.publicKeyB64)
  return [/^[0-9a-f]{64}$/.test(a) && a === b && a !== d, a] })
await check('herstelcode-kluis werkt nog (versleutelPrivateKey / ontsleutelPrivateKey)', async () => {
  const code = c.maakHerstelSleutel(), k = await c.versleutelPrivateKey(L.privateKeyB64, code)
  return (await c.ontsleutelPrivateKey(k, code)) === L.privateKeyB64 })
await check('geen hashHerstelSleutel meer (die hash hoort niet naar de server)', () => [typeof c.hashHerstelSleutel === 'undefined', typeof c.hashHerstelSleutel])
// v182: de vingerafdruk in een uitnodigingslink
await check('v182: eigen publieke sleutel uit de geheime = de echte', async () => {
  const a = await c.eigenPubliekeSleutel(L.privateKeyB64), b = await c.eigenPubliekeSleutel(B.privateKeyB64)
  return [a === L.publicKeyB64 && b === B.publicKeyB64, a.slice(0, 30)] })
await check('v182: isZelfdeSleutel: lang gelijk, kort begin goed, korter/ander/rommel niet', async () => {
  const f = await c.sleutelVingerafdruk(B.publicKeyB64), g = await c.sleutelVingerafdruk(D.publicKeyB64)
  const r = [c.isZelfdeSleutel(f, f), c.isZelfdeSleutel(f.slice(0, 32), f), !c.isZelfdeSleutel(f.slice(0, 31), f), !c.isZelfdeSleutel(g.slice(0, 32), f),
             !c.isZelfdeSleutel(g, f), !c.isZelfdeSleutel('', f), !c.isZelfdeSleutel(f.slice(0, 32).toUpperCase(), f), !c.isZelfdeSleutel(null, f), !c.isZelfdeSleutel(f, 'x')]
  return [r.every(Boolean), r.join()] })
await check('v182: herstelcode uit echte willekeur (crypto.getRandomValues), 12 tekens uit 32', () => {
  const echt = Math.random; let n = 0; Math.random = () => { n++; return echt() }
  const codes = Array.from({ length: 50 }, () => c.maakHerstelSleutel()); Math.random = echt
  return [n === 0 && codes.every(x => /^FIBRO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(x)) && new Set(codes).size === 50, n + ' ' + codes[0]] })

if (o) {
  const oudBlob = await o.versleutel('Een oud bericht van Bram', B.privateKeyB64, L.publicKeyB64)
  await check('oud bericht (v1, gemaakt met de oude code) blijft leesbaar: status v1', async () => {
    const r = await ob(oudBlob, L.privateKeyB64, B.publicKeyB64, { soort: 'bericht', van: BRAM, naar: LOTTE })
    return [r.status === 'v1' && r.tekst === 'Een oud bericht van Bram', JSON.stringify(r)] })
  await check('oud bericht ook zonder afzender/ontvanger (export, oude reacties)', async () =>
    [(await c.ontsleutel(oudBlob, L.privateKeyB64, B.publicKeyB64)) === 'Een oud bericht van Bram', ''])
  await check('oudere app krijgt een nieuw bericht: ziet het slotje, geen rommel', async () => {
    const t = await o.ontsleutel(blob, B.privateKeyB64, L.publicKeyB64)
    return [t === '\u{1F512} [versleuteld bericht — kan niet lezen]', t] })
  await check('een sleutelpaar van de oude code werkt met de nieuwe', async () => {
    const OL = await o.genereerKeypair(), OB = await o.genereerKeypair()
    const x = await c.versleutel('hallo', OL.privateKeyB64, OB.publicKeyB64, naarBram)
    return (await c.ontsleutel(x, OB.privateKeyB64, OL.publicKeyB64, naarBram)) === 'hallo' })
}
console.log('\nproef77: ' + goed + ' goed, ' + mis + ' mis')
process.exit(mis ? 1 : 0)
