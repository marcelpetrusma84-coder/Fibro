import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('serverbalk', S + '/b9', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'bellen.html', 'tests/LEESMIJ.txt'],
    nieuwe=['verbinding.js', 'tests/tools/proef24.py', 'tests/gen/maak_serverbalk.py', 'tests/gen/testscript_serverbalk.py'],
    oude_v=[],
    beschrijving="balkje als de server even niet bereikbaar is (verbinding.js?v=1, op 6 pagina's)",
    vereist=['offline.js', 'supabase.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-serverbalk.py')
print(r['inhoudsregels'])
