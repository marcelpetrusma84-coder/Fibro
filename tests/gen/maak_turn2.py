import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('turn2', S + '/oud', S + '/nieuw',
    gewijzigd=['supabase/functions/get-turn-credentials/index.ts', 'server/LEESMIJ.txt', 'tests/tools/proef47.mjs'],
    nieuwe=['tests/gen/maak_turn2.py', 'tests/gen/testscript_turn2.py'],
    oude_v=[],
    beschrijving="get-turn-credentials: van TURN_GEHEIM telt alleen a-z (hoofdletters, spaties en onzichtbare tekens niet) (v149)",
    vereist=['server/turnserver.conf', 'ice-config.js', 'tests/gen/bouw.py', 'tests/gen/maak_turn.py'],
    uitpad=S + '/out/maak-turn2.py')
print(r['inhoudsregels'])
