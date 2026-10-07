import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('offline2', S + '/fibro', S + '/nieuw',
    gewijzigd=['index.html', 'vrienden.html', 'chat.html', 'over.html', 'invite.html', 'login.html', 'vriend-profiel.html',
               'bellen.html', 'profiel.html', 'moderatie.html', 'spellen/runner-gunner.html'],
    nieuwe=['kastvullen.js'],
    oude_v=['android-fix.css'],
    beschrijving="offline deel 2: alle spellen en pagina's in de kast (kastvullen.js?v=127), gastenboek en vriendenlijst bewaard voor zonder internet, android-fix.css?v=1",
    vereist=['offline.js', 'service-worker.js'],
    uitpad=S + '/out/maak-offline2.py')
print(r)
