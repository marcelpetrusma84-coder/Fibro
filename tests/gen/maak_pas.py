import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('pas', S + '/base2', S + '/nieuw',
    gewijzigd=['supabase.js', 'service-worker.js'],
    nieuwe=[],
    oude_v=[],
    beschrijving="zonder internet niet wachten op een verlopen inlogpas (supabase.js), CACHE_VERSION fibro-v30",
    vereist=['kastvullen.js', 'offline.js'],
    uitpad=S + '/out/maak-pas.py')
print(r)
