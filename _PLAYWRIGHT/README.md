# Fibro lokaal testen met Playwright

Deze tests openen Home, Vrienden, Chat en Stijl. Ze gebruiken een **lokaal nagebootste testserver** met een fictieve uitnodiger en testaccounts. Externe verbindingen worden geblokkeerd. Dit test de schermen en de aanmeldstroom; de echte Supabase-server, beveiligingsregels en verbindingen worden hiermee niet getest.

De testbestanden staan in `_PLAYWRIGHT` naast `.vscode` en `android`. De aanmelding staat in `first-login.setup.js`, de vier paginatests in `tests/navigation.spec.js`.

## Klaarzetten en starten

Open een terminal in deze map en voer uit:

```powershell
npm install
npm run test:headed
```

Bij de eerste run wordt automatisch een nieuwe lokale uitnodiging gemaakt en wordt de registratie zichtbaar doorlopen. De lokale gegevens, inclusief gebruikersnaam, wachtwoord en herstelcode, staan leesbaar in `test-account.mock.local.json`. De sessie staat in `auth-state.mock.local.json`. De lokale servergegevens staan in `local-backend.local.json`. Git negeert deze bestanden. Iedere pagina blijft even in beeld.

Een volgende run gebruikt dezelfde lokale testsessie. Met dit commando begin je opnieuw en maak je automatisch een nieuwe eenmalige lokale uitnodiging:

```powershell
npm run test:fresh
```

Dit verwijdert de drie genoemde lokale mockbestanden. De eerdere echte testaccountgegevens en de eerder aangeleverde uitnodiging in `invite.local.txt` blijven staan; die link werd gebruikt voor de oorspronkelijke opzet met de echte server en wordt door deze lokale tests niet gebruikt.

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
