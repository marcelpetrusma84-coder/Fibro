-- Fibro: persoonlijk blokkeren, versie 3 (30-09-2026)
--
-- Reparatie op versie 2: de controleregel friendships_status_check laat alleen
-- 'pending', 'accepted' en 'blocked' toe. Blokkeren gebruikt nu 'blocked'
-- (was 'geblokkeerd', wat werd geweigerd). Verder werkt alles als in versie 2.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

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

  update friendships set status = 'blocked'
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
    where status = 'blocked'
      and ((user_id = mij and friend_id = ander) or (user_id = ander and friend_id = mij));
  end if;
  return weg;
end;
$function$;

commit;

-- Controle: verwacht 'blokkeren zet blocked: true', 'deblokkeren kijkt naar blocked: true',
-- 'rijen met status blocked: 0' (nog niemand geblokkeerd).
select 'blokkeren zet blocked' as soort,
       (pg_get_functiondef('public.blokkeer_persoon(uuid)'::regprocedure) like '%status = ''blocked''%')::text as detail
union all
select 'deblokkeren kijkt naar blocked',
       (pg_get_functiondef('public.deblokkeer_persoon(uuid)'::regprocedure) like '%status = ''blocked''%')::text
union all
select 'rijen met status blocked', count(*)::text
from public.friendships where status = 'blocked';
