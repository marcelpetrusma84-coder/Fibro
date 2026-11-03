-- functies-afgeschermd.sql (bugtest 3 nov 2026): al uitgevoerd op 3 nov 2026 (Supabase-migraties
-- vaste_search_path_drie_functies en handle_new_user_alleen_als_trigger). Hier bewaard zodat het in de repo staat;
-- nog een keer uitvoeren kan geen kwaad.
--
-- 1. Drie functies hadden geen vaste search_path (waarschuwing van Supabase). Alle namen daarin staan al voluit
--    (public.messages, public.profiles), dus een lege search_path verandert niets aan wat ze doen.
-- 2. handle_new_user is alleen de trigger bij een nieuw account (on_auth_user_created op auth.users) en was ook los aan
--    te roepen via /rest/v1/rpc. Dat kan nu niet meer. Een trigger werkt ook zonder EXECUTE-recht: getest met een
--    proeftabel als 'authenticated' (de functie liep door tot het opslaan van het profiel).
begin;

alter function public.handle_new_user() set search_path = '';
alter function public.delete_expired_messages() set search_path = '';
alter function public.berichten_bewaren_start() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;

-- Controle (drie keer true)
select
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.handle_new_user()'::regprocedure) as vaste_search_path,
  not has_function_privilege('anon', 'public.handle_new_user()', 'execute') as niet_los_aan_te_roepen_anon,
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as niet_los_aan_te_roepen_ingelogd;
