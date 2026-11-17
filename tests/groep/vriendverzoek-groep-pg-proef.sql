-- De eigenlijke proeven (na vriendverzoek-groep-pg.sql en sql/vriendverzoek-groep.sql). Elke regel 'ok: ...' of een fout.
create function pg_temp.als(n int) returns void language sql as $$ select set_config('test.uid', '00000000-0000-0000-0000-00000000000' || n, false) $$;
create function pg_temp.moet(ok boolean, wat text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FOUT: %', wat; end if; raise notice 'ok: %', wat; end $$;
\set G '\'10000000-0000-0000-0000-000000000001\''
\set M '\'00000000-0000-0000-0000-000000000001\''
\set B '\'00000000-0000-0000-0000-000000000002\''
\set L '\'00000000-0000-0000-0000-000000000003\''
\set K '\'00000000-0000-0000-0000-000000000004\''
\set J '\'00000000-0000-0000-0000-000000000005\''
-- de app kan niet zelf in de tabel
select pg_temp.moet(not has_table_privilege('authenticated', 'public.vriendverzoeken', 'select'), 'tabel dicht voor de app');
select pg_temp.moet(has_function_privilege('authenticated', 'public.vraag_vriend(uuid,uuid)', 'execute') and not has_function_privilege('anon', 'public.vraag_vriend(uuid,uuid)', 'execute'), 'vraag_vriend: alleen ingelogd');
select pg_temp.moet(not has_function_privilege('authenticated', 'public.maak_vrienden(uuid,uuid)', 'execute'), 'maak_vrienden niet zelf aan te roepen');
-- Marcel vraagt Bram
select pg_temp.als(1);
select pg_temp.moet(public.vraag_vriend(:B, :G) = 'verstuurd', 'Marcel vraagt Bram: verstuurd');
select pg_temp.moet(public.vraag_vriend(:B, :G) = 'verstuurd', 'nog eens: geen tweede verzoek');
select pg_temp.moet((select count(*) from public.vriendverzoeken) = 1, 'een verzoek in de tabel');
select pg_temp.moet((select richting || wie::text from public.mijn_vriendverzoeken()) = 'uit' || :B, 'Marcel ziet zijn verzoek (uit)');
select pg_temp.moet(not public.zijn_vrienden(:M, :B), 'nog geen vrienden');
-- iemand anders kan het verzoek niet beantwoorden
select pg_temp.als(3);
select pg_temp.moet(public.beantwoord_vriendverzoek((select id from public.vriendverzoeken), true) = false, 'Lotte kan het verzoek aan Bram niet beantwoorden');
select pg_temp.moet((select count(*) from public.mijn_vriendverzoeken()) = 0, 'Lotte ziet het verzoek niet');
select pg_temp.als(1);
select pg_temp.moet(public.beantwoord_vriendverzoek((select id from public.vriendverzoeken), true) = false, 'Marcel kan zijn eigen verzoek niet beantwoorden');
-- Bram zegt ja
select pg_temp.als(2);
select pg_temp.moet((select richting || username || groep_naam from public.mijn_vriendverzoeken()) = 'inMarcelSpelavond', 'Bram ziet: Marcel, uit Spelavond');
select pg_temp.moet(public.beantwoord_vriendverzoek((select id from public.vriendverzoeken), true), 'Bram zegt ja');
select pg_temp.moet(public.zijn_vrienden(:M, :B), 'Marcel en Bram zijn vrienden (beide kanten)');
select pg_temp.moet(public.beantwoord_vriendverzoek((select id from public.vriendverzoeken), true) = false, 'een tweede keer beantwoorden kan niet');
select pg_temp.moet(public.vraag_vriend(:M, :G) = 'al vrienden', 'al vrienden');
-- Lotte zegt nee tegen Marcel; Marcel merkt niets en kan niet blijven vragen
select pg_temp.als(1); select public.vraag_vriend(:L, :G);
select pg_temp.als(3);
select pg_temp.moet(public.beantwoord_vriendverzoek((select id from public.vriendverzoeken where naar = :L), false), 'Lotte zegt nee');
select pg_temp.moet(not public.zijn_vrienden(:M, :L), 'nee = geen vrienden');
select pg_temp.als(1);
select pg_temp.moet((select count(*) from public.mijn_vriendverzoeken()) = 0, 'Marcel ziet geen nee (verzoek gewoon weg)');
select pg_temp.moet(public.vraag_vriend(:L, :G) = 'verstuurd', 'opnieuw vragen lijkt te lukken...');
select pg_temp.moet((select count(*) from public.vriendverzoeken where naar = :L and status = 'open') = 0, '...maar Lotte krijgt 30 dagen geen nieuw verzoek');
-- Lotte vraagt Marcel zelf (zij mag dat wel): verzoek; als Marcel daarna vraagt = meteen vrienden
select pg_temp.als(3);
select pg_temp.moet(public.vraag_vriend(:M, :G) = 'verstuurd', 'Lotte vraagt Marcel');
select pg_temp.als(1);
select pg_temp.moet(public.vraag_vriend(:L, :G) = 'vrienden', 'Marcel vraagt terug: meteen vrienden');
select pg_temp.moet(public.zijn_vrienden(:M, :L), 'Marcel en Lotte vrienden');
-- niet in dezelfde groep / geblokkeerd account / persoonlijke blokkade
do $$ begin perform pg_temp.als(1); perform public.vraag_vriend('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001');
  raise exception 'FOUT: Joep zit niet in de groep, toch gelukt';
exception when insufficient_privilege then raise notice 'ok: niet in dezelfde groep = geweigerd'; end $$;
select pg_temp.moet(public.vraag_vriend(:K, :G) = 'niet', 'Kees (geblokkeerd account): niet');
insert into public.groep_leden values (:G, :J);
insert into public.mijn_blokkades values (:J, :M);
select pg_temp.moet(public.vraag_vriend(:J, :G) = 'niet', 'Joep blokkeerde Marcel: niet (zonder te zeggen waarom)');
select pg_temp.als(5);
do $$ begin perform public.vraag_vriend('00000000-0000-0000-0000-000000000001', null); raise exception 'FOUT: zonder groep gelukt';
exception when invalid_parameter_value then raise notice 'ok: zonder groep = geweigerd'; end $$;
select pg_temp.moet(public.vraag_vriend(:M, :G) = 'niet', 'ook andersom: Joep vraagt Marcel = niet');
-- niet ingelogd
select set_config('test.uid', '', false);
do $$ begin perform public.vraag_vriend('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'); raise exception 'FOUT: niet ingelogd gelukt';
exception when insufficient_privilege then raise notice 'ok: niet ingelogd = geweigerd'; end $$;
-- hoogstens 20 per dag
select pg_temp.als(4); update public.profiles set geblokkeerd = false where id = :K;
insert into public.vriendverzoeken (van, naar, created_at) select :K, :J, now() from generate_series(1, 1) where false;
insert into auth.users select gen_random_uuid() from generate_series(1, 21);
insert into public.profiles (id, username) select id, 'p' from auth.users where id not in (select id from public.profiles);
insert into public.groep_leden select :G, id from public.profiles where username = 'p';
do $$ declare u uuid; n int := 0; begin perform pg_temp.als(4);
  for u in select id from public.profiles where username = 'p' loop
    begin perform public.vraag_vriend(u, '10000000-0000-0000-0000-000000000001'); n := n + 1;
    exception when sqlstate 'P0001' then exit; end;
  end loop;
  if n <> 20 then raise exception 'FOUT: % verzoeken op een dag', n; end if; raise notice 'ok: hoogstens 20 verzoeken per dag'; end $$;
