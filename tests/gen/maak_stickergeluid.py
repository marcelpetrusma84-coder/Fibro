import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickergeluid', S + '/base', S + '/nieuw',
    gewijzigd=['chat.html'],
    nieuwe=[],
    oude_v=[],
    beschrijving="stickergeluid alleen bij een nieuw binnenkomend bericht, niet bij het openen van een chat (chat.html)",
    vereist=['runner-gunner-ui.js', 'index.html'],
    uitpad=S + '/out/maak-stickergeluid.py')
print(r)
