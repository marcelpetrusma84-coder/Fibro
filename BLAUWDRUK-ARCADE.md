# Blauwdruk: een arcadespel

*27 november 2026. Een arcadespel speel je alleen: snel, met punten, een record en het scorebord (top 10). Voorbeelden:
Flapper (`flappy-ui.js`), Block It (`blockit-ui.js`), The Swarm (`swarm-ui.js`).*

## Snel beginnen

- **Met Stekky Studio:** kies "🕹️ Arcadespel". Het installeerscript (`tests/tools/studio-spel-installeer.mjs`) zet het
  spel overal neer met een werkend beginspel uit `sjabloon-arcade-ui.js` en `sjabloon-arcade.js` ("Ontwijk"), en zet
  `"arcade": true` in `studio-spellen.js`.
- **Zonder Studio:** kopieer die twee sjablonen en zet het spel in `solo.js` (`SOLO_SPELLEN`, met `arcade: true`).
- Kijk eerst in [BOUWSTENEN.md](BOUWSTENEN.md) wat er al is.

## Hoe het in elkaar zit

1. **De spelwereld is gewoon rekenen** (`<id>.js`): `nieuweWereld()`, `stap(wereld, dt, invoer, rng)` en `punten(wereld)`.
   Geen scherm, zodat je het in een Node-test kunt nalopen (botsen, randen, sneller worden).
2. **Het scherm** (`<id>-ui.js`): één `<canvas>` over het hele speelveld, scherp met `devicePixelRatio`, en een lus met
   `requestAnimationFrame`. Het ☰-menu (`spelmenu.js`) zet die lus vanzelf stil bij pauze; begrens `dt` (het sjabloon
   doet hoogstens 0,05 s) zodat er na een pauze geen sprong komt.
3. **Besturen:** pijltjes of A/D, schuiven met je vinger (pointer-events), en een controller: `controller.js` maakt
   daar vanzelf toetsen van.
4. **Punten en record:** spel.html geeft `solo` mee. `solo.record()` is je record op dit toestel; `solo.nieuweScore(n)`
   aan het eind van een potje bewaart een nieuw record én zet de score op het scorebord (`spelscores.js`).
5. **Geluid en trillen:** `kaartGeluid` en `tril` uit `kaartspel-hulp.js`, of een eigen geluid met Web Audio.
6. **Opruimen:** als het spel dichtgaat (het vak is uit de pagina), de lus stoppen en de toetsen loslaten.

## Klaar is

- het spel werkt met toetsen, je vinger en een controller;
- een Node-test voor de spelwereld en een browsertest in `tests/tools/` (met een regel in `browsertests.txt`);
- alle teksten met `T(...)` en Engels erbij;
- nieuwe bouwstenen in BOUWSTENEN.md. Een platformmotor (springen, levels uit een bestand) staat daar op de lijst
  "Wat nog ontbreekt": die maak je als bouwsteen, zodat elk volgend platformspel hem kan gebruiken.
