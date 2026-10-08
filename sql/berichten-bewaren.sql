-- Fibro: zelf kiezen hoelang berichten bewaard worden (8 oktober 2026)
-- Uitvoeren in de Supabase SQL Editor (New query, plakken, Run).
-- Nog een keer uitvoeren kan geen kwaad.
--
-- Tot nu toe kreeg elk bericht wel een einddatum (31 dagen), maar deed niets daar iets
-- mee: de leesregel keek er niet naar en er ruimde niets op. Nu:
-- 1. profiles.bewaar_dagen: 1, 7, 31 (standaard), 90 of 365 dagen.
-- 2. Elk nieuw bericht krijgt van de server de einddatum: het kortste van de keuzes van
--    afzender en ontvanger. Wat de app zelf meestuurt telt niet (niet te omzeilen).
-- 3. zet_bewaartermijn(dagen): je eigen keuze wijzigen. Geldt ook voor de berichten die
--    er al zijn (alleen met tellen = true: hoeveel berichten er dan meteen verdwijnen).
-- 4. De leesregel: verlopen berichten ziet niemand meer.
-- 5. Elke nacht om 03:23 (UTC) ruimt pg_cron verlopen berichten echt op.
-- Eerlijke start: berichten van voor vandaag tellen alsof ze vandaag verstuurd zijn
-- (berichten_bewaren_start), dus bij het aanzetten verdwijnt er niets.

begin;

