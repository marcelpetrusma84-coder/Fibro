-- controle-alles.sql (Fibro, 2 nov 2026): welke SQL-bestanden uit de map sql/ zijn al uitgevoerd?
-- Plakken in Supabase > SQL Editor > Run. Dit bestand verandert NIETS, het kijkt alleen.
-- Per bestand: kijkt of wat dat bestand maakt (tabel, kolom, functie, trigger, regel) in de database staat.
-- Uitkomst: eerst wat nog ontbreekt (❌ nog doen), daarna wat er al is (✅ gedaan).
-- Een ❌ uitvoeren kan geen kwaad: alle bestanden mogen opnieuw. Voer ze uit in de volgorde van de lijst.
with kolom(tabel, naam) as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
), trig(naam) as (
  select tgname from pg_trigger where not tgisinternal
), regel(tabel, naam) as (
  select tablename, policyname from pg_policies
), lijst(volgorde, bestand, gedaan) as (values
  ( 1, 'toon-online.sql',             exists (select 1 from kolom where tabel = 'profiles' and naam = 'toon_online')),
  ( 2, 'vriendschap-rechten.sql',     not exists (select 1 from regel where tabel = 'friendships' and naam = 'Vriendschap beheren')),
  ( 3, 'profielrechten.sql',          exists (select 1 from trig where naam = 'bescherm_profielrechten')),
  ( 4, 'fibro-plus-afschermen.sql',   coalesce(pg_get_functiondef(to_regprocedure('public.bescherm_profielrechten()')) like '%is_plus%', false)),
  ( 5, 'blokkeren.sql',               to_regclass('public.blokkades') is not null),
  ( 6, 'blokkade-melding.sql',        to_regprocedure('public.mijn_blokkade()') is not null),
  ( 7, 'persoonlijk-blokkeren.sql',   to_regclass('public.mijn_blokkades') is not null),
  ( 8, 'persoonlijk-blokkeren-2.sql', to_regprocedure('public.verwijder_geblokkeerde(uuid)') is not null),
  ( 9, 'persoonlijk-blokkeren-3.sql', coalesce(pg_get_functiondef(to_regprocedure('public.blokkeer_persoon(uuid)')) like '%''blocked''%', false)),
  (10, 'rechten-ronde2.sql',          exists (select 1 from regel where tabel = 'guestbook_entries' and naam = 'Gastenboek schrijven als vriend')),
  (11, 'poll.sql',                    to_regclass('public.poll_tellers') is not null),
  (12, 'passkey-kluis.sql',           to_regclass('public.passkey_kluis') is not null),
  (13, 'ongelezen.sql',               to_regclass('public.laatst_gelezen') is not null),
  (14, 'berichten-verwijderen.sql',   to_regclass('public.verborgen_berichten') is not null),
  (15, 'account-verwijderen.sql',     to_regprocedure('public.verwijder_mijn_account(text)') is not null),
  (16, 'berichten-bewaren.sql',       exists (select 1 from kolom where tabel = 'profiles' and naam = 'bewaar_dagen')),
  (17, 'taal.sql',                    exists (select 1 from kolom where tabel = 'profiles' and naam = 'taal')),
  (18, 'belregels.sql',               coalesce(pg_get_functiondef(to_regprocedure('public.ongelezen_per_vriend()')) like '%oproep:gemist%', false)),
  (19, 'foto-etiketten.sql',          exists (select 1 from kolom where tabel = 'profiles' and naam = 'avatar_versie')),
  (20, 'profiel-versie.sql',          exists (select 1 from kolom where tabel = 'profiles' and naam = 'profiel_versie')),
  (21, 'profielvelden.sql',           exists (select 1 from trig where naam = 'bescherm_online')),
  (22, 'realtime-kanalen.sql',        exists (select 1 from regel where tabel = 'messages' and naam = 'fibro_realtime_lezen')),
  (23, 'foutmeldingen.sql',           to_regclass('public.foutmeldingen') is not null),
  (24, 'terugmeldingen.sql',          to_regclass('public.terugmeldingen') is not null),
  (25, 'schaken-drie-spelers.sql',    to_regclass('public.chess_three_sessions') is not null),
  (26, 'neon-raiders-scores.sql',     exists (select 1 from kolom where tabel = 'neon_raiders_scores' and naam = 'level')),
  (27, 'registratie-schakelaar.sql',  to_regclass('public.registratie_instelling') is not null),
  (28, 'minimumleeftijd.sql',         exists (select 1 from trig where naam = 'fibro_leeftijd_controle')),
  (29, 'uitnodigingen-grens.sql',     to_regprocedure('public.uitnodiging_vol(text)') is not null)
)
select case when gedaan then '✅ gedaan' else '❌ nog doen' end as stand, bestand
  from lijst
 order by gedaan, volgorde;
