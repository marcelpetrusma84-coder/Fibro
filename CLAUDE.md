# Afspraken voor Claude (Stekky, voorheen Fibro)

> Dezelfde afspraken staan in AGENTS.md (voor Codex). Pas je de ene aan, pas dan de andere ook aan.

## Wie beslist
- Eigenaar: **Marcel**. Hij is geen programmeur: schrijf in eenvoudig Nederlands.
- **Merge nooit** zonder dat **Marcel of Tijn** "Merge" zegt. Zij beslissen.
- Deploys en migraties naar productie (Supabase): eerst toestemming vragen. Lukt het niet vanaf hier, geef dan de SQL
  of de stappen, zodat ze het zelf kunnen doen.

## Werkwijze
- Branch `claude/...` (Claude) of `codex/...` (Codex) vanaf `origin/main` → PR → testversie op Netlify:
  `deploy-preview-<nr>--stately-llama-4b380e.netlify.app`.
- Wacht met mergen tot alle controles op GitHub goed zijn (Tests (Node), Browsertests, apk).
- Tests: `node tests/alle-tests.mjs`. Versiecontrole: `node tests/tools/controleer-versies.mjs origin/main HEAD`
  (elk veranderd script een hoger `?v=`). Browsertests: `tests/tools/proef*.py`, een nieuwe begint met
  `tests/tools/proefhulp.py` (zie BOUWSTENEN.md) en krijgt een regel in
  `tests/tools/browsertests.txt`, dan draait hij op GitHub mee (in 4 groepjes tegelijk, `tests/tools/browsertests.py`).
- Een nieuwe functie of reparatie krijgt bij voorkeur een browsertest die op de oude versie misgaat.

## Vaste keuzes (zonder te vragen)
Marcel stuurt meestal alleen een idee. Dit geldt dan altijd, tenzij hij iets anders zegt. Twijfel je over iets anders
(welke spelregels, welke variant), vraag het dan kort.
- **Elk spel:** in de Stekky Store en op Home; Nederlands én Engels (ook de naam en de uitleg in de Store); de knop ❓ met
  de spelregels; ↻ Opnieuw spelen na afloop; geluid en trillen; het ☰-spelmenu; een eigen spelicoon (zonder plaatje
  maak je er een).
- **Tegen de computer:** altijd, met makkelijk, normaal en moeilijk (behalve een automaat of arcadespel: daar speel je
  alleen).
- **Samen:** kaartspellen met 2 tot 6 spelers (tegen de computer, met een vriend én in de groepschat), beurtspellen met
  z'n tweeën; beurtklok van 30 seconden; reacties (emoji) aan.
- **Scorebord:** altijd. Winnen tegen de computer telt per niveau; arcade telt punten (top 10).
- **Casino-tokens:** alleen bij casinospellen (gokken, inzetten, een automaat) en alleen tegen de computer. Betaalt het
  meer dan 2× uit, dan deelt de server (zoals Video Poker). Tokens zijn speelgeld: nooit te koop en nooit in te wisselen.
- **Widgets:** in de Store (`widgets.js`). Persoonlijk (jouw scores, jouw tokens) = alleen op je eigen Home.
- **Uiterlijk:** de kleuren van Stekky (zie Techniek); werkt op een telefoon van 360 px breed; grote knoppen.
- **Klaar:** tests (Node en een browsertest), nieuwe bouwstenen in BOUWSTENEN.md, een PR met in gewone woorden wat er
  veranderd is. SQL voor productie: eerst vragen.
- **Begin met het sjabloon** van de goede soort (BOUWSTENEN.md, "Sjablonen") en met wat er in het pakhuis staat.

## Het pakhuis (BOUWSTENEN.md)
- **Lees eerst [BOUWSTENEN.md](BOUWSTENEN.md)** voordat je iets nieuws bouwt. Staat wat je nodig hebt er al, gebruik het
  (of breid het uit, met een test). Bouw niets opnieuw dat er al is.
- Iets nieuws gebouwd dat later bruikbaar is? Zet het in BOUWSTENEN.md. Alleen voor één spel of pagina? Dan bij
  "Alleen voor één onderdeel". `tests/ui/test-bouwstenen.mjs` controleert dat elk script, SQL-bestand, edge function en
  installeerscript erin staat.
- Werk je aan iets uit "Dubbel werk", voeg het dan eerst samen tot één bouwsteen.
- In de PR: onder "Bouwstenen" welke je hergebruikte en welke er nieuw bij kwamen.

## Techniek
- GitHub Pages onder `/Fibro/`. PWA met service worker die per `?v=` cachet.
- Supabase-project `qmgatbphiplrfxrljtbe`. Edge function `stuur-push` (verify_jwt false).
- Teksten: `taal.js` + `taal-en.js` (de Nederlandse zin is de sleutel; in het Engels `{app}` voor de appnaam).
  Na een nieuwe zin: `taal-en.js` en `taal.js` een hoger `?v=`.
- Interne namen (`fibro_`-sleutels, `/Fibro/`-paden, FibroDB, FIBRO-codes) blijven bewust "fibro".
- Kleurstijl: knoppen `#8b3fd1` met witte letters, achtergrond app `#1a0a2e`, lichte accenten `#c084fc`.
  Inloggen/uitnodiging/tikscherm en het app-icoon: verloop `#8b3fd1` → `#6a2bab` → `#1a0a2e`.
- App-icoon: `tests/gen/logo_bouw.py` (tekent alle formaten opnieuw).
