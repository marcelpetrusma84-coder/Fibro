import sys, os
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
nieuwe = sorted(os.path.relpath(os.path.join(w, b), S + '/nieuw') for w, ms, bs in os.walk(S + '/nieuw/tests') for b in bs)
r = bouw('tests', S + '/base', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'login.html',
               'invite.html', 'bellen.html', 'over.html', 'moderatie.html', 'spel.html'],
    nieuwe=nieuwe,
    oude_v=[],
    beschrijving="gereedschap van Claude in tests/ (generator, veiligheidstests, nabootsing) en icoontje (icon.svg) in alle pagina's",
    vereist=['runner-gunner-ui.js', 'kastvullen.js'],
    uitpad=S + '/out/maak-tests.py')
print(r['inhoudsregels'], len(nieuwe))
