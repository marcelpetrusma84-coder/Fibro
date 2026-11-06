# Versies en historie van spellen

`spelversie-data.js` is de enige bron voor het huidige nummer en de historie van
elk spel. Home en Stijl lezen dezelfde gegevens. Op Home blijft de spelkaart
compact; houd een kaart drie seconden vast om de versie, tijd, tussenpoos en
omhoog/omlaagknoppen voor oudere en nieuwere versies te tonen. Een korte tik
blijft het spel openen. Cacheversies in import-URL's en de algemene
Fibro-appversie blijven afzonderlijke technische tellers.

## Nummering

Sla versies op als tekst in de vorm `major.minor.patch`, bijvoorbeeld `6.1.0`.
De zichtbare badge verbergt alleen een lege patch: `v6.1`; een echte patch blijft
zichtbaar als `v6.1.1`. Gebruik nooit optellen met `0.1`: `6.10` is de tiende
minorversie en verschilt van `6.1`.

- **Patch**: foutcorrectie zonder nieuwe spelmogelijkheden, bijvoorbeeld 6.1.1.
- **Minor**: een toevoeging of verbetering, bijvoorbeeld 6.2.0.
- **Major**: een grote spelregelwijziging of fundamenteel andere spelvariant.

De al gepubliceerde oude majorversies worden niet achteraf hernummerd.

Schaken 6.1 voegt paardroutes na 2 seconden vasthouden, sterker contrast en de
vernieuwde versiehistorie toe. Dit zijn verbeteringen binnen dezelfde
spelvariant en daarom een minorversie.

Schaken 6.1.1 verfijnt de schaakmatweergave: de tekst begint op halve grootte
en zoomt naar de bestaande volle grootte. De fade en totale duur blijven gelijk.

Schaken 6.2 voegt live instellingen voor paardroutes toe: 1–4 sprongen,
5–100% zichtbaarheid en onafhankelijke schakelaars per sprongkleur. Het
onderzochte paard krijgt een highlight; het beginvak krijgt geen
routemarkering. Ultra krijgt een driedubbele hintdruk voor een echte legale zet
met controleerbare uitleg, pijl en demonstratie. Een gewone tik houdt de korte
stukhint. De hint gebruikt een zwart-wit-cyaan omlijsting, ook wanneer een
aangevallen stuk rood is gemarkeerd.

Schaken 6.3 voegt de uitgebreide Ultra-hint met uitleg toe. Op Home blijft de
versiehistorie van alle spellen verborgen tot je een spelkaart drie seconden
vasthoudt; de spelversie en pijlen verschijnen dan zonder een normale tik te
veranderen in een spelstart.

## Waar de datum vandaan komt

De bestaande historische gegevens zijn nagegaan in de eerste-oudergeschiedenis
van `main` voor `spelversies.js`. `updatedAt` is de ISO-datum met tijdzone van de
commit die dat versienummer op main introduceerde. `sourceCommit` bewaart de
volledige commit-ID. Dit is een aantoonbaar tijdstip van de code-update, geen
bewering over de exacte Netlify-deploymenttijd.

De oudste gegevens stammen uit de start van de registratie op 21 oktober 2026.
`firstRecorded:true` betekent daarom ‘eerste vastgelegde versie’, niet dat het
spel toen pas gemaakt of uitgebracht werd. Niet vastgelegde oudere versies en
een onbekende voorgaande tussenperiode worden niet verzonnen.

Voor een nieuwe versie wordt eerst de implementatie gecommit. Neem daarna het
echte committertijdstip en de hash van die commit op in het nieuwe record.
Een tijdelijke preview-entry mag datum en hash nog niet hebben; vóór overdracht
worden die ingevuld. Een metadata-aanpassing kan vervolgens apart worden
gecommit. De array blijft van nieuw naar oud gesorteerd en wordt niet op de
actuele klok herordend.

## English

The canonical model stores full semantic version strings and immutable history
records. Minor releases cover additions; patch releases cover fixes. Existing
historical major numbers are preserved. Do not use floating-point increments.

Home game cards stay compact until held for three seconds. Then the same version
history used in Style appears, including its timestamp, interval and newer/older
controls; a normal tap still opens the game.

Chess 6.3 adds a detailed Ultra hint with a legal suggested move and explanation.
The hint gets a distinct black, white and cyan frame even when the piece is red
to indicate that it is under attack.

Historical timestamps identify the first-parent main commit that introduced
each recorded number, with the full commit hash retained as evidence. They are
code-update timestamps, not exact deployment times. Baseline entries identify
the start of registration and never invent a game's original creation date.
