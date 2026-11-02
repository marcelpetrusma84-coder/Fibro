# Ultra: terugvegen en 4D standaard aan

Gebaseerd op Marcels main **7ca218e**, inclusief de samengevoegde PR #70 en zijn
minimumleeftijdwijziging. Normaal mergen en statisch deployen; geen nieuwe SQL,
sleutels of pakketten nodig.

## Terugvegen onder het bord

Alleen mobiel solo Ultra heeft een afzonderlijke strook onder het bord, wanneer
**Take-back** is aangezet. De strook blijft bereikbaar in alle vier de
vergrotingsstanden. Begin in de rechter 30%, veeg naar links tot iets voorbij
het midden (42% van de strookbreedte) en laat los. De markering en verlichting
geven aan wanneer de beweging ver genoeg is. Terug naar rechts bewegen vóór
het loslaten annuleert de terugname.

Er volgt maximaal één bestaande Take-back per veeg: de eigen laatste zet en,
als die al is gespeeld, de computerreactie worden teruggenomen. De strook en
knop gebruiken dezelfde functie en dezelfde controles. Geen actie zonder
eerdere zet, bij uitgeschakelde Take-back, tijdens stukanimatie/promotie of een
al lopende terugname, of na afsluiten van het spel. Beschikbaarheid wordt ook
bij loslaten opnieuw gecontroleerd. Terugnemen tijdens de rekentijd van de
computer blijft mogelijk; bestaande generatiecontrole weert oude antwoorden.

Kleine bewegingen, gewone tikken, de verkeerde richting en multitouch doen
niets. `touch-action:pan-y` bewaart verticaal scrollen. Captureverlies,
annuleren, verbergen, schermwissel en opruimen annuleren de veeg. Toetsenbord en
schermlezer kunnen dezelfde actie activeren; muisslepen werkt in de
telefoonpreview. Nederlandse en Engelse labels wisselen tijdens de partij mee.

## 4D standaard aan

Zonder bestaande geldige voorkeur staat de tafelachtergrond aan. Een expliciet
opgeslagen `off` blijft uit; uitschakelen gebeurt via de bestaande instelling
**4D wallpaper → Tafelachtergrond**. Telefoonsensoren starten automatisch waar
het platform dit toestaat. Een browser die eerst toestemming vraagt, behoudt
de aparte activeringsknop en vraagt nooit ongevraagd toestemming. Minder
beweging behoudt de statische achtergrond.

## Proberen

Open `tests/fixtures/chess-ultra-mobile-preview.html`, kies Ultra en zet Take-back
aan in de schaakinstellingen. Speel bijvoorbeeld e2–e4. Sleep de pijl onder het
bord naar links voorbij de markering en laat los. Probeer ook een korte veeg,
terugschuiven en dezelfde actie in vergrotingsstand vier. De preview behoudt
de bestaande knoppen voor de vier formaten en kan met de muis worden bediend.

## Validatie

Alle **77 Node-testbestanden** slagen in chess, security, UI, onboarding, Neon,
sync, foutmelder en Block It, inclusief Marcels nieuwe minimumleeftijdtest.
Er zijn extra controles voor veegdrempels, terugschuiven, scrollen, multitouch,
capture-overdracht, annuleren, verborgen/losgekoppelde schermen, actuele
terugnameblokkades, dubbele verzoeken, menu openen/sluiten en volledig bordherstel.
De wallpaper-tests controleren nieuwe standaardwaarden, bewaarde opt-outs,
opslagfouten, beide instellingenmenu’s en toestemming zonder automatische prompt.

In de echte telefoonpreview werkt terugvegen met de muis na e2–e4/e7–e5, ook in
vergrotingsstand vier. De 4D-schakelaar zet de achtergrond zichtbaar aan en uit;
de veegteksten wisselen tussen Nederlands en Engels. Fysieke touchgebaren en
telefoonkanteling vragen nog een controle op een toestel.

## English

Mobile solo Ultra adds a dedicated under-board swipe strip when Take-back is
enabled. Start in the rightmost 30%, drag left beyond the midpoint and release.
The strip lights up at the threshold; moving back cancels. Each release invokes
the same guarded undo as the button, including an already-played bot reply.
It stays available in every focus stage, preserves vertical scrolling, rejects
small/wrong/multitouch gestures, and cleans up capture and visibility changes.
Keyboard/assistive activation and mouse dragging in the phone preview work too.

The 4D table wallpaper now defaults on for missing/invalid preferences. Explicit
opt-outs, permission requirements and reduced-motion behavior remain intact.
No new database or build changes are needed; this builds on main `7ca218e`.
All 77 Node test files pass, with a real browser undo after a played human/bot
turn, live language switching and wallpaper toggle checks. Physical touch/tilt
remain a device smoke test.
