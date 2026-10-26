# Setup: Fibro-map en snelkoppelingen / shortcuts

De aanvinkoptie staat uitsluitend op setup.html, nooit op Home. De drie afgeronde
registratiepaden bieden Verder met setup aan. De gebruiker kan de setup overslaan
of Open Fibro kiezen. Gewoon inloggen en sleutelherstel blijven naar Home gaan.

## Standaardactie

Aanvinken voert meteen de actie uit, zonder mapkiezer of toestemmingsvraag:

1. Lees een eerder gekozen directory-handle uit IndexedDB (fibro_shortcuts).
2. Alleen als queryPermission(readwrite) al granted is, maak een nieuwe Fibro-map
   in die toegestane map. Bestaande mappen/bestanden worden niet overschreven.
3. Zonder bruikbare toegang of bij schrijffout: download direct Fibro-shortcuts.zip.
   De tekst zegt dat de browser de downloadlocatie bepaalt en dat de gebruiker de
   Fibro-map op het bureaublad kan uitpakken. Een download is geen installatie.
4. Pas na stap 3 verschijnt Map kiezen, mits de browser de API ondersteunt.
   Alleen die expliciete knop opent showDirectoryPicker, met startIn: desktop.
   Na een geslaagde schrijfbeurt wordt de gekozen handle bewaard voor hergebruik.

De webapp kan niet onbevraagd een OS-bureaubladpad verkrijgen of daar schrijven.
Een eerder verleende browsertoegang kan vervallen. Er wordt nooit automatisch
requestPermission aangeroepen. Geen OPFS-map wordt voorgesteld als bureaubladmap.
Geen scripts, installers of beveiligingsomzeilingen worden gedownload/uitgevoerd.

Mobiel: download levert gewone links op. Browser/OS beheren beginschermiconen en
mappen. Setup geeft de handmatige stappen; de app claimt geen automatische plaatsing.
Het pakket bevat alleen openbare links en Fibro-iconen, geen privésleutel, account-id,
sessie, herstelcode of inloggegevens. login.html#herstellen opent alleen Herstel.

## Controle

- node tests/onboarding/test-shortcuts.mjs
- node tests/onboarding/test-setup-shortcuts.mjs
- node tests/onboarding/test-shortcut-folder-store.mjs
- node tests/security/test-key-recovery.mjs

Browserfixture: tests/onboarding/setup-shortcuts-preview.html?case=download
(ook remembered, denied, failure, choose, mobile). De fixture simuleert handles en
onderschept downloads. Verwachting: standaardactie picker=0 en requests=0;
remembered schrijft 8 bestanden zonder download, denied/failure downloaden,
Map kiezen verschijnt pas na de fallback en gebruikt desktop als startlocatie.

## English

The checkbox is Setup-only. Completed signup flows link to Setup; normal login and
key recovery are unchanged. Checking immediately reuses an already granted saved
directory handle or downloads the portable ZIP. The folder-picker fallback is
revealed only when direct placement is unavailable or fails. The explicit picker
starts at Desktop. Browser download settings control where the ZIP is saved.
No silent desktop-access or mobile-icon-installation claim is made.

## Browser documentation

- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
- https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=en-GB
