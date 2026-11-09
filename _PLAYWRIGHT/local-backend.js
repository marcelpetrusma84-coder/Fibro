// Local-only browser fixture. This emulates a small part of Supabase and must
// never be mistaken for a test of the production server or its permissions.
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const databasePath = path.join(dir, 'local-backend.local.json')
const inviterId = 'aaaaaaaa-0000-4000-8000-000000000001'
const fakeSupabaseHost = 'qmgatbphiplrfxrljtbe.supabase.co'
const emptyDatabase = () => ({
  users: [], invitations: [], friendships: [], vaults: [],
  profiles: [{ id: inviterId, username: 'TestUitnodiger', display_name: 'Testuitnodiger' }]
})

async function load() {
  try { return JSON.parse(await readFile(databasePath, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return emptyDatabase(); throw error }
}
async function save(db) { await writeFile(databasePath, JSON.stringify(db, null, 2) + '\n') }
let pending = Promise.resolve()
async function transaction(callback) {
  const operation = pending.then(async () => {
    const db = await load()
    const result = await callback(db)
    await save(db)
    return result
  })
  pending = operation.catch(() => {})
  return operation
}
function invitationUrl(baseURL, token) {
  const target = new URL('/invite.html', baseURL)
  if (target.hostname !== '127.0.0.1' || target.protocol !== 'http:') throw new Error('Lokale testuitnodiging vereist een lokaal adres.')
  target.searchParams.set('token', token)
  target.hash = 'n=Testuitnodiger'
  return target.href
}
export async function createLocalInvite(baseURL, { reusable = false } = {}) {
  return transaction(async db => {
    const token = 'fibro-test-' + randomBytes(12).toString('hex')
    db.invitations.push({ token, created_by: inviterId, is_used: false, reusable, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() })
    return invitationUrl(baseURL, token)
  })
}
function validInvite(db, token) {
  return db.invitations.find(i => i.token === token && (!i.is_used || i.reusable) && Date.parse(i.expires_at) > Date.now())
}
function userData(user) {
  const { password, ...safe } = user
  return safe
}
function makeSession(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  return { access_token: `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: user.id, exp: expires })}.local`, token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: `local-${user.id}`, user: userData(user) }
}
function getUser(db, headers) {
  try {
    const jwt = (headers.authorization || '').replace(/^Bearer\s+/i, '')
    const uid = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub
    return db.users.find(u => u.id === uid)
  } catch { return null }
}
function bodyOf(request) { try { return request.postDataJSON() || {} } catch { return {} } }
const result = (json, status = 200) => ({ status, json })

export async function handleMockRequest(request) {
  const url = new URL(request.url())
  const method = request.method()
  const body = bodyOf(request)
  const headers = request.headers()
  return transaction(async db => {
    const user = getUser(db, headers)
    if (url.pathname === '/auth/v1/signup' && method === 'POST') {
      if (!validInvite(db, body.data?.invite_token)) return result({ error: 'FIBRO_REGISTRATIE_ALLEEN_UITNODIGING', msg: 'Ongeldige testuitnodiging' }, 400)
      if (db.users.some(u => u.email === body.email)) return result({ error: 'user_already_exists', msg: 'User already registered' }, 422)
      const created = { id: randomUUID(), email: body.email, password: body.password, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: body.data || {}, created_at: new Date().toISOString() }
      db.users.push(created)
      return result(makeSession(created))
    }
    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      const found = url.searchParams.get('grant_type') === 'refresh_token'
        ? db.users.find(u => body.refresh_token === `local-${u.id}`)
        : db.users.find(u => u.email === body.email && u.password === body.password)
      return found ? result(makeSession(found)) : result({ error: 'invalid_grant', msg: 'Ongeldige lokale testgegevens' }, 400)
    }
    if (url.pathname === '/auth/v1/user' && method === 'GET') return user ? result(userData(user)) : result({ msg: 'Geen lokale sessie' }, 401)
    if (url.pathname === '/auth/v1/logout') return { status: 204, body: '' }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').pop()
      const invite = validInvite(db, body.token_in)
      if (rpc === 'registratie_stand') return result('uitnodiging')
      if (rpc === 'valideer_invite') return result(invite ? [{ created_by: invite.created_by }] : [])
      if (rpc === 'uitnodiger_van_invite') return result(invite ? [db.profiles.find(p => p.id === invite.created_by)] : [])
      if (rpc === 'uitnodiging_vol') return result(false)
      if (rpc === 'maak_vriendschap_via_invite') {
        if (!invite || !user || user.id === invite.created_by) return result(false)
        db.friendships.push({ user_id: user.id, friend_id: invite.created_by, status: 'accepted' })
        if (!invite.reusable) invite.is_used = true
        return result(true)
      }
      if (rpc === 'gebruik_invite') { if (invite && !invite.reusable) invite.is_used = true; return result(Boolean(invite)) }
      if (rpc === 'mijn_geblokkeerden') return result([])
      return result(null)
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop()
      const id = (url.searchParams.get('id') || url.searchParams.get('user_id') || '').replace(/^eq\./, '')
      const object = (headers.accept || '').includes('vnd.pgrst.object')
      if (table === 'invite_tokens' && method === 'POST') {
        const row = { ...body, created_by: user?.id || inviterId, is_used: false, reusable: false }
        db.invitations.push(row)
        return result([row], 201)
      }
      const storage = table === 'profiles' ? db.profiles : table === 'sleutel_kluis' ? db.vaults : table === 'friendships' ? db.friendships : null
      if (storage && method === 'GET') {
        let rows = storage.filter(row => !id || row.id === id || row.user_id === id)
        if (table === 'friendships' && user) rows = rows.filter(row => row.user_id === user.id).map(row => ({ ...row, profiles: db.profiles.find(p => p.id === row.friend_id) || null }))
        if (object) return rows.length ? result(rows[0]) : result({ code: 'PGRST116', message: 'Geen lokale rij' }, 406)
        return result(rows)
      }
      if (storage && ['POST', 'PATCH'].includes(method)) {
        const entries = Array.isArray(body) ? body : [body]
        for (const entry of entries) {
          const key = table === 'sleutel_kluis' ? 'user_id' : 'id'
          const value = entry[key] || id
          const existing = storage.find(row => row[key] === value)
          if (existing) Object.assign(existing, entry)
          else storage.push({ ...entry, [key]: value || randomUUID() })
        }
        return result(object ? entries[0] : entries, method === 'POST' ? 201 : 200)
      }
      if (method === 'GET') return result(object ? {} : [])
      return result([], 200)
    }
    return result({ error: 'Dit endpoint bestaat niet in de lokale testomgeving.' }, 404)
  })
}

