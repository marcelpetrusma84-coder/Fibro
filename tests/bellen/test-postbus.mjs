// postbus.js (3 nov 2026): kleine profielupdates via de server als je niet tegelijk online bent.
// Echte versleuteling (crypto.js), nagemaakte server. Marcel zet iets klaar terwijl Bram offline is; Bram haalt het
// later op, het staat op zijn toestel en is van de server weg. Foto's/muziek/video gaan er niet in.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
globalThis.localStorage = undefined
const C = await import('../../crypto.js')
const P = await import('../../postbus.js')

function maakLs(start = {}) { const m = new Map(Object.entries(start)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m } }
function maakDb() { const m = new Map(); return { get: async id => m.get(id) || null, put: async o => { m.set(o.id, o) }, del: async id => { m.delete(id) }, _m: m } }
const SERVER = { post: [], profiles: [] }
function nepSupabase(ik) {
  const tabel = naam => {
    let rijen = null, filters = [], actie = 'select', waarde = null
    const q = {
      select() { return q }, eq(k, v) { filters.push(r => r[k] === v); return q }, in(k, l) { filters.push(r => l.includes(r[k])); return q },
      upsert(v) { actie = 'upsert'; waarde = v; return q }, delete() { actie = 'delete'; return q },
      then(ok, f) {
        const bron = naam === 'profiel_post' ? SERVER.post : SERVER.profiles
        if (actie === 'upsert') {
          if (v_afzenderFout(waarde)) return Promise.resolve({ error: { code: '42501', message: 'rls' } }).then(ok, f)
          const i = bron.findIndex(r => r.afzender === waarde.afzender && r.ontvanger === waarde.ontvanger)
          const rij = { ...waarde, bijgewerkt: new Date().toISOString() }
          if (i >= 0) bron[i] = rij; else bron.push(rij)
          return Promise.resolve({ error: null }).then(ok, f)
        }
        const passend = bron.filter(r => filters.every(fn => fn(r)))
        if (actie === 'delete') { for (const r of passend) bron.splice(bron.indexOf(r), 1); return Promise.resolve({ error: null }).then(ok, f) }
        return Promise.resolve({ data: passend.map(r => ({ ...r })), error: null }).then(ok, f)
      },
    }
    const v_afzenderFout = w => w.afzender !== ik
    return q
  }
  return { from: tabel }
}
const crypto = { versleutel: C.versleutel, ontsleutelBericht: C.ontsleutelBericht, sleutelVingerafdruk: C.sleutelVingerafdruk, isZelfdeSleutel: C.isZelfdeSleutel }
const M = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002'
const km = await C.genereerKeypair(), kb = await C.genereerKeypair()
SERVER.profiles.push({ id: M, public_key: km.publicKeyB64 }, { id: B, public_key: kb.publicKeyB64 })

const lsM = maakLs({
  ['fibro_widgets_profiel_' + M]: JSON.stringify([{ type: 'quote', x: 1 }, { type: 'foto', id: 'pfoto_1' }]),
  ['quote_' + M]: JSON.stringify({ tekst: 'Carpe diem' }),
  ['aftel_' + M]: JSON.stringify({ naar: '2026-12-25', titel: 'Kerst' }),
  fibro_blokstijl: JSON.stringify({ kleur: '#ff00aa', doorzicht: 30, hoek: 20 }),
  ['fibro_profiel_' + M]: JSON.stringify({ naam: 'Marcel P.' }),
})
const depsM = { supabase: nepSupabase(M), crypto, privateKey: km.privateKeyB64, eigenId: M, ls: lsM, db: maakDb(), log: () => {} }
const lsB = maakLs(), dbB = maakDb()
const depsB = { supabase: nepSupabase(B), crypto, privateKey: kb.privateKeyB64, eigenId: B, ls: lsB, db: dbB, log: () => {} }

