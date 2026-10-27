# Neon Raiders: scorelijsten / leaderboards

## Voor Marcel

Neon Raiders wordt v4.0; de appversie wordt 218. Op PC wisselt een dubbelklik op het **eigen schip** tussen de bestaande sleepstand (vliegen en schieten zolang links ingedrukt is) en de volgstand (vliegen zonder ingedrukte knop, links om te schieten). De keuze blijft lokaal bewaard. Touch, toetsenbord, controller en de optionele autovuurinstelling blijven beschikbaar.

Voer **`sql/neon-raiders-scores.sql`** eenmalig uit in de Supabase SQL Editor en publiceer daarna de nieuwe bestanden. De migratie is herhaalbaar. Er zijn geen nieuwe omgevingsvariabelen, sleutels, buckets of Realtime-publicaties nodig. De bestaande tabellen `profiles`, `friendships`, `mijn_blokkades` en `blokkades`, plus `ben_ik_geblokkeerd()`, worden gebruikt.

Zonder migratie blijft spelen mogelijk en blijven nieuwe persoonlijke scores op het toestel staan. De scorelijst vermeldt dat online lijsten nog niet beschikbaar zijn. Bij het openen van de scorelijst of afronden van een volgende ronde probeert de app de wachtende scores opnieuw te versturen. Er wordt geen productie-SQL automatisch uitgevoerd vanuit de app of de tests.

- Links: de tien hoogste **afgeronde rondes** van het account, met datum en tijd.
- Rechts: de tien hoogste rondes van jezelf en je huidige wederzijds geaccepteerde, niet geblokkeerde vrienden. Meerdere rondes van dezelfde speler mogen erin staan.
- Wereldrecord: één hoogste score. Een onbekende recordhouder levert alleen het getal; geen account-id, ronde-id, gebruikersnaam, gekozen naam of tijdstip. Een recordhouder die jijzelf of een vriend is mag herkenbaar zijn.
- Een gelijkspel wordt deterministisch gesorteerd op oudste tijdstip, daarna account en ronde. Datum en tijd worden als UTC opgeslagen en in de tijdzone van de kijker weergegeven.
- Gekozen namen blijven op het toestel: eigen `fibro_profiel_<uid>.naam`, vriend `vriend_naam_<vriend>_<uid>`. Daarna volgt de gegenereerde `username`. `display_name` uit de database wordt hiervoor niet gebruikt of gekopieerd.

De browser krijgt alleen `SELECT` op eigen scorerijen via RLS. Invoegen gaat via een functie die de eigenaar uit `auth.uid()` afleidt; de verwachte account-id is een extra controle tegen een accountwissel tijdens het versturen. Geen clientrechten voor wijzigen of wissen. Een ronde-UUID maakt herhaling idempotent. Beëindigde vriendschappen en blokkades worden bij elk verzoek opnieuw gecontroleerd; vriendenlijsten worden niet lokaal gecachet.

Dit is een sociale scorelijst met door de game berekende scores, **geen fraudebestendig wedstrijdsysteem**. Een aangepaste browser kan een verzonnen score indienen. De database controleert grenzen, datum, eigenaar en rechten; cryptografische bewijzen van gameplay of een server die de volledige ronde afspeelt zijn niet aanwezig.

Persoonlijk blijven tien records bewaard; maximaal honderd nog niet verstuurde rondes blijven in de wachtrij (hoogste scores eerst bij langdurig offline gebruik). Iedere account en lokaal gastgebruik hebben aparte opslag. Een accountwissel tijdens een ronde draagt de score niet over. Als opslag is geweigerd of vol is, werkt de scorelijst gedurende de huidige pagina in het geheugen; de UI meldt dat bewaren op het toestel niet lukte. Oude enkele records hebben geen betrouwbare speeldatum en worden daarom niet met een verzonnen tijdstip in de nieuwe lijst gezet.

## API

`maakNeonScoreService({ supabase, storage?, now?, uuid?, isOnline? })`

