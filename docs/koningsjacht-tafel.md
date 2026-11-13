# Koningsjacht: tafel, instellingen en bierpullen

Het tandwiel op het beginscherm en op de speeltafel opent de instellingen. Deze worden op het toestel bewaard in `fibro_koningsjacht_instellingen`.

- Normale houttafel of middeleeuwse studeerkamer, met dezelfde bestaande perkamentkaarten.
- Subtiele achtergrondbeweging met muis of telefoonsensor; standaard uit. iOS vraagt toestemming na de tik. De kaartbediening blijft stil. Verminderde beweging van het toestel wordt gerespecteerd.
- Realistische kandelaars met apart bewegende vlammen. Flikkeren staat standaard aan; de bestaande kaarsknop blijft al het kaarslicht uitzetten.
- Optionele bierpul (standaard uit): keramiek op de normale tafel, hout bij de middeleeuwse scene. De inhoudsschuif loopt van 0 tot 100%. Omdat de pullen ondoorzichtig zijn, staat er een aparte niveaumeter met percentage naast.
- **Nieuwe volle pul** vult naar 100%, wisselt de oorstand en animeert de vervanging. Beide spelers zien hun eigen pul en de pul van de ander.

De beelden zijn speciaal gegenereerde lokale spelassets. De achtergrond is een foto met parallax en de kandelaars/pullen zijn transparante sprites; dit is geen volledig 3D-model met vrij draaibare camera.

## Multiplayer en webcam

`koningsjacht-bier.js` gebruikt het bestaande spelkanaal, los van de spelregels. Elk bericht bevat de eigen speler, zichtbaarheid, inhoud, oorstand, pulnummer en oplopende versie. Ongeldige berichten, eigen echo's en oudere standen worden genegeerd. Een nieuwe deelnemer vraagt de stand op; volledige standen worden bovendien iedere vijf seconden herhaald om gemiste berichten te herstellen. Dit werkt in samen, wedstrijd, duel en belegering. Het is handmatig ingestelde aanwezigheid, geen detectie van echt drinken.

De bestaande webcamondersteuning van Koningsjacht blijft beschikbaar via het gedeelde spelmenu in de chat, met dezelfde ronde videokaders en belverbinding als schaken. Deze wijziging vervangt de mediaverbinding niet.

## Zelf proberen

Start vanuit de projectmap een lokale server (`python -m http.server 8131`).

- Alleen: `http://127.0.0.1:8131/tests/fixtures/koningsjacht-preview.html`
- Twee lokale testspelers: open die pagina in twee tabbladen met respectievelijk `?speler=1&kanaal=proef` en `?speler=2&kanaal=proef`.

De fixture is duidelijk als test gemarkeerd en gebruikt alleen een lokale BroadcastChannel. Ze registreert geen accounts, verstuurt geen uitnodigingen en test geen echte camera's of Supabase-verbinding. Gebruik twee browserprofielen voor verschillende bewaarde voorkeuren; tabbladen binnen hetzelfde profiel delen de opslag.

## Controles

`node tests/kaart/test-koningsjacht-scene.mjs` test beweging, reduced motion, toestemming, vulmeters en opruimen. `node tests/kaart/test-koningsjacht-bier.mjs` test late join, verloren/oude/ongeldige berichten, opnieuw vullen en opruimen. Beide worden door `node tests/alle-tests.mjs` meegenomen.

De bestaande CI-browsertests `tests/tools/proef299.py` en `proef301.py` zijn uitgebreid voor de instellingen, bewaren, Engelse teksten en de gedeelde bierstand. Hiervoor is geen productie-databasewijziging nodig.