export async function attachLocalBackend(context, baseURL = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT || 8136)}`) {
  const localOrigin = new URL(baseURL).origin
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(localOrigin)) throw new Error('De testbackend werkt uitsluitend op 127.0.0.1.')
  // Prevent service workers or a future websocket from bypassing HTTP routing.
  await context.routeWebSocket('**/*', socket => socket.close({ code: 1000, reason: 'Lokale testomgeving' }))
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === localOrigin && url.pathname === '/__fibro_playwright/invite' && request.method() === 'POST') {
      const invite = await createLocalInvite(localOrigin, { reusable: bodyOf(request).reusable === true })
      return route.fulfill(result({ url: invite }))
    }
    if (url.origin === localOrigin) return route.continue()
    if (url.protocol === 'https:' && url.hostname === fakeSupabaseHost) {
      const headers = {
        'access-control-allow-origin': localOrigin,
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': request.headers()['access-control-request-headers'] || 'authorization, content-type, apikey, x-client-info, prefer',
        'access-control-expose-headers': 'content-range'
      }
      const response = request.method() === 'OPTIONS' ? { status: 204, body: '' } : await handleMockRequest(request)
      return route.fulfill({ ...response, headers: { ...response.headers, ...headers } })
    }
    return route.abort('blockedbyclient')
  })
}
