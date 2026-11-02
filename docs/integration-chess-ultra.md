# Ultra-schaken integreren · 2 november 2026

Deze wijziging bouwt op Marcels `main` **4a6c506** (inclusief PR #64). Camera’s,
wachten op vrienden, stoppen bij vertrek, uitnodigingen en Block It blijven
behouden. PR #52 is al samengevoegd en hoeft niet opnieuw te worden overgenomen.

## Klaar voor overname

1. Beoordeel en merge deze PR in `main`; gebruik de normale statische deployment.
2. Bewaar de complete map `vendor/stockfish`, inclusief de bijpassende `.js` en
   `.wasm`. De host moet `.wasm` als `application/wasm` serveren; Netlify doet dit
   standaard. Er zijn geen databasewijzigingen, API-sleutels, npm-buildstappen of
   extra cross-origin-isolationheaders nodig.
3. Open `spel.html?spel=schaken`, kies Ultra en controleer een echte tegenzet.
   Zet de evaluatie aan, controleer de zetgeschiedenis en schakel het optionele
   analysegeluid in. Na de stukklank volgt de analyseklank.
4. Controleer dat gewoon schaken nog drie bestaande niveaus en standaard oude
   geluiden heeft; Ultra is een extra vierde keuze. In een vriendenpartij zijn
   de Ultra-meter en analyseklank niet beschikbaar.

Ultra start met maximaal 5 seconden menselijke bedenktijd (variabel),
gradatiegeluiden aan en analysegeluid uit. De meter staat standaard uit. Alle
keuzes worden afzonderlijk voor deze spelmodus op het apparaat onthouden.
De eerste engine-download/rekentijd kan een trage verbinding of toestel volgen;
0 seconden verwijdert de extra wachttijd en schakelt de engine niet uit.

Lichess geeft bestaande cloudanalyses terug. Een onbekende stelling, fout,
limiet of ontbrekend internet schakelt over op de meegeleverde Stockfish 19,
zonder de zwakkere oude bot te gebruiken. De bron staat onder het bord.
De analyse van de menselijke beurt draait lokaal; de publieke API wordt beperkt
aangesproken. Zie `chess-ultra.md` voor de exacte limieten en voorkeurvelden.

## Validatie

73 Node-testbestanden slagen tegen deze geïntegreerde `main` in `tests/chess`,
`tests/security`, `tests/ui`, `tests/onboarding`, `tests/neon`, `tests/sync`,
`tests/foutmelder` en `tests/blockit`. Dit omvat Marcels nieuwe regressietests.
Twee testverwachtingen volgen de verhoogde cacheversies; de gedragstests en
laatste camera-/verbindingscode zijn behouden.

Extra dekking: FEN/UCI, echte legale zetten, promoties/rokade/en passant,
Lichess-fouten en limieten, oude async-antwoorden, finalisatie per zet, SAN,
delta’s en mat, audio-opruimen/voorrang/dempen, variabele denktijd en reset.
Releasebestanden worden op grootte en SHA-256 gecontroleerd. De GPL-licentie,
auteurs, exacte broncode en NNUE-model worden meegeleverd.

De browsercontrole heeft echte Lichess- en Stockfish-tegenzetten, de live meter,
historie, teller en de standaardinstellingen bevestigd. Op 320/390 pixels was
er geen horizontale overloop. Mobiele proefpagina:
`tests/fixtures/chess-ultra-mobile-preview.html`.

## English handoff

This PR is based on Marcel’s latest main `4a6c506`, including PR #64, and keeps
the recent camera, waiting/leave, invitation and Block It changes. Merge it with
the normal static deployment. No SQL, credentials, build step or isolation
headers are required; ship the matching vendored JS/WASM pair with WASM MIME
type `application/wasm`.

Ultra combines bounded Lichess cached analysis with bundled Stockfish 19. It
adds opt-in live move deltas, right-hand SAN history, sequenced opt-in evaluation
sounds and a separate variable thinking-time preference (default up to 5s).
Capture grading defaults ON only in Ultra. All 73 integrated Node scripts pass;
real browser engine/API moves and narrow layouts were checked. Full technical
details are in `chess-ultra.md`; release sources, model, license and checksums
are in `vendor/stockfish`.

## Take-back, hints en tafelachtergrond

Ultra heeft twee nieuwe hulpopties, beide standaard uit: Take-back herstelt de
volledige stelling vóór je laatste eigen zet (ook de computerreactie gaat terug),
Tips & hints toont een !-knop die alleen een eigen stuk aanwijst. Oude
berekeningen, animaties en audiowachtrijen kunnen na terugnemen niet doorlopen.
Alle schaakvarianten hebben 4D wallpaper → Tafelachtergrond. De aangeleverde
foto beweegt subtiel met de muis of toegestane telefoonsensoren; het bord blijft
stil. Bij minder beweging of geweigerde toestemming blijft de foto statisch.
Sensorwaarden worden niet verstuurd. Controleer kantelen nog op een fysieke
telefoon via HTTPS; browser- en lifecycleproeven gebruiken gesimuleerde sensoren.

Default-OFF Ultra takeback/hints and an independent, default-OFF table wallpaper
for every chess variant are included. Only the background moves; phone motion
requires browser support, HTTPS and user-initiated permission where applicable.
Physical phone tilt remains a device smoke test. The 73-script suite includes
undo/hint races, complete-state restoration and wallpaper permission/cleanup.
