# Bouwopdracht: Fruitautomaat (🍒)

*Gemaakt in Stekky Studio. Bouw dit spel volgens BLAUWDRUK-KAARTSPEL.md en kijk eerst in BOUWSTENEN.md wat er al is. Het spel staat al overal aangemeld (studio-spellen.js) en heeft een werkend beginspel uit `sjabloon-automaat-ui.js` in `fruitautomaat-ui.js` (en `fruitautomaat.js`). Vervang dat beginspel door de echte regels hieronder.*

## Wat

- Soort: Kaartspel
- Id: `fruitautomaat`
- Naam: Fruitautomaat (Engels: Fruit machine)
- Store, Nederlands: Een klassieke fruitautomaat met drie rollen: kersen, citroenen, bellen en de 7. Drie dezelfde wint, drie zevens 200×. Met of zonder casino-tokens (18+).
- Store, Engels: A classic fruit machine with three reels: cherries, lemons, bells and the 7. Three of a kind wins, three sevens 200×. With or without casino tokens (18+).

## Spelregels

Een fruitautomaat met drie rollen. Je speelt alleen.

Kies je inzet (10, 25, 50 of 100 tokens, of zonder tokens) en tik op Draai.
Uitbetaling (× je inzet): 7 7 7 = 200, ster ster ster = 60, bel bel bel = 40, druif ×3 = 20, sinaasappel ×3 = 15, citroen ×3 = 12, kers ×3 = 10, twee kersen = 4, een kers op de eerste rol = 1 (inzet terug).
Op de lange duur krijg je ongeveer 97 van elke 100 tokens terug; de kans op een prijs is ongeveer 1 op 4. Dat staat eerlijk bij de spelregels.

Met tokens draait de SERVER de rollen (sql/casino-volwassen.sql), zoals bij Video Poker, omdat het meer dan 2× uitbetaalt. Zonder tokens draait het toestel, met dezelfde tabel.
Ook een wachtspelletje bij Poker en Black Jack.

## Kaarten

- Kaartspel: Gewoon kaartspel (52 kaarten)
- Kaarten per speler: 1
- Spelers: 2
- Gebruik de kaarttafel (`kaartspel-hulp.js`): kaartstijlen, ondergrond, animaties, beurtklok en trillen.

## Alleen spelen (een automaat)

- Je speelt alleen: geen niveaus, geen computerspeler, niet in de chat (`zonderKanaal` in studio-spellen.js).
- Met casino-tokens? Zet het spel in `CASINO_SPELLEN` (casino.js) en in de lijst van `casino_inzet` (sql/casino-tokens.sql). Betaalt het meer dan 2× uit, laat dan de server delen en uitbetalen zoals Video Poker (sql/videopoker.sql).

## Wat erin zit

- Spelmenu ☰ (pauze, geluid, microfoon, camera, menu, verlaten): ja
- Met een vriend spelen in de chat: nee
- Tegen de computer (op Home, makkelijk, normaal of moeilijk): ja
- Chatbalk in het spel: stickers 🎨, emoji 😊 en berichten: nee
- Webcamrondjes bovenin (met 📹-knop): nee
- In de Stekky Store (downloaden, dan op Home en in het spelmenu): ja
- Spraak: Geen spraak
- Titelscherm: zoals Pesten

## Extra's

- Knop ❓ met de spelregels in het spel
- Knop ↻ Opnieuw spelen na afloop
- Trillen als je aan de beurt bent
- Scorebord over meerdere potjes
- Geluidjes bij zetten, winnen en verliezen
- Animaties (kaarten of stukken die bewegen)
- Hulp: laten oplichten wat je mag doen

## Klaar is

- de regels werken met een vriend en tegen de computer (wat hierboven aan staat);
- alle teksten met `T(...)`, en Engels in `taal-en.js`;
- een test in `tests/` en een browsertest in `tests/tools/`;
- de `?v=` van fruitautomaat-ui.js en fruitautomaat.js omhoog (en `v` in studio-spellen.js).
