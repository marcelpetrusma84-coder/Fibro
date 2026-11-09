import { expect, test } from '../test-fixtures.js'

async function notePageErrors(page) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

async function expectPage(page, pageId, heading) {
  await expect(page.locator('body')).toHaveAttribute('data-fibro-page', pageId)
  await expect(page.locator('h1').first()).toContainText(heading)
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible()
  // Give a person time to inspect the page during a headed run.
  if (test.info().project.use.headless === false) await page.waitForTimeout(2500)
}

async function openAuthenticatedHome(page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('body')).toHaveAttribute('data-fibro-page', 'home')
  await expect.poll(() => page.evaluate(() => Boolean(window._uid)), {
    message: 'The first-login setup should leave a signed-in test account.'
  }).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const userId = window._uid
    return Boolean(userId && localStorage.getItem(`fibro_privkey_${userId}`))
  }), {
    message: 'The saved recovery key should restore the test account key on this browser.'
  }).toBe(true)
  if (test.info().project.use.headless === false) await page.waitForTimeout(1200)
}

test('Home opens', async ({ page }) => {
  const errors = await notePageErrors(page)
  await openAuthenticatedHome(page)
  await expectPage(page, 'home', 'Home')
  expect(errors, 'Home should not throw a browser error while opening').toEqual([])
})

test('Vrienden opens from the menu', async ({ page }) => {
  const errors = await notePageErrors(page)
  await openAuthenticatedHome(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByText('Vrienden', { exact: true }).click()
  await expect(page).toHaveURL(/\/vrienden\.html$/)
  await expectPage(page, 'friends', 'Vrienden')
  expect(errors, 'Vrienden should not throw a browser error while opening').toEqual([])
})

test('Chat opens from the menu', async ({ page }) => {
  const errors = await notePageErrors(page)
  await openAuthenticatedHome(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByText('Chat', { exact: true }).click()
  await expect(page).toHaveURL(/\/chat\.html$/)
  await expectPage(page, 'chat', 'Chat')
  expect(errors, 'Chat should not throw a browser error while opening').toEqual([])
})

test('Stijl opens from the menu', async ({ page }) => {
  const errors = await notePageErrors(page)
  await openAuthenticatedHome(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByText('Stijl', { exact: true }).click()
  await expect(page).toHaveURL(/\/profiel\.html$/)
  await expectPage(page, 'style', 'stijl')
  expect(errors, 'Stijl should not throw a browser error while opening').toEqual([])
})
