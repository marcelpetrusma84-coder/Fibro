import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('moodsticker', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'profiel.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['moodsticker.js', 'tests/tools/proef69.py', 'tests/gen/maak_moodsticker.py', 'tests/gen/testscript_moodsticker.py'],
    oude_v=[],
    beschrijving="Een sticker als mood: kiezen in Profiel, tikken op Home en bij een vriend (v171)",
    vereist=['stickerkeuze.js', 'tests/gen/maak_spelsticker.py'],
    uitpad=S + '/out/maak-moodsticker.py')
print(r['inhoudsregels'])
