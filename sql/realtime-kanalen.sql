-- realtime-kanalen.sql - wie mag welk afgeschermd realtime-kanaal openen (stap B, deel 1)
-- Geldt alleen voor kanalen met private: true. Openbare kanalen werken gewoon door
-- tot 'Allow public access' in de Realtime-instellingen uit gaat (laatste stap).
--
-- 1. Eigen databasekanalen  berichten-<ik>, reacties-<ik>, ongelezen-<ik>,
--    meldingen-berichten-<ik>: alleen jijzelf, alleen lezen.
-- 2. Brievenbus  bel-uitnodiging-<id>, speluitnodiging-<id>: lezen alleen de
--    eigenaar; sturen (broadcast) alleen een vriend die niet geblokkeerd is.
-- 3. Per vriendenpaar  paar_<a>_<b>, syncdata_<a>_<b>, belgesprek_<a>_<b>,
--    spel_<a>_<b>_<sessie>: alleen die twee, alleen als ze vrienden zijn
--    (beide rijen accepted) en jij niet door een moderator geblokkeerd bent.
-- Al het andere: niemand.

begin;

do $$
begin
  if to_regprocedure('realtime.topic()') is null then
    raise exception 'STOP: functie realtime.topic() ontbreekt';
  end if;
  if to_regprocedure('public.ben_ik_geblokkeerd()') is null then
    raise exception 'STOP: functie ben_ik_geblokkeerd() ontbreekt';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages'
             and policyname not in ('fibro_realtime_lezen', 'fibro_realtime_sturen')) then
    raise exception 'STOP: er staan andere regels op realtime.messages';
  end if;
end $$;

