# Driespelerschaken — integratie en overdracht / integration handoff

## Nederlands

Deze branch bevat de complete opvolger van PR #5, inclusief het oorspronkelijke
96-vaks bord uit de referentie en de klassieke witte, zwarte en rode SVG-stukken.
Voeg deze branch samen met `main`; voeg PR #5 daarna niet nog apart samen.
De veldgeometrie, klikvlakken en bewegingen over de middengrenzen zijn samen
aangepast. Neem daarom de renderer, engine en `assets/chess-three/` samen over.
Het bord heeft geen externe asset- of lettertypeafhankelijkheid.

### Eén persoon test twee en drie spelers

1. Open Fibro Chat, typ exact `FIBRO TEST` en druk op verzenden. Dit commando
   wordt lokaal onderschept, ook zonder geselecteerde vriend. Het is geen
   chatbericht en verstuurt geen uitnodiging.
2. Je begint met een gewone tweespelerstest. Speel wit; de testtegenstander
   antwoordt. Zet de webcam aan als je de beelden wilt testen.
3. Open **Chess settings**, schakel **Allow a third-player invite in this match**
   in en gebruik **Join as third test player**. Het bord wisselt naar de
   beginopstelling met 96 velden en 48 stukken.
4. Je bestuurt nu alle kleuren: **White → Black → Red**. De drie camerakaders
   spiegelen dezelfde lokale webcam; er zijn geen externe deelnemers. Camera
   vraagt alleen video, geen microfoon. De geel/zwarte TEST DUMMY-markering blijft
   zichtbaar.
5. Probeer **Rules**, **Reset 96-square board** en **Back to 2-player test**.
   Terugschakelen bewaart de camera; het spel afsluiten stopt de lokale tracks.

Zonder account kun je dezelfde flow starten op
`chat.html?test=FIBRO%20TEST`. Direct naar drie spelers:
`chat.html?test=FIBRO%20TEST&players=3`. Gebruik een lokale HTTP-server of HTTPS,
geen `file://`. Webcams vereisen browsertoestemming en een veilige context.

### Integratievolgorde

1. Voor echte uitnodigingen: controleer/appliceer
   `sql/schaken-drie-spelers.sql` in de juiste Supabase-omgeving. Dit maakt de
   sessietabel/RPC en autorisatie voor de private realtimekamer. Controleer de
   vervangende `realtime_toegang`-functie tegen eventuele nieuwere wijzigingen op
   `main`; bewaar ook de overige kanaalregels. Deze visuele correctie voegt geen
   nieuwe migratie toe. FIBRO TEST heeft deze SQL niet nodig.
2. Publiceer de volledige branch inclusief SVG-assets. Chat/preload/preview laden
   renderer `v=19`, engine `v=10` en artworkmodule `v=1`; behoud consistente
   importversies wegens de cache-first service worker. De SVG's worden niet
   expliciet offline voorgecachet.
3. Voer alle schaak- en beveiligingstests uit, ook na een merge met nieuwere main.
4. Controleer naast de lokale test echte accounts, uitnodiging/acceptatie en
   beeld/geluid op verschillende apparaten. Een lokale test bewijst geen
   verbinding via NAT/TURN tussen drie echte apparaten.

Tijdens een lopende partij zijn de stukken van de twee wachtende spelers 80%
dekkend. De actieve speler blijft volledig zichtbaar, met een zachte spotlight
langs diens buitenste thuisrand. Dit volgt elke beurt en verdwijnt na de winst.

### Bewuste spelregelvariant

Dit gebruikt het oorspronkelijke bordontwerp met de eerder gekozen **Fibro
king-capture-variant**, niet de volledige Yalta-regelset: koning slaan verwijdert
die speler en diens stukken; de laatste koning wint. Er is geen
schaak/schaakmatbescherming, rokade, en passant of automatische remise. Pionnen
promoveren automatisch naar dame. Een derde speler toevoegen begint een nieuwe
driespelerpartij; de oude tweespelerpositie wordt niet meegenomen. De Rules-popup
benoemt dit expliciet.

### Validatie

PowerShell (stop bij de eerste mislukte test):

```powershell
Get-ChildItem tests/chess/*.mjs, tests/security/*.mjs | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Test failed: $($_.Name)" }
}
git diff --check
```

Bash:

```bash
for test in tests/chess/*.mjs tests/security/*.mjs; do
  node "$test" || exit 1
done
git diff --check
```

De tests controleren o.a. de oorspronkelijke SVG-geometrie, 96 velden, de
veldgrenzen tussen de drie gebieden, pion/paard/loper-bewegingen, koningcaptuur,
beurtvolgorde, gelijke importversies, lokale testisolatie, late camerastreams en
de bestaande beveiligingsregressies. Zie
`assets/chess-three/README.md` voor bron en CC BY-SA 3.0-licentie; de hoofd-README
maakt hiervoor een uitzondering op MIT.

## English

This branch supersedes PR #5 and includes the complete three-player/test flow
plus the original reference board and White/Black/Red SVG pieces. Merge the full
branch, including the engine, renderer and artwork directory, rather than merging
PR #5 separately afterwards.

Type exactly **FIBRO TEST** in Chat. Play the local two-player opponent, open
Chess settings, enable a third player and invite them. The local-only flow starts
the 96-square board; you control White, Black and Red in order. Three camera tiles
mirror your one local webcam, with a permanent yellow/black test badge. No real
messages or invitations are sent. Rules, Reset and Back to 2-player test remain
available. The test URL is `chat.html?test=FIBRO%20TEST`; append `&players=3` to
start directly with three seats.

Real invitations require the existing `sql/schaken-drie-spelers.sql` migration.
Review its replacement realtime authorization function against any newer main
changes. Deploy every SVG asset and keep UI `v=19`, engine `v=10` and artwork
`v=1` imports consistent. Run every test individually using the commands above,
including after merging main. Separately verify three real devices and their
audio/video connections; the local test does not validate NAT/TURN behavior.

The active army stays fully opaque; the other two armies use 80% opacity.
A soft spotlight follows the active player's outer home edge. The turn effect
ends when the game has a winner.

The artwork matches the reference; the rules remain the explicitly selected
Fibro king-capture variant: capture a king to eliminate its army, last king wins,
no check protection/castling/en passant/automatic draws, automatic queen
promotion. Joining a third player resets everyone to a new opening position.
Original and adapted artwork/geometry are CC BY-SA 3.0; attribution and sources
are in `assets/chess-three/README.md`.
