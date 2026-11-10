import { defineConfig } from '@playwright/test'
import config from './playwright.config.js'

export default defineConfig(config, { testDir: './manual', timeout: 0 })