// 1. Marcel zet klaar (Bram is offline)
assert.equal(await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }]), 1)
assert.equal(SERVER.post.length, 1)
const opServer = SERVER.post[0].inhoud
assert.ok(opServer.startsWith('e2e:2:'), 'versleuteld')
for (const geheim of ['Carpe', 'Kerst', 'Marcel P.', 'ff00aa', 'quote']) assert.ok(!opServer.includes(geheim), 'server ziet niet: ' + geheim)
// 2. niets veranderd: niet opnieuw
assert.equal(await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }]), 0)
// 3. Bram komt later online: binnen, op zijn toestel, en van de server weg
const binnen = await P.haalOp(depsB)
assert.equal(binnen.length, 1)
assert.deepEqual(binnen[0].veranderd.sort(), ['aftel', 'blokstijl', 'layout', 'naam', 'quote'])
assert.equal(JSON.parse((await dbB.get('vriend_' + M + '_quote')).data).tekst, 'Carpe diem')
assert.equal(lsB.getItem('vriend_naam_' + M + '_' + B), 'Marcel P.')
assert.equal(JSON.parse((await dbB.get('vriend_' + M + '_blokstijl')).data).kleur, '#ff00aa')
assert.equal((await dbB.get('vriend_' + M + '_layout')).hash, P.hashString(lsM.getItem('fibro_widgets_profiel_' + M)), 'zelfde hash als de rechtstreekse sync')
assert.equal(SERVER.post.length, 0, 'gewist na ophalen')
// 4. Marcel haalt de aftelteller weg en verandert de quote: Bram krijgt dat ook (weg = weg)
lsM.removeItem('aftel_' + M); lsM.setItem('quote_' + M, JSON.stringify({ tekst: 'Nieuw!' }))
assert.equal(await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }]), 1)
const binnen2 = await P.haalOp(depsB)
assert.deepEqual(binnen2[0].veranderd.sort(), ['aftel', 'quote'])
assert.equal(await dbB.get('vriend_' + M + '_aftel'), null)
// 5. alleen de nieuwste stand: twee keer veranderen = één pakketje
lsM.setItem('quote_' + M, JSON.stringify({ tekst: 'A' })); await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }])
lsM.setItem('quote_' + M, JSON.stringify({ tekst: 'B' })); await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }])
assert.equal(SERVER.post.length, 1)
await P.haalOp(depsB)
assert.equal(JSON.parse((await dbB.get('vriend_' + M + '_quote')).data).tekst, 'B')
// 6. rechtstreeks gesynct NA het pakketje: het oude pakketje wordt niet toegepast, alleen gewist
lsM.setItem('quote_' + M, JSON.stringify({ tekst: 'oud via server' })); await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }])
await dbB.put({ id: 'vriend_' + M + '_quote', hash: 'x', data: JSON.stringify({ tekst: 'nieuwer rechtstreeks' }) })
await P.haalOp(depsB, () => Date.now() + 120000)
assert.equal(JSON.parse((await dbB.get('vriend_' + M + '_quote')).data).tekst, 'nieuwer rechtstreeks')
assert.equal(SERVER.post.length, 0)
// 7. rechtstreeks klaar: Marcel wist zijn pakketje en zet het niet opnieuw klaar
lsM.setItem('quote_' + M, JSON.stringify({ tekst: 'C' })); await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }])
await P.rechtstreeksKlaar(depsM, B)
assert.equal(SERVER.post.length, 0)
assert.equal(await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }]), 0)
// 8. veranderde sleutel van een vriend (onthouden vingerafdruk past niet): niets klaarzetten, niets openen
const vreemd = await C.genereerKeypair()
lsM.setItem('fibro_vriendsleutel_' + M + '_' + B, await C.sleutelVingerafdruk(kb.publicKeyB64))
lsM.setItem('quote_' + M, JSON.stringify({ tekst: 'D' }))
assert.equal(await P.verstuur(depsM, [{ id: B, public_key: vreemd.publicKeyB64 }]), 0, 'niet naar een andere sleutel')
assert.equal(await P.verstuur(depsM, [{ id: B, public_key: kb.publicKeyB64 }]), 1, 'wel naar de bekende sleutel')
// 9. onzin en een gewoon bericht in de postbus: niet toegepast, wel gewist
assert.equal(P.uitpakken('hallo'), null)
assert.equal(P.uitpakken(P.VOORVOEGSEL + '{"layout":"geen lijst"}').layout, null)
assert.equal(P.uitpakken(P.VOORVOEGSEL + JSON.stringify({ klein: { quote: 'x'.repeat(30000) } })).klein.quote, undefined)
SERVER.post.length = 0
SERVER.post.push({ afzender: M, ontvanger: B, inhoud: await C.versleutel('gewoon een bericht', km.privateKeyB64, kb.publicKeyB64, { soort: 'bericht', van: M, naar: B }), bijgewerkt: new Date().toISOString() })
const r9 = await P.haalOp(depsB)
assert.equal(r9.length, 0); assert.equal(SERVER.post.length, 0)
// 10. alleen kleine dingen: geen foto's, muziek, video of stickers in het pakketje
const pak = P.maakKleinPakket(M, lsM)
assert.deepEqual(Object.keys(pak).sort(), ['blokstijl', 'klein', 'layout', 'naam'])
// 11. sync.js gebruikt de postbus, en de pagina's laden de nieuwe sync
const s = lees('sync.js')
assert.match(s, /import \* as Postbus from '\.\/postbus\.js\?v=1'/)
assert.match(s, /Postbus\.rechtstreeksKlaar\(postbusDeps\(\), syncPartnerId\)/)
assert.match(s, /Postbus\.wis\(postbusDeps\(\), syncPartnerId, huidigeUserId\)/)
for (const f of ['chat.html', 'index.html', 'profiel.html', 'vriend-profiel.html', 'vrienden.html']) assert.match(lees(f), /sync\.js\?v=251/, f)
const sql = lees('sql/profiel-post.sql')
assert.match(sql, /primary key \(afzender, ontvanger\)/)
assert.match(sql, /'profiel_postbus'/)
console.log('postbus: ok')