create or replace function public.realtime_toegang(onderwerp text, soort text, sturen boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ik    uuid := auth.uid();
  u     constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  m     text[];
  ander uuid;
begin
  if ik is null or onderwerp is null then
    return false;
  end if;

  -- 1. Eigen databasekanalen
  if onderwerp in ('berichten-' || ik, 'reacties-' || ik, 'ongelezen-' || ik,
                   'meldingen-berichten-' || ik) then
    return not sturen;
  end if;

  -- 2. Brievenbus
  m := regexp_match(onderwerp, '^(bel-uitnodiging|speluitnodiging)-(' || u || ')$');
  if m is not null then
    ander := m[2]::uuid;
    if not sturen then
      return ander = ik;
    end if;
    return soort = 'broadcast'
       and ander <> ik
       and exists (select 1 from friendships f where f.user_id = ik and f.friend_id = ander and f.status = 'accepted')
       and exists (select 1 from friendships f where f.user_id = ander and f.friend_id = ik and f.status = 'accepted')
       and not public.ben_ik_geblokkeerd();
  end if;

  -- 3. Per vriendenpaar
  m := regexp_match(onderwerp, '^(paar|syncdata|belgesprek)_(' || u || ')_(' || u || ')$');
  if m is null then
    m := regexp_match(onderwerp, '^(spel)_(' || u || ')_(' || u || ')_[0-9a-z]{1,20}$');
  end if;
  if m is not null then
    if m[2]::uuid = ik then
      ander := m[3]::uuid;
    elsif m[3]::uuid = ik then
      ander := m[2]::uuid;
    else
      return false;
    end if;
    return ander <> ik
       and soort in ('broadcast', 'presence')
       and exists (select 1 from friendships f where f.user_id = ik and f.friend_id = ander and f.status = 'accepted')
       and exists (select 1 from friendships f where f.user_id = ander and f.friend_id = ik and f.status = 'accepted')
       and not public.ben_ik_geblokkeerd();
  end if;

  return false;
end
$$;

revoke all on function public.realtime_toegang(text, text, boolean) from public, anon;
grant execute on function public.realtime_toegang(text, text, boolean) to authenticated;

drop policy if exists fibro_realtime_lezen on realtime.messages;
drop policy if exists fibro_realtime_sturen on realtime.messages;

create policy fibro_realtime_lezen on realtime.messages
  for select to authenticated
  using (public.realtime_toegang((select realtime.topic()), extension, false));

create policy fibro_realtime_sturen on realtime.messages
  for insert to authenticated
  with check (public.realtime_toegang((select realtime.topic()), extension, true));

-- Zelftest met de echte vriendschappen (toont niets, stopt alleen bij een fout)
do $$
declare
  p      record;
  fouten int := 0;
  tests  int := 0;
  blok   boolean;
begin
  for p in
    select f.user_id as a, f.friend_id as b
    from friendships f
    where f.status = 'accepted' and f.user_id < f.friend_id
      and exists (select 1 from friendships g where g.user_id = f.friend_id and g.friend_id = f.user_id and g.status = 'accepted')
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', p.a, 'role', 'authenticated')::text, true);
    blok := public.ben_ik_geblokkeerd();
    tests := tests + 9;
    if public.realtime_toegang('paar_' || p.a || '_' || p.b, 'presence', true) is distinct from not blok then fouten := fouten + 1; end if;
    if public.realtime_toegang('paar_' || p.a || '_' || p.b, 'broadcast', false) is distinct from not blok then fouten := fouten + 1; end if;
    if public.realtime_toegang('belgesprek_' || p.a || '_' || p.b, 'broadcast', true) is distinct from not blok then fouten := fouten + 1; end if;
    if public.realtime_toegang('spel_' || p.a || '_' || p.b || '_mg7k2x1', 'broadcast', true) is distinct from not blok then fouten := fouten + 1; end if;
    if public.realtime_toegang('bel-uitnodiging-' || p.b, 'broadcast', true) is distinct from not blok then fouten := fouten + 1; end if;
    if public.realtime_toegang('bel-uitnodiging-' || p.b, 'broadcast', false) then fouten := fouten + 1; end if;
    if not public.realtime_toegang('speluitnodiging-' || p.a, 'broadcast', false) then fouten := fouten + 1; end if;
    if not public.realtime_toegang('berichten-' || p.a, 'broadcast', false) then fouten := fouten + 1; end if;
    if public.realtime_toegang('berichten-' || p.b, 'broadcast', false) then fouten := fouten + 1; end if;
  end loop;

  -- Geen vrienden: geen toegang
  for p in
    select x.id as a, y.id as b
    from profiles x join profiles y on x.id < y.id
    where not exists (select 1 from friendships f where f.user_id = x.id and f.friend_id = y.id and f.status = 'accepted')
    limit 50
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', p.a, 'role', 'authenticated')::text, true);
    tests := tests + 3;
    if public.realtime_toegang('paar_' || p.a || '_' || p.b, 'presence', false) then fouten := fouten + 1; end if;
    if public.realtime_toegang('bel-uitnodiging-' || p.b, 'broadcast', true) then fouten := fouten + 1; end if;
    if public.realtime_toegang('fibro-online', 'presence', false) then fouten := fouten + 1; end if;
  end loop;

  perform set_config('request.jwt.claims', '', true);
  tests := tests + 1;
  if public.realtime_toegang('fibro-online', 'presence', false) then fouten := fouten + 1; end if;

  if fouten > 0 then
    raise exception 'STOP: zelftest mislukt (% van % gevallen)', fouten, tests;
  end if;
  raise notice 'zelftest geslaagd: % gevallen', tests;
end $$;

commit;

-- Controle (alleen aantallen en ja/nee)
select 'regels op realtime.messages' as wat,
       count(*)::text || ' (' || coalesce(string_agg(policyname || ':' || cmd, ', ' order by policyname), '-') || ')' as uitkomst
from pg_policies where schemaname = 'realtime' and tablename = 'messages'
union all
select 'functie realtime_toegang security definer', prosecdef::text
from pg_proc where oid = 'public.realtime_toegang(text, text, boolean)'::regprocedure
union all
select 'authenticated mag hem uitvoeren', has_function_privilege('authenticated', 'public.realtime_toegang(text, text, boolean)', 'execute')::text
union all
select 'anon mag hem uitvoeren', has_function_privilege('anon', 'public.realtime_toegang(text, text, boolean)', 'execute')::text
union all
select 'paren getest (vrienden)', count(*)::text
from friendships f
where f.status = 'accepted' and f.user_id < f.friend_id
  and exists (select 1 from friendships g where g.user_id = f.friend_id and g.friend_id = f.user_id and g.status = 'accepted');
