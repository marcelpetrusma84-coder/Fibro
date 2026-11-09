import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const folder = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(folder, '..')
const port = Number(process.env.PLAYWRIGHT_PORT || 8136)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: path.join(folder, 'tests'),
  testMatch: '**/*.spec.js',
  globalSetup: path.join(folder, 'first-login.setup.js'),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    storageState: path.join(folder, 'auth-state.mock.local.json'),
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `python tests/tools/server.py "${projectRoot}" ${port}`,
    cwd: projectRoot,
    url: `${baseURL}/index.html`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
})
