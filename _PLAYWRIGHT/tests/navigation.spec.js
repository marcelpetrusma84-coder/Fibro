import { expect, test } from '../test-fixtures.js'
import { attachLocalBackend } from '../local-backend.js'

async function expectPage(page, pageId, heading) {
  await expect(page.locator('body')).toHaveAttribute('data-fibro-page', pageId)
  await expect(page.locator('h1').first()).toContainText(heading)
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible()
  // Keep each screen visible for a moment when watching the headed run.
  if (test.info().project.use.headless === false) await page.waitForTimeout(2500)
}

async function openMenuItem(page, naam) {
  await page.getByRole('navigation', { name: 'Menu' })
    .locator('.nav-item').filter({ hasText: naam }).click()
}

test.describe('Home en menu in één browsersessie', () => {
  test.describe.configure({ mode: 'serial' })
  let context, page, errors

  test.beforeAll(async ({ browser }, workerInfo) => {
    const { baseURL, storageState } = workerInfo.project.use
    context = await browser.newContext({ baseURL, storageState, serviceWorkers: 'block' })
    await attachLocalBackend(context, baseURL)
    await context.addInitScript(() => {
      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        localStorage.setItem('fibro_playwright_local', '1')
      }
    })
    page = await context.newPage()
    errors = []
    page.on('pageerror', error => errors.push(error.message))
  })

  test.afterAll(async () => { await context?.close() })

  test('Home opens', async () => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.evaluate(() => Boolean(window._uid)), {
      message: 'The first-login setup should leave a signed-in test account.'
    }).toBe(true)
    await expect.poll(() => page.evaluate(() => {
      const userId = window._uid
      return Boolean(userId && localStorage.getItem(`fibro_privkey_${userId}`))
    }), {
      message: 'The test account should have its own key on this browser.'
    }).toBe(true)
    await expectPage(page, 'home', 'Home')
    expect(errors, 'Home should open without a browser error').toEqual([])
  })

  test('Vrienden opens from the menu', async () => {
    await openMenuItem(page, 'Vrienden')
    await expect(page).toHaveURL(/\/vrienden\.html$/)
    await expectPage(page, 'friends', 'Vrienden')
    expect(errors, 'Vrienden should open without a browser error').toEqual([])
  })

  test('Chat opens from the menu', async () => {
    await openMenuItem(page, 'Chat')
    await expect(page).toHaveURL(/\/chat\.html$/)
    await expectPage(page, 'chat', 'Chat')
    expect(errors, 'Chat should open without a browser error').toEqual([])
  })

  test('Stijl opens from the menu', async () => {
    await openMenuItem(page, 'Stijl')
    await expect(page).toHaveURL(/\/profiel\.html$/)
    await expectPage(page, 'style', 'stijl')
    expect(errors, 'Stijl should open without a browser error').toEqual([])
  })
})
