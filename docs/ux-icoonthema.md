# UX en icoonthema's

In **Stijl → UX** (voorheen Kleur) blijven de bestaande accentkleuren, blokinstellingen en live preview staan. De laatste sectie, **Icoonthema**, biedt twee radiokeuzes met ieder drie voorbeelden van Home, Vrienden en Chat:

- **Modern**: de bestaande lijniconen, standaard voor een apparaat zonder voorkeur.
- **Nostalgia**: de oorspronkelijke kleurrijke emoji-iconen.

De keuze geldt direct voor de onderste navigatie, de Stijl-tabs en de knoppen voor emoji, stickers, spellen, foto's en spraak in Chat en groepschat. Spelillustraties, avatars en berichtinhoud veranderen niet. De bestaande knoppen, labels, klikacties en ongelezen-badges blijven behouden.

`icoonthema.js` bewaart alleen `modern` of `nostalgia` onder `fibro_icoonthema` in de lokale browseropslag. Er is geen databasewijziging en de instelling wordt niet naar andere apparaten gesynchroniseerd. Een ontbrekende of ongeldige waarde valt terug op Modern; geblokkeerde opslag veroorzaakt geen paginafout. Andere tabbladen op dezelfde browser volgen de keuze via het storage-event.

De gedeelde controller en `icoonthema.css` worden op de zes betrokken pagina's geladen. De iconen worden al toegepast wanneer de HTML klaar is, zonder te wachten op netwerkafhankelijke modules. De bestaande interne IDs `tab-kleur` en `panel-kleur` blijven behouden voor compatibiliteit; alleen de zichtbare tabtitel heet UX. De twee voorbeeldsets blijven altijd naast elkaar zichtbaar, ongeacht het gekozen thema.

## Controleren

`node tests/ui/test-icoonthema.mjs` controleert de voorkeur, laden vóór DOMContentLoaded, wisselen, opslagfouten, meerdere tabbladen en behoud van labels/meldingen.

De bestaande CI-browsertest `python -I tests/tools/proef276.py .` controleert daarnaast beide talen, drie voorbeelden per keuze, telefoonbreedte, radiotoetsen, herladen en navigeren tussen de echte pagina's.
