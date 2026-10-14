import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('ice', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['ice-config.js', 'bellen.js', 'p2pfoto.js', 'sync.js', 'bel-luisteraar.js', 'kastvullen.js',
                         'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'server/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef48.py', 'tests/gen/maak_ice.py', 'tests/gen/testscript_ice.py'],
    oude_v=['ice-config.js?v=106', 'bellen.js?v=143', 'bel-luisteraar.js?v=143', 'p2pfoto.js?v=122', 'sync.js?v=146',
            'kastvullen.js?v=146', 'taal.js?v=7', 'taal-en.js?v=7'],
    beschrijving="Eigen spiegel (STUN) en het TURN-pasje 12 uur op het toestel; Over Fibro bijgewerkt (v149)",
    vereist=['account.js', 'supabase.js', 'supabase/functions/get-turn-credentials/index.ts', 'server/turnserver.conf',
             'tests/gen/bouw.py', 'tests/gen/maak_turn2.py'],
    uitpad=S + '/out/maak-ice.py')
print(r['inhoudsregels'])
