import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('fps30', S + '/oud', S + '/nieuw',
    gewijzigd=['ecto-ui.js', 'solo.js', 'chat.html', 'spel.html'],
    nieuwe=['tests/gen/maak_fps30.py'],
    oude_v=['ecto-ui.js?v=147', 'solo.js?v=148'],
    beschrijving="Ghost Tag alleen spelen: hoogstens 30 beeldjes per seconde (v174)",
    vereist=['tests/gen/maak_menufont.py'],
    uitpad=S + '/out/maak-fps30.py')
print(r['inhoudsregels'])