- `captureOwner(): Promise<uuid|null>` — bij het starten van een ronde vastleggen.
- `saveRun({ id, ownerId, score, playedAt?, level?, won?, mode? })` — één stabiele UUID per ronde; `ownerId` is de bij de start vastgelegde waarde. Geeft `{ savedLocal, persisted, inMemory, synced, status, reason? }`.
- `loadBoards()` — `{ personal, friends, global, status, durable }`. Rijen: `{ id, score, playedAt, name, isSelf }`. Wereldrecord: `{ score }` met alleen bij bekenden optioneel `name`, `isSelf`, `playedAt`.
- Status: `online`, `offline` (tijdelijk niet te synchroniseren), `setup` (RPC/migratie ontbreekt), `local` (niet ingelogd). `durable:false` betekent dat de huidige gegevens alleen in het paginageheugen konden worden bewaard.

## Tests

```powershell
node tests/neon/test-neon-scores.mjs
node tests/ui/test-neon-mouse.mjs
node tests/ui/test-neon-scoreboard.mjs
```

Browserproeven: `tests/fixtures/neon-game-preview.html` gebruikt het echte spel met uitsluitend nep-scoreopslag en een duidelijk TEST-label. Met Onkwetsbaar kun je rustig beide muisstanden proberen; Ronde afronden controleert eenmalig bewaren. `tests/fixtures/neon-scores-preview.html` bevat tien verzonnen resultaten per kolom en verschillende verbindingsstaten. Deze fixtures sturen geen scores naar de database. Controleer daarnaast de echte startpagina via `spel.html?spel=shmup` (Scores-knop op het start- en eindscherm).

Voor de SQL-test: maak een **lege wegwerpdatabase**, voer daarin achtereenvolgens `tests/neon/neon-score-fixture.sql`, `sql/neon-raiders-scores.sql` (tweemaal voor herhaalbaarheid) en `tests/neon/test-neon-score-permissions.sql` uit met `psql -v ON_ERROR_STOP=1`. De fixture is uitsluitend voor een lege testdatabase; nooit in productie uitvoeren. De permissions-test gebruikt synthetische accounts en draait alle testdata terug.

De migratie en permissions-test zijn lokaal uitgevoerd met PostgreSQL 17. Controles: eigen RLS, geen directe schrijfrechten, anonieme/functierechten, onveranderlijke ronde-id, beste tien, invoergrenzen, accountwissel, wederzijdse vriendschap, blokkade, herkenbare bevriende recordhouder en volledig anonieme onbekende recordhouder.

## English handoff

Apply `sql/neon-raiders-scores.sql` in the Supabase SQL Editor before deploying. It is repeatable and uses the existing profile, friendship and blocking schema; no new secrets or infrastructure are required. Without the migration, gameplay and local personal results remain available and the UI explains that online rankings are not ready.

The two columns contain each account's best ten completed runs and the best ten runs among the viewer and current mutual, unblocked friends. The global result contains only a score for an unknown player; it includes no identity, run id or timestamp. Only a known friend or the viewer may be named. Chosen display names continue to come from existing local/P2P storage, falling back to `username`; they are never uploaded to the scoring table. Timestamps are stored in UTC and displayed locally.

All writes derive ownership from the authenticated JWT and check the account captured at run start. Clients cannot update or delete results; UUIDs make retries idempotent. In-flight responses from a previous account are discarded. Personal local results and pending submissions are separated per account. Blocked storage falls back to page memory and is reported honestly.

Scores are computed by the browser, so this is **not an anti-cheat system**. The server validates score/date bounds and access permissions, not a gameplay proof. Test the migration only in a disposable database using the fixture and permission test above; no live database was changed during implementation.

On desktop, double-click the player's own ship to toggle drag-to-fly/fire and mouse-follow with left-click fire. Touch, keyboard and controller support remain available. The two clearly marked browser fixtures above use synthetic score data only. The actual game exposes Scores on its start and end screens.

## Bronnen / sources

- [MDN: dblclick](https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event)
- [Supabase: database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
