import { expect, test } from '../test-fixtures.js'

// Hold the real local module response until the test has inspected the first paint.
// All other requests remain behind the shared local-only backend fixture.
async function vertraagSessieModule(page) {
  let vrijgeven
  const wacht = new Promise(resolve => { vrijgeven = resolve })
  await page.route('**/supabase-lib.js*', async route => {
    await wacht
    await route.continue()
  })
  return vrijgeven
}

test('Bestaande sessie toont een loader en vervaagt het formulier tot Home opent', async ({ page, context }) => {
  // This case models a returning user who already declined optional Face ID setup.
  await context.addInitScript(() => {
    const session = JSON.parse(localStorage.getItem('sb-qmgatbphiplrfxrljtbe-auth-token') || 'null')
    if (session?.user?.id) localStorage.setItem(`fibro_faceid_later_${session.user.id}`, String(Date.now()))
  })
  const vrijgeven = await vertraagSessieModule(page)
  try {
    await page.goto('/login.html', { waitUntil: 'commit' })
    await expect(page.locator('html')).toHaveAttribute('data-login-sessie', 'laden')
    await expect(page.locator('.login-sessie')).toBeVisible()
    await expect(page.locator('#login-inhoud')).toHaveAttribute('inert', '')
    await expect(page.locator('#login-inhoud')).toHaveAttribute('aria-hidden', 'true')
    await expect.poll(() => page.locator('#login-inhoud').evaluate(el => getComputedStyle(el).filter)).toContain('blur(')
  } finally {
    vrijgeven()
  }
  await expect(page).toHaveURL(/\/index\.html$/, { timeout: 20_000 })
  await expect(page.locator('body')).toHaveAttribute('data-fibro-page', 'home')
})

test('Zonder opgeslagen sessie zijn de inlogvelden direct bereikbaar', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.removeItem('sb-qmgatbphiplrfxrljtbe-auth-token'))
  const vrijgeven = await vertraagSessieModule(page)
  try {
    await page.goto('/login.html', { waitUntil: 'commit' })
    await expect(page.locator('#login-username')).toBeVisible()
    await expect(page.locator('.login-sessie')).toBeHidden()
    await expect(page.locator('#login-inhoud')).not.toHaveAttribute('inert')
    await expect(page.locator('#login-username')).toBeEditable()
  } finally {
    vrijgeven()
  }
  await page.waitForLoadState('domcontentloaded')
  await expect(page).toHaveURL(/\/login\.html$/)
  await expect(page.locator('#login-wachtwoord')).toBeEditable()
})

test('Een expliciete herstellink blijft bruikbaar met een bestaande sessie', async ({ page }) => {
  await page.goto('/login.html#herstellen', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.login-sessie')).toBeHidden()
  await expect(page.locator('#panel-herstellen')).toHaveClass(/active/)
  await expect(page.locator('#login-inhoud')).not.toHaveAttribute('inert')
  await expect(page.locator('#herstel-username')).toBeEditable()
  await expect(page).toHaveURL(/\/login\.html#herstellen$/)
})

test('De sessieloader respecteert verminderde beweging', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const vrijgeven = await vertraagSessieModule(page)
  try {
    await page.goto('/login.html', { waitUntil: 'commit' })
    await expect(page.locator('.login-sessie')).toBeVisible()
    await expect.poll(() => page.locator('.login-sessie-balk').evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none')
  } finally {
    vrijgeven()
  }
})
