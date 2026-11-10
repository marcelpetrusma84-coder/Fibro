import { test, expect } from '../test-fixtures.js'
import { attachLocalBackend } from '../local-backend.js'

test('Lokale testuitnodiging uitproberen', async ({ page, context, browser }) => {
  const gastContexts = new Set()
  const base = new URL(test.info().project.use.baseURL)
  await context.exposeBinding('fibroOpenLocalTestInvite', async (_, link) => {
    const url = new URL(link)
    if (url.origin !== base.origin || url.pathname !== '/invite.html' || !url.searchParams.get('token')) {
      throw new Error('Alleen een lokale testuitnodiging kan worden geopend.')
    }
    const gast = await browser.newContext({ serviceWorkers: 'block' })
    gastContexts.add(gast)
    gast.on('close', () => gastContexts.delete(gast))
    try {
      await attachLocalBackend(gast, base.origin)
      await gast.addInitScript(() => {
        if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
          localStorage.setItem('fibro_playwright_local', '1')
          document.addEventListener('DOMContentLoaded', () => {
            const melding = document.createElement('div')
            melding.textContent = 'LOKALE TEST — nieuwe testgebruiker'
            melding.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;padding:8px 12px;border-radius:8px;background:#facc15;color:#161006;font:700 13px sans-serif;box-shadow:0 2px 10px #0009'
            document.body.appendChild(melding)
          }, { once: true })
        }
      })
      const gastPagina = await gast.newPage()
      await gastPagina.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    } catch (error) {
      await gast.close()
      throw error
    }
  })
  try {
  await page.goto('/vrienden.html', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Uitnodigen/i })).toBeVisible()
  await page.getByRole('button', { name: /Uitnodigen/i }).first().click()
  console.log('De uitnodigingstest wacht op jou. Houd 7 dagen vijf seconden vast, vul 1234 in en kies Testlink maken. Sluit het tabblad of kies Test beëindigen als je klaar bent.')
  await Promise.race([
    page.waitForEvent('close', { timeout: 0 }),
    page.evaluate(() => new Promise(resolve => {
      const melding = document.createElement('aside')
      melding.setAttribute('role', 'status')
      melding.style.cssText = 'position:fixed;bottom:86px;right:12px;z-index:8000;max-width:290px;padding:12px;border:2px solid #facc15;border-radius:12px;background:#251d07;color:#fff;box-shadow:0 4px 18px #0009;font:14px/1.4 sans-serif'
      const tekst = document.createElement('div')
      tekst.textContent = 'LOKALE TEST: houd 7 dagen 5 seconden vast, vul 1234 in en maak de testlink. De test wacht op jou.'
      const knop = document.createElement('button')
      knop.textContent = 'Test beëindigen'
      knop.style.cssText = 'margin-top:8px;padding:8px 12px;border:0;border-radius:8px;background:#facc15;color:#161006;font-weight:bold;cursor:pointer'
      knop.addEventListener('click', () => { melding.remove(); resolve() }, { once: true })
      melding.append(tekst, knop)
      document.body.appendChild(melding)
    })).catch(() => {})
  ])
  } finally {
    await Promise.all([...gastContexts].map(gast => gast.close()))
  }
})
