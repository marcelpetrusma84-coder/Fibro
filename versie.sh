#!/bin/bash
# Hoogt het versienummer op in alle import-paden, zodat browsers verse
# bestanden ophalen na een push. Draaien vanuit ~/Fibro, vóór het committen.
cd "$(dirname "$0")" || exit 1

HUIDIG=$(cat .versie 2>/dev/null || echo 0)
NIEUW=$((HUIDIG + 1))

for f in *.html *.js; do
  [ -f "$f" ] || continue
  case "$f" in *.backup-*|*.kapot-*|*.nieuw-*) continue;; esac
  # eerst bestaande ?v=NN weghalen, dan het nieuwe nummer erachter
  sed -i -E "s|(from ['\"]\./[a-z0-9_-]+\.js)(\?v=[0-9]+)?(['\"])|\1?v=$NIEUW\3|g" "$f"
  # ook gewone script-tags: <script src="bestand.js?v=NN">
  sed -i -E "s|(<script src=['\"][a-z0-9_.-]+\.js)(\?v=[0-9]+)?(['\"])|\1?v=$NIEUW\3|g" "$f"
done

echo "$NIEUW" > .versie
echo "VERSIE NU: $NIEUW"
grep -c "?v=$NIEUW" *.html *.js | grep -v ":0"
