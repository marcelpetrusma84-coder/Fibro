# Blauwdruk: een nieuw beurtspel in Fibro

*Gemaakt op 3 november 2026. Een beurtspel is een spel waarin je om de beurt zet: boter-kaas-en-eieren, vier op een rij, dammen, schaken. Voor kaartspellen (zoals Pesten) is er een eigen blauwdruk bovenop deze: [BLAUWDRUK-KAARTSPEL.md](BLAUWDRUK-KAARTSPEL.md).*

Elk nieuw beurtspel krijgt **vanzelf** hetzelfde als dammen:

- **De chatbalk onderin**: stickers 🎨, emoji's 😊, een tekstveld met verstuurknop ➤. Op een telefoon schuiven 🎨 en 😊 opzij tijdens het typen.
- **De webcamrondjes bovenin**: twee rondjes van 120 px (vriend links, jij rechts), de webcamknop 📹, een groene rand als je vriend je ziet, een gouden rand als iemand praat, en een rode rand (met geluidje) als iemand geslagen wordt.

Dat regelt `chat.html`. Het spel hoeft er bijna niets voor te doen.

## In elk spel: het spelmenu ☰ en berichten linksboven (11 november 2026)

Dit geldt voor **alle** spellen (in de chat en tegen de computer); een spel hoeft er niets voor te doen.

- **Rechtsboven ☰** (`spelmenu.js`), in deze volgorde: ⏸ Pauze / ▶ Verder spelen, 🔊 Geluid aan/uit, 🎤 Microfoon, 📹 Camera, 🏠 Menu, 🚪 Spel verlaten. Microfoon en camera alleen met een vriend (camera alleen bij spellen met webcam). De losse ✕, 🎤 en 📹 bovenin zijn weg.
- **Pauze** staat bij jullie allebei stil; wie pauzeerde, gaat verder. Tegen de computer wacht de computer ook. Het spel hoeft niets te doen: de beeldjes (`requestAnimationFrame`) en de klok (`performance.now`) worden vastgehouden. Wil een spel zelf iets doen, luister dan naar `fibro-spel-pauze`.
- **Geluid uit** zet al het Web Audio-geluid van het spel op 0 (de stem van je vriend blijft).
- **Menu**: tegen de computer terug naar het kiezen van het niveau; met een vriend het spel dicht en het spelmenu van de chat open.
- **Linksboven** een wolkje als een andere vriend je een bericht stuurt (`spelbericht.js`). Berichten van je tegenspeler zie je al in het spel.

## Zo maak je een nieuw beurtspel

1. **Kopieer het sjabloon.** `sjabloon-beurtspel-ui.js` is een klein, werkend spel ("Stokjes"). Kopieer het naar `<naam>-ui.js` en bouw je spel daarin. Houd deze onderdelen aan:
   - `export function start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam })`
   - het protocol over het spelkanaal: `zet` (met de **hele stand**, `nr` en `spelId`), `vraag-stand`, `stand` en `opnieuw`;
   - wie wacht, vraagt elke 3 seconden de stand op. Dan loopt het spel nooit vast op een zoekgeraakt bericht;
   - teksten met `T('...')`, met de Engelse vertaling in `taal-en.js`.
2. **Gebruik `beurtspel-hulp.js`.**
   - `webcamRuimte()` geeft terug hoeveel pixels bovenin vrij moeten blijven. Gebruik dat bij het schalen van je bord.
   - `opWebcamWissel(fn)` roept je functie aan als de rondjes verschijnen of verdwijnen. Teken dan je bord opnieuw.
   - `meldGeslagen('ik' | 'ander', aantal)` maakt het rondje van die persoon even rood. Ben jij het, dan hoor je ook een geluidje. Geef `{ geluid: false }` mee als je spel al een eigen geluid heeft.
3. **Zet het spel in `BEURTSPELLEN`** in `chat.html`. Daarmee krijgt het de chatbalk en de webcam.
4. **Meld het spel overal aan.** Dit zijn alle plekken waar een spel nu staat:

| Bestand | Wat |
|---|---|
| `chat.html` | knop in het spelmenu (`spel-keuze-btn`), `SPEL_INFO`, `SPEL_BESTAND`, de lijst `beschikbaar` in `speelMee`, de regel `else if (spelType === ...)` met een `startNaam()`-functie, en `BEURTSPELLEN` |
| `solo.js` | `SOLO_SPELLEN` (bestand en computerspeler), voor spelen tegen de computer in `spel.html` |
| `spelversies.js` | versienummer van het spel (versie ophogen = "nieuw"-label) |
| `index.html` | `ICONEN` |
| `invite.html`, `vrienden.html`, `speluitnodiging.js` | naam en icoon in uitnodigingen |
| `profiel.html` | widget (`spel_<naam>`) en icoon |
| `spelicoon.js` + `spelicoon/<naam>.webp` | spelicoon |
| `titelscherm.js`, `titelscenes.js`, `titelmuziek.js` | titelscherm, scène en muziek |
| `taal-en.js` | Engelse teksten |

5. **Versies.** Verandert een JS-bestand, verhoog dan de `?v=` overal waar het geladen wordt. Een nieuw bestand begint op `?v=1`.
6. **Tests.** Voeg een test toe in `tests/` en draai **alle** tests voordat je pusht.

## Wat er al vanzelf werkt (je hoeft er niets voor te doen)

- `isVideoSpel()` en `CAMERA_RONDJES` in `chat.html` worden gemaakt uit `BEURTSPELLEN` (schaken heeft eigen webcamvakken).
- De webcamknop 📹 (`bouwSpelCamKnop`) verschijnt linksboven. Dammen heeft een eigen knop onder het bord.
- De gouden spreekrand (`spreekMeter`) en de rode rand (`fibro-spel-geslagen`).
- Op de pc blijft de chatbalk zoals hij is. Op een touchscherm schuiven de knoppen opzij bij typen.

## Let op

- Het spraakgesprek begint bij deze spellen pas als iemand op 📹 drukt (bij schaken en de kaartspellen vanzelf; zie BLAUWDRUK-KAARTSPEL.md). Er was een geluidsprobleem tussen een iPhone en een Steam Deck dat nog niet is opgelost.
- Snelle actiespellen (zoals Neo Paddle en Block It) krijgen geen chatbalk en alleen kleine rondjes. Die staan niet in `BEURTSPELLEN`, maar alleen met `'klein'` in `CAMERA_RONDJES`.
