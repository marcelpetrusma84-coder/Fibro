# Fibro lokaal testen met Playwright

Deze tests openen Home, Vrienden, Chat en Stijl. Ze gebruiken een **lokaal nagebootste testserver** met een fictieve uitnodiger en testaccounts. Externe verbindingen worden geblokkeerd. Dit test de schermen en de aanmeldstroom; de echte Supabase-server, beveiligingsregels en verbindingen worden hiermee niet getest.

De testbestanden staan in `_PLAYWRIGHT` naast `.vscode` en `android`. De korte voorbereiding staat in `quick-login.setup.js`, de uitgebreide aanmelding in `first-login.setup.js` en de vier paginatests in `tests/navigation.spec.js`.

## Klaarzetten en starten

Open een terminal in deze map en voer uit:

```powershell
npm install
npm run test:headed
```

Standaard bereidt de korte route automatisch een fictieve gebruiker en sessie in de lokale nabootsing voor. Daarna opent één browser Home en klikt achtereenvolgens op Vrienden, Chat en Stijl. De vier controles blijven apart zichtbaar in het resultaat en iedere pagina blijft even in beeld. De inlog- en registratieschermen worden daarbij niet doorlopen. De testgegevens, inclusief gebruikersnaam, wachtwoord en herstelcode, zijn leesbaar in `test-account.quick.local.json`; de sessie staat in `auth-state.quick.local.json`. Git negeert deze lokale bestanden.

Een volgende run gebruikt dezelfde lokale testsessie. Met dit commando begin je opnieuw en maak je automatisch een nieuwe eenmalige lokale uitnodiging:

```powershell
npm run test:fresh
```

Dit verwijdert de lokale gegevens van de korte en uitgebreide testaccounts, hun sessies en de nagebootste server. De eerdere echte testaccountgegevens en de eerder aangeleverde uitnodiging in `invite.local.txt` blijven staan; die link wordt door deze lokale tests niet gebruikt.

## Uitgebreide aanmelding en uitnodiging automatisch testen

```powershell
npm run test:full
```

Dit gebruikt de uitgebreide voorbereiding uit `first-login.setup.js`: bij een eerste run doorloopt Chrome de lokale uitnodiging en registratie, slaat de herstelcode op en voert daarna de vier paginatests uit. Volgende runs hergebruiken de aparte uitgebreide testsessie. De lokale gegevens staan in `test-account.mock.local.json` en `auth-state.mock.local.json`.

De uitnodiging en registratie zijn ook als zelfstandige automatische browsertest te draaien, zonder zelf te klikken:

```powershell
npm run test:registration
```

Met `npm run test:all` voer je voorlopig de vier navigatietests uit, met de korte voorbereiding. De uitnodigings- en registratietest is tijdelijk uitgeschakeld in `test:all` en kan afzonderlijk worden gestart met `npm run test:registration`. Deze lokale nabootsing is geen test van de echte Supabase-server.

De automatische sessielader op het inlogscherm heeft eigen tests voor vervagen, doorgaan naar Home, herstel, geen opgeslagen sessie en verminderde beweging:

```powershell
npm run test:login-session
```

## Herbruikbare lokale uitnodiging proberen

```powershell
npm run test:invite
```

In de zichtbare lokale testomgeving opent Vrienden met het uitnodigingsvenster. Houd **7 dagen** vijf seconden vast, vul de testcode **1234** in en kies **Testlink maken**. Kies **Open als nieuwe testgebruiker** om de link in een schoon testvenster te openen; dat kun je herhalen. De test blijft wachten terwijl je dit doet; sluit het uitnodigingsvenster en kies **Test beëindigen**, of sluit het oorspronkelijke browsertabblad, om te stoppen. De testcode is een bediening voor deze nagebootste omgeving, geen beveiliging voor de echte app. De link werkt alleen binnen de actieve Playwright-test; een normale browser gebruikt de lokale nabootsing niet.

De configuratie start een lokale webserver op poort 8136 en gebruikt Google Chrome. De server stopt na de tests.

## PrivacyLink en uitnodigingen

```powershell
npm run test:privacy
```

De test gebruikt een verzonnen Fibro-uitnodiging en een nagebootst API-antwoord. Zo controleert hij het doorgeven van de volledige uitnodiging, inclusief het gedeelte na `#`, en het afhandelen van API-fouten. Dit is een proef in de testmap; Fibro verstuurt hiermee nog niet automatisch uitnodigingen via PrivacyLink.

De PrivacyLink Third-Party API vermeldt dat de beheerder aangeleverde berichten en toegangscodes tijdens verwerking technisch kan inzien. Een Fibro-uitnodiging houdt bovendien haar eigen vervaltijd en gebruiksbeperking. Zie de [API-specificatie](https://api.privacylink.nl/openapi.yaml).

De test tegen de echte API is apart aan te zetten. Vul een eigen API-sleutel uitsluitend in de terminal in; deze wordt niet in de testbestanden opgeslagen. Die test maakt een echt PrivacyLink-geheim aan met een verzonnen uitnodiging:

```powershell
$env:PRIVACYLINK_LIVE = '1'
$env:PRIVACYLINK_API_KEY = 'HIER_JE_API_SLEUTEL'
npm run test:privacy
Remove-Item Env:PRIVACYLINK_API_KEY
Remove-Item Env:PRIVACYLINK_LIVE
```
