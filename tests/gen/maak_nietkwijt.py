import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('nietkwijt', S + '/b8', S + '/nieuw',
    gewijzigd=['chat.html', 'index.html', 'profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef23.py', 'tests/gen/maak_nietkwijt.py', 'tests/gen/testscript_nietkwijt.py'],
    oude_v=[],
    beschrijving="chat: een bericht of sticker die niet verstuurd kon worden blijft staan (tik = opnieuw), ook na verversen; uitloggen wist ze",
    vereist=['crypto.js', 'reply.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-nietkwijt.py')
print(r['inhoudsregels'])
