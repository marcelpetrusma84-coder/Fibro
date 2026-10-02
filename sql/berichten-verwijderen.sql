-- Fibro: berichten verwijderen.
-- Uitvoeren in de Supabase SQL Editor (New query, plakken, Run).
-- Nog een keer uitvoeren kan geen kwaad.
--
-- 1. verwijder_bericht_voor_iedereen(id): alleen de afzender. De inhoud wordt
--    vervangen door 'verwijderd:' (de versleutelde tekst is dan echt weg),
--    antwoord_op wordt leeg en de reacties op het bericht worden gewist.
--    Geen DELETE: Supabase stuurt een DELETE naar iedereen die luistert.
-- 2. verberg_bericht(id): zender of ontvanger verbergt het bericht alleen
--    voor zichzelf (tabel verborgen_berichten, alleen zelf leesbaar).
--    De ander merkt er niets van.
-- Een melding (tabel rapporten) bewaart al een eigen kopie van de tekst,
-- dus verwijderen na een melding wist het bewijs niet.

begin;

-- --- Controles vooraf ---
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name in ('id', 'sender_id', 'receiver_id', 'content', 'antwoord_op');
  if n <> 5 then
    raise exception 'STOP: tabel messages heeft niet de verwachte kolommen (% van 5); er is niets aangepast', n;
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'reacties' and column_name = 'bericht_id') then
    raise exception 'STOP: tabel reacties heeft geen kolom bericht_id; er is niets aangepast';
  end if;

  if to_regclass('public.verborgen_berichten') is not null then
    select count(*) into n from information_schema.columns
     where table_schema = 'public' and table_name = 'verborgen_berichten';
    if n <> 3 or (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'verborgen_berichten'
                     and column_name in ('gebruiker_id', 'bericht_id', 'gemaakt_op')) <> 3 then
      raise exception 'STOP: er bestaat al een andere tabel verborgen_berichten; er is niets aangepast';
    end if;
  end if;
end $$;

-- --- Voor mij verwijderen: tabel ---
create table if not exists public.verborgen_berichten (
  gebruiker_id uuid not null references auth.users(id) on delete cascade,
  bericht_id   uuid not null references public.messages(id) on delete cascade,
  gemaakt_op   timestamptz not null default now(),
  primary key (gebruiker_id, bericht_id)
);

alter table public.verborgen_berichten enable row level security;

drop policy if exists "eigen verborgen lezen" on public.verborgen_berichten;
create policy "eigen verborgen lezen" on public.verborgen_berichten
  for select using (gebruiker_id = auth.uid());

-- Alleen lezen; toevoegen gaat via verberg_bericht().
revoke all on public.verborgen_berichten from anon, authenticated;
grant select on public.verborgen_berichten to authenticated;

-- --- Voor iedereen verwijderen ---
create or replace function public.verwijder_bericht_voor_iedereen(p_id uuid)
returns boolean
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  update messages
     set content = 'verwijderd:', antwoord_op = null
   where id = p_id and sender_id = auth.uid() and content is distinct from 'verwijderd:';
  get diagnostics n = row_count;
  if n = 0 then
    -- al verwijderd telt als gelukt; niet van jou of bestaat niet = false
    return exists (select 1 from messages where id = p_id and sender_id = auth.uid());
  end if;
  delete from reacties where bericht_id = p_id;
  return true;
end
$$;

-- --- Voor mij verwijderen ---
create or replace function public.verberg_bericht(p_id uuid)
returns boolean
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from messages
                  where id = p_id and (sender_id = auth.uid() or receiver_id = auth.uid())) then
    return false;
  end if;
  insert into verborgen_berichten (gebruiker_id, bericht_id)
  values (auth.uid(), p_id)
  on conflict do nothing;
  return true;
end
$$;

revoke all on function public.verwijder_bericht_voor_iedereen(uuid) from public, anon;
revoke all on function public.verberg_bericht(uuid) from public, anon;
grant execute on function public.verwijder_bericht_voor_iedereen(uuid) to authenticated;
grant execute on function public.verberg_bericht(uuid) to authenticated;

-- --- Zelftest als echte gebruikers (wordt altijd teruggedraaid) ---
do $$
declare
  a uuid; b uuid; c uuid; m0 uuid; m uuid; n int; t text; aop uuid;
