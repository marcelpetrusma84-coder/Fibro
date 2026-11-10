// Snelle start voor paginatests. Alle accounts en API-antwoorden zijn lokaal nagebootst.
// De uitgebreide aanmeldtest staat apart in first-login.setup.js.
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalInvite, handleMockRequest } from './local-backend.js'

const folder = path.dirname(fileURLToPath(import.meta.url))
const accountPath = path.join(folder, 'test-account.quick.local.json')
const statePath = path.join(folder, 'auth-state.quick.local.json')
const sessionKey = 'sb-qmgatbphiplrfxrljtbe-auth-token'
const mockOrigin = 'https://qmgatbphiplrfxrljtbe.supabase.co'
const displayName = 'Playwright Test'

async function leesJson(bestand) {
  try { return JSON.parse(await readFile(bestand, 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
    throw error
  }
}

// Gebruik dezelfde sleutelimplementatie als de app, zonder de live server te benaderen.
async function laadCrypto() {
  const bron = await readFile(new URL('../crypto.js', import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(bron).toString('base64')}`)
}

async function lokaalVerzoek(method, pad, inhoud = {}, token = '') {
  const response = await handleMockRequest({
    url: () => `${mockOrigin}${pad}`,
    method: () => method,
    postDataJSON: () => inhoud,
    headers: () => ({ accept: 'application/vnd.pgrst.object+json', ...(token ? { authorization: `Bearer ${token}` } : {}) })
  })
  return response
}

function lokaleWaarden(state) {
  const oorsprong = state?.origins?.find(item => {
    try { return new URL(item.origin).hostname === '127.0.0.1' } catch { return false }
  })
  return new Map((oorsprong?.localStorage || []).map(item => [item.name, item.value]))
}

async function hergebruik(account, state, cryptoApi) {
  if (!account?.username || !account?.password || !account?.recoveryKey || !account?.userId) return null
  const waarden = lokaleWaarden(state)
  const privateKey = waarden.get(`fibro_privkey_${account.userId}`)
  if (!privateKey) return null
  const login = await lokaalVerzoek('POST', '/auth/v1/token?grant_type=password', {
    email: `${account.username.toLowerCase()}@fibro.internal`, password: account.password
  })
  const session = login.status === 200 ? login.json : null
  if (!session?.user || session.user.id !== account.userId || !session.access_token) return null
  const profiel = await lokaalVerzoek('GET', `/rest/v1/profiles?id=eq.${encodeURIComponent(account.userId)}`, {}, session.access_token)
  const kluis = await lokaalVerzoek('GET', `/rest/v1/sleutel_kluis?user_id=eq.${encodeURIComponent(account.userId)}`, {}, session.access_token)
  try {
    if (profiel.status !== 200 || kluis.status !== 200 ||
        await cryptoApi.eigenPubliekeSleutel(privateKey) !== profiel.json?.public_key ||
        await cryptoApi.ontsleutelPrivateKey(kluis.json?.blob, account.recoveryKey) !== privateKey) return null
  } catch { return null }
  return { account, session, privateKey, waarden }
}

async function nieuwAccount(baseURL, cryptoApi) {
  const uitnodiging = new URL(await createLocalInvite(baseURL))
  const username = `Playwright${randomBytes(6).toString('hex')}`
  const password = `Test-${randomBytes(24).toString('base64url')}a1!`
  const recoveryKey = cryptoApi.maakHerstelSleutel()
  const sleutels = await cryptoApi.genereerKeypair()
  const signup = await lokaalVerzoek('POST', '/auth/v1/signup', {
    email: `${username.toLowerCase()}@fibro.internal`, password,
    data: { username, geboortejaar: 1990, niveau: 'adults', invite_token: uitnodiging.searchParams.get('token') }
  })
  const session = signup.status === 200 ? signup.json : null
  if (!session?.user?.id || !session.access_token) throw new Error('Lokaal testaccount aanmaken mislukt.')
  const userId = session.user.id
  const profiel = await lokaalVerzoek('POST', '/rest/v1/profiles', {
    id: userId, username, niveau: 'adults', public_key: sleutels.publicKeyB64
  }, session.access_token)
  const blob = await cryptoApi.versleutelPrivateKey(sleutels.privateKeyB64, recoveryKey)
  const kluis = await lokaalVerzoek('POST', '/rest/v1/sleutel_kluis', { user_id: userId, blob }, session.access_token)
  if (profiel.status !== 201 || kluis.status !== 201) throw new Error('Lokaal testprofiel of herstelkluis aanmaken mislukt.')
  const vriendschap = await lokaalVerzoek('POST', '/rest/v1/rpc/maak_vriendschap_via_invite', {
    token_in: uitnodiging.searchParams.get('token')
  }, session.access_token)
  if (vriendschap.json !== true) throw new Error('Lokale testuitnodiging verwerken mislukt.')
  return {
    account: { purpose: 'Local Playwright quick test account', username, password, recoveryKey, userId, createdAt: new Date().toISOString() },
    session, privateKey: sleutels.privateKeyB64, waarden: new Map()
  }
}

export default async function quickLoginSetup(config) {
  const baseURL = new URL(config.projects[0].use.baseURL)
  if (baseURL.protocol !== 'http:' || baseURL.hostname !== '127.0.0.1' || !baseURL.port) {
    throw new Error('Snelle aanmelding werkt alleen met de lokale Playwright-testserver.')
  }
  const cryptoApi = await laadCrypto()
  const eerderAccount = await leesJson(accountPath)
  const eerdereState = await leesJson(statePath)
  const data = await hergebruik(eerderAccount, eerdereState, cryptoApi) || await nieuwAccount(baseURL.origin, cryptoApi)
  const { account, session, privateKey, waarden } = data
  waarden.set(sessionKey, JSON.stringify(session))
  waarden.set(`fibro_privkey_${account.userId}`, privateKey)
  if (!waarden.has(`fibro_profiel_${account.userId}`)) {
    waarden.set(`fibro_profiel_${account.userId}`, JSON.stringify({ naam: displayName }))
  }
  waarden.set('fibro_playwright_local', '1')
  const state = {
    cookies: [],
    origins: [{ origin: baseURL.origin, localStorage: [...waarden].map(([name, value]) => ({ name, value })) }]
  }
  await writeFile(accountPath, `${JSON.stringify(account, null, 2)}\n`)
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
  console.log('Snelle lokale testaanmelding klaar. De vier pagina’s kunnen worden getest.')
}
