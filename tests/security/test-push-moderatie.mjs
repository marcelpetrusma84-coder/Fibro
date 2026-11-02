// v255 (2 nov 2026): stuur-push type 'moderatie': na een melding krijgen de moderators een pushmelding zonder inhoud.
// De functie draait hier met een nep-Supabase en nep-webpush (geen internet).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const bron = readFileSync(new URL('../../supabase/functions/stuur-push/index.ts', import.meta.url), 'utf8')
const js = stripTypeScriptTypes(bron.replace(/^import .*$/gm, ''))

function maak(tabellen, gebruiker) {
  const verstuurd = []
  let handler = null
  const query = (rijen) => {
    let r = rijen.slice()
    const q = {
      select() { return q }, eq(k, v) { r = r.filter(x => x[k] === v); return q }, gte(k, v) { r = r.filter(x => x[k] >= v); return q },
      in(k, v) { r = r.filter(x => v.includes(x[k])); return q }, order() { return q }, limit(n) { r = r.slice(0, n); return q },
      delete() { return q }, then(ok) { ok({ data: r, error: null }) },
    }
    return q
  }
  const supabase = { auth: { getUser: async () => ({ data: { user: gebruiker ? { id: gebruiker } : null } }) }, from: (t) => query(tabellen[t] || []) }
  const omgeving = {
    createClient: () => supabase, Deno: { env: { get: () => 'x' }, serve: (f) => { handler = f } },
    webpush: { setVapidDetails() {}, sendNotification: async (sub, payload) => { verstuurd.push([sub, JSON.parse(payload)]) } },
  }
  new Function(...Object.keys(omgeving), js)(...Object.values(omgeving))
  const roep = async (body) => {
    const res = await handler({ method: 'POST', json: async () => body, headers: { get: () => 'Bearer pas' } })
    return [res.status, JSON.parse(await res.text())]
  }
  return { roep, verstuurd }
}
const nu = new Date().toISOString(), oud = new Date(Date.now() - 10 * 60 * 1000).toISOString()
const tabellen = {
  profiles: [{ id: 'mod1', is_moderator: true, taal: 'nl' }, { id: 'mod2', is_moderator: true, taal: 'en' }, { id: 'bram', is_moderator: false }],
  push_subscriptions: [{ id: 's1', user_id: 'mod1', subscription: 'tel-mod1' }, { id: 's2', user_id: 'mod2', subscription: 'tel-mod2' }, { id: 's3', user_id: 'bram', subscription: 'tel-bram' }],
  rapporten: [{ id: 'r1', melder_id: 'bram', created_at: nu }, { id: 'r2', melder_id: 'lotte', created_at: oud }],
}

// 1. Bram deed net een melding: beide moderators krijgen een seintje, Bram niet; zonder inhoud
{
  const { roep, verstuurd } = maak(tabellen, 'bram')
  const [status, uit] = await roep({ type: 'moderatie' })
  assert.equal(status, 200); assert.equal(uit.verstuurd, 2)
  assert.deepEqual(verstuurd.map(v => v[0]).sort(), ['tel-mod1', 'tel-mod2'])
  const nl = verstuurd.find(v => v[0] === 'tel-mod1')[1], en = verstuurd.find(v => v[0] === 'tel-mod2')[1]
  assert.match(nl.body, /nieuwe melding/); assert.match(en.body, /new report/)
  assert.equal(nl.url, '/Fibro/moderatie.html')
  assert.ok(!JSON.stringify(nl).includes('bram'), 'geen naam of inhoud in de melding')
}
// 2. Lotte meldde 10 minuten geleden: geen seintje (zo kan niemand moderators bestoken)
{
  const { roep, verstuurd } = maak(tabellen, 'lotte')
  const [status] = await roep({ type: 'moderatie' })
  assert.equal(status, 403); assert.equal(verstuurd.length, 0)
}
// 3. Niet ingelogd: niets
{
  const { roep, verstuurd } = maak(tabellen, null)
  const [status] = await roep({ type: 'moderatie' })
  assert.equal(status, 401); assert.equal(verstuurd.length, 0)
}
// 4. rapport.js roept de functie aan na een geslaagde melding; chat.html laadt de nieuwe versie
const rapport = readFileSync(new URL('../../rapport.js', import.meta.url), 'utf8')
assert.match(rapport, /return false\n  \}\n  \/\/ v255[^\n]*\n  try \{ supabase\.functions\.invoke\('stuur-push', \{ body: \{ type: 'moderatie' \} \}\)/)
const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
assert.ok(!chat.includes('rapport.js?v=95') && chat.includes('rapport.js?v=96'))
console.log('PASS: moderators krijgen een pushmelding bij een nieuwe melding (zonder inhoud, alleen na een echte melding).')
