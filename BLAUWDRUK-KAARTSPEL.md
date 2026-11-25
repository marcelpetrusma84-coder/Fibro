# Blauwdruk: een nieuw kaartspel in Stekky

*Gemaakt op 11 november 2026, samen met het eerste kaartspel: **Pesten**. Daarna op dezelfde blauwdruk: **Toepen** en **Eenentwintigen**. Een kaartspel is ook een beurtspel, dus alles uit [BLAUWDRUK-BEURTSPEL.md](BLAUWDRUK-BEURTSPEL.md) geldt ook hier.*

Elk kaartspel krijgt **vanzelf**:

- **De chatbalk onderin** met stickers 🎨, emoji's 😊 en een tekstveld (van `chat.html`, omdat het spel in `BEURTSPELLEN` staat).
- **Spraak meteen aan**: zodra het spel begint, gaat het spraakgesprek aan (omdat het spel in `KAARTSPELLEN` staat). De microfoon kun je met 🎤 uitzetten.
- **De webcamrondjes** bovenin, met de gekleurde randen: groen (je vriend ziet je), goud (iemand praat), rood (iemand krijgt strafkaarten), en paars: de **beurtklok**.
- **Alles van de tafel** uit `kaartspel-hulp.js` (hieronder).

## Wat de tafel doet (`kaartspel-hulp.js`)

| Onderdeel | Hoe het werkt |
|---|---|
| Kaarten | Vectorplaatjes (SVG): `kaartSvg('h10')`, `kaartSvg('J1')`. Kleuren `h` harten, `r` ruiten, `k` klaveren, `s` schoppen; waarden `2`..`10`, `B`, `V`, `H`, `A`; jokers `J1` en `J2`. In het Engels staan er J, Q, K op. |
| Achterkant | `achterkantSvg('stekky')`: paars verloop `#8b3fd1` → `#6a2bab` → `#1a0a2e`. Meer achterkanten (bijvoorbeeld uit de Store) zet je in `ACHTERKANTEN`. |
| Kaartstijl | Knop **🎴** onderin: kies de gewone **Stekky**-kaarten of **Perkament** (plaatjes in `kaarten/perkament/`, met eigen achterkant en joker). De keuze staat op dit toestel (`fibro_kaartstijl`) en geldt in elk kaartspel; de kaarten op tafel veranderen meteen. Een nieuwe stijl: een map `kaarten/<naam>/` met `h2.webp` … `sA.webp`, `joker.webp`, `achterkant.webp`, en een regel in `KAARTSTIJLEN`. Maken: zie `tests/gen/kaarten_perkament/`. Test: `tests/tools/proef294.py`. |
| Jouw waaier | **Tik** = de kaart komt groot naar voren. Tik meer kaarten van dezelfde waarde om ze samen te spelen. **Veeg omhoog** = spelen; hoe harder, hoe verder de kaart over tafel glijdt. **Dubbeltik** = meteen spelen (v7). **Met je vinger opzij over de waaier schuiven** = de kaart onder je vinger komt groot omhoog; loslaten = die kaart kiezen (v7). **Lang vasthouden en schuiven** = de kaart verplaatsen. **⇅** = sorteren op kleur, nog eens = op waarde. |
| Aflegstapel | v7: kaart gekozen + **tik op de aflegstapel** = de kaart wordt daar neergelegd (mag het, dan licht de aflegstapel op). Zonder gekozen kaart: de **laatste zet van de ander** groot in beeld (`anderSpeeltAnimatie` onthoudt dat; een spel kan het ook zelf zetten met `laatsteZet(ids)`). |
| Oplichten | Kaarten die je mag spelen krijgen een paarse gloed, de rest wordt donkerder. Kun je niets, dan licht de stapel op. Uit te zetten met ⚙️ > Hulp. |
| Instellingen ⚙️ | v7: **Hulp: kaarten oplichten** (standaard aan), **Grote kaarten** (standaard uit) en **Trillen** (standaard aan). Per toestel, voor alle kaartspellen (`fibro_kaarttafel`). Een spel met een eigen instellingenscherm (Koningsjacht) zet `instellingKnop: false` en toont `KAART_INSTELLINGEN` zelf met `kaartInstellingen()` en `zetKaartInstelling()`. Test: `tests/tools/proef302.py`. |
| Stapel | **Tik** = de kaart springt op, draait om en vliegt in een boog naar je hand. **Veeg** = de kaart gaat met je vinger mee en tolt naar je hand. |
| Schudden en delen | `deelAnimatie(...)`: twee halve stapels ritselen, dan om en om een kaart naar jou en de ander, dan de open kaart. |
| De ander | Bovenin een kleine dichte waaier met het aantal kaarten. Zijn kaarten vliegen van daar naar de aflegstapel en draaien om. |
| Beurtklok | `beurtKlok('ik' \| 'ander', 30)`: een ring die in 30 seconden leegloopt, rond je rondje én rond het webcamrondje. Alleen om te zien. |
| Effecten | `effect('+2')`: grote tekst met gloed en een geluidje, voor sterke kaarten. |
| Reacties | 😀 opent zes emoji's (😂😱🔥😎🙈👏) die over tafel vliegen, zonder de chat te openen. |
| Knoppen | `knoppen([...])` onderin (bijvoorbeeld "☝ Laatste kaart!" en "Pas"), `anderKnop(...)` bij de ander (bijvoorbeeld "🫵 Betrapt!"). |
| Vragen | `kiesUit(titel, keuzes)`, bijvoorbeeld welke kleur na een boer. |
| Einde | `einde({ titel, sub, gewonnen, opnieuw })`: winnen = vallende kaarten en een vrolijk deuntje. |
| Gevoel | Geluidjes met Web Audio (geen bestanden), trillen waar het toestel dat kan (`navigator.vibrate`; op een iPhone niet). |

