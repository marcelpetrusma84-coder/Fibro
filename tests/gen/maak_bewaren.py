import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('bewaren', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'over.html', 'tests/LEESMIJ.txt'],
    nieuwe=['sql/berichten-bewaren.sql', 'tests/tools/proef32.py', 'tests/tools/nep-supabase.sql', 'tests/gen/maak_bewaren.py', 'tests/gen/testscript_bewaren.py'],
    oude_v=[],
    beschrijving="menu op Home met Berichten bewaren (1 dag t/m 1 jaar, het kortste van de twee geldt); sql/berichten-bewaren.sql",
    vereist=['supabase.js', 'offline.js', 'lijntjes.js', 'vriend-profiel.html', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-bewaren.py')
print(r['inhoudsregels'])
