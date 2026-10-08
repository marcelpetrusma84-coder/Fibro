import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('lettermaat', S + '/b11', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'lettertypes.js', 'thema.js', 'service-worker.js', 'tests/LEESMIJ.txt', 'lettertypen/audiowide.css', 'lettertypen/bungee-shade.css', 'lettertypen/bungee.css', 'lettertypen/cinzel-decorative.css', 'lettertypen/cinzel.css', 'lettertypen/comfortaa.css', 'lettertypen/courier-prime.css', 'lettertypen/fascinate.css', 'lettertypen/great-vibes.css', 'lettertypen/merriweather.css', 'lettertypen/monoton.css', 'lettertypen/mountains-of-christmas.css', 'lettertypen/nosifer.css', 'lettertypen/orbitron.css', 'lettertypen/pacifico.css', 'lettertypen/permanent-marker.css', 'lettertypen/rampart-one.css', 'lettertypen/rubik-bubbles.css', 'lettertypen/rubik-spray-paint.css', 'lettertypen/rye.css', 'lettertypen/satisfy.css', 'lettertypen/sedgwick-ave.css', 'lettertypen/shadows-into-light.css', 'lettertypen/share-tech-mono.css', 'lettertypen/silkscreen.css', 'lettertypen/space-mono.css', 'lettertypen/titan-one.css'],
    nieuwe=['lettertypen/press-start-2p-tekst.css', 'tests/tools/proef25.py', 'tests/gen/maak_lettermaat.py', 'tests/gen/testscript_lettermaat.py'],
    oude_v=['thema.js?v=119', 'lettertypes.js?v=118'],
    beschrijving="lettertypen ongeveer even breed als DM Sans (size-adjust), Press Start 2P voor de pagina kleiner (spellen ongemoeid), muziektekst afgekapt; portier fibro-v31, thema.js en lettertypes.js ?v=130",
    vereist=['lettertypen/press-start-2p.css', 'lettertypen/basis.css', 'ecto-ui.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-lettermaat.py')
print(r['inhoudsregels'])
