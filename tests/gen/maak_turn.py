import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('turn', S + '/oud', S + '/nieuw',
    gewijzigd=['tests/LEESMIJ.txt'],
    nieuwe=['supabase/functions/get-turn-credentials/index.ts', 'server/turnserver.conf', 'server/LEESMIJ.txt',
            'tests/tools/proef47.mjs', 'tests/gen/maak_turn.py', 'tests/gen/testscript_turn.py'],
    oude_v=[],
    beschrijving="Eigen TURN-server: get-turn-credentials maakt pasjes voor onze coturn, server/turnserver.conf en server/LEESMIJ.txt (v149)",
    vereist=['ice-config.js', 'supabase/functions/stuur-push/index.ts', 'tests/gen/bouw.py', 'tests/gen/maak_blockit.py'],
    uitpad=S + '/out/maak-turn.py')
print(r['inhoudsregels'])