begin
  select f.user_id, f.friend_id into a, b
    from friendships f join profiles p on p.id = f.user_id
   where f.status = 'accepted' and not coalesce(p.geblokkeerd, false)
   limit 1;
  if a is null then
    raise notice 'zelftest overgeslagen: geen vriendenpaar gevonden';
    return;
  end if;
  select id into c from profiles where id <> a and id <> b limit 1;

  begin
    insert into messages (sender_id, receiver_id, content)
    values (a, b, 'e2e:zelftest') returning id into m0;
    insert into messages (sender_id, receiver_id, content, antwoord_op)
    values (a, b, 'e2e:zelftest', m0) returning id into m;

    -- ontvanger b
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    if verwijder_bericht_voor_iedereen(m) then raise exception 'ZT: ontvanger kon voor iedereen verwijderen'; end if;
    if not verberg_bericht(m) then raise exception 'ZT: ontvanger kon niet verbergen'; end if;
    if not verberg_bericht(m) then raise exception 'ZT: tweede keer verbergen mislukte'; end if;
    select count(*) into n from verborgen_berichten where bericht_id = m;
    if n <> 1 then raise exception 'ZT: ontvanger ziet % verborgen regels (verwacht 1)', n; end if;
    begin
      insert into verborgen_berichten (gebruiker_id, bericht_id) values (b, m);
      raise exception 'ZT: rechtstreeks invoegen was mogelijk';
    exception when insufficient_privilege then null;
    end;

    -- afzender a
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    select count(*) into n from verborgen_berichten where bericht_id = m;
    if n <> 0 then raise exception 'ZT: afzender ziet dat de ontvanger het verborg'; end if;
    if not verwijder_bericht_voor_iedereen(m) then raise exception 'ZT: afzender kon niet verwijderen'; end if;
    select content, antwoord_op into t, aop from messages where id = m;
    if t is distinct from 'verwijderd:' or aop is not null then raise exception 'ZT: inhoud niet gewist'; end if;
    if not verwijder_bericht_voor_iedereen(m) then raise exception 'ZT: tweede keer verwijderen gaf false'; end if;

    -- buitenstaander c
    if c is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
      if verberg_bericht(m) then raise exception 'ZT: buitenstaander kon verbergen'; end if;
      if verwijder_bericht_voor_iedereen(m) then raise exception 'ZT: buitenstaander kon verwijderen'; end if;
    end if;

    -- niet ingelogd
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    begin
      perform verwijder_bericht_voor_iedereen(m);
      raise exception 'ZT: anon mocht de functie uitvoeren';
    exception when insufficient_privilege then null;
    end;

    raise exception 'ZELFTEST_OK';
  exception when others then
    if sqlerrm <> 'ZELFTEST_OK' then
      raise exception 'STOP: zelftest mislukt (%); er is niets aangepast', sqlerrm;
    end if;
  end;
  raise notice 'zelftest geslaagd';
end $$;

commit;

-- --- Controle (alleen aantallen en ja/nee) ---
select 'tabel verborgen_berichten' as wat,
       case when to_regclass('public.verborgen_berichten') is not null then 'ja' else 'nee' end as uitkomst
union all
select 'afscherming (RLS) aan',
       case when coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.verborgen_berichten')), false) then 'ja' else 'nee' end
union all
select 'regels op verborgen_berichten',
       (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'verborgen_berichten')
union all
select 'ingelogd mag verwijderen',
       case when coalesce(has_function_privilege('authenticated', to_regprocedure('public.verwijder_bericht_voor_iedereen(uuid)'), 'execute'), false) then 'ja' else 'nee' end
union all
select 'ingelogd mag verbergen',
       case when coalesce(has_function_privilege('authenticated', to_regprocedure('public.verberg_bericht(uuid)'), 'execute'), false) then 'ja' else 'nee' end
union all
select 'niet ingelogd mag functies',
       case when coalesce(has_function_privilege('anon', to_regprocedure('public.verwijder_bericht_voor_iedereen(uuid)'), 'execute'), false)
              or coalesce(has_function_privilege('anon', to_regprocedure('public.verberg_bericht(uuid)'), 'execute'), false) then 'ja' else 'nee' end
union all
select 'ingelogd mag zelf invoegen',
       case when to_regclass('public.verborgen_berichten') is not null
              and has_table_privilege('authenticated', 'public.verborgen_berichten', 'insert') then 'ja' else 'nee' end
union all
select 'testberichten over',
       (select count(*)::text from public.messages where content = 'e2e:zelftest');
