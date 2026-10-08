import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html',
           'profiel.html', 'spel.html', 'spellen/runner-gunner.html', 'vriend-profiel.html', 'vrienden.html']
r = bouw('huisregel', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['tests/LEESMIJ.txt'],
    nieuwe=['huisregel.js', 'tests/tools/proef36.py', 'tests/gen/maak_huisregel.py', 'tests/gen/testscript_huisregel.py'],
    oude_v=[],
    beschrijving="huisregel (Content-Security-Policy) op alle 12 paginas: code alleen van de eigen site, praten alleen met de eigen site en Supabase; huisregel.js?v=1 schrijft op wat tegengehouden wordt (Over Fibro, Technisch)",
    vereist=['supabase.js', 'ice-config.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-huisregel.py')
print(r['inhoudsregels'])
