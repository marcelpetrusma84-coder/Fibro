-- Fibro: persoonlijk blokkeren, versie 2 (30-09-2026)
--
-- Blokkeren zet de vriendschap op status 'geblokkeerd' (in plaats van hem te
-- verwijderen). Alles wat om een geaccepteerde vriendschap vraagt (berichten,
-- gastenboek, polls, reacties, profiel lezen) gaat daarmee dicht. De ander
-- ziet je niet meer in zijn lijst; jij ziet hem onderaan met een blokkeerteken.
-- Deblokkeren: vriendschap wordt weer 'accepted' (tenzij de ander jou ook
-- blokkeerde). Verwijderen: blokkade en vriendschap weg.
-- Veiligheid: stopt zonder iets te wijzigen als de leesregel voor vrienden op
-- profiles niet naar status 'accepted' kijkt.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'profiles'
                   and cmd in ('SELECT', 'ALL')
                   and qual like '%friendships%' and qual like '%accepted%') then
    raise exception 'STOP: geen leesregel op profiles die naar accepted kijkt. Er is niets aangepast.';
  end if;
  if exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'profiles'
               and cmd in ('SELECT', 'ALL')
               and qual like '%friendships%' and qual not like '%accepted%') then
    raise exception 'STOP: een leesregel op profiles kijkt niet naar accepted. Er is niets aangepast.';
  end if;
end $$;

create or replace function public.blokkeer_persoon(ander uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare mij uuid := auth.uid();
begin
  if mij is null or ander is null or ander = mij then return false; end if;
  if not exists (select 1 from profiles where id = ander) then return false; end if;

  insert into mijn_blokkades (blokkeerder_id, geblokkeerde_id)
  values (mij, ander) on conflict do nothing;

  update friendships set status = 'geblokkeerd'
  where status = 'accepted'
    and ((user_id = mij and friend_id = ander) or (user_id = ander and friend_id = mij));
  return true;
end;
$function$;

create or replace function public.deblokkeer_persoon(ander uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare mij uuid := auth.uid(); weg boolean;
begin
  if mij is null then return false; end if;
  delete from mijn_blokkades
  where blokkeerder_id = mij and geblokkeerde_id = ander;
  weg := found;

  -- Weer vrienden, tenzij de ander jou ook blokkeerde
  if weg and not exists (select 1 from mijn_blokkades
                         where blokkeerder_id = ander and geblokkeerde_id = mij) then
    update friendships set status = 'accepted'
    where status = 'geblokkeerd'
      and ((user_id = mij and friend_id = ander) or (user_id = ander and friend_id = mij));
  end if;
  return weg;
end;
$function$;

create or replace function public.verwijder_geblokkeerde(ander uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare mij uuid := auth.uid();
begin
  if mij is null or ander is null then return false; end if;
  if not exists (select 1 from mijn_blokkades
                 where blokkeerder_id = mij and geblokkeerde_id = ander) then
    return false;
  end if;
  delete from mijn_blokkades where blokkeerder_id = mij and geblokkeerde_id = ander;
  delete from friendships
  where (user_id = mij and friend_id = ander) or (user_id = ander and friend_id = mij);
  return true;
end;
$function$;

revoke execute on function public.verwijder_geblokkeerde(uuid) from public, anon;
grant execute on function public.verwijder_geblokkeerde(uuid) to authenticated;

commit;

-- Controle: verwacht 'functies voor app: 4', 'blokkeren zet status: true',
-- 'deblokkeren zet terug: true'.
select 'functies voor app' as soort,
       (has_function_privilege('authenticated', 'public.blokkeer_persoon(uuid)', 'EXECUTE')::int
      + has_function_privilege('authenticated', 'public.deblokkeer_persoon(uuid)', 'EXECUTE')::int
      + has_function_privilege('authenticated', 'public.verwijder_geblokkeerde(uuid)', 'EXECUTE')::int
      + has_function_privilege('authenticated', 'public.mijn_geblokkeerden()', 'EXECUTE')::int)::text as detail
union all
select 'blokkeren zet status',
       (pg_get_functiondef('public.blokkeer_persoon(uuid)'::regprocedure) like '%status = ''geblokkeerd''%')::text
union all
select 'deblokkeren zet terug',
       (pg_get_functiondef('public.deblokkeer_persoon(uuid)'::regprocedure) like '%status = ''accepted''%')::text;
