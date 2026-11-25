# Bouwopdracht: Eenendertigen (🎲)

*Gemaakt in Stekky Studio. Bouw dit spel volgens BLAUWDRUK-KAARTSPEL.md. Het spel staat al overal aangemeld (studio-spellen.js) en heeft een werkend beginspel in `eenendertigen-ui.js` en een computerspeler in `eenendertigen.js`. Vervang dat beginspel door de echte regels hieronder.*

## Wat

- Soort: Kaartspel
- Id: `eenendertigen`
- Naam: Eenendertigen (Engels: Thirty-One)
- Store, Nederlands: Ruil kaarten met de tafel en kom zo dicht mogelijk bij 31 in één kleur. Klop als je denkt dat je genoeg hebt!
- Store, Engels: Swap cards with the table and get as close to 31 as you can in one suit. Knock when you think you have enough!
- Doel: Wie als laatste nog levens heeft, wint.

## Spelregels

Elke speler krijgt 3 kaarten. Er liggen ook 3 kaarten open op tafel. Wie begint, wisselt per ronde.
Om de beurt doe je één ding: één kaart ruilen met de tafel, alle drie je kaarten ruilen met de tafel, of kloppen. Kloppen mag pas als iedereen één keer aan de beurt is geweest.
Je punten tel je alleen op bij kaarten van dezelfde kleur: aas is 11, heer, vrouw en boer zijn 10, de andere kaarten hun eigen waarde. Je beste kleur telt. Het hoogste is 31.
Drie kaarten met dezelfde waarde (bijvoorbeeld drie vrouwen) zijn 30½ waard.
Klop je, dan mag de ander nog één keer ruilen. Daarna laten jullie je kaarten zien.
Heb je precies 31, dan laat je meteen je kaarten zien en win je de ronde.
Wie de minste punten heeft, verliest een leven. Hebben jullie evenveel, dan verliezen jullie allebei een leven. Ook wie klopte verliest maar één leven.
Iedereen begint met 3 levens. Wie geen levens meer heeft, heeft verloren.

## Kaarten

- Kaartspel: Piket (32 kaarten: 7 tot en met aas)
- Kaarten per speler: 3
- Gebruik de kaarttafel (`kaartspel-hulp.js`): kaartstijlen, ondergrond, animaties, beurtklok en trillen.

## Wat erin zit

- Spelmenu ☰ (pauze, geluid, microfoon, camera, menu, verlaten): ja
- Met een vriend spelen in de chat: ja
- Tegen de computer (op Home, makkelijk, normaal of moeilijk): ja
- Chatbalk in het spel: stickers 🎨, emoji 😊 en berichten: ja
- Webcamrondjes bovenin (met 📹-knop): ja
- In de Stekky Store (downloaden, dan op Home en in het spelmenu): ja
- Spraak: Spraak meteen aan als het spel begint (zoals bij de kaartspellen)
- Titelscherm: zoals Pesten

## Extra's

- Knop ❓ met de spelregels in het spel
- Knop ↻ Opnieuw spelen na afloop
- Beurtklok (een rondje dat aftelt)
- Trillen als je aan de beurt bent
- Scorebord over meerdere potjes
- Geluidjes bij zetten, winnen en verliezen
- Animaties (kaarten of stukken die bewegen)
- Hulp: laten oplichten wat je mag doen
- Instelling: grote kaarten of stukken

## Klaar is

- de regels werken met een vriend en tegen de computer (wat hierboven aan staat);
- alle teksten met `T(...)`, en Engels in `taal-en.js`;
- een test in `tests/` en een browsertest in `tests/tools/`;
- de `?v=` van eenendertigen-ui.js en eenendertigen.js omhoog (en `v` in studio-spellen.js).
