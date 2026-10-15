import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickers', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'taal.js', 'taal-en.js', 'bellen.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html',
               'profiel.html', 'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html',
               'tests/LEESMIJ.txt', 'tests/tools/proef23.py', 'tests/tools/proef43.py'],
    nieuwe=['stickerfx.js', 'stickervellen.js', 'stickerkeuze.js', 'tests/tools/proef53.py', 'tests/gen/maak_stickers.py', 'tests/gen/testscript_stickers.py'],
    oude_v=['taal.js?v=10', 'taal-en.js?v=10'],
    beschrijving="Stickers met beweging en geluid: nieuwe stickerkeuze (6 vellen, 2 eigen, 4 winkel), alleen de code van de sticker in het bericht (v153)",
    vereist=['supabase.js', 'crypto.js', 'belregel.js', 'tests/gen/bouw.py', 'tests/gen/maak_belregels.py'],
    uitpad=S + '/out/maak-stickers.py')
print(r['inhoudsregels'])
