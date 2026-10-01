-- sql/fibro-plus-afschermen.sql
-- Fibro+ (profiles.is_plus) kan alleen nog door een moderator of via de
-- SQL Editor worden gewijzigd. Nieuwe profielen beginnen altijd zonder Fibro+.
-- Breidt de trigger bescherm_profielrechten uit (verder ongewijzigd).
-- Zelftest draait mee; gaat er iets mis, dan wordt er niets aangepast.

begin;

-- 1. Controles vooraf
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'is_plus') then
    raise exception 'STOP: kolom profiles.is_plus bestaat niet; er is niets aangepast';
  end if;
  if to_regprocedure('public.ben_ik_moderator()') is null
     or to_regprocedure('public.ben_ik_geblokkeerd()') is null then
    raise exception 'STOP: ben_ik_moderator() of ben_ik_geblokkeerd() ontbreekt; er is niets aangepast';
  end if;
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.profiles'::regclass and not tgisinternal
                   and tgfoid = 'public.bescherm_profielrechten()'::regprocedure) then
    raise exception 'STOP: trigger bescherm_profielrechten hangt niet aan profiles; er is niets aangepast';
  end if;
  if not exists (select 1 from profiles where is_moderator
                 and not coalesce(geblokkeerd, false)) then
    raise exception 'STOP: er is geen moderator; er is niets aangepast';
  end if;
end $$;

-- 2. De trigger uitbreiden
CREATE OR REPLACE FUNCTION public.bescherm_profielrechten()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  vrij text[] := array['online_status', 'laatst_gezien', 'toon_online', 'updated_at', 'public_key'];
begin
  -- Alleen verzoeken uit de app controleren; SQL Editor en service_role mogen alles.
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_moderator := false;
    new.geblokkeerd := false;
    new.is_plus := false;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if coalesce(old.geblokkeerd, false) or (old.id = auth.uid() and public.ben_ik_geblokkeerd()) then
      raise exception 'Een geblokkeerd account kan zijn profiel niet verwijderen';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.is_moderator is distinct from old.is_moderator then
    raise exception 'is_moderator kan alleen via de SQL Editor worden gewijzigd';
  end if;
  if new.is_plus is distinct from old.is_plus and not public.ben_ik_moderator() then
    raise exception 'Fibro+ kan alleen door een moderator worden gewijzigd';
  end if;
  if new.geblokkeerd is distinct from old.geblokkeerd
     and not (public.ben_ik_moderator() and new.id <> auth.uid()) then
    raise exception 'Alleen een moderator kan iemand anders blokkeren of deblokkeren';
  end if;
  if new.id = auth.uid() and public.ben_ik_geblokkeerd()
     and (to_jsonb(new) - vrij) is distinct from (to_jsonb(old) - vrij) then
    raise exception 'Een geblokkeerd account kan zijn profiel niet wijzigen';
  end if;
  return new;
end;
$function$;

-- 3. Zelftest als echte gebruikers (alles wordt teruggedraaid)
do $$
declare
  gewoon uuid;
  moder uuid;
  uitkomst text;
begin
  select id into gewoon from profiles
   where not coalesce(is_moderator, false) and not coalesce(geblokkeerd, false) limit 1;
  select id into moder from profiles
   where is_moderator and not coalesce(geblokkeerd, false) limit 1;

  -- a. gewone gebruiker probeert zichzelf Fibro+ te geven of af te nemen
  if gewoon is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', gewoon, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      update profiles set is_plus = not coalesce(is_plus, false) where id = gewoon;
      raise exception 'NIET TEGENGEHOUDEN';
    exception when others then uitkomst := sqlerrm;
    end;
    reset role;
    if uitkomst is distinct from 'Fibro+ kan alleen door een moderator worden gewijzigd' then
      raise exception 'STOP: zelftest gewone gebruiker mislukt (%); er is niets aangepast', uitkomst;
    end if;
  end if;

  -- b. moderator mag zijn eigen Fibro+ omzetten (testlinkje)
  perform set_config('request.jwt.claims', json_build_object('sub', moder, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update profiles set is_plus = not coalesce(is_plus, false) where id = moder;
    if not found then raise exception 'GEEN RIJ'; end if;
    raise exception 'TOEGESTAAN';
  exception when others then uitkomst := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if uitkomst is distinct from 'TOEGESTAAN' then
    raise exception 'STOP: zelftest moderator mislukt (%); er is niets aangepast', uitkomst;
  end if;
end $$;

commit;

-- 4. Controle
select 'is_plus afgeschermd' as wat,
       case when pg_get_functiondef('public.bescherm_profielrechten()'::regprocedure)
                 like '%Fibro+ kan alleen door een moderator%' then 'ja' else 'nee' end as uitkomst
union all
select 'accounts met Fibro+', count(*)::text from profiles where is_plus
union all
select 'moderators', count(*)::text from profiles where is_moderator;
