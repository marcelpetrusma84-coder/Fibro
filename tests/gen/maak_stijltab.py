import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stijltab', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'vrienden.html', 'chat.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html',
               'login.html', 'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html',
               'stickerkeuze.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef86.py', 'tests/gen/maak_stijltab.py', 'tests/gen/testscript_stijltab.py'],
    oude_v=['taal.js?v=20', 'taal-en.js?v=20', 'stickerkeuze.js?v=180'],
    beschrijving="Het tabblad onderaan heet Stijl met een waskrijtje (v190)",
    vereist=['tests/gen/maak_stickerpush.py', 'tests/tools/proef85.py'],
    uitpad=S + '/out/maak-stijltab.py')
print(r['inhoudsregels'])
