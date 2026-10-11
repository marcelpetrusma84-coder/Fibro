import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('etiket', S + '/oud', S + '/nieuw',
    gewijzigd=['vriend-profiel.html', 'vrienden.html', 'chat.html', 'vriendfotos.js', 'tests/LEESMIJ.txt', 'tests/tools/proef34.py'],
    nieuwe=['sql/foto-etiketten.sql', 'tests/tools/proef40.py', 'tests/gen/maak_etiket.py', 'tests/gen/testscript_etiket.py'],
    oude_v=['vriendfotos.js?v=1'],
    beschrijving="een eigen etiket per foto (avatar_versie, wallpaper_versie): vrienden halen alleen de foto op die echt anders is; een nieuwe avatar haalt de achtergrond (tot 1,5 MB) niet meer mee",
    vereist=['profiel.html', 'supabase.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-etiket.py')
print(r['inhoudsregels'])
