# Fibro als Android-app (APK)

De app is een *Trusted Web Activity*. Hij opent https://marcelpetrusma84-coder.github.io/Fibro/
in Chrome, maar ziet eruit als een gewone app met een eigen icoon. De website zelf zit niet in de APK.
Een wijziging aan Fibro is daardoor meteen in de app te zien. Een nieuwe APK is alleen nodig als
het icoon, de naam of de kleuren van de app veranderen.

## Een APK maken

1. Eenmalig: zet bij GitHub > Settings > Secrets and variables > Actions twee geheimen:
   - `FIBRO_APK_KEYSTORE`: de Fibro-sleutel als base64-tekst
   - `FIBRO_APK_WACHTWOORD`: het wachtwoord van die sleutel
2. Ga naar Actions > Android-APK > Run workflow.
3. Na een paar minuten staat onderaan de run, bij Artifacts, `fibro-apk-fibro`. Dat is een zip
   met `fibro-fibro.apk` erin.
4. Zet die APK op de telefoon en open hem. Android vraagt dan om "installeren uit onbekende bron" toe te staan.

Bewaar de sleutel goed. Een nieuwe APK installeert alleen over de oude heen als hij met dezelfde
sleutel is ondertekend.

## Zonder adresbalk

Android laat de app pas zonder adresbalk bovenin zien als de website de app "kent". Daarvoor moet
`assetlinks.json` (in deze map) bereikbaar zijn op:

    https://marcelpetrusma84-coder.github.io/.well-known/assetlinks.json

Dat is de hoofdmap van het domein, niet /Fibro/. Er is dus een aparte repo nodig met de naam
`marcelpetrusma84-coder.github.io`. Daarin komen `.well-known/assetlinks.json` en een leeg
bestand `.nojekyll`. Zonder die repo werkt de app ook, maar dan met een smalle adresbalk bovenin.

## Gegevens

- Pakketnaam: `nl.fibro.app`
- Vingerafdruk van de sleutel (SHA-256): `52:BF:92:FB:79:E4:99:8E:E0:C4:A8:6E:D9:E3:5A:BE:55:94:D7:07:77:72:7A:EE:8A:FF:CC:2A:B6:E2:72:CF`
- Gemaakt met Bubblewrap (`twa-manifest.json`). Versie ophogen: `versionCode` en `versionName`
  in `app/build.gradle`.

## App en webapp naast elkaar

De APK vervangt de webversie niet. Fibro in de browser, of als icoon op het startscherm via
"Toevoegen aan startscherm", blijft gewoon werken. Links naar Fibro, bijvoorbeeld een uitnodiging
in WhatsApp, openen in de browser en niet in de app, omdat de app geen link-filter heeft. De app
opent alleen via zijn eigen icoon. Op dezelfde telefoon gebruiken de app en Chrome dezelfde gegevens,
zoals de inlog en de sleutels.
