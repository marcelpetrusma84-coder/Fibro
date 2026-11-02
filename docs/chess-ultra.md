# Ultra-schaken / Ultra chess

## Nederlands

Bij schaken tegen de computer staat **Ultra** onder Moeilijk, met de zichtbare
vermelding **Lichess + Stockfish 19**. De andere spellen houden hun drie niveaus.
De bestaande drie schaakniveaus gebruiken hun oorspronkelijke bot.

Lichess biedt via `/api/cloud-eval` diepe, eerder opgeslagen Stockfish-analyses,
geen algemene rekenservice voor iedere willekeurige stelling. Ultra gebruikt
een geldig cloudantwoord met minimaal diepte 18. Bij ontbrekende, ongeldige,
trage of niet bereikbare cloudgegevens rekent de meegeleverde Stockfish 19
lite-engine zelf in een Web Worker. Er wordt nooit ongemerkt naar de bestaande
zwakkere bot of een willekeurige zet teruggeschakeld. Onder het bord staat de
werkelijk actieve bron. Een enginefout laat de stelling intact en geeft een
knop om dezelfde stelling opnieuw te proberen.

In **Schaakinstellingen → Spelverloop → Live evaluatie tonen** kan de meter
naast het bord aan of uit. Standaard uit; de keuze wordt per apparaat bewaard
in `fibro_chess_settings_v1.showUltraEvaluation`. De optie en meter verschijnen
uitsluitend bij solo Ultra, nooit bij vriendenpartijen, andere niveaus of drie
spelers. Wit staat onderaan: positief betekent geschat voordeel voor wit,
negatief voordeel voor zwart. `#n` betekent mat in n zetten. De schaal is een
indicatie van voordeel en geen winstpercentage. Een oude stelling blijft niet
als actuele analyse in beeld staan. De grijze strook tussen de vorige en nieuwe
stand toont de verschuiving voor beide kleuren; de complementaire plus/minwaarden
staan aan beide uiteinden. Kleine verschuivingen hebben een zachte gradiënt,
middelgrote een streeppatroon en grote een sterk contrasterend patroon.
De grenzen zijn 0,50 en 1,50 pionwaarde. De vergelijking gebruikt uitsluitend de
definitieve analyse van de vorige gespeelde zet, niet ieder enginebericht.
Zonder eerdere definitieve analyse wordt geen verzonnen verschil getoond.

Onder de meter staat `Zet #n`: iedere afzonderlijke witte of zwarte zet telt.
Rechts staat de geschiedenis in standaard algebraïsche notatie, gegroepeerd in
witte/zwarte zetparen. Rokade, slaan, promotie, schaak en mat worden genoteerd.
De geschiedenis blijft zichtbaar wanneer de meter uitstaat.

De meter is optioneel; de sterke engine blijft bij uitschakelen gewoon spelen.
Ultra heeft weer een eigen denktijdschuif: standaard maximaal **5 seconden**,
met een willekeurig doel tussen 1 seconde en dat maximum. Ophalen en rekenen
tellen daarin mee; er wordt geen volle wachttijd achteraf toegevoegd. Bij 0
vervalt de menselijke wachttijd, maar de engine moet nog wel rekenen.
Een trage eerste engine-download of vertraagd toestel kan de reactietijd verlengen.
De normale niveaus behouden hun aparte denktijdvoorkeur.

**Gradatie-geluiden schaakstukken** staat in Ultra standaard aan en elders
standaard uit, met afzonderlijke voorkeuren. **Geluid bij evaluatieverandering**
is alleen bij Ultra beschikbaar en staat standaard uit. Deze andere klank
klinkt als een zachte stijgende/dalende synth- en windzwelling, met drie
sterktes; hij volgt winst/verlies vanuit jouw perspectief. Hij klinkt eenmaal
per definitieve zetvergelijking, na het volledige stukgeluid. Nieuwe stukken
hebben voorrang; oude analyseklanken worden afgebouwd en verouderde wachtende
klanken vervangen. Dempen, uitzetten, opnieuw beginnen en sluiten ruimen de
analysewachtrij op. Deze klank kan ook met een verborgen meter worden gebruikt.
Aan- of uitzetten begint geen nieuwe partij en verandert camera’s niet.

Er is geen Lichess-account, API-sleutel of serverconfiguratie nodig. Alleen de
openbare schaakstelling gaat naar Lichess; geen Fibro-gebruikersnaam, token,
chat of camerabeeld. Cloudverzoeken worden begrensd: maximaal acht per partij,
minstens 2,5 seconde ertussen, stoppen na twee opeenvolgende onbekende stellingen
en minstens een minuut pauze na HTTP 429. Analyse tijdens de menselijke beurt
is lokaal. Cloudantwoorden worden beperkt ingelezen, gevalideerd en gecachet;
alle gekozen zetten worden nogmaals met Fibro’s eigen regels gecontroleerd.
Resetten of sluiten annuleert oude verzoeken en workers.

De vastgepinde enginebestanden, oorspronkelijke GPL-licentie, auteurs,
broncodearchief, bouwinstructies en hashes staan in `vendor/stockfish`.

### Proberen

1. Open `spel.html?spel=schaken` en kies **Ultra**.
2. Speel bijvoorbeeld e2–e4; Ultra doet een geldige tegenzet.
3. Zet de live evaluatie aan via de schaakinstellingen en speel verder.
4. Zet de meter uit: de engine blijft sterk spelen. Wissel de taal voor de
   Nederlandse/Engelse bediening.
5. Bij geen internet blijft de lokaal geladen Stockfish-engine beschikbaar.
6. `tests/fixtures/chess-ultra-mobile-preview.html` toont de echte app op 320 of
   390 pixels breed, met zetgeschiedenis en meter naast het bord.

Bronnen: https://lichess.org/api#tag/Analysis/operation/apiCloudEval en
https://github.com/nmrugg/stockfish.js/tree/v19.0.1.

## English

Ultra is an additional chess-only solo level. It uses deep cached evaluations
from the public Lichess Cloud Evaluation API when available, with bundled
Stockfish 19 lite as the actual strong fallback for uncached/offline positions.
The displayed source always identifies the engine in use. There is no silent
downgrade to the old bot. Worker failures offer a retry of the same position.

The default-OFF **Show live evaluation** setting adds a White-perspective meter
beside the board only in solo Ultra. It does not expose assistance in friend
games or other levels. Turning it off hides analysis without weakening the bot.
Preferences, live Dutch/English switching, audio and camera state are preserved.

The meter now highlights the move-to-move difference with complementary values
and three grey gradient/pattern strengths. Only finalized adjacent-ply scores
form the baseline. A chronological ply counter appears below it; standard SAN
move history stays on the right even when the meter is hidden. Ultra capture
grading defaults ON independently from ordinary chess. Optional evaluation
swells default OFF, sound once per finalized change and wait until piece sounds
finish. The per-Ultra human thinking slider defaults to varied 1–5-second targets,
including analysis time; zero removes artificial waiting while retaining search.

Only a FEN chess position is sent to Lichess, anonymously without credentials.
Requests are bounded, sequential, rate limited and validated. The local engine
uses a single-threaded worker with no special hosting headers. Vendored release
19.0.1, hashes, GPL license, attribution and source/build information are included.
