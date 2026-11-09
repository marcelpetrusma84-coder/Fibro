import { expect, test } from '../test-fixtures.js'

// Bewaar geen API-sleutels of aangemaakte links in Playwright-traces.
test.use({ trace: 'off' })

// Alle links, tokens en antwoorden hieronder zijn verzonnen. Er gaat niets naar PrivacyLink.
const endpoint = 'https://api.privacylink.nl/v1/secrets'
const invite = 'https://example.test/invite.html?token=fibro-test-example#s=0123456789abcdef0123456789abcdef&n=Test'
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type'
}

async function openTestPage(page) {
  await page.route('**/__privacylink_test__', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="nl"><title>PrivacyLink-test</title><body><h1>PrivacyLink-test</h1><p>Lokale test met fictieve gegevens.</p></body></html>'
  }))
  await page.goto('/__privacylink_test__')
}

test('PrivacyLink bewaart de volledige fictieve uitnodiging', async ({ page }) => {
  let verzonden
  await page.route(endpoint, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    verzonden = {
      methode: route.request().method(),
      authorization: route.request().headers().authorization,
      inhoud: route.request().postDataJSON()
    }
    return route.fulfill({ status: 201, headers: cors, json: { link: 'https://example.test/eenmalig/test-secret' } })
  })
  await openTestPage(page)

  const antwoord = await page.evaluate(async uitnodiging => {
    const { maakPrivacyLink } = await import('/_PLAYWRIGHT/privacy-link-client.js')
    return maakPrivacyLink({ uitnodiging, apiKey: 'fictieve-test-sleutel', expiry: '7d', accessCode: 'testcode', emailAddress: 'test@example.test' })
  }, invite)

  expect(antwoord).toBe('https://example.test/eenmalig/test-secret')
  expect(verzonden).toEqual({
    methode: 'POST',
    authorization: 'Bearer fictieve-test-sleutel',
    inhoud: { message: invite, expiry: '7d', accessCode: 'testcode', emailAddress: 'test@example.test' }
  })
})

test('PrivacyLink meldt een ongeldige API-sleutel', async ({ page }) => {
  await page.route(endpoint, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    return route.fulfill({ status: 401, headers: cors, json: { message: 'Unauthorized' } })
  })
  await openTestPage(page)
  const bericht = await page.evaluate(async uitnodiging => {
    const { maakPrivacyLink } = await import('/_PLAYWRIGHT/privacy-link-client.js')
    try { await maakPrivacyLink({ uitnodiging, apiKey: 'ongeldige-test-sleutel' }); return 'geen fout' }
    catch (error) { return error.message }
  }, invite)
  expect(bericht).toContain('HTTP 401')
})

test('PrivacyLink weigert ongeldige invoer voordat er iets wordt verstuurd', async ({ page }) => {
  let verzoeken = 0
  await page.route(endpoint, async route => { verzoeken++; await route.abort() })
  await openTestPage(page)
  const fouten = await page.evaluate(async uitnodiging => {
    const { maakPrivacyLink } = await import('/_PLAYWRIGHT/privacy-link-client.js')
    const gevallen = [
      { uitnodiging, apiKey: '' },
      { uitnodiging, apiKey: 'test', expiry: 'voor-altijd' },
      { uitnodiging: 'https://example.test/invite.html', apiKey: 'test' }
    ]
    return Promise.all(gevallen.map(async invoer => {
      try { await maakPrivacyLink(invoer); return 'geen fout' }
      catch (error) { return error.message }
    }))
  }, invite)
  expect(fouten[0]).toContain('API-sleutel')
  expect(fouten[1]).toContain('geldigheid')
  expect(fouten[2]).toContain('token')
  expect(verzoeken).toBe(0)
})

test.describe('PrivacyLink echte API met fictieve gegevens', () => {
  test('createSecret maakt een testgeheim', async ({ request }) => {
    test.skip(process.env.PRIVACYLINK_LIVE !== '1', 'Alleen op expliciet verzoek de externe API aanroepen.')
    const apiKey = process.env.PRIVACYLINK_API_KEY
    expect(apiKey, 'Zet PRIVACYLINK_API_KEY lokaal in de terminal.').toBeTruthy()
    const response = await request.post(endpoint, {
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      data: { message: invite, expiry: '1d' },
      maxRedirects: 0,
      timeout: 30_000
    })
    expect(response.status(), 'PrivacyLink moet een geheim aanmaken (HTTP 201).').toBe(201)
    const result = await response.json()
    expect(typeof result.link).toBe('string')
    expect(new URL(result.link).protocol).toBe('https:')
  })
})