-- --- Controles vooraf ---
do $$
declare n int; t text;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name in ('id', 'sender_id', 'receiver_id', 'created_at', 'expires_at');
  if n <> 5 then
    raise exception 'STOP: tabel messages heeft niet de verwachte kolommen (% van 5); er is niets aangepast', n;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages'
                  and policyname = 'Berichten voor zender en ontvanger' and cmd = 'SELECT') then
    raise exception 'STOP: leesregel "Berichten voor zender en ontvanger" niet gevonden; er is niets aangepast';
  end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'messages' and cmd in ('SELECT', 'ALL');
  if n <> 1 then
    raise exception 'STOP: er staan % leesregels op messages (verwacht 1); er is niets aangepast', n;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
              and column_name = 'bewaar_dagen' and data_type <> 'integer') then
    raise exception 'STOP: profiles.bewaar_dagen bestaat al, maar is geen getal; er is niets aangepast';
  end if;

  -- Verwijzingen naar messages die het opruimen zouden tegenhouden (reacties ruimen we zelf op)
  select string_agg(conrelid::regclass::text || ' (' || conname || ')', ', ') into t
    from pg_constraint
   where confrelid = 'public.messages'::regclass and contype = 'f'
     and confdeltype not in ('c', 'n', 'd')
     and conrelid <> 'public.messages'::regclass
     and conrelid <> coalesce(to_regclass('public.reacties'), 0::regclass);
  if t is not null then
    raise exception 'STOP: deze verwijzingen houden het opruimen tegen: %; er is niets aangepast', t;
  end if;

  if to_regclass('public.reacties') is not null and not exists (
       select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reacties' and column_name = 'bericht_id') then
    raise exception 'STOP: tabel reacties heeft geen kolom bericht_id; er is niets aangepast';
  end if;
end $$;

-- --- pg_cron (het klokje voor het opruimen) ---
create extension if not exists pg_cron;

-- --- Startmoment voor de eerlijke start: wordt maar een keer vastgelegd ---
do $$
begin
  if to_regprocedure('public.berichten_bewaren_start()') is null then
    execute format('create function public.berichten_bewaren_start() returns timestamptz language sql immutable as %L',
                   'select ' || quote_literal(now()::text) || '::timestamptz');
  end if;
end $$;

-- --- De keuze per gebruiker ---
do $$
declare nieuw boolean;
begin
  nieuw := not exists (select 1 from information_schema.columns
                        where table_schema = 'public' and table_name = 'profiles' and column_name = 'bewaar_dagen');
  alter table public.profiles add column if not exists bewaar_dagen integer not null default 31;
  if nieuw then
    -- eerlijke start: alles wat er nu staat krijgt 31 dagen vanaf vandaag
    update public.messages set expires_at = public.berichten_bewaren_start() + interval '31 days';
  end if;
end $$;
alter table public.profiles drop constraint if exists profiles_bewaar_dagen_check;
alter table public.profiles add constraint profiles_bewaar_dagen_check check (bewaar_dagen in (1, 7, 31, 90, 365));

-- --- Einddatum van een bericht: het kortste van de twee keuzes ---
create or replace function public.bericht_einde(p_gemaakt timestamptz, p_van uuid, p_naar uuid)
returns timestamptz
language sql stable security definer
set search_path = public, pg_temp
as $$
  select greatest(coalesce(p_gemaakt, now()), public.berichten_bewaren_start())
       + make_interval(days => least(coalesce((select bewaar_dagen from profiles where id = p_van), 31),
                                     coalesce((select bewaar_dagen from profiles where id = p_naar), 31)))
$$;

create or replace function public.bericht_einddatum()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  new.expires_at := public.bericht_einde(now(), new.sender_id, new.receiver_id);
  return new;
end
$$;

drop trigger if exists bericht_einddatum on public.messages;
create trigger bericht_einddatum
  before insert on public.messages
  for each row execute function public.bericht_einddatum();

-- --- Eigen keuze wijzigen (ook voor de berichten die er al zijn) ---
create or replace function public.zet_bewaartermijn(p_dagen integer, p_tellen boolean default false)
returns integer
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare mij uuid := auth.uid(); n integer;
begin
  if mij is null then raise exception 'Niet ingelogd'; end if;
  if p_dagen is null or p_dagen not in (1, 7, 31, 90, 365) then
    raise exception 'Kies 1, 7, 31, 90 of 365 dagen';
  end if;
  -- hoeveel van jouw berichten er met deze keuze meteen verdwijnen
  select count(*) into n from messages m
   where (m.sender_id = mij or m.receiver_id = mij)
     and m.expires_at > now()
     and greatest(coalesce(m.created_at, now()), public.berichten_bewaren_start())
         + make_interval(days => case when m.sender_id = m.receiver_id then p_dagen
                                      else least(p_dagen, coalesce((select p.bewaar_dagen from profiles p
                                                                     where p.id = case when m.sender_id = mij then m.receiver_id else m.sender_id end), 31)) end)
         <= now();
  if p_tellen then return n; end if;
  update profiles set bewaar_dagen = p_dagen where id = mij;
  update messages m
     set expires_at = public.bericht_einde(m.created_at, m.sender_id, m.receiver_id)
   where (m.sender_id = mij or m.receiver_id = mij)
     and m.expires_at > now();
  return n;
end
$$;

-- --- Opruimen: verlopen berichten (en hun reacties) echt weggooien ---
create or replace function public.berichten_opruimen()
returns integer
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if to_regclass('public.reacties') is not null then
    execute 'delete from public.reacties where bericht_id in (select id from public.messages where expires_at <= now())';
  end if;
  delete from public.messages where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.bericht_einde(timestamptz, uuid, uuid) from public, anon, authenticated;
revoke all on function public.bericht_einddatum() from public, anon, authenticated;
revoke all on function public.berichten_opruimen() from public, anon, authenticated;
revoke all on function public.zet_bewaartermijn(integer, boolean) from public, anon;
grant execute on function public.zet_bewaartermijn(integer, boolean) to authenticated;

-- --- Leesregel: verlopen berichten ziet niemand meer ---
drop policy if exists "Berichten voor zender en ontvanger" on public.messages;
create policy "Berichten voor zender en ontvanger" on public.messages
  for select using (
    (auth.uid() = sender_id or auth.uid() = receiver_id)
    and (expires_at is null or expires_at > now())
  );

-- --- Elke nacht opruimen ---
select cron.unschedule(jobid) from cron.job where jobname = 'fibro-berichten-opruimen';
select cron.schedule('fibro-berichten-opruimen', '23 3 * * *', 'select public.berichten_opruimen()');

-- --- Zelftest als echte gebruikers (wordt altijd teruggedraaid) ---
do $$
declare
  a uuid; b uuid; m uuid; m2 uuid; e timestamptz; n int;
begin
  select f.user_id, f.friend_id into a, b
    from friendships f join profiles p on p.id = f.user_id
   where f.status = 'accepted' and f.user_id <> f.friend_id and not coalesce(p.geblokkeerd, false)
   limit 1;
  if a is null then
    raise notice 'zelftest overgeslagen: geen vriendenpaar gevonden';
    return;
  end if;

  begin
    -- afzender a stuurt b een bericht en probeert zelf een einddatum van 10 jaar mee te geven
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    insert into messages (sender_id, receiver_id, content, expires_at)
    values (a, b, 'e2e:zelftest', now() + interval '10 years') returning id, expires_at into m, e;
    if e > now() + interval '31 days 1 minute' or e < now() + interval '1 day' then
      raise exception 'ZT: einddatum klopt niet (%)', e;
    end if;

    -- a kiest 1 dag: het bericht (van net) blijft nog een dag
    perform zet_bewaartermijn(1);
    select expires_at into e from messages where id = m;
    if e > now() + interval '1 day 1 minute' then raise exception 'ZT: einddatum niet korter na 1 dag kiezen (%)', e; end if;

    -- b stuurt terug: ook voor b geldt nu 1 dag (het kortste van de twee)
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    insert into messages (sender_id, receiver_id, content) values (b, a, 'e2e:zelftest') returning id, expires_at into m2, e;
    if e > now() + interval '1 day 1 minute' then raise exception 'ZT: kortste van de twee geldt niet (%)', e; end if;
    begin
      perform zet_bewaartermijn(2);
      raise exception 'ZT: ongeldige termijn werd geaccepteerd';
    exception when raise_exception then
      if sqlerrm like 'ZT:%' then raise; end if;
    end;
    begin
      update profiles set bewaar_dagen = 3 where id = b;
      raise exception 'ZT: bewaar_dagen 3 kon worden opgeslagen';
    exception when check_violation then null;
    end;

    -- verlopen berichten ziet niemand meer
    reset role;
    update messages set expires_at = now() - interval '1 minute' where id = m;
    perform set_config('role', 'authenticated', true);
    select count(*) into n from messages where id = m;
    if n <> 0 then raise exception 'ZT: verlopen bericht nog te zien'; end if;
    select count(*) into n from messages where id = m2;
    if n <> 1 then raise exception 'ZT: niet-verlopen bericht niet te zien'; end if;

    -- de app mag zelf niet opruimen of de einddatum-functie gebruiken
    begin
      perform berichten_opruimen();
      raise exception 'ZT: app mocht opruimen';
    exception when insufficient_privilege then null;
    end;

    -- opruimen (zoals pg_cron het doet) gooit het verlopen bericht weg, het andere niet
    reset role;
    perform berichten_opruimen();
    if exists (select 1 from messages where id = m) then raise exception 'ZT: verlopen bericht niet opgeruimd'; end if;
    if not exists (select 1 from messages where id = m2) then raise exception 'ZT: te veel opgeruimd'; end if;

    raise exception 'ZELFTEST_OK';
  exception when others then
    if sqlerrm <> 'ZELFTEST_OK' then
      raise exception 'STOP: zelftest mislukt (%); er is niets aangepast', sqlerrm;
    end if;
  end;
  raise notice 'zelftest geslaagd';
end $$;

commit;

-- --- Controle ---
select 'keuze per gebruiker (bewaar_dagen)' as wat,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'bewaar_dagen') then 'ja' else 'nee' end as uitkomst
union all
select 'server zet de einddatum (trigger)',
       case when exists (select 1 from pg_trigger where tgrelid = 'public.messages'::regclass and tgname = 'bericht_einddatum') then 'ja' else 'nee' end
union all
select 'leesregel kijkt naar de einddatum',
       case when (select qual from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'Berichten voor zender en ontvanger') like '%expires_at%' then 'ja' else 'nee' end
union all
select 'opruimen elke nacht',
       coalesce((select schedule || ' (' || case when active then 'aan' else 'uit' end || ')' from cron.job where jobname = 'fibro-berichten-opruimen'), 'nee')
union all
select 'ingelogd mag eigen keuze wijzigen',
       case when has_function_privilege('authenticated', 'public.zet_bewaartermijn(integer, boolean)', 'execute') then 'ja' else 'nee' end
union all
select 'ingelogd mag opruimen',
       case when has_function_privilege('authenticated', 'public.berichten_opruimen()', 'execute') then 'ja' else 'nee' end
union all
select 'eerlijke start vanaf', to_char(public.berichten_bewaren_start() at time zone 'Europe/Amsterdam', 'DD-MM-YYYY HH24:MI')
union all
select 'berichten nu te zien / verlopen',
       (select count(*) filter (where expires_at > now())::text || ' / ' || count(*) filter (where expires_at <= now())::text from public.messages)
union all
select 'testberichten over', (select count(*)::text from public.messages where content = 'e2e:zelftest');
