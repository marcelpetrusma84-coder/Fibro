import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickerpush', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef85.py', 'tests/gen/maak_stickerpush.py', 'tests/gen/testscript_stickerpush.py'],
    oude_v=[],
    beschrijving="Ook een sticker geeft een pushmelding (v189)",
    vereist=['tests/gen/maak_offlinestip.py', 'tests/tools/proef84.py'],
    uitpad=S + '/out/maak-stickerpush.py')
print(r['inhoudsregels'])
