# Bouwopdracht: Hoger of lager (🃏)

*Gemaakt in Stekky Studio. Bouw dit spel volgens BLAUWDRUK-KAARTSPEL.md en kijk eerst in BOUWSTENEN.md wat er al is. Het spel staat al overal aangemeld (studio-spellen.js) en heeft een werkend beginspel uit `sjabloon-automaat-ui.js` in `hogerlager-ui.js` (en `hogerlager.js`). Vervang dat beginspel door de echte regels hieronder.*

## Wat

- Soort: Kaartspel
- Id: `hogerlager`
- Naam: Hoger of lager (Engels: Higher or lower)
- Store, Nederlands: Je ziet een kaart: is de volgende hoger of lager? Snel, simpel en spannend. Ook als wachtspelletje bij Poker en Black Jack. Met of zonder casino-tokens (18+).
- Store, Engels: You see a card: is the next one higher or lower? Quick, simple and exciting. Also a waiting game at Poker and Black Jack. With or without casino tokens (18+).

## Spelregels

Hoger of lager speel je alleen, tegen de automaat.

Je ziet een open kaart. Raad of de volgende kaart hoger of lager is. Aas is het hoogst, 2 het laagst.
Goed geraden = gewonnen. Dezelfde waarde = gelijk (je inzet terug). Fout = verloren.
Met casino-tokens (alleen 18+): je kiest 10, 25, 50 of 100 en krijgt bij winst je inzet dubbel terug.

Ook een wachtspelletje: in de wachtkamer van Poker en Black Jack (met een vriend of in de groepschat) en als je bij Poker uit het spel ligt. Zit er iemand onder de 18 in de chat, dan zonder tokens.

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
- de `?v=` van hogerlager-ui.js en hogerlager.js omhoog (en `v` in studio-spellen.js).

## Aanpassing 28 nov 2026 (Marcel)

De uitbetaling hangt nu af van de kans (eerst altijd 2×; met slim kiezen kreeg je dan 150 van de 100 terug):
uitbetaling = inzet × floor(4947 / winnende kaarten) / 100, dezelfde waarde = verloren. Elke keuze geeft zo op de lange
duur ongeveer 97 van de 100 terug. Met tokens deelt de server (`hogerlager_deel`, `hogerlager_raad` in
`sql/casino-volwassen.sql`). Fiches 5, 10, 25, 50 en 100; elke week 500 tokens.
