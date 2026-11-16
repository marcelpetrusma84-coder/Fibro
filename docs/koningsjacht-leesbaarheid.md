# Koningsjacht: leesbare hand en middeleeuwse materialen

Een selectie vergroot de kaarten zoals voorheen. Met `leesbareSelectie: true` reserveert de gedeelde kaarttafel van iedere kaart de volledige hoek met waarde én soort. De ruimte tussen kaarten wordt aangepast aan hun werkelijke schaal en stapelvolgorde. Op een smal scherm verdeelt de hand zich zo nodig over twee rijen. Tekst en kaarten worden daarbij niet verkleind. De logische handvolgorde blijft behouden; na wissen komt de gewone waaier terug.

`kaartwaaier.js` bevat de pure plaatsingsberekening. Koningsjacht schakelt deze in; de andere kaartspellen behouden hun bestaande handplaatsing. De aanraakvakken blijven tijdens een kijkbeweging op hun oorspronkelijke plek, zodat het uitwijken van de kaarten de kaart onder je vinger niet voortdurend verandert. Instellingen en eindschermen liggen boven de vergrote kaarten.

In de scene **Middeleeuws** zijn de randen en aflegbak van hout en ijzer, met warme kaars-/haardgloed. De drie tellers krijgen verweerde steen met uitgesneden symbolen en cijfers. De bestaande scene-klasse schakelt deze materiaalstijl uit bij Standaard of Modern. Kaartwaarden, spelstand en regels veranderen niet.

Proberen: `tests/fixtures/koningsjacht-hand-preview.html` heeft exact de voorbeeldhand met ♥9, ♠5 en ♥8 en een knop om beide harten te kiezen. Dit is een componenttest, geen echte partij. De bestaande `koningsjacht-preview.html` toont het volledige spel en de nieuwe tellers.

Validatie: `node tests/kaart/test-leesbare-waaier.mjs` controleert 18.424 combinaties (alle achtkaartselecties, loep, vier schermmaten, gewone/grote kaarten) op vrijliggende waarde-/soorthoeken. `python -I tests/tools/proef304.py .` controleert in de browser met daadwerkelijke raakpunten dat geen hogere kaart die hoeken bedekt, plus materialen, instellingenlaag en terugschakelen naar Modern.
