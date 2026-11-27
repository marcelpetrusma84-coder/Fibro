# Bouwopdracht: Video Poker (🎰)

*Gemaakt in Stekky Studio. Bouw dit spel volgens BLAUWDRUK-KAARTSPEL.md. Het spel staat al overal aangemeld (studio-spellen.js) en heeft een werkend beginspel in `videopoker-ui.js` en een computerspeler in `videopoker.js`. Vervang dat beginspel door de echte regels hieronder.*

## Wat

- Soort: Kaartspel
- Id: `videopoker`
- Naam: Video Poker (Engels: Video Poker)
- Store, Nederlands: Jacks or Better tegen de automaat: 5 kaarten, houd wat je wilt en ruil de rest één keer. Een paar boeren of beter betaalt uit, een royal flush 250×. Met of zonder casino-tokens.
- Store, Engels: Jacks or Better against the machine: 5 cards, hold what you like and swap the rest once. A pair of jacks or better pays, a royal flush 250×. With or without casino tokens.

## Spelregels

Video Poker speel je in je eentje tegen een automaat. De bekendste versie heet Jacks or Better.

Zo speel je:

Je zet in: 10, 25, 50 of 100 tokens (of zonder tokens).
Je krijgt 5 open kaarten.
Je tikt de kaarten aan die je wilt houden. Je mag alles houden, niets houden of iets ertussenin.
Je tikt op Ruilen: de kaarten die je niet hield worden één keer vervangen door nieuwe.
Je eindhand bepaalt wat je wint. Elke ronde is één nieuw potje met een vers geschud kaartspel.

Uitbetaling (de gangbare tabel, zet × deze waarde):

Hand Uitbetaling
Royal flush 250×
Straight flush 50×
Four of a kind 25×
Full house 9×
Flush 6×
Straight 4×
Three of a kind 3×
Twee paar 2×
Een paar boeren of hoger (B, V, H, A) 1× (je krijgt je inzet terug)
Al het andere 0 (je inzet is weg)

Een paar tienen of lager levert dus niets op, vandaar de naam: alleen boeren of beter tellen.

Server (Marcel, 27 nov 2026): met tokens deelt de server de kaarten en betaalt hij uit (sql/videopoker.sql), zodat niemand een hand kan verzinnen. Zonder tokens (of zonder internet) speel je op het toestel, met dezelfde tabel.

## Kaarten

- Kaartspel: Gewoon kaartspel (52 kaarten)
- Kaarten per speler: 5
- Spelers: 2
- Gebruik de kaarttafel (`kaartspel-hulp.js`): kaartstijlen, ondergrond, animaties, beurtklok en trillen.

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
- de `?v=` van videopoker-ui.js en videopoker.js omhoog (en `v` in studio-spellen.js).
