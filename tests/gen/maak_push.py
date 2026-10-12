import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('push', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'supabase/functions/stuur-push/index.ts', 'tests/LEESMIJ.txt'],
    nieuwe=['sql/taal.sql', 'tests/tools/proef45.py', 'tests/tools/proef46.mjs', 'tests/gen/maak_push.py', 'tests/gen/testscript_push.py'],
    oude_v=[],
    beschrijving="Pushmeldingen in de taal van de ontvanger: Home zet profiles.taal, stuur-push maakt de tekst zelf (v148)",
    vereist=['huisregel.js', 'taal.js', 'taal-en.js', 'chat.html', 'service-worker.js', 'tests/gen/bouw.py', 'tests/gen/maak_taal6.py'],
    uitpad=S + '/out/maak-push.py')
print(r['inhoudsregels'])
