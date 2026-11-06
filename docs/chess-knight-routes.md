# Paardroutes in solo schaken

Tijdens je eigen beurt kun je een eigen paard of een paard van de computer twee
seconden vasthouden. Vier onafhankelijke schakelaars in **Schaakinstellingen →
Paardroutes** kiezen exacte sprongaantallen 1 t/m 4. Ze staan standaard allemaal
aan en worden opgeslagen als vier booleans in `knightRouteSteps`, binnen de
bestaande apparaatinstellingen. Ongeldige gegevens vallen terug op de defaults.

De functie werkt in alle vier de soloniveaus, waaronder Ultra. Vriendenpartijen
en drie-spelerpartijen krijgen deze hulp niet.

Zodra routes zichtbaar zijn, verschijnen er naast elkaar twee live sliders.
**Stappen** kiest de lagen 1 t/m het ingestelde maximum (1–4) en synchroniseert
de vier instellingen. **Zichtbaarheid** regelt alle routevormen inclusief hun
contrasterende randen van 5% (bijna onzichtbaar) tot 100% (de standaard). De
waarde wordt opgeslagen als het gehele getal `knightRouteOpacity`. Alleen de
routevormen vervagen: de legenda, bediening en highlight van het onderzochte
paard blijven goed zichtbaar. Ongeldige opgeslagen waarden gebruiken 100%.


## Weergave en betekenis

- Eigen paard: rode, blauwe, groene en paarse bolletjes, afnemend in grootte.
- Computerpaard: oranje, cyaan, gele en witte vierkantjes, eveneens afnemend.
- De vulling is halfdoorzichtig, zodat stukken eronder zichtbaar blijven. Als
  meerdere sprongaantallen hetzelfde veld bereiken, liggen de kleinere vormen
  boven de grotere. Er is geen beperking of uitsluiting per kwadrant.
- Het onderzochte paard krijgt een eigen highlight en de legenda noemt zijn
  veld. Op het beginvak staat geen bestemmingsbolletje of -vierkantje.
- Een legenda geeft de gekozen sprongaantallen aan. Een nieuwe gewone tik,
  sluiten of een gewijzigde stelling/beurt ruimt de routes op.

Het gaat om **hypothetische opeenvolgende sprongen van hetzelfde paard**. De
andere stukken blijven staan, behalve stukken die langs een route worden
geslagen. De tegenstander krijgt tussendoor geen gesimuleerde zetten. Het is
daarom geen voorspelling van een echte partij en geen engine-advies.

Iedere sprong gebruikt de bestaande legale-zettencontrole, inclusief de
veiligheid van de eigen koning. Een koning wordt niet als capturebestemming
gebruikt. Terugkeer en rondjes blijven in de berekening mogelijk, ook al wordt
op het beginvak geen markering getekend. De echte stelling wordt nooit
gewijzigd. Een uitgeschakelde tussenlaag wordt nog steeds berekend als een
latere laag aanstaat. Hoogstens vier sprongen worden doorzocht, met deduplicatie
van identieke stellingen per laag.

## Bediening en lifecycle

Pointer Events ondersteunen muis en aanraking. Twee seconden is vereist; een
korte tik blijft de gewone schaakbediening. Verplaatsing, meerdere vingers,
annuleren, verbergen en schermwissels annuleren een lopende druk. De loslaatklik
na een lange druk blijft geblokkeerd, ook na een schermwissel. Enter/spatie
ondersteunen dezelfde korte/lange bediening. Tekstselectie, callouts en het
contextmenu worden op de relevante schaakelementen onderdrukt.

FEN en een revisienummer beschermen tegen verouderde timers na zetten, reset of
terugnemen. De overlay behoudt stukken, focus van het bord en bestaande
toegankelijkheidsbeschrijvingen. Alle timers, listeners en markeringen worden
opgeruimd bij afsluiten. De labels wisselen live tussen Nederlands en Engels.

## Proberen / overnemen

Open `tests/fixtures/chess-ultra-mobile-preview.html`, kies Ultra en houd tijdens
wit aan zet bijvoorbeeld g1 twee seconden vast. Probeer daarna b8 en verander
de twee live sliders en de vier toggles. Controleer dat terugkeer naar het
beginvak alleen de paardhighlight toont. De preview bevat ook de bestaande
bordvergroting. De veegzone
voor Take-back is in de echte app onzichtbaar; uitsluitend de testpreview toont
de strook en voortgang. Toetsenbordfocus kan die bediening zichtbaar maken.

Normaal mergen en statisch deployen. Geen SQL, API-sleutels of nieuwe pakketten
nodig. Alle drie de nieuwe modules `schaak-paard*.js` moeten worden meegeleverd.

De oorspronkelijke invoering was gebaseerd op Marcels main **3362283**, inclusief
zijn postbus- en pushwijzigingen. Daarbij slaagden **88 Node-testbestanden** in chess, security, UI,
onboarding, Neon, sync, foutmelder, Block It, bellen en dammen. Nieuwe tests
controleren exacte sprongaantallen, eigen/vijandelijk paard, captures en
koningsveiligheid, overlappende routes, alle toggles, lange druk en annuleren,
schermwissels na activering, stale FEN/revisies, hertekenen, taal en opruimen.
Echte muis-holds in de browser tonen beide vormen en kleuren; de partij blijft
ongewijzigd en alle 32 beginstukken blijven zichtbaar. Fysieke telefoongebaren
blijven een toestelcontrole; de touch-lifecycle is met events getest.

## English

On the human turn, holding either side's knight for two seconds shows exact
reachable destinations after 1–4 consecutive knight jumps. Four independent,
default-ON settings persist on the device. Own routes use translucent red/blue/
green/purple circles; opposing routes use orange/cyan/yellow/white squares.
Sizes decrease with jump count, overlapping horizons remain visible and no
quadrants are omitted. This is solo-only in every level, including Ultra.

While routes are visible, live sliders select contiguous depths 1 through N
(1–4) and marker opacity from 5% to 100%. The latter persists as
`knightRouteOpacity`, defaulting to 100 for invalid data. Opacity updates retain
the board and destination nodes. The inspected knight has a persistent
highlight and a coordinate label; its own square receives no destination
marker. Legal return branches are still calculated. Legend and controls retain
their contrast at minimal marker opacity.


Other pieces stay still except captures along a branch. Each jump uses legal
move generation and king-safety checks; the live position is immutable. These
routes do not predict opposing replies. Holds support touch, mouse and keyboard,
preserve normal taps, suppress accidental release clicks, and cancel safely on
movement/multitouch/lifecycle changes. FEN/revision guards reject stale work.
The prior invisible-production swipe correction is retained. No database,
credentials or dependency changes are required.
The original implementation was based on main `3362283`, including its mailbox/
push changes; all 88 Node test files passed at that point. Real browser holds confirmed both palettes/shapes and preserved
pieces. Physical phone gestures remain a device smoke test.
