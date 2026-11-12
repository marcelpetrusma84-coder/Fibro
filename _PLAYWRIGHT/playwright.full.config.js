import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from './playwright.config.js'

const folder = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig(config, {
  globalSetup: path.join(folder, 'first-login.setup.js'),
  use: { ...config.use, storageState: path.join(folder, 'auth-state.mock.local.json') }
})
