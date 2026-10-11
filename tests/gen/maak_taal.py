import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('taal', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['opslag.js', 'beltoon.js', 'bel-luisteraar.js', 'tests/LEESMIJ.txt', 'tests/tools/proef35.py'],
    nieuwe=['taal.js', 'taal-en.js', 'tests/tools/proef42.py', 'tests/tools/taalcheck.py', 'tests/gen/maak_taal.py', 'tests/gen/testscript_taal.py'],
    oude_v=['bel-luisteraar.js?v=131', 'beltoon.js?v=6', 'opslag.js?v=1'],
    beschrijving="Fibro in het Nederlands of het Engels, stap 1: taal.js en taal-en.js (in alle 12 paginas), taalkeuze bij inloggen, bij de uitnodiging en in het menu op Home; inloggen, uitnodiging en Home vertaald",
    vereist=['huisregel.js', 'supabase.js', 'crypto.js', 'passkey-kluis.js', 'kastvullen.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-taal.py')
print(r['inhoudsregels'])
