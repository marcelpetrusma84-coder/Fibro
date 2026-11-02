# Integratie voor main · 31 oktober 2026

Deze branch bevat de complete wijzigingen voor schaken, Neon Raiders en de
speltitels op Home. De wijzigingen van PR #50 en #51 zitten er volledig in.
Beoordeel voor één gezamenlijke integratie deze complete PR; de twee losse
PR's bieden dezelfde onderdelen apart ter vergelijking.

## Overnemen

1. Bekijk de diff en de online deploy-preview van deze complete PR.
2. Voer `sql/neon-raiders-scores.sql` uit in Supabase om bij de online scores ook
   level en uitgespeeld-status terug te geven. Het script is herhaalbaar; die
   tabelkolommen bestaan al in de eerdere scoremigratie. De testfixture-SQL
   hoort uitsluitend in een lege wegwerpdatabase.
3. Merge deze complete branch in `main` en laat de gebruikelijke deployment lopen.
   De conflicten in de laadverwijzingen zijn opgelost: `solo.js?v=247`,
   `bordgeluid.js?v=201`, `neon-raiders-ui.js?v=222`,
   `schaken-ui.js?v=255` en `schaken-drie-ui.js?v=27`.
4. Controleer op twee echte toestellen een vriendenpartij en de online scorelijst.
   De browserproeven gebruiken lokale partijen en fictieve scores.

## Meegeleverd

- Schaken begint in het Nederlands en heeft een eigen Nederlands/English-keuze.
  Wisselen behoudt de partij, instellingen, selectie en camerastreams.
- De nieuwe geluidsreeks is optioneel: **Gradatie-geluiden schaakstukken** staat
  standaard uit in de schaakinstellingen. Aangezet klinkt veroveren positief als een chime-instrument; verliezen heeft een donkere
  dreun. De waarde van het veroverde stuk bepaalt de gradatie. Beide schaakvarianten
  gebruiken het perspectief van de lokale speler.
- Neon Raiders toont Verder voor elk ontgrendeld level pas na drie seconden
  Opnieuw vasthouden. Een korte klik begint bij level 1. Nieuwe rondes verbergen
  de optie opnieuw; annuleren en opruimen zijn getest.
- Home toont per spel het versienummer in de titelbalk. Schaken en Neon Raiders
  zijn respectievelijk v6.0 en v5.0. De scorelijsten tonen het bereikte level en of de ronde uitgespeeld is.
  Een onbekende wereldrecordhouder blijft anoniem.

## Controleren

52 Node-testbestanden zijn geslaagd op de geïntegreerde code. Na het samenvoegen
zijn de schaak- en beveiligingstests opnieuw gedraaid. De positieve/negatieve
klanken zijn in 16 echte browser-audiorenders gecontroleerd. Neon Raiders heeft
36 gerichte gedragstests en is in de browser op level 7 getest, inclusief een
echte lange muisdruk, kort opnieuw beginnen en verbergen op het volgende eindscherm.

- `tests/fixtures/chess-sound-preview.html`: luistertest per stukwaarde.
- `chat.html?test=FIBRO%20TEST&players=3`: lokale driespelerstest.
- `tests/fixtures/chess-language-preview.html`: mobiele taalkeuze.
- `tests/fixtures/neon-resume-preview.html`: echte game met testlevels en nepscores.
- `tests/fixtures/neon-scores-preview.html`: synthetische scorelijsten met levels.

## English handoff

This branch combines the full changes from PR #50 and #51 with Home game-version
labels and reached-level/completion metadata in Neon Raiders scoreboards. Merge
this complete PR for a single integration. The individual PRs remain available
for reviewing their respective parts.

Original chess audio remains the default. The new **Graded chess piece sounds**
checkbox opts into capture-value chimes/loss impacts and is remembered per device
for both chess variants.

Rerun `sql/neon-raiders-scores.sql` in Supabase to include level/completion fields
in online board responses. It is repeatable; never run the synthetic SQL fixture
against production. Cache-reference conflicts are already resolved. All 52 Node
test files pass; chess/security were rerun after integration. Local browser tests
cover both chess variants, audio, and the real Neon Raiders restart/continue flow.
Check a real multi-device match and online rankings as the deployment smoke test.

## Aanvulling 1 november: Ultra

Schaken heeft nu Ultra via Lichess-cache en meegeleverde Stockfish 19, met een
optionele live evaluatiemeter uitsluitend in solo Ultra. Zie `chess-ultra.md`
voor werking, limieten, licentie en testen. De schaakgeluidsgradatie is opt-in
zoals hierboven beschreven. De schaakversie is v6.0. Alle 57 Node-testbestanden
slagen; echte browserproeven bevestigen zowel de Lichess-zet als de lokale
Stockfish-zet en de live meter. CSP in `spel.html` staat uitsluitend het
specifieke Lichess-evaluatie-endpoint extra toe.

Ultra uses Lichess cached analysis plus bundled Stockfish 19 with an optional
solo-only live evaluation meter. See `chess-ultra.md`. Chess is v6.0. The complete
57-file Node suite and real browser cloud/local-engine move checks pass.

### Ultra: zetverschillen, historie en geluid

De definitieve evaluatie per individuele witte/zwarte zet vormt de vergelijking.
De meter toont een grijze verschilband met drie patronen, complementaire
plus/minwaarden en het zetnummer. Rechts staat SAN-zetgeschiedenis. Ultra heeft
aparte standaardinstellingen: gradatiegeluiden aan, analysegeluid uit en een
variabele denktijd tot 5 seconden. Analysegeluiden worden na stukgeluiden gepland.
Alle 60 Node-testbestanden slagen vóór het bijwerken naar Marcels nieuwste main;
na die integratie worden de volledige checks opnieuw uitgevoerd. Browserproeven
bevestigen echte zetten, historie, teller, beide geluiddefaults en de denktijd5;
320/390-pixelweergaven hebben geen horizontale overloop.

Finalized per-ply differences, grey magnitude bands, SAN history, separately
remembered Ultra defaults and sequenced evaluation sounds are included. The
pre-integration 60-file suite passes; full checks are rerun against latest main.
