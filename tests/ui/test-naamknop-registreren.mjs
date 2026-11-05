// v266 (5 nov 2026): bij registreren (login.html en invite.html) staat onder de gebruikersnaam een duidelijke knop
// '🔄 Kies een andere naam' in plaats van een losse dobbelsteen (🎲) ernaast. De knop roept nog steeds nieuweNaam() aan,
// en de Engelse vertaling staat in taal-en.js.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const en = lees('taal-en.js')
for (const [pagina, veld] of [['login.html', 'reg-username'], ['invite.html', 'gebruikersnaam']]) {
  const s = lees(pagina)
  assert.ok(!s.includes('🎲'), pagina + ': geen dobbelsteen meer')
  assert.ok(!s.includes('dice-btn'), pagina + ': geen dobbelsteenknop meer')
  const knop = s.match(/<button[^>]*class="naam-knop"[^>]*>([^<]*)<\/button>/)
  assert.ok(knop, pagina + ': knop met class naam-knop gevonden')
  assert.match(knop[0], /onclick="nieuweNaam\(\)"/, pagina + ': knop maakt een nieuwe naam')
  assert.match(knop[0], /type="button"/, pagina + ': knop verstuurt geen formulier')
  assert.equal(knop[1], '🔄 Kies een andere naam', pagina + ': duidelijke tekst op de knop')
  assert.ok(s.indexOf('id="' + veld + '"') < s.indexOf('class="naam-knop"'), pagina + ': knop staat onder de naam')
  assert.match(s, /\.naam-knop \{[^}]*min-height:44px/, pagina + ': knop is groot genoeg om aan te tikken')
}
assert.match(en, /"🔄 Kies een andere naam": "🔄 Pick another name"/, 'Engelse tekst voor de knop')
assert.match(en, /"Je naam verschijnt hier": "Your name appears here"/, 'Engelse tekst voor het lege veld')
console.log('ok: duidelijke knop voor een andere gebruikersnaam bij registreren')
