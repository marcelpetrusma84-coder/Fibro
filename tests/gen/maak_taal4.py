import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('taal4', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/taalcheck.py', 'tests/tools/proef43.py', 'tests/tools/proef36.py'],
    nieuwe=['tests/gen/maak_taal4.py', 'tests/gen/testscript_taal4.py'],
    oude_v=['taal.js?v=3', 'taal-en.js?v=3'],
    beschrijving="Fibro in het Engels, portie 3: het Profiel (alle tabbladen, widgets, lettertypen, kleuren, stickers, muziek)",
    vereist=['huisregel.js', 'supabase.js', 'lettertypes.js', 'thema.js', 'tests/gen/bouw.py', 'tests/gen/maak_taal3.py'],
    uitpad=S + '/out/maak-taal4.py')
print(r['inhoudsregels'])
