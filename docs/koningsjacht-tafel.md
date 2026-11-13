# Koningsjacht: tafel, instellingen en bierpullen

Het tandwiel op het beginscherm en op de speeltafel opent de instellingen. Deze worden op het toestel bewaard in `fibro_koningsjacht_instellingen`.

- Drie aparte keuzeknoppen voor de tafelsfeer: **Standaard**, **Modern** en **Middeleeuws**. Standaard houdt de houttafel en perkamentkaarten. Middeleeuws gebruikt de studeerkamer en eigen kandelaars. Modern krijgt een blauwe/gouden epoxytafel, links een opengewerkte gouden kandelaar, rechts een champagneglazen kandelaar met kaars, en een zwart-gouden kaartenset. Wisselen tijdens een partij bewaart de hand, selectie en spelstand.
- Subtiele achtergrondbeweging met muis of telefoonsensor; standaard uit. iOS vraagt toestemming na de tik. De kaartbediening blijft stil. Verminderde beweging van het toestel wordt gerespecteerd.
- Realistische kandelaars met apart bewegende vlammen. Flikkeren staat standaard aan; de bestaande kaarsknop blijft al het kaarslicht uitzetten.
- Optionele bierpul (standaard uit): keramiek op de normale tafel, hout bij de middeleeuwse scene. Sleep of tik rechtstreeks op je eigen pul om de inhoud aan te geven. Muis, vinger en toetsenbord werken; de pul vangt alleen zijn eigen sleepbeweging op. De geel-oranje niveaumeter blijft zichtbaar, zonder percentage op tafel of in de instellingen. Bij minimaal 95% verschijnt schuim boven de rand; bij lage niveaus is het schuim weg, ook bij de houten pul.
- De moderne scene heeft een doorzichtige glazen pul met een daadwerkelijk veranderende bierlaag achter het glas en schuim bij een volle pul. Glas en vloeistof draaien samen als de oorstand wisselt.
- De middeleeuwse scene kiest een eigen 6/8-arrangement met luit, fluit, tamboer en tamboerijn. Dit is lokaal gesynthetiseerde muziek. De bestaande muziekknop bepaalt of muziek klinkt; een scenewissel zet uitgeschakelde muziek niet alsnog aan.
- **Nieuwe volle pul** en rechtstreeks dubbelklikken (pc) of dubbeltikken (mobiel) vullen naar 100%, wisselen de oorstand en animeren de vervanging. Je begint bij pul #1. Elke nieuwe pul verhoogt de teller; het nieuwe nummer verschijnt twee seconden, ook bij de medespeler. De verse glazen pul heeft een dikkere schuimkraag van ongeveer twee vingers. Dit werkt in alle drie tafelstijlen.

De beelden zijn speciaal gegenereerde lokale spelassets. De achtergrond is een foto met parallax en de kandelaars/pullen zijn transparante sprites; dit is geen volledig 3D-model met vrij draaibare camera. De moderne kaarten worden als zelfstandige SVGs getekend. Deze stijl overschrijft geen globale kaartvoorkeur bij andere spellen; de gedeelde kaarthelper houdt de bestaande stijlen beschikbaar.

## Multiplayer en webcam

`koningsjacht-bier.js` gebruikt het bestaande spelkanaal, los van de spelregels. Elk bericht bevat de eigen speler, zichtbaarheid, inhoud, oorstand, pulnummer en oplopende versie. Ongeldige berichten, eigen echo's en oudere standen worden genegeerd. Een nieuwe deelnemer vraagt de stand op; volledige standen worden bovendien iedere vijf seconden herhaald om gemiste berichten te herstellen. Dit werkt in samen, wedstrijd, duel en belegering. Het is handmatig ingestelde aanwezigheid, geen detectie van echt drinken.

De bestaande webcamondersteuning van Koningsjacht blijft beschikbaar via het gedeelde spelmenu in de chat, met dezelfde ronde videokaders en belverbinding als schaken. Deze wijziging vervangt de mediaverbinding niet.

## Zelf proberen

Start vanuit de projectmap een lokale server (`python -m http.server 8131`).

- Alleen: `http://127.0.0.1:8131/tests/fixtures/koningsjacht-preview.html`
- Twee lokale testspelers: open die pagina in twee tabbladen met respectievelijk `?speler=1&kanaal=proef` en `?speler=2&kanaal=proef`.

De fixture is duidelijk als test gemarkeerd en gebruikt alleen een lokale BroadcastChannel. Ze registreert geen accounts, verstuurt geen uitnodigingen en test geen echte camera's of Supabase-verbinding. Gebruik twee browserprofielen voor verschillende bewaarde voorkeuren; tabbladen binnen hetzelfde profiel delen de opslag.

## Controles

`node tests/kaart/test-koningsjacht-scene.mjs` test beweging, reduced motion, toestemming, touchbediening, toetsenbord, schuim en opruimen. `node tests/kaart/test-koningsjacht-bier.mjs` test late join, verloren/oude/ongeldige berichten, opnieuw vullen en opruimen. `node tests/kaart/test-koningsjacht-muziekthema.mjs` test de instrumenten, de muziekvoorkeur, pauzeren en het opruimen bij themawissels. Alle drie worden door `node tests/alle-tests.mjs` meegenomen.

De bestaande CI-browsertests `tests/tools/proef299.py` en `proef301.py` zijn uitgebreid voor de instellingen, bewaren, Engelse teksten en de gedeelde bierstand. Hiervoor is geen productie-databasewijziging nodig.
