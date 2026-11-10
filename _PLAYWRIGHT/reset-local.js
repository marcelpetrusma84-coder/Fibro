import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const folder = path.dirname(fileURLToPath(import.meta.url))

for (const bestand of ['test-account.mock.local.json', 'auth-state.mock.local.json', 'local-backend.local.json']) {
  await rm(path.join(folder, bestand), { force: true })
}

console.log('Lokale nagebootste testaccount, sessie en testservergegevens verwijderd.')
