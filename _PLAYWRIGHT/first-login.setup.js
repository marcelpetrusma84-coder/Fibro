import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { attachLocalBackend, createLocalInvite } from './local-backend.js'

const folder = path.dirname(fileURLToPath(import.meta.url))
const accountPath = path.join(folder, 'test-account.mock.local.json')
const statePath = path.join(folder, 'auth-state.mock.local.json')
const baseURL = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT || 8136)}`
const HERSTELPATROON = /FIBRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/

function veiligeTekst(tekst) {
  return String(tekst || '').replace(/\s+/g, ' ').trim().slice(0, 360)
}

async function wachtOpHomeLogin(page, timeout = 25_000) {
  try {
    await page.waitForFunction(() => Boolean(window._uid), null, { timeout })
    return true
  } catch {
    return false
  }
}

async function lokaalAanmeldscherm(page) {
  const uitnodigingslink = await createLocalInvite(baseURL)
  if (uitnodigingslink) {
    let invite
    try { invite = new URL(uitnodigingslink) } catch {}
    if (!invite?.searchParams.get('token')) throw new Error('De uitnodigingslink bevat geen geldig uitnodigingstoken.')

    await page.goto(`${baseURL}/invite.html${invite.search}${invite.hash}`, { waitUntil: 'domcontentloaded' })
    await page.locator('#regFormulier').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    if (!(await page.locator('#regFormulier').isVisible().catch(() => false))) {
      const tekst = veiligeTekst(await page.locator('body').innerText().catch(() => ''))
      throw new Error(`De uitnodiging opent geen aanmeldformulier. Controleer de link. ${tekst}`)
    }
    await page.waitForTimeout(1500)
    return {
      naam: '#eigennaam', gebruikersnaam: '#gebruikersnaam', wachtwoord: '#wachtwoord',
      geboortejaar: '#geboortejaar', akkoord: '#akkoord', versturen: '#regBtn', melding: '#bericht'
    }
  }

  await page.goto(`${baseURL}/login.html#registreren`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => window.switchTab?.('registreren'))
  const formulier = page.locator('#reg-form')
  await formulier.waitFor({ state: 'attached', timeout: 20_000 })
  await page.waitForFunction(() => {
    const f = document.querySelector('#reg-form')
    const melding = document.querySelector('#reg-msg')?.textContent?.trim()
    return !f || f.style.display === 'none' || Boolean(melding)
  }, null, { timeout: 4_000 }).catch(() => {})
  if (!(await formulier.isVisible())) {
    const uitleg = veiligeTekst(await page.locator('#reg-msg').innerText().catch(() => ''))
    throw new Error(`Nieuwe accounts vereisen hier een geldige uitnodiging. Zet die link in FIBRO_TEST_INVITE_URL. ${uitleg}`)
  }
  await page.waitForTimeout(1500)
  return {
    naam: '#reg-eigennaam', gebruikersnaam: '#reg-username', wachtwoord: '#reg-wachtwoord',
    geboortejaar: '#reg-jaar', akkoord: '#reg-akkoord', versturen: '#reg-btn', melding: '#reg-msg'
  }
}

async function wachtOpAanmeldresultaat(page, meldingSelector) {
  await page.waitForFunction(({ selector, patroon }) => {
    const tekst = document.body.innerText || ''
    const meldingElement = document.querySelector(selector)
    const melding = meldingElement?.classList.contains('error') && meldingElement.textContent?.trim()
    const herstelcode = new RegExp(patroon).test(tekst)
    const herstelkeuze = [...document.querySelectorAll('button')]
      .some(knop => /geen face id\?/i.test(knop.textContent || ''))
    const inviteFout = document.querySelector('#foutScherm') &&
      getComputedStyle(document.querySelector('#foutScherm')).display !== 'none'
    return herstelcode || herstelkeuze || melding || inviteFout
  }, { selector: meldingSelector, patroon: HERSTELPATROON.source }, { timeout: 60_000 })

  const herstelkeuze = page.getByRole('button', { name: /Geen Face ID\?/i }).first()
  if (await herstelkeuze.isVisible().catch(() => false)) {
    await herstelkeuze.click()
    await page.waitForFunction(patroon => new RegExp(patroon).test(document.body.innerText || ''),
      HERSTELPATROON.source, { timeout: 30_000 })
  }

  return page.evaluate(patroon => {
    const match = (document.body.innerText || '').match(new RegExp(patroon))
    return match ? match[0] : null
  }, HERSTELPATROON.source)
}

