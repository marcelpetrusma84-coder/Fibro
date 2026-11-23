# Koningsjacht: resultaten en eindscènes

Jouw top 10, de top 10 van jou en je vrienden en het algemene Stekky-record gebruiken dezelfde presentatie en privacyregels als Neon Raiders. Hoofdscore: verslagen wachters (0–12), daarna het eerst behaalde tijdstip. Niveau en spelvorm staan erbij; de lijst bevat alle niveaus en spelvormen. Een wedstrijd winnen met minder dan 12 wachters is geen voltooid kasteel. Samen spelen registreert de gezamenlijke voortgang voor iedere deelnemer.

Een ronde heeft lokaal een UUID en de account-eigenaar van het begin. Verder spelen behoudt die identiteit; een nieuwe partij krijgt een nieuwe UUID. Herhaalde eindmeldingen leveren geen dubbele scores op. Offline resultaten blijven lokaal en worden bij het volgende opslaan/openen van Scores opnieuw aangeboden. Dit is client-side scoreopslag zoals bij Neon Raiders, geen server-gevalideerd anti-cheatsysteem.

## Database — apart uitvoeren na goedkeuring

Voer `sql/koningsjacht-scores.sql` uit in de Supabase SQL Editor. Deze PR voert geen productiemigratie uit. Zonder de migratie werken de eigen scores lokaal; de interface meldt dat gedeelde lijsten nog worden klaargezet. De eigen tabel en RPC's wijzigen Neon Raiders niet. De client kan geen andere eigenaar kiezen. Alleen wederzijds geaccepteerde, niet-geblokkeerde vrienden krijgen namen te zien; het algemene record van een onbekende bevat geen naam, ID of tijdstip.

## Eindbeelden

Vijf actieve illustraties van hetzelfde tafereel vormen de tussenstanden 0, 4, 6, 8 en 12. In de drie vroege beelden heeft de koning zijn zwaard verloren, houdt hij zijn hand op zijn been, zijn mond dicht en zijn blik recht vooruit. Daardoor blijft die houding zonder zwaard zichtbaar van 0 tot en met 6 verslagen wachters. Vanaf 7 begint de overgang naar de opgestoken arm van de feestelijke aankomst. De renderer mengt tussen naburige standen; dertien posities zijn bereikbaar. Het vaandel toont exact één gouden wapenschild per verslagen wachter. De paardverzorging, mantel, kasteelschade en vlaggen verbeteren naar 12/12. De drie aangepaste JPG-bestanden zijn samen circa 1,5 MB; de twee latere WebP-bestanden circa 1 MB. Geen externe afbeeldingen of AI-aanroepen tijdens het spelen.

Bekijk `tests/fixtures/koningsjacht-eindscene-preview.html` met de slider 0–12. Dit voorbeeld schrijft geen scores en maakt geen netwerkverbinding met Supabase.

Er zijn drie complete reeksen van elk vijf beelden. De bestaande reeks met het grote kasteel hoort bij een partij die met 0 narren begon. Bij 2 narren staat hetzelfde kasteel kleiner op de heuvel; bij 4 narren nog kleiner. De gekozen reeks komt van het aantal narren bij de start van de partij (`narren + narrenGebruikt`), zodat het gebruik van een nar de scène niet plotseling laat verspringen. De gezamenlijke stand met 1 nar gebruikt de reeks van 2 narren. Elke reeks behoudt de voortgang van 0 naar 12 wachters; in de eerste drie beelden blijft de koning zwaardloos en ingetogen. De preview laat alle drie de reeksen kiezen.

## Spelfeedback

De vier immuniteitssymbolen zijn groter met reliëf en contrastrand. Alleen Koningsjacht schakelt de variabele stapelhoogte en de vloeiend oplopende én aflopende Taveerne-teller in; +/− maakt de richting duidelijk. Bij een vijandelijke aanval blijft het schild staan totdat de drie klauwhalen zijn opgevangen. Bij gedeeltelijke bescherming vermeldt de melding de resterende schade. Zonder schild gebruikt de aanval de bestaande klauwhalen.

## Controleren

- `node tests/kaart/test-koningsjacht-scores.mjs`
- `node tests/ui/test-neon-scoreboard.mjs` (gedeelde UI blijft compatibel)
- `node tests/alle-tests.mjs`
- Browser: eindscène op 0, 1, 4, 5, 6, 7, 8 en 12; Scores openen en sluiten; nieuwe partij vs. verder spelen; drie stijlen, 320px breedte; schild 0 / gedeeltelijk / volledig; Taveerne laten toenemen en afnemen.

Controleer de volledige GitHub-testresultaten vóór mergen. Niet-afgeronde browsercontroles zijn geen geslaagde controles.
