import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('vriendfotos', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'vrienden.html', 'tests/LEESMIJ.txt'],
    nieuwe=['vriendfotos.js', 'tests/tools/proef34.py', 'tests/gen/maak_vriendfotos.py', 'tests/gen/testscript_vriendfotos.py'],
    oude_v=[],
    beschrijving="avatarfotos van vrienden in Vrienden en Chat (lijst, kop, berichten), alleen ophalen als ze ontbreken of veranderd zijn (vriendfotos.js?v=1)",
    vereist=['supabase.js', 'offline.js', 'lijntjes.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vriendfotos.py')
print(r['inhoudsregels'])
