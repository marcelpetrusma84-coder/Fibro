import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('oproep', S + '/oud', S + '/nieuw',
    gewijzigd=['bellen.js', 'bellen.html', 'bel-luisteraar.js', 'chat.html', 'index.html', 'profiel.html', 'vrienden.html',
               'service-worker.js', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef51.py', 'tests/gen/maak_oproep.py', 'tests/gen/testscript_oproep.py'],
    oude_v=['bellen.js?v=150', 'bel-luisteraar.js?v=150'],
    beschrijving="Pushmelding bij bellen: belt je, en gemiste oproep als niemand opnam (v151)",
    vereist=['supabase/functions/stuur-push/index.ts', 'ice-config.js', 'supabase.js', 'tests/gen/bouw.py', 'tests/gen/maak_push2.py'],
    uitpad=S + '/out/maak-oproep.py')
print(r['inhoudsregels'])
