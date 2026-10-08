import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('account', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'over.html', 'tests/LEESMIJ.txt', 'tests/tools/nep-supabase.sql', 'tests/tools/proef32.py'],
    nieuwe=['account.js', 'sql/account-verwijderen.sql', 'tests/tools/proef35.py', 'tests/gen/maak_account.py', 'tests/gen/testscript_account.py'],
    oude_v=[],
    beschrijving="mijn gegevens downloaden en account verwijderen in het menu op Home (account.js?v=1, sql/account-verwijderen.sql)",
    vereist=['supabase.js', 'crypto.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-account.py')
print(r['inhoudsregels'])
