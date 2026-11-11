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
| Jouw waaier | **Tik** = de kaart komt groot naar voren. Tik meer kaarten van dezelfde waarde om ze samen te spelen. **Veeg omhoog** = spelen; hoe harder, hoe verder de kaart over tafel glijdt. **Lang vasthouden en schuiven** = de kaart verplaatsen. **⇅** = sorteren op kleur, nog eens = op waarde. |
| Oplichten | Kaarten die je mag spelen krijgen een paarse gloed, de rest wordt donkerder. Kun je niets, dan licht de stapel op. |
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

## Zo maak je een nieuw kaartspel

1. **Regels in een eigen bestand** zonder scherm, zoals `pesten.js`: één stand-object, functies die een *nieuwe* stand teruggeven (of `null` als het niet mag), `geldigeStand()` om een stand van de ander te controleren, en `computerStap()` voor spelen tegen de computer. Zo kun je de regels testen met Node.
2. **Het spel zelf**, zoals `pesten-ui.js`: `export function start({ spelKanaal, benIkSpeler1, vriendNaam })`, maak de tafel met `maakKaartTafel(...)` en praat over het spelkanaal zoals een beurtspel: `zet` (de hele stand), `vraag-stand`/`stand` (elke 3 seconden als je wacht), `opnieuw` (met de nieuwe stand). Speler 1 schudt en deelt. Animaties gaan na elkaar (een wachtrij), en tijdens een animatie kun je niets doen.
3. **Aanmelden**: zet het spel in `BEURTSPELLEN` **en** `KAARTSPELLEN` in `chat.html`. Komt het uit de Store, zet het dan in `STORE_GAMES` (`store.js`) en `toonStoreSpellen()` (`chat.html`) in plaats van een vaste knop; anders de knop in het spelmenu, `SPEL_INFO`, `SPEL_BESTAND`, `beschikbaar` en een `startNaam()`-functie. In `solo.js` bij `SOLO_SPELLEN` met een computerspeler. In `speluitnodiging.js` de naam en het icoon. Zie de tabel in BLAUWDRUK-BEURTSPEL.md voor de rest (titelscherm, widget, spelicoon).
4. **Teksten** met `T('...')` en de Engelse zin in `taal-en.js`. Daarna `taal-en.js` en `taal.js` een hoger `?v=`.
5. **Tests**: regels in `tests/kaart/`, en een browsertest zoals `tests/tools/proef290.py` (speelt echt: tikken, vegen, pakken, uitspelen, en met z'n tweeën).

## Pesten (het eerste kaartspel)

7 kaarten elk. Leg dezelfde kleur of waarde op; meer kaarten van dezelfde waarde mag in één keer. Kun je niet, pak een kaart (past hij, dan mag je hem leggen, anders **Pas**).

- **2** = de ander pakt er 2, **joker** = 5. Terugpesten met een 2 of joker stapelt op.
- **7** (blijft plakken), **8** (wacht), **aas** (keer om): jij bent nog een keer.
- **Boer**: past altijd, jij kiest de kleur. **Joker**: past altijd, daarna mag alles.
- Nog 2 kaarten? Tik **☝ Laatste kaart!** voordat je speelt. Vergeten? Dan mag de ander op **🫵 Betrapt!** tikken: 2 strafkaarten.
- Wie het eerst geen kaarten meer heeft, wint. Daarna begint de ander.

## Toepen

32 kaarten (7 t/m aas), 4 elk. Van laag naar hoog: boer, vrouw, heer, aas, 7, 8, 9, **10**. Kleur bekennen als je kunt; de hoogste van de gevraagde kleur wint de slag. **Alleen de laatste slag telt**: wie die verliest, krijgt de inzet als strafpunten.

- **✊ Toep!** op je beurt: de ander gaat mee (inzet + 1) of gaat eruit (krijgt de oude inzet). Niet twee keer achter elkaar toepen.
- Wie **10 strafpunten** heeft, verliest. Na elke ronde begint de ander.
- Regels: `toepen.js`, spel: `toepen-ui.js`. De zet die een ronde afmaakt, deelt meteen de volgende ronde (`laatste.ronde`).

## Eenentwintigen

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
