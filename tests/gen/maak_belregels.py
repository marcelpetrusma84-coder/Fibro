import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('belregels', S + '/oud', S + '/nieuw',
    gewijzigd=['bellen.js', 'bellen.html', 'bel-luisteraar.js', 'chat.html', 'index.html', 'profiel.html', 'vrienden.html', 'ongelezen.js',
               'over.html', 'taal.js', 'taal-en.js', 'spel.html', 'invite.html', 'login.html', 'vriend-profiel.html', 'moderatie.html',
               'spellen/runner-gunner.html', 'tests/LEESMIJ.txt', 'tests/tools/proef51.py'],
    nieuwe=['belregel.js', 'sql/belregels.sql', 'tests/tools/proef52.py', 'tests/gen/maak_belregels.py', 'tests/gen/testscript_belregels.py'],
    oude_v=['bellen.js?v=151', 'bel-luisteraar.js?v=151', 'ongelezen.js?v=131', 'taal.js?v=9', 'taal-en.js?v=9'],
    beschrijving="Belregels in de chat: gemist, geweigerd, gesprek met duur; alleen gemist telt als ongelezen (v152)",
    vereist=['supabase.js', 'lijntjes.js', 'ice-config.js', 'sql/ongelezen.sql', 'tests/gen/bouw.py', 'tests/gen/maak_oproep.py'],
    uitpad=S + '/out/maak-belregels.py')
print(r['inhoudsregels'])
