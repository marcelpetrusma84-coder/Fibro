import { randomBytes } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { attachLocalBackend, createLocalInvite, handleMockRequest } from '../local-backend.js'

// De uitgebreide route gebruikt een eigen, lege browsercontext en de lokale
// nabootsing van Supabase. Er worden geen echte uitnodigingen of accounts gebruikt.
test('Een lokale uitnodiging maakt een account met herstelcode aan', async ({ browser }, testInfo) => {
  test.setTimeout(90_000)
  const baseURL = testInfo.project.use.baseURL
  const invitation = await createLocalInvite(baseURL)
  const invitationToken = new URL(invitation).searchParams.get('token')
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block' })

  try {
    await attachLocalBackend(context, baseURL)
    await context.addInitScript(() => {
      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        localStorage.setItem('fibro_playwright_local', '1')
      }
    })
    const page = await context.newPage()
    await page.goto(invitation, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#regFormulier')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#gebruikersnaam')).not.toHaveValue('')

    const username = await page.locator('#gebruikersnaam').inputValue()
    const password = `Test-${randomBytes(24).toString('base64url')}a1!`
    await page.locator('#eigennaam').fill('Playwright Test')
    await page.locator('#wachtwoord').fill(password)
    await page.locator('#geboortejaar').fill('1990')
    await page.locator('#akkoord').check()
    await page.locator('#regBtn').click()

    // Sommige apparaten bieden eerst Face ID aan; kies dan de herstelcode.
    const herstelcode = page.locator('#herstelCode')
    const herstelkeuze = page.getByRole('button', { name: /Geen Face ID\? Gebruik een herstelcode/i })
    await page.waitForFunction(() => {
      const zichtbaar = el => Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      const code = document.querySelector('#herstelCode')
      const keuze = [...document.querySelectorAll('button')]
        .find(knop => /Geen Face ID\? Gebruik een herstelcode/i.test(knop.textContent || '') && zichtbaar(knop))
      return zichtbaar(code) || Boolean(keuze)
    }, null, { timeout: 60_000 })
    if (await herstelkeuze.isVisible()) await herstelkeuze.click()
    await expect(herstelcode).toHaveText(/^FIBRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, { timeout: 30_000 })
    await expect(page.locator('#bevestigNaam')).toHaveText(username)

    // De app moet ook echt een sessie, eigen lokale sleutel en naam hebben bewaard.
    const bewaard = await page.evaluate(() => {
      const sessie = JSON.parse(localStorage.getItem('sb-qmgatbphiplrfxrljtbe-auth-token') || 'null')
      const uid = sessie?.user?.id
      const profiel = uid ? JSON.parse(localStorage.getItem(`fibro_profiel_${uid}`) || '{}') : {}
      return { ingelogd: Boolean(uid), sleutel: Boolean(uid && localStorage.getItem(`fibro_privkey_${uid}`)), naam: profiel.naam }
    })
    expect(bewaard).toEqual({ ingelogd: true, sleutel: true, naam: 'Playwright Test' })

    // De gewone uitnodiging is na gebruik niet opnieuw geldig op de lokale server.
    const opnieuw = await handleMockRequest({
      url: () => 'https://qmgatbphiplrfxrljtbe.supabase.co/rest/v1/rpc/valideer_invite',
      method: () => 'POST',
      headers: () => ({}),
      postDataJSON: () => ({ token_in: invitationToken })
    })
    expect(opnieuw.json).toEqual([])
  } finally {
    await context.close()
  }
})
