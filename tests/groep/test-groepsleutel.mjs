// test-groepsleutel.mjs (10 nov 2026): groepsberichten versleutelen en openen (groepsleutel.js).
import assert from 'node:assert/strict'
import { versleutelGroepsbericht, openGroepsbericht, isGroepsbericht, MAX_LEDEN, versleutelGroepsBytes, openGroepsBytes } from '../../groepsleutel.js'

const b64 = buf => Buffer.from(buf).toString('base64')
async function paar() {
  const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  return { pub: b64(await crypto.subtle.exportKey('spki', k.publicKey)), priv: b64(await crypto.subtle.exportKey('pkcs8', k.privateKey)) }
}
const [a, b, c, d] = await Promise.all([paar(), paar(), paar(), paar()])
const G = '11111111-1111-4111-8111-111111111111', G2 = '22222222-2222-4222-8222-222222222222'
const leden = [{ id: 'A', public_key: a.pub }, { id: 'B', public_key: b.pub }, { id: 'C', public_key: c.pub }, { id: 'X', public_key: null }]
const nu = Date.now()
const { content, overgeslagen } = await versleutelGroepsbericht('Hoi allemaal 👋', { groepId: G, van: 'A', mijnPriv: a.priv, leden, nu })
assert.ok(isGroepsbericht(content))
assert.ok(!content.includes('Hoi'), 'niet leesbaar op de server')
assert.deepEqual(overgeslagen, ['X'], 'lid zonder sleutel overgeslagen')

const open = (ik, priv, extra = {}) => openGroepsbericht(content, { groepId: G, van: 'A', ik, mijnPriv: priv, afzenderPub: a.pub, serverTijd: nu, ...extra })
assert.deepEqual(await open('B', b.priv), { tekst: 'Hoi allemaal 👋', status: 'ok', verstuurd: nu })
assert.equal((await open('C', c.priv)).tekst, 'Hoi allemaal 👋')
assert.equal((await open('A', a.priv)).tekst, 'Hoi allemaal 👋', 'eigen bericht ook leesbaar')
assert.equal((await open('D', d.priv)).status, 'niet-voor-mij', 'wie later lid werd, kan oude berichten niet lezen')
assert.equal((await open('B', d.priv)).status, 'onleesbaar', 'verkeerde sleutel')
assert.equal((await open('B', b.priv, { groepId: G2 })).status, 'onleesbaar', 'in een andere groep gezet')
assert.equal((await open('B', b.priv, { van: 'C', afzenderPub: c.pub })).status, 'onleesbaar', 'op naam van een ander')
assert.equal((await open('B', b.priv, { serverTijd: nu + 3600000 })).status, 'tijd', 'oude kopie opnieuw neergezet')
// onderweg veranderd
const pak = JSON.parse(content.slice(3)); const d2 = Buffer.from(pak.d, 'base64'); d2[20] ^= 1; pak.d = d2.toString('base64')
assert.equal((await openGroepsbericht('g1:' + JSON.stringify(pak), { groepId: G, van: 'A', ik: 'B', mijnPriv: b.priv, afzenderPub: a.pub })).status, 'vervalst')
assert.equal((await openGroepsbericht('g1:{kapot', { groepId: G, van: 'A', ik: 'B', mijnPriv: b.priv, afzenderPub: a.pub })).status, 'vervalst')
await assert.rejects(versleutelGroepsbericht('x', { groepId: G, van: 'A', mijnPriv: a.priv, leden: [{ id: 'B', public_key: b.pub }] }), /eigen sleutel/)
assert.deepEqual(MAX_LEDEN, { chat: 50, voice: 8, webcam: 4 })
// 50 leden: werkt en blijft redelijk klein
const veel = [{ id: 'A', public_key: a.pub }]
for (let i = 0; i < 49; i++) veel.push({ id: 'L' + i, public_key: (i % 2 ? b : c).pub })
const groot = await versleutelGroepsbericht('x'.repeat(200), { groepId: G, van: 'A', mijnPriv: a.priv, leden: veel })
assert.ok(groot.content.length < 8000, 'bericht voor 50 leden < 8 kB (' + groot.content.length + ')')
// foto's en spraak (bytes, v2)
const foto = crypto.getRandomValues(new Uint8Array(50000))
const pakB = await versleutelGroepsBytes(foto, { groepId: G, van: 'A', mijnPriv: a.priv, leden })
const ob = await openGroepsBytes(pakB, { groepId: G, van: 'A', ik: 'C', mijnPriv: c.priv, afzenderPub: a.pub })
assert.equal(ob.status, 'ok'); assert.deepEqual(ob.bytes, foto)
assert.equal((await openGroepsBytes(pakB, { groepId: G2, van: 'A', ik: 'C', mijnPriv: c.priv, afzenderPub: a.pub })).status, 'onleesbaar', 'media: andere groep')
const kapot = { ...pakB, d: pakB.d.slice() }; kapot.d[100] ^= 1
assert.equal((await openGroepsBytes(kapot, { groepId: G, van: 'A', ik: 'C', mijnPriv: c.priv, afzenderPub: a.pub })).status, 'vervalst', 'media: onderweg veranderd')
// een foto is nooit als tekstbericht te openen
const alsTekst = 'g1:' + JSON.stringify({ t: pakB.t, d: Buffer.from(pakB.d).toString('base64'), k: pakB.k })
assert.equal((await openGroepsbericht(alsTekst, { groepId: G, van: 'A', ik: 'C', mijnPriv: c.priv, afzenderPub: a.pub })).status, 'vervalst', 'media niet als bericht')
console.log('ok: groepsberichten versleutelen en openen (' + groot.content.length + ' tekens voor 50 leden)')
