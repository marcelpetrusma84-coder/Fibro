# Koningsjacht: resultaten en eindscènes

Jouw top 10, de top 10 van jou en je vrienden en het algemene Stekky-record gebruiken dezelfde presentatie en privacyregels als Neon Raiders. Hoofdscore: verslagen wachters (0–12), daarna het eerst behaalde tijdstip. Niveau en spelvorm staan erbij; de lijst bevat alle niveaus en spelvormen. Een wedstrijd winnen met minder dan 12 wachters is geen voltooid kasteel. Samen spelen registreert de gezamenlijke voortgang voor iedere deelnemer.

Een ronde heeft lokaal een UUID en de account-eigenaar van het begin. Verder spelen behoudt die identiteit; een nieuwe partij krijgt een nieuwe UUID. Herhaalde eindmeldingen leveren geen dubbele scores op. Offline resultaten blijven lokaal en worden bij het volgende opslaan/openen van Scores opnieuw aangeboden. Dit is client-side scoreopslag zoals bij Neon Raiders, geen server-gevalideerd anti-cheatsysteem.

## Database — apart uitvoeren na goedkeuring

Voer `sql/koningsjacht-scores.sql` uit in de Supabase SQL Editor. Deze PR voert geen productiemigratie uit. Zonder de migratie werken de eigen scores lokaal; de interface meldt dat gedeelde lijsten nog worden klaargezet. De eigen tabel en RPC's wijzigen Neon Raiders niet. De client kan geen andere eigenaar kiezen. Alleen wederzijds geaccepteerde, niet-geblokkeerde vrienden krijgen namen te zien; het algemene record van een onbekende bevat geen naam, ID of tijdstip.

## Eindbeelden

Vier oorspronkelijke, met imagegen gemaakte illustraties van exact hetzelfde tafereel vormen de tussenstanden 0, 4, 8 en 12. De renderer mengt tussen naburige standen; dertien posities zijn bereikbaar. Het vaandel toont exact één gouden wapenschild per verslagen wachter. De paardverzorging, mantel, kasteelschade en vlaggen verbeteren naar de gekozen feestelijke aankomst bij 12/12. Vier WebP-bestanden samen circa 2 MB. Geen externe afbeeldingen of AI-aanroepen tijdens het spelen.

Bekijk `tests/fixtures/koningsjacht-eindscene-preview.html` met de slider 0–12. Dit voorbeeld schrijft geen scores en maakt geen netwerkverbinding met Supabase.

## Spelfeedback

De vier immuniteitssymbolen zijn groter met reliëf en contrastrand. Alleen Koningsjacht schakelt de variabele stapelhoogte en de vloeiend oplopende én aflopende Taveerne-teller in; +/− maakt de richting duidelijk. Bij een vijandelijke aanval blijft het schild staan totdat de drie klauwhalen zijn opgevangen. Bij gedeeltelijke bescherming vermeldt de melding de resterende schade. Zonder schild gebruikt de aanval de bestaande klauwhalen.

## Controleren

- `node tests/kaart/test-koningsjacht-scores.mjs`
- `node tests/ui/test-neon-scoreboard.mjs` (gedeelde UI blijft compatibel)
- `node tests/alle-tests.mjs`
- Browser: eindscène op 0, 1, 8 en 12; Scores openen en sluiten; nieuwe partij vs. verder spelen; drie stijlen, 320px breedte; schild 0 / gedeeltelijk / volledig; Taveerne laten toenemen en afnemen.

Controleer de volledige GitHub-testresultaten vóór mergen. Niet-afgeronde browsercontroles zijn geen geslaagde controles.
