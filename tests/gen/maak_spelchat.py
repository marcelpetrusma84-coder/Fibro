import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('spelchat', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef67.py', 'tests/gen/maak_spelchat.py', 'tests/gen/testscript_spelchat.py'],
    oude_v=[],
    beschrijving="Chatbalk in een spel (emoji's en tekst) alleen bij de beurtspellen (v169)",
    vereist=['sync.js', 'tests/gen/maak_badge.py'],
    uitpad=S + '/out/maak-spelchat.py')
print(r['inhoudsregels'])
