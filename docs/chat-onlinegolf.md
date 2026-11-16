# Een vriend komt online in de open chat

Als een vriend aantoonbaar van offline naar online gaat terwijl zijn of haar chatgeschiedenis openstaat, loopt een blauwe lichtgolf in ongeveer **2,5 seconden van boven naar beneden**. Het patroon combineert satijnplooien met neonlicht en gebroken lichtreflecties. De laag blijft achter de berichten en neemt geen muis- of aanraakinvoer over.

Na de golf verdwijnen de canvaslaag en de tijdelijke tekstverzachting. Een aparte, kort zichtbare melding zegt: **{naam} is zojuist online gekomen**. De bestaande privé-weergavenaam wordt gebruikt. De typindicator blijft apart functioneren.

De eerste status na openen, een gecachte vriendenlijst zonder onlinegegevens en de eerste presence-sync na opnieuw verbinden spelen geen aankomst af. De bestaande privacybewuste onlinebeslissing blijft leidend. Wisselen naar een andere vriend, teruggaan, offline gaan, een spel openen of het tabblad verbergen stopt het effect. Er worden geen nieuwe aanwezigheidssignalen of berichten naar anderen verstuurd.

`chat-onlinegolf.js` bevat de overgangscontrole en een tijdelijke WebGL-laag. Zonder WebGL gebruikt de laag een CSS-variant; met verminderde beweging verschijnt alleen de duidelijke onlinemelding. GPU-objecten, animatieframes, timers en tijdelijke DOM worden opgeruimd.

## Proberen en testen

- Open `tests/fixtures/chat-onlinegolf-preview.html` en druk op **Vriend komt online**. Dit is een duidelijk gemarkeerde, lokale simulatie met voorbeeldberichten.
- `node tests/ui/test-chat-onlinegolf.mjs`: overgangen, exacte duur, annuleren, tekstveiligheid, fallback, verminderde beweging en opruiming.
- `python -I tests/tools/proef303.py .`: echte chatpagina met nagebootste server, offline→online, herhaalde status, opnieuw openen en annuleren. De test verandert geen echte accounts.
