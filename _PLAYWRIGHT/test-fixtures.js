import { test as base, expect } from '@playwright/test'
import { attachLocalBackend } from './local-backend.js'

export const test = base.extend({
  context: async ({ context }, use) => {
    await attachLocalBackend(context)
    await context.addInitScript(() => {
      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        localStorage.setItem('fibro_playwright_local', '1')
      }
    })
    await use(context)
  }
})

export { expect }
