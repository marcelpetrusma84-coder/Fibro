// Pushmeldingen voor spellen (3 nov 2026). Server: tests/tools/proef233.mjs; app met twee spelers: proef234.py.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const c = lees('chat.html'), s = lees('spel.html'), f = lees('supabase/functions/stuur-push/index.ts')
// uitnodiging: met het id van het bericht (chat: gewone spellen en schaken met drie; spel.html: schaken)
assert.match(c, /content: 'spelinvite:' \+ spelType \+ ':' \+ huidigeUser\.id \+ ':' \+ sessieId\n    \}\)\.select\('id'\)\.single\(\)\n    stuurPling\(uitnodiging\?\.id\)/)
assert.match(c, /stuurPling\(uitnodiging3\?\.id\)/)
assert.match(s, /body: JSON\.stringify\(\{ message_id: uitnodiging\.id \}\)/)
// gemist en verlaten: bij sluiten en bij weggaan van de pagina; verlaten alleen als de vriend al even stil is
assert.match(c, /if \(spelWachtKlaar && spelUitnodiger === huidigeUser\?\.id\) soort = 'spel-gemist'/)
assert.match(c, /else if \(!stil && spelVriendKwam && \['waiting', 'reconnecting'\]\.includes\(laatsteSpelVerbindingStatus\)\) soort = 'spel-verlaten'/)
assert.match(c, /if \(!wasFibroTest\) spelPushBijWeggaan\(stil\)/)
assert.match(c, /spelPushBijWeggaan\(false\) \/\/ v3 nov/)
assert.match(c, /spelVriendKwam = true \/\/ v3 nov/)
// server: de drie soorten met teksten in beide talen, korte levensduur voor de uitnodiging
for (const soort of ['spel', '"spel-gemist"', '"spel-verlaten"']) assert.ok(f.includes('  ' + soort + ': {'), soort)
assert.match(f, /spel: 120, "spel-gemist": 24 \* 60 \* 60, "spel-verlaten": 60 \* 60/)
assert.match(f, /if \(isSpel\) melding\.tag = "spel-" \+ afzender/)
// elk spel uit de chat heeft een naam op de server
const chatSpellen = /const beschikbaar = \[([^\]]+)\]/.exec(c)[1].match(/'([a-z]+)'/g).map(x => x.slice(1, -1))
for (const id of chatSpellen) assert.ok(new RegExp('\\b' + id + ': \\{ nl: ').test(f), 'naam op de server voor ' + id)
console.log('game push: ok')
