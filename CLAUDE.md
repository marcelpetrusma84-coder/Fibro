# Afspraken voor Claude (Stekky, voorheen Fibro)

## Wie beslist
- Eigenaar: **Marcel**. Hij is geen programmeur: schrijf in eenvoudig Nederlands.
- **Merge nooit** zonder dat **Marcel of Tijn** "Merge" zegt. Zij beslissen.
- Deploys en migraties naar productie (Supabase): eerst toestemming vragen. Lukt het niet vanaf hier, geef dan de SQL
  of de stappen, zodat ze het zelf kunnen doen.

## Werkwijze
- Branch `claude/...` vanaf `origin/main` → PR → testversie op Netlify:
  `deploy-preview-<nr>--stately-llama-4b380e.netlify.app`.
- Wacht met mergen tot alle controles op GitHub goed zijn (Tests (Node), Browsertests, apk).
- Tests: `node tests/alle-tests.mjs`. Versiecontrole: `node tests/tools/controleer-versies.mjs origin/main HEAD`
  (elk veranderd script een hoger `?v=`). Browsertests: `tests/tools/proef*.py` (draaien ook in CI).
- Een nieuwe functie of reparatie krijgt bij voorkeur een browsertest die op de oude versie misgaat.

## Techniek
- GitHub Pages onder `/Fibro/`. PWA met service worker die per `?v=` cachet.
- Supabase-project `qmgatbphiplrfxrljtbe`. Edge function `stuur-push` (verify_jwt false).
- Teksten: `taal.js` + `taal-en.js` (de Nederlandse zin is de sleutel; in het Engels `{app}` voor de appnaam).
  Na een nieuwe zin: `taal-en.js` en `taal.js` een hoger `?v=`.
- Interne namen (`fibro_`-sleutels, `/Fibro/`-paden, FibroDB, FIBRO-codes) blijven bewust "fibro".
- Kleurstijl: knoppen `#8b3fd1` met witte letters, achtergrond app `#1a0a2e`, lichte accenten `#c084fc`.
  Inloggen/uitnodiging/tikscherm en het app-icoon: verloop `#8b3fd1` → `#6a2bab` → `#1a0a2e`.
- App-icoon: `tests/gen/logo_bouw.py` (tekent alle formaten opnieuw).
