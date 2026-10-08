import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('profielkolommen', S + '/oud', S + '/nieuw',
    gewijzigd=['vriend-profiel.html', 'index.html', 'profiel.html', 'bellen.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef31.py', 'tests/gen/maak_profielkolommen.py', 'tests/gen/testscript_profielkolommen.py'],
    oude_v=[],
    beschrijving="profielen zonder onnodige fotos: vriend-profiel alleen bij een andere updated_at, Home/Profiel nooit de eigen achtergrond, belscherm alleen naam en emoji",
    vereist=['supabase.js', 'offline.js', 'lijntjes.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-profielkolommen.py')
print(r['inhoudsregels'])