async function maakTestaccount(page) {
  const selectors = await lokaalAanmeldscherm(page)
  const password = `Test-${randomBytes(24).toString('base64url')}a1!`

  for (let poging = 0; poging < 5; poging++) {
    if (poging > 0) await page.evaluate(() => window.nieuweNaam?.())
    await page.waitForFunction(selector => Boolean(document.querySelector(selector)?.value?.trim()), selectors.gebruikersnaam, { timeout: 10_000 })
    const username = await page.locator(selectors.gebruikersnaam).inputValue()
    await page.locator(selectors.naam).fill('Playwright Test')
    await page.locator(selectors.wachtwoord).fill(password)
    await page.locator(selectors.geboortejaar).fill('1990')
    await page.locator(selectors.akkoord).check()
    await page.locator(selectors.versturen).click()

    const recoveryKey = await wachtOpAanmeldresultaat(page, selectors.melding)
    if (!recoveryKey) {
      const melding = veiligeTekst(await page.locator(selectors.melding).innerText().catch(() => ''))
      if (/gebruikersnaam.*(gebruik|bestaat)|already/i.test(melding) && poging < 4) continue
      if (/uitnodiging|invite/i.test(melding)) {
        throw new Error(`Deze aanmelding vraagt een geldige uitnodiging. Zet die in FIBRO_TEST_INVITE_URL. ${melding}`)
      }
      throw new Error(`De testaanmelding is niet afgerond. ${melding || 'Controleer het aanmeldscherm in Chrome.'}`)
    }

    const account = {
      purpose: 'Local Playwright test account',
      username,
      password,
      recoveryKey,
      createdAt: new Date().toISOString()
    }
    await writeFile(accountPath, `${JSON.stringify(account, null, 2)}\n`, { flag: 'wx' })
    console.log('Lokaal testaccount en herstelcode opgeslagen in _PLAYWRIGHT/test-account.mock.local.json.')
    await page.waitForTimeout(2500)
    return account
  }

  throw new Error('Er konden geen vrije testgebruikersnamen worden gekozen. Probeer de setup nog eens.')
}

async function logIn(page, account) {
  await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('#login-username').fill(account.username)
  await page.locator('#login-wachtwoord').fill(account.password)
  await page.locator('#login-btn').click()
  try {
    await page.waitForFunction(() => !location.pathname.endsWith('/login.html') ||
      [...document.querySelectorAll('button')].some(button => /niet nu/i.test(button.textContent || '')),
    null, { timeout: 25_000 })
  } catch {
    const melding = veiligeTekst(await page.locator('#login-msg').innerText().catch(() => ''))
    throw new Error(`Inloggen met de lokaal opgeslagen testaccountgegevens lukte niet. ${melding}`)
  }
  const laterKnop = page.getByRole('button', { name: /Niet nu/i }).first()
  if (await laterKnop.isVisible().catch(() => false)) await laterKnop.click()
  await page.waitForFunction(() => !location.pathname.endsWith('/login.html'), null, { timeout: 15_000 })
  await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' })
  if (!(await wachtOpHomeLogin(page))) throw new Error('Home opende, maar de testsessie is niet ingelogd.')
}

async function herstelPrivateKey(page, account) {
  await page.goto(`${baseURL}/login.html#herstellen`, { waitUntil: 'domcontentloaded' })
  await page.locator('#herstel-username').fill(account.username)
  await page.locator('#herstel-wachtwoord').fill(account.password)
  await page.locator('#herstelsleutel-input').fill(account.recoveryKey.replace(/^FIBRO-/, ''))
  await page.getByRole('button', { name: 'Account herstellen', exact: true }).click()
  await page.waitForFunction(() => !location.pathname.endsWith('/login.html'), null, { timeout: 30_000 })
  await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const userId = window._uid
    return Boolean(userId && localStorage.getItem(`fibro_privkey_${userId}`))
  }, null, { timeout: 30_000 })
}

// Home asks for a display name once for accounts without one on this device.
// Complete that real dialog in setup, then save the resulting browser state.
async function handelEigenNaamAf(page) {
  const moetVragen = await page.evaluate(() => {
    const uid = window._uid
    if (!uid) return false
    let profiel = {}
    try { profiel = JSON.parse(localStorage.getItem(`fibro_profiel_${uid}`) || '{}') || {} } catch {}
    return !String(profiel.naam || '').trim() && localStorage.getItem(`fibro_eigennaam_gevraagd_${uid}`) !== '1'
  })
  if (!moetVragen) return

  const dialoog = page.locator('#eigenNaamVraag')
  await dialoog.waitFor({ state: 'visible', timeout: 15_000 })
  await dialoog.locator('#eigenNaamInvoer').fill('Playwright Test')
  await dialoog.locator('.env-opslaan').click()
  await dialoog.waitFor({ state: 'hidden', timeout: 10_000 })
  console.log('De weergavenaam van het testaccount is ingesteld.')
}

async function setup(zichtbareRun) {
  const eersteKeer = !existsSync(accountPath)
  const account = eersteKeer ? null : JSON.parse(await readFile(accountPath, 'utf8'))
  const zichtbaar = eersteKeer || zichtbareRun
  const browser = await chromium.launch({ channel: 'chrome', headless: !zichtbaar, slowMo: zichtbaar ? 450 : 0 })
  let context
  try {
    context = existsSync(statePath)
      ? await browser.newContext({ storageState: statePath, serviceWorkers: 'block' })
      : await browser.newContext({ serviceWorkers: 'block' })
    await attachLocalBackend(context)
    await context.addInitScript(() => {
      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        localStorage.setItem('fibro_playwright_local', '1')
      }
    })
    const page = await context.newPage()
    const credentials = eersteKeer ? await maakTestaccount(page) : account

    await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' })
    if (!(await wachtOpHomeLogin(page))) await logIn(page, credentials)
    if (zichtbaar) await page.waitForTimeout(1500)

    const heeftEigenSleutel = await page.evaluate(() => {
      const userId = window._uid
      return Boolean(userId && localStorage.getItem(`fibro_privkey_${userId}`))
    })
    if (!heeftEigenSleutel) await herstelPrivateKey(page, credentials)

    await handelEigenNaamAf(page)
    await context.storageState({ path: statePath })
  } finally {
    await context?.close()
    await browser.close()
  }
}

export default async function firstLoginSetup(config) {
  await setup(config.projects.some(project => project.use.headless === false))
}
