#!/bin/sh
# Zet een kopie van sync.js en syncbeurt.js (met nep-supabase, nep-paren en nep-ice) in www/.
# Gebruik: sh maak.sh [map met de Fibro-bestanden]   (standaard: de repo zelf)
HIER=$(cd "$(dirname "$0")" && pwd)
BRON=${1:-$HIER/../../..}
sed -e "s#from './supabase.js?v=95'#from './nep-supabase.js'#" -e "s#from './ice-config.js?v=149'#from './nep-ice.js'#" \
    -e "s#from './paren.js?v=2'#from './nep-paren.js'#" -e "s#from './syncbeurt.js?v=1'#from './syncbeurt.js'#" "$BRON/sync.js" > "$HIER/www/sync.js"
cp "$BRON/syncbeurt.js" "$HIER/www/syncbeurt.js"