## De snelle weg: via Stekky Studio (25 november 2026)

In **Stekky Studio > 🎲 Spel maken** beschrijf je een nieuw spel: beurtspel of kaartspel, naam (ook in het Engels), icoon (een emoji of een eigen plaatje), uitleg voor de Store, doel, spelregels, en bij een kaartspel welk kaartspel, hoeveel kaarten per speler en de speciale kaarten. Je vinkt aan wat erin zit (met een vriend, chatbalk met stickers, webcamrondjes, spraak vanzelf of met 📹, titelscherm en muziek in de stijl van een ander spel) en welke extra's Claude moet bouwen (❓-knop, opnieuw spelen, beurtklok, trillen, scorebord, ...). Tegen de computer, de Store en het spelmenu ☰ zitten er altijd in. De Studio maakt er een spelbestand van (`<id>.stekkyspel.json`, `spelmaker.js`).

Dan: `node tests/tools/studio-spel-installeer.mjs <id>.stekkyspel.json`. Dat

- zet het spel in `studio-spellen.js`. Daarmee staat het vanzelf in de Store, het spelmenu van de chat (`SPEL_INFO`, `SPEL_BESTAND`, `beschikbaar`, `toonStoreSpellen`), `BEURTSPELLEN` (webcam), de chatbalk, `KAARTSPELLEN` (spraak vanzelf), `SOLO_SPELLEN` (tegen de computer, de computerspeler `<id>.js` wordt pas geladen als je speelt), Profiel > Widgets, uitnodigingen, het spelicoon en het titelscherm. Je hoeft de tabel hieronder dus niet langs;
- zet het spelicoon neer (`spelicoon/<id>.webp`) en een werkend beginspel uit het sjabloon (`<id>-ui.js` en `<id>.js`);
- schrijft de bouwopdracht `spellen/<id>.md` met alles wat in de Studio is ingevuld.

Daarna bouwt Claude de echte regels in `<id>-ui.js` en `<id>.js` (zie de stappen hieronder) en verhoogt `v` van het spel in `studio-spellen.js`.

## Eigen speelkaarten: Stekky Studio > 🃏 Speelkaarten maken (25 november 2026)

Een eigen set kaarten maak je uit een paar grote platen (bijvoorbeeld met Gemini). Je kiest:

- **Alleen de plaatjes (18)**: de azen, boeren, vrouwen en heren, de achterkant en de joker, op 2 platen van 3 × 3. De kaarten 2 tot en met 10 tekent de app zelf (`studioCijferKaart` in `kaartspel-hulp.js`), met de tekens in de kleuren die je kiest.
- **Alle 54 kaarten**: 4 platen van 4 × 4 (één per kleur) en 1 plaat met de achterkant en de joker, zoals Perkament.

Per plaat staat er een prompt voor Gemini klaar (`maakKaartPrompt` in `kaartmaker.js`). Je laadt de platen in (ook alle tegelijk); de Studio knipt ze in kaarten van 375 × 525, zet elk plaatje op de goede kaart en laat zien wat er nog ontbreekt. Klopt een kaart niet, dan kies je bij die kaart een ander plaatje. Dan maakt de Studio een kaartpakket (`<id>.stekkykaarten.json`).

