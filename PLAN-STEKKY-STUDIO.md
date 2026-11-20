# Plan: Stekky Studio

*Bedacht door Marcel op 20 november 2026, samen met Claude. Nog niet gebouwd: dit is het plan voor later.*

## Waarom

Elke skin, elk stickervel of elk kaartspel los laten maken door Claude kost veel credits en tijd. Het meeste werk is
steeds hetzelfde: uitknippen, opmeten, op maat maken, testen, publiceren. **Stekky Studio** neemt dat saaie werk over,
zodat Marcel (en Tijn) zelf snel content voor de Store maken. Claude is dan alleen nog nodig voor echt nieuwe dingen.

**Een studio, geen generator.** De Studio doet het zware werk en doet voorstellen. Marcel bedenkt, ontwerpt en kiest
wat er in de Store komt. Kwaliteit boven aantal: liever elke week één pakket met een thema dan elke dag tien losse
dingen.

## Wat het wordt

- Een **pagina in Stekky zelf**, alleen voor Marcel en Tijn. Ingericht voor de pc (breed scherm, muis, mappen erin
  slepen), maar ook bruikbaar op de telefoon. De voorvertoning gebruikt dezelfde code als de app, dus wat je ziet is
  wat spelers krijgen.
- **Hergebruik wat er al is:** achtergrond weg uit het Stickerlab (`eigenstickers.js` `achtergrondWeg`, `onderwerp.js`
  "Tik op het onderwerp", `stickerkwast.js`), de radio-skins (`radioskins.js`, `tests/gen/radioskins_bouw.py`),
  kaartstijlen (`KAARTSTIJLEN` in `kaartspel-hulp.js`), stickervellen (`stickervellen.js`), de Store (`store.js`).
- **Naar de Store via GitHub:** de Studio maakt één pakketbestand. Dat gaat naar GitHub (eerst door het te slepen,
  later met één knop). Een automatische controle test het en maakt zelf een PR. Marcel of Tijn zegt "Merge".

## Volgorde

Na elke stap een werkende PR, zodat er altijd iets bruikbaars is, ook als de credits halverwege op zijn.

### Kern (eerst)

1. **Basis**
   - plaatje erin, achtergrond automatisch weg, exact op maat (bijsnijden, schalen, WebP);
   - voorvertoning, bundelen, pakketbestand, automatisch een PR;
   - **kleurvarianten** met één tik;
   - **thema-pakketten**: één stijl wordt een skin, lijstje, RSS-layout, kaartachterkant en stickervel;
   - **fabriek-modus**: een map met plaatjes erin, en elk plaatje wordt een item;
   - **prompts voor een AI-plaatjesmaker**, met exacte maat, indeling, "geen tekst" en "transparante achtergrond";
   - automatische Store-presentatie (voorbeeldplaatjes, beschrijving NL/EN);
   - kwaliteitscheck (maat, scherpte, leesbaarheid, waarschuwing bij bekende logo's of figuren).
2. **Skins** voor de radio en de media player (PeerTube, muziek).
   - De Studio vindt zelf het schermpje en de knoppen; Marcel controleert alleen.
   - Een indeling kan bewaard worden als sjabloon.
3. **Lijstjes-pakketten** (geen plaatjes nodig): zenderbundels (getest via Radio Browser), RSS-bundels (getest via
   `rss-ophalen`), en quiz-, citaten-, poll- en woordpakketten. Werkwijze: onderwerp typen, AI maakt de lijst, de
   Studio test alles, Marcel leest na, en het gaat naar de Store.
4. **Kaartspelmotor voor aflegspellen**, vanuit Pesten (zie [BLAUWDRUK-KAARTSPEL.md](BLAUWDRUK-KAARTSPEL.md)):
   - een **regelformulier** in de Studio (kaarten, spelers, delen, wat mag je spelen, speciale kaarten, punten, einde);
   - **robotspelers** die elk nieuw spel 1000 keer spelen;
   - automatische **speluitleg** in NL en EN;
   - een unieke regel wordt een herbruikbaar **regelblokje** in de motor.

**Dan even stoppen en kijken:** wat downloaden en spelen de vrienden het meest? Daarna kiezen wat volgt.

### Daarna (pas na overleg)

- Fotolijstjes (de Studio vindt zelf het gat voor de foto) en RSS-layouts (kleuren, lettertype, indeling).
- Stickervellen (12 bewegende stickers met geluid; geluiden automatisch even hard en kort) en kaartstijlen (54 kaarten
  en een achterkant).
- **Widgetbouwer** met vaste, veilige blokjes (tekst, plaatje, knop, teller, lijst, link, geluid). Geen eigen code en
  geen trackers, omdat widgets via P2P naar vrienden gaan.
- **Spelsjablonen:** Memory, Quiz, Puzzel, daarna galgje, woordzoeker, kraskaart en rad van fortuin.
- **Andere kaartspelfamilies:** slagen (vanuit Toepen), vergelijken (vanuit Eenentwintigen), verzamelen, patience.
- **Platformmotor** (lopen, springen, vijanden, munten, besturing op de telefoon) met een level-editor, eigen figuren,
  automatisch gemaakte levels, een robottest of elk level te halen is, en een highscorelijst onder vrienden.
- **Level-editor voor spelers** (zoals Mario Maker):
  - alleen de blokken en figuren van het spel;
  - eerst zelf uitspelen voordat je deelt;
  - delen met vrienden via P2P, met highscores, duimpjes en melden;
  - delen met iedereen pas later, via de server met moderatie (eerst toestemming voor Supabase).
- Later misschien: downloadstatistieken in de Studio, een seizoensplanning (pakket klaarzetten met een datum), en
  spelers zelf content laten maken (met moderatie en duidelijke afspraken over rechten).

## Wat het oplevert (schatting)

- **Een kaartspelmotor** kost ongeveer zoveel als 2 à 3 losse spellen. Daarna is een spel in die familie gratis
  (invullen) of 0,1 à 0,3 van een los spel (een nieuwe regel). Hij is terugverdiend na ongeveer 3 spellen; bij de
  aflegspellen al na 2.
- **De skin- en lijstjes-onderdelen** verdienen zich terug na een paar pakketten, omdat elke skin nu een hele sessie met
  Claude kost.
- **Blijf letten op onderhoud:** elk onderdeel moet blijven werken als de app verandert. Bouw daarom niet alles
  vooraf, maar stap voor stap, en alleen wat echt gebruikt wordt.

## Regels die blijven gelden

- De privacyregels van Stekky. Content die naar vrienden gaat is alleen data (P2P), zonder eigen code. Er wordt niets
  van buiten geladen zonder dat de gebruiker erom vraagt.
- Geen bekende figuren, logo's of songteksten in de Store. AI-tekst (bijvoorbeeld quizvragen) eerst nalezen.
- De gewone werkwijze uit [CLAUDE.md](CLAUDE.md) en [AGENTS.md](AGENTS.md): PR, tests groen, en pas mergen als Marcel
  of Tijn "Merge" zegt.

## Om te plakken als er weer credits zijn

> Bouw **Stekky Studio** volgens PLAN-STEKKY-STUDIO.md, stap voor stap, met na elke stap een werkende PR. Begin met de
> kern: (1) basis, (2) skins voor radio en media player, (3) lijstjes-pakketten, (4) kaartspelmotor voor aflegspellen
> vanuit Pesten. Daarna stoppen en overleggen.
