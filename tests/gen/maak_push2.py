import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('push2', S + '/oud', S + '/nieuw',
    gewijzigd=['supabase/functions/stuur-push/index.ts', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef50.mjs', 'tests/gen/maak_push2.py', 'tests/gen/testscript_push2.py'],
    oude_v=[],
    beschrijving="stuur-push: belmeldingen (oproep, oproep-video, gemist), eerst de functie, de app volgt (v151)",
    vereist=['service-worker.js', 'bellen.js', 'tests/gen/bouw.py', 'tests/gen/maak_video.py'],
    uitpad=S + '/out/maak-push2.py')
print(r['inhoudsregels'])
