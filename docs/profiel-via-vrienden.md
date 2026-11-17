# Profiel via vrienden (plan, 17 nov 2026)

**Wens van Marcel:** heeft een vriend zijn profiel bijgewerkt, maar ben je niet tegelijk online, dan haal je het
nieuwe profiel op via een gezamenlijke vriend die het al wél heeft.

**Nu:** foto's, muziek, video en stickers gaan alleen rechtstreeks van telefoon naar telefoon (sync.js), als je
tegelijk online bent. Naam, indeling en kleine widgets gaan ook versleuteld via de server (postbus.js).

## Veiligheid
- **Handtekening.** De eigenaar ondertekent een lijstje van zijn profielonderdelen, elk met een SHA-256
  (`profielhandtekening.js`). Hij gebruikt daarvoor zijn bestaande chatsleutel, dus er komt geen nieuwe sleutel bij.
  Een tussenpersoon die iets verandert, weglaat of toevoegt, valt door de mand.
- **Juiste sleutel.** De ontvanger controleert met `profiles.public_key` van de eigenaar, met dezelfde
  vingerafdrukcontrole als de chat (`fibro_vriendsleutel_<ik>_<vriend>`). Is de sleutel veranderd, dan kan het niet via
  een vriend. Je wacht dan tot je de eigenaar zelf spreekt.
- **Geen oud profiel als nieuw.** De versie (tijd) staat in de handtekening. Een ontvanger neemt alleen een nieuwere
  versie aan dan wat hij al heeft.
- **Alleen voor vrienden van de eigenaar.** De tussenpersoon geeft het profiel alleen als de server bevestigt dat de
  vrager ook een vriend van de eigenaar is (`sql/profiel-via-vrienden.sql`, `deelt_vriend`). Geblokkeerd of de
  vriendschap opgezegd telt als geen vrienden meer.
- **Wat je wel moet weten:** wie het vraagt en wie het geeft, weten daardoor van elkaar dat ze een gezamenlijke vriend
  hebben. Een tussenpersoon ziet niets wat hij als vriend van de eigenaar niet al had.

## Stappen (elk een eigen pull request)
1. **Handtekening** (#196): `profielhandtekening.js` en tests. Er verandert nog niets in de app.
2. **Supabase:** `sql/profiel-via-vrienden.sql` uitvoeren, alleen na toestemming van Marcel of Tijn.
3. **Ondertekenen bij het rechtstreeks synchroniseren:** de eigenaar stuurt zijn ondertekende lijstje mee. Ontvangers
   bewaren het naast zijn onderdelen (`vriend_<id>_handtekening`).
4. **Doorgeven** (`doorgeven.js`): bij een rechtstreekse verbinding tussen B en C werkt het zo:
   - B vraagt per vriend aan de server `deelt_vriend(A, C)`.
   - Alleen bij "ja" biedt B het lijstje van A aan, met het manifest (veld `doorgeven`, bericht `dg-lijst`).
   - C controleert of A haar vriend is, de handtekening en de onthouden vingerafdruk, en of het lijstje nieuwer is
     dan wat ze al had (ook dan haar laatste rechtstreekse sync met A).
   - C vraagt alleen wat ze nog niet (zo) heeft (`dg-geef`). Elk onderdeel (`dg-chunk`) moet precies passen bij de
     SHA-256.
   - Het lijstje bewaart C pas als alles klopte. Dan kan zij het ook doorgeven.
   - Video gaat niet mee. Muziek gaat niet via een relay.
   - Wat A weghaalde, verdwijnt pas bij de volgende rechtstreekse sync met A.
5. **Browsertests** voor de hele route A → B → C, met een vervalste foto en een oud profiel.

Dit kost de server bijna niets. De onderdelen gaan van telefoon naar telefoon, net als nu.
