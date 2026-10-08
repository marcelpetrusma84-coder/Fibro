import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('licht', S + '/oud', S + '/nieuw',
    gewijzigd=['profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef37.py', 'tests/gen/maak_licht.py', 'tests/gen/testscript_licht.py'],
    oude_v=[],
    beschrijving="Profiel opslaan stuurt avatar en achtergrondfoto alleen mee als ze veranderd zijn (en dan pas updated_at), 270 bytes in plaats van 1,5 MB",
    vereist=['vriendfotos.js', 'vriend-profiel.html', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-licht.py')
print(r['inhoudsregels'])
