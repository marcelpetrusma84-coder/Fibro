import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('taal3', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'reacties.js', 'reply.js', 'tests/LEESMIJ.txt', 'tests/tools/taalcheck.py', 'tests/tools/proef43.py'],
    nieuwe=['tests/gen/maak_taal3.py', 'tests/gen/testscript_taal3.py'],
    oude_v=['taal.js?v=2', 'taal-en.js?v=2', 'reacties.js?v=108', 'reply.js?v=95'],
    beschrijving="Fibro in het Engels, portie 2: de Chat (berichten, stickers, spellen, screenshots, niet verstuurd, verwijderen), reacties, antwoorden en melden",
    vereist=['huisregel.js', 'supabase.js', 'crypto.js', 'p2pfoto.js', 'bellen.js', 'rapport.js', 'tests/gen/bouw.py', 'tests/gen/maak_taal2.py'],
    uitpad=S + '/out/maak-taal3.py')
print(r['inhoudsregels'])
