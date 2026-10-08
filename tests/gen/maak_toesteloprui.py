import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('toesteloprui', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef33.py', 'tests/gen/maak_toesteloprui.py', 'tests/gen/testscript_toesteloprui.py'],
    oude_v=[],
    beschrijving="verlopen berichten ook van het toestel weg: eigen berichttekst eens per 6 uur nagekeken, bewaarde gesprekken meteen",
    vereist=['supabase.js', 'offline.js', 'index.html', 'sql/berichten-bewaren.sql', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-toesteloprui.py')
print(r['inhoudsregels'])