`node tests/tools/studio-kaarten-installeer.mjs <id>.stekkykaarten.json` zet de plaatjes in `kaarten/<id>/` en de set in `studio-kaarten.js`. Daarmee staat hij vanzelf bij "Kies je kaarten" in elk kaartspel (`KAARTSTIJLEN`).

## Zo maak je een nieuw kaartspel

1. **Regels in een eigen bestand** zonder scherm, zoals `pesten.js`: één stand-object, functies die een *nieuwe* stand teruggeven (of `null` als het niet mag), `geldigeStand()` om een stand van de ander te controleren, en `computerStap()` voor spelen tegen de computer. Zo kun je de regels testen met Node.
2. **Het spel zelf**, zoals `pesten-ui.js`: `export function start({ spelKanaal, benIkSpeler1, vriendNaam })`, maak de tafel met `maakKaartTafel(...)` en praat over het spelkanaal zoals een beurtspel: `zet` (de hele stand), `vraag-stand`/`stand` (elke 3 seconden als je wacht), `opnieuw` (met de nieuwe stand). Speler 1 schudt en deelt. Animaties gaan na elkaar (een wachtrij), en tijdens een animatie kun je niets doen.
3. **Aanmelden**: zet het spel in `BEURTSPELLEN` **en** `KAARTSPELLEN` in `chat.html`. Komt het uit de Store, zet het dan in `STORE_GAMES` (`store.js`) en `toonStoreSpellen()` (`chat.html`) in plaats van een vaste knop; anders de knop in het spelmenu, `SPEL_INFO`, `SPEL_BESTAND`, `beschikbaar` en een `startNaam()`-functie. In `solo.js` bij `SOLO_SPELLEN` met een computerspeler. In `speluitnodiging.js` de naam en het icoon. Zie de tabel in BLAUWDRUK-BEURTSPEL.md voor de rest (titelscherm, widget, spelicoon).
4. **Teksten** met `T('...')` en de Engelse zin in `taal-en.js`. Daarna `taal-en.js` en `taal.js` een hoger `?v=`.
5. **Tests**: regels in `tests/kaart/`, en een browsertest zoals `tests/tools/proef290.py` (speelt echt: tikken, vegen, pakken, uitspelen, en met z'n tweeën).

## Pesten (het eerste kaartspel)

7 kaarten elk. Leg dezelfde kleur of waarde op; meer kaarten van dezelfde waarde mag in één keer. Kun je niet, pak een kaart (past hij, dan mag je hem leggen, anders **Pas**).

- **2** = de ander pakt er 2, **joker** = 5. Terugpesten met een 2 of joker stapelt op.
- **7** (blijft plakken), **8** (wacht): jij bent nog een keer. **Aas**: tegen de computer maar één keer (daarna is de ander aan de beurt); met z'n tweeën online nog een keer; met 3 of 4 spelers draait de richting om (regels klaar in `pesten.js`: `aasRegel`, `richting`, `spelers`; het scherm en het verbinden met meer spelers volgen nog).
- **Boer**: past altijd, jij kiest de kleur. **Joker**: past altijd, daarna mag alles.
- Nog 2 kaarten? Tik **☝ Laatste kaart!** voordat je speelt. Vergeten? Dan mag de ander op **🫵 Betrapt!** tikken: 2 strafkaarten.
- Wie het eerst geen kaarten meer heeft, wint. Daarna begint de ander.

## Toepen

32 kaarten (7 t/m aas), 4 elk. Van laag naar hoog: boer, vrouw, heer, aas, 7, 8, 9, **10**. Kleur bekennen als je kunt; de hoogste van de gevraagde kleur wint de slag. **Alleen de laatste slag telt**: wie die verliest, krijgt de inzet als strafpunten.

- **✊ Toep!** op je beurt: de ander gaat mee (inzet + 1) of gaat eruit (krijgt de oude inzet). Niet twee keer achter elkaar toepen.
- Wie **10 strafpunten** heeft, verliest. Na elke ronde begint de ander.
- Regels: `toepen.js`, spel: `toepen-ui.js`. De zet die een ronde afmaakt, deelt meteen de volgende ronde (`laatste.ronde`).

## Black Jack (voorheen Eenentwintigen; in de code blijft de naam `eenentwintigen`)

52 kaarten, 2 elk. 2 t/m 10 tellen wat erop staat, boer/vrouw/heer 10, aas 11 of 1. Wie begint pakt kaarten (tik of veeg op de stapel) tot **✋ Ik blijf**; daarna de ander. Boven 21 = meteen af. Aan het eind draait de ander zijn kaarten om (ze vliegen open op tafel). Evenveel = gelijkspel.

- Regels: `eenentwintigen.js`, spel: `eenentwintigen-ui.js`. De computerspeler voor beide staat in `solo.js` (`kaartspelBot`).
- Beide komen alleen uit de **Stekky Store**, net als Pesten (`STORE_GAMES`, widgets `spel_toepen` en `spel_eenentwintigen`).
- Test: `tests/tools/proef293.py` en `tests/kaart/test-toepen-regels.mjs`, `test-eenentwintigen-regels.mjs`.

## Let op

- De hele stand gaat over het spelkanaal, dus ook de kaarten van de ander. Het spel laat ze niet zien, maar iemand die het kanaal afluistert, kan ze zien. Voor een spel tussen vrienden is dat goed genoeg; voor een spel met inzet niet.
- Het spraakgesprek gaat vanzelf aan bij kaartspellen. Het oude geluidsprobleem tussen een iPhone en een Steam Deck (zie BLAUWDRUK-BEURTSPEL.md) is nog niet opgelost.
- **Pesten komt alleen uit de Stekky Store** (11 november 2026). Zo werkt het:
  1. Store → Games → Pesten → Downloaden (`STORE_GAMES` in `store.js`; een rij in `store_downloads`).
  2. Daarna staat Pesten bij Profiel → Widgets → Spellen (`widgetRij-spel_pesten`, `zetStoreGames`).
  3. Zet je die widget aan, dan staat Pesten op **Home** (tegen de computer, `spel.html?spel=pesten`) en in het **spelmenu van de chat** (met een vriend, `toonStoreSpellen()` in `chat.html`).
  4. Een uitnodiging van een vriend voor Pesten kun je altijd aannemen, ook zonder download.
  5. **Verwijderen** kan altijd: in de Store (🗑 Verwijderen) en bij Profiel → Widgets (🗑). Dan gaat de download uit je account én de widget uit, dus Pesten verdwijnt van Home en uit het spelmenu (`verwijderDownload` in `store.js`). Lettertypes uit de Store verwijder je ook bij Stijl → Lettertype → Uit de Store.
  - De chat kijkt op **dit toestel** of Pesten aan staat (`gameAan`: download + widget), want je widgets staan op je toestel, niet op de server.
  - Pesten gaat niet mee met een uitnodigingslink (`store: true` in `solo.js`).
  - De Store is sinds 11 november 2026 voor iedereen met een account (`sql/stekky-store-iedereen.sql`).

## Eenendertigen (het eerste spel uit Stekky Studio, 25 november 2026)

Gemaakt via **🎲 Spel maken** (spellen/eenendertigen.md). Regels in `eenendertigen.js` (met `bot` voor tegen de computer, via `studio-spellen.js`), het scherm in `eenendertigen-ui.js`. Piket (32 kaarten), 3 kaarten per speler en 3 open op tafel. Kies een kaart uit je hand en tik op een tafelkaart om te ruilen (of veeg je kaart omhoog en kies een tafelkaart); knoppen "Alle 3 ruilen", "Kloppen" (pas na één rondgang) en ❓. De tafelkaarten en de pilletjes (ronde, punten, levens) staan in een eigen vak midden op tafel (`.eed-midden`), want het info-vak van de tafel laat geen tikken door. Na een ronde deelt speler 1 vanzelf de volgende. Tests: `tests/kaart/test-eenendertigen.mjs` (ook 500 potjes computer tegen computer) en `proef339`.

## Met meer spelers en met de groep (25 november 2026)

- **`groepspel.js`** (stap 1): 2 tot 6 spelers over één spelkanaal. Wie het spel start is de gastheer en heeft de stand; de anderen sturen hun zet (`actie`), de gastheer stuurt de nieuwe stand (`stand`). De computer speelt lege zetels, wie weggaat (`weg`) en wie zijn beurt laat verlopen. Gaat de gastheer weg, dan stopt het spel bij de anderen (`onGastheerWeg`).
- **De tafel**: `tafel.tegenstanders(lijst)` zet de anderen als rondjes bovenaan (naam, icoon, info, wie aan de beurt is, wie eruit ligt); beurtklok en reacties per zetel (`'zetel:3'`).
- **In de groepschat** (stap 2, `groepkaartspel.js`): 🎲 → een spel kiezen (`groepSpellen()`: kaartspellen met `max` > 2 in `studio-spellen.js`) → de groep krijgt bovenin een uitnodiging → wachtkamer (hoogstens 6, de opener kan 🤖 computers erbij zetten) → Start. Alles loopt over het kanaal van de groep (`groep-<id>`, event `gs` met het nummer van het spel), dus er hoeft niets aan de database. In het spel: het spelmenu ☰ met de microfoon (= de voice chat van de groep), 🏠 = terug naar de chat (het spel blijft open), 🚪 = verlaten.
- Een spel kan dit als het `start({ spelKanaal, spelers, mijnZetel })` begrijpt (zie `eenendertigen-ui.js`).
- **Pushmelding** (stap 2b): wie een spel opent, stuurt de andere leden "🎲 Marcel wil Eenendertigen spelen in de groep" (`stuur-push`, type `groepspel`); wie de groep later opent, zegt `hallo` en ziet de uitnodiging toch.
- **In Stekky Studio** (stap 4): bij een kaartspel kies je **Hoeveel spelers?** (2 tot 6, `kaarten.spelers` in het spelbestand). De bouwopdracht krijgt dan een stuk "Met meer spelers": bouw het zoals Eenendertigen en zet `"max": n` in `studio-spellen.js` zodra het werkt (het beginspel uit het sjabloon kan alleen met z'n tweeën, dus de installer zet `max` nog niet).

## Koningsjacht (alleen te spelen)

*13 november 2026.* Gebaseerd op het idee van het kaartspel **Regicide** van Badgers From Mars; de naam, de teksten en de uitwerking zijn van Stekky (in het spel staat een vermelding). Je speelt alleen tegen het kasteel: 12 vijanden (eerst de boeren, dan de vrouwen, dan de heren).

- Aanvallen met een kaart, een aas + een kaart, of 2 tot 4 dezelfde waarden (samen tot 10). Krachten: ♥ kaarten terug onder de taveerne, ♦ kaarten pakken, ♣ dubbele schade, ♠ schild. Een vijand is immuun voor zijn eigen soort.
- Daarna slaat de vijand terug: kaarten afgooien die samen minstens zijn aanval (min schild) waard zijn. Precies op nul = de vijand komt bovenop de taveerne.
- Niveaus: Schildknaap (4 narren), Ridder (2), Koning (0). Een nar = je hele hand weg, 8 nieuwe kaarten. Medaille: goud zonder nar, zilver met 1, brons met meer.
- Regels: `koningsjacht.js`, spel: `koningsjacht-ui.js`. Geen spelkanaal (`zonderKanaal` in `solo.js`), niet in de chat. Het spel wordt op het toestel bewaard (`fibro_koningsjacht_stand`), de beste medaille per niveau ook (`fibro_koningsjacht_best`).
- De tafel gebruikt drie opties van `kaartspel-hulp.js` v5: `stijl: 'perkament'` (vaste kaarten, geen knop 🎴), `ondergrond: 'hout'` (`kaarten/hout.webp`, gemaakt met `tests/gen/maak_hout.py`) en `stapelTekst`. Bovenin staat geen tegenstander maar de vijand (zijn kaart, leven, aanval, schild).
- Uit de **Stekky Store** (`STORE_GAMES`, widget `spel_koningsjacht`). Spelicoon: `tests/gen/maak_spelicoon_koningsjacht.py`.
- **Geluid en licht** (v2): `koningsjacht-geluid.js` maakt alle geluiden met Web Audio (zwaard, inslag, gong, brul, oorlogshoorn, fanfares) en epische muziek (knop 🎵, `fibro_koningsjacht_muziek`). Bij een aanval gloeien je kaarten in hun kleur, vliegen ze naar de vijand en komt er een zwaardhaal van licht met vonken.
- **Met z'n tweeën** (v5, in de chat): speler 1 kiest **samen** (één kasteel, om de beurt, elk 7 kaarten, de hele stand gaat over het kanaal), **wedstrijd** (ieder een eigen kasteel met hetzelfde zaadje, berichten `voortgang`) of **duel** (wedstrijd + `vloek`: precies raak = de vijand van de ander krijgt 10 leven erbij). Test: `tests/tools/proef301.py`.
- Test: `tests/kaart/test-koningsjacht-regels.mjs` en `tests/tools/proef299.py`.
