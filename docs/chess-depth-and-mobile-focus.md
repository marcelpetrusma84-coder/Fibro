# Schaken: tafel met diepte en mobiel Ultra-bord

Gebaseerd op Marcels `main` **6a6c94d** (PR #69). Ultra, hints en take-back uit
PR #65 zijn al via PR #67 opgenomen; deze vervolgwijziging bouwt daarop voort.
Geen SQL, sleutels, extra pakketten of buildstap nodig.

## Tafelachtergrond

De bestaande instelling **4D wallpaper → Tafelachtergrond** gebruikt nu een
3D-bewerking van de aangeleverde foto. Kamer en tafel zijn behouden, met meer
houtreliëf en contactschaduw. De originele foto blijft bewaard; de generatie met
de ingebouwde imagegen-tool is vastgelegd in `assets/chess/wallpaper-generation.md`.

Eén verbonden WebGL-raster geeft de nabije tafel en voet meer beweging dan de
achterwand, zonder dubbel afgebeelde tafelranden. Het profiel volgt de originele
afbeeldingscoördinaten na `cover`-bijsnijden. De sterkte wordt per formaat aan de
werkelijke driehoeken getoetst: ook bij maximale diagonale kanteling behouden
ze ten minste 40% oppervlak. Dit voorkomt vouwen op smalle telefoons.

Alleen zichtbare achtergrond reageert op de muis. Bord, stukken, bediening,
veroverde stukken, geschiedenis, camera’s en instellingen stoppen ook de
resterende muisanimatie direct. Sensorkanteling blijft onafhankelijk werken.
Standaard aan bij een nieuwe of ongeldige voorkeur; een expliciete uit-keuze en
de bestaande toestemming blijven behouden. Zie `chess-ultra-swipe.md` voor de
latere aanvulling met terugvegen onder het bord.

De rasterresolutie is begrensd tot twee miljoen pixels en DPR 1,5. Er draait
geen extra animatielus. Ontbrekende WebGL, contextverlies of een afbeeldingsfout
laten de gewone CSS-foto staan. Uitschakelen/afsluiten ruimt GPU-resources en
listeners op. Telefoonsensoren zijn met tests gesimuleerd; kantelen op een echt
toestel blijft onderdeel van de apparaatcontrole.

## Ultra op mobiel

Vier afzonderlijke spreidbewegingen maken achtereenvolgens ruimte:

1. Bovenste informatie, geluid, veroverde stukken en zet terugnemen.
2. Zetgeschiedenis.
3. Evaluatiebalk.
4. Bord- en instellingenbalk; het bord gebruikt de maximale beschikbare breedte.

Naar binnen knijpen keert telkens één stap terug. De toestand is alleen een
weergavekeuze tijdens deze partij: schaakstelling en opgeslagen voorkeuren
blijven behouden. De bestaande bediening van andere schaakvarianten blijft
beschikbaar.

Elke afzonderlijke beweging geeft maximaal één stap; kleine bewegingen en een
derde vinger voeren geen stap uit. Pointercapture op het blijvende bord voorkomt
verlies bij het opnieuw tekenen van velden. Annuleren, focusverlies en echte
captureverliezen ruimen het gebaar op. Muisklikken en gewone éénvingertikken
blijven beschikbaar; compatibiliteitsklikken na multitouch worden onderdrukt.

Bij stap vier blijft een klein herstelicoon bereikbaar. Het bord zelf ondersteunt
ook `+`, `−` en Escape voor toetsenbordbediening. De proefpagina
`tests/fixtures/chess-ultra-mobile-preview.html` laat dezelfde bediening via
**Meer bord**, **Minder bord** en **Alles tonen** gebruiken op de pc. Er zijn
geen testknoppen of gesimuleerde aanrakingen in het echte spel toegevoegd.

## Validatie

Alle **75 Node-testbestanden** slagen in chess, security, UI, onboarding, Neon,
sync, foutmelder en Block It. Nieuw zijn tests voor echte geüploade
rastercoördinaten (zeven formaten, alle 7.680 driehoeken en vier kantelrichtingen)
en de volledige tweevinger-lifecycle: heen/terug, grenzen, één stap per gebaar,
kleine bewegingen, drie vingers, capture-overdracht, annuleren, schermwissels,
voorkeuren en opruimen.

Browsercontrole: achtergrond beweegt boven de tafel en stopt boven het bord;
het bord houdt dezelfde positie. Op 390 px groeit het Ultra-bord van circa
232 px via 254, 320 en 360 naar **386 px**, zonder horizontale overloop. Alle
panelen keren in omgekeerde volgorde terug. Een echte e2–e4 en Ultra's e7–e5
werken na het herstellen. Ook de 320 px-proef heeft geen horizontale overloop.
Layout is met de echte toetsenbordroute en proefknoppen getest; fysieke
multitouchgebaren en telefoonkanteling vragen nog een controle op een toestel.

## English handoff

This follow-up builds on Marcel’s main `6a6c94d`; the earlier Ultra PR is already
integrated. Merge normally and ship the added local image and JS modules. No
database or build changes are required.

The supplied table photo now has a 3D-style edit plus a crop-correct connected
depth mesh. Adaptive displacement prevents folded triangles on narrow screens.
Mouse motion runs only over exposed background, freezing immediately over game
surfaces. Sensor permission, reduced-motion handling, static fallback, bounded
resolution and cleanup are preserved.

Mobile solo Ultra gains four reversible pinch-out focus steps: top information
and captures, move history, evaluation, then the settings bar. Pinch inward
restores one step at a time without changing the position or saved preferences.
All 75 integrated Node test files pass. Actual browser checks cover all focus
steps and their reversal, 320/390 px layouts, background-only mouse motion and
a real engine reply after restoration. Physical phone gestures/sensors remain
a device smoke test; the event lifecycle is covered with simulated inputs.
