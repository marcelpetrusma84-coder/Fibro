import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('offline3', S + '/base', S + '/nieuw',
    gewijzigd=['chat.html', 'index.html', 'profiel.html', 'runner-gunner-ui.js', 'solo.js', 'spel.html'],
    nieuwe=[],
    oude_v=['runner-gunner-ui.js?v=124', 'solo.js?v=124'],
    beschrijving="offline deel 3: berichten van alle vrienden bewaren (chat.html), uitloggen wist offline-gegevens, Runner & Gunner alleen zonder medespeler-vakje (?v=128)",
    vereist=['service-worker.js', 'kastvullen.js', 'supabase.js'],
    uitpad=S + '/out/maak-offline3.py')
print(r)
