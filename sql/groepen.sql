-- groepen.sql (10 nov 2026, stap 1 van de groepschat): groepen, hun leden en groepsberichten.
-- Alleen nieuwe tabellen en functies; aan bestaande tabellen verandert niets. Eén functie wordt vervangen:
-- realtime_toegang krijgt er één regel bij (het kanaal groep-<id> voor de leden van die groep).
--
-- Wat de server weet: dat er een groep is, de naam, wie erin zit en wanneer iemand iets stuurde.
-- Wat de server NIET weet: wat er gezegd wordt. Een groepsbericht is versleuteld met een nieuwe sleutel per
-- bericht, en die sleutel is per lid apart versleuteld (zie groepsleutel.js). Zonder je eigen sleutel: onleesbaar.
--
-- Regels:
--  - Iedereen mag een groep maken (niet als een moderator je blokkeerde), alleen met eigen vrienden (beide kanten
--    'accepted'). De maker is beheerder. Alleen de beheerder voegt leden toe, en alleen zijn eigen vrienden.
--  - Hoogstens 50 leden (groepschat), 8 (voice chat) of 4 (webcam chat), de maker meegeteld.
--  - Een lid mag zelf weggaan; de beheerder mag iemand weghalen. Gaat de beheerder weg, dan wordt het langst
--    zittende lid beheerder. Gaat de laatste weg, dan verdwijnt de groep (met de berichten).
--  - Berichten: alleen leden lezen en sturen; je eigen bericht mag je weghalen. Na 31 dagen weg (zoals de chat).
--  - Groepen maken, leden toevoegen en weghalen gaat alleen via de functies hieronder (die controleren alles).
--
-- Uitvoeren: in één keer in de SQL Editor van Supabase. Nog een keer uitvoeren kan geen kwaad, maar voer daarna
-- ook sql/groep-onbekenden.sql opnieuw uit (die maakt maak_groep en groep_lid_toevoegen af).

begin;

do $$
begin
  if to_regprocedure('public.ben_ik_geblokkeerd()') is null then
    raise exception 'STOP: functie ben_ik_geblokkeerd() ontbreekt';
  end if;
  if to_regprocedure('public.realtime_toegang(text,text,boolean)') is null then
    raise exception 'STOP: functie realtime_toegang() ontbreekt';
  end if;
end $$;

-- ── Tabellen ──
create table if not exists public.groepen (
  id         uuid primary key default gen_random_uuid(),
  naam       text not null check (char_length(btrim(naam)) between 1 and 40),
  soort      text not null default 'chat' check (soort in ('chat', 'voice', 'webcam')),
  maker      uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.groep_leden (
  groep_id        uuid not null references public.groepen(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  rol             text not null default 'lid' check (rol in ('beheerder', 'lid')),
  toegevoegd_door uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (groep_id, user_id)
);
create index if not exists groep_leden_user_idx on public.groep_leden (user_id);

create table if not exists public.groep_berichten (
  id         uuid primary key default gen_random_uuid(),
  groep_id   uuid not null references public.groepen(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) <= 200000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '31 days')
);
create index if not exists groep_berichten_groep_idx on public.groep_berichten (groep_id, created_at desc);

alter table public.groepen enable row level security;
alter table public.groep_leden enable row level security;
alter table public.groep_berichten enable row level security;

-- ── Hulpfuncties ──
-- Ben ik lid van deze groep? (security definer: zo kijkt een regel niet in zichzelf rond)
create or replace function public.is_groepslid(p_groep uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (select 1 from public.groep_leden l where l.groep_id = p_groep and l.user_id = auth.uid());
$$;

create or replace function public.groep_max(p_soort text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_soort when 'voice' then 8 when 'webcam' then 4 else 50 end;
$$;

create or replace function public.zijn_vrienden(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a <> b
     and exists (select 1 from public.friendships f where f.user_id = a and f.friend_id = b and f.status = 'accepted')
     and exists (select 1 from public.friendships f where f.user_id = b and f.friend_id = a and f.status = 'accepted');
$$;

-- ── Regels (alleen lezen voor de leden; schrijven via de functies, behalve berichten) ──
drop policy if exists groepen_lezen on public.groepen;
create policy groepen_lezen on public.groepen for select to authenticated
  using (public.is_groepslid(id));

drop policy if exists groep_leden_lezen on public.groep_leden;
create policy groep_leden_lezen on public.groep_leden for select to authenticated
  using (public.is_groepslid(groep_id));

drop policy if exists groep_berichten_lezen on public.groep_berichten;
create policy groep_berichten_lezen on public.groep_berichten for select to authenticated
  using (public.is_groepslid(groep_id) and expires_at > now());

drop policy if exists groep_berichten_sturen on public.groep_berichten;
create policy groep_berichten_sturen on public.groep_berichten for insert to authenticated
  with check (sender_id = auth.uid() and public.is_groepslid(groep_id) and not public.ben_ik_geblokkeerd()
              and expires_at <= now() + interval '32 days');

drop policy if exists groep_berichten_weghalen on public.groep_berichten;
create policy groep_berichten_weghalen on public.groep_berichten for delete to authenticated
  using (sender_id = auth.uid());

revoke all on public.groepen, public.groep_leden, public.groep_berichten from anon;
grant select on public.groepen, public.groep_leden to authenticated;
grant select, insert, delete on public.groep_berichten to authenticated;

-- ── Een groep maken ──
create or replace function public.maak_groep(p_naam text, p_soort text, p_leden uuid[])
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ik    uuid := auth.uid();
  nieuw uuid;
  lid   uuid;
  leden uuid[];
begin
  if ik is null then raise exception 'niet ingelogd' using errcode = '42501'; end if;
  if public.ben_ik_geblokkeerd() then raise exception 'geblokkeerd' using errcode = '42501'; end if;
  if p_soort not in ('chat', 'voice', 'webcam') then raise exception 'onbekende soort' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x), '{}') into leden from unnest(coalesce(p_leden, '{}')) x where x <> ik;
  if cardinality(leden) < 1 then raise exception 'kies minstens een vriend' using errcode = '22023'; end if;
  if cardinality(leden) + 1 > public.groep_max(p_soort) then raise exception 'te veel leden' using errcode = '22023'; end if;
  foreach lid in array leden loop
    if not public.zijn_vrienden(ik, lid) then raise exception 'alleen vrienden' using errcode = '42501'; end if;
  end loop;
  insert into public.groepen (naam, soort, maker) values (btrim(p_naam), p_soort, ik) returning id into nieuw;
  insert into public.groep_leden (groep_id, user_id, rol, toegevoegd_door) values (nieuw, ik, 'beheerder', ik);
  insert into public.groep_leden (groep_id, user_id, rol, toegevoegd_door) select nieuw, x, 'lid', ik from unnest(leden) x;
  return nieuw;
end
$$;

-- ── Een vriend toevoegen (alleen de beheerder) ──
create or replace function public.groep_lid_toevoegen(p_groep uuid, p_lid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ik    uuid := auth.uid();
  s     text;
begin
  if ik is null or public.ben_ik_geblokkeerd() then raise exception 'geen toegang' using errcode = '42501'; end if;
  if not exists (select 1 from public.groep_leden where groep_id = p_groep and user_id = ik and rol = 'beheerder') then
    raise exception 'alleen de beheerder' using errcode = '42501';
  end if;
  if not public.zijn_vrienden(ik, p_lid) then raise exception 'alleen vrienden' using errcode = '42501'; end if;
  select soort into s from public.groepen where id = p_groep for update;
  if (select count(*) from public.groep_leden where groep_id = p_groep) >= public.groep_max(s) then
    raise exception 'groep is vol' using errcode = '22023';
  end if;
  insert into public.groep_leden (groep_id, user_id, rol, toegevoegd_door) values (p_groep, p_lid, 'lid', ik)
    on conflict (groep_id, user_id) do nothing;
end
$$;

-- ── Iemand weghalen, of zelf weggaan ──
create or replace function public.groep_lid_weg(p_groep uuid, p_lid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ik     uuid := auth.uid();
  wasbeh boolean;
  opvolger uuid;
begin
  if ik is null then raise exception 'niet ingelogd' using errcode = '42501'; end if;
  if p_lid <> ik and not exists (select 1 from public.groep_leden where groep_id = p_groep and user_id = ik and rol = 'beheerder') then
    raise exception 'alleen de beheerder' using errcode = '42501';
  end if;
  perform 1 from public.groepen where id = p_groep for update;
  delete from public.groep_leden where groep_id = p_groep and user_id = p_lid returning rol = 'beheerder' into wasbeh;
  if not exists (select 1 from public.groep_leden where groep_id = p_groep) then
    delete from public.groepen where id = p_groep;
    return;
  end if;
  if coalesce(wasbeh, false) and not exists (select 1 from public.groep_leden where groep_id = p_groep and rol = 'beheerder') then
    select user_id into opvolger from public.groep_leden where groep_id = p_groep order by created_at, user_id limit 1;
    update public.groep_leden set rol = 'beheerder' where groep_id = p_groep and user_id = opvolger;
  end if;
end
$$;

-- ── De leden van een groep (ook wie geen vriend van je is: naam, avatar en publieke sleutel) ──
create or replace function public.groep_leden_info(p_groep uuid)
returns table (id uuid, username text, avatar_url text, public_key text, rol text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.avatar_url, p.public_key, l.rol
    from public.groep_leden l join public.profiles p on p.id = l.user_id
   where l.groep_id = p_groep and public.is_groepslid(p_groep)
   order by l.created_at, p.username;
$$;

-- ── Mijn groepen, nieuwste bericht eerst ──
create or replace function public.mijn_groepen()
returns table (id uuid, naam text, soort text, leden integer, laatste timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select g.id, g.naam, g.soort,
         (select count(*)::int from public.groep_leden l2 where l2.groep_id = g.id),
         coalesce((select max(b.created_at) from public.groep_berichten b where b.groep_id = g.id and b.expires_at > now()), g.created_at)
    from public.groepen g join public.groep_leden l on l.groep_id = g.id and l.user_id = auth.uid()
   order by 5 desc;
$$;

-- Naam veranderen (alleen de beheerder)
create or replace function public.groep_hernoem(p_groep uuid, p_naam text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.groep_leden where groep_id = p_groep and user_id = auth.uid() and rol = 'beheerder') then
    raise exception 'alleen de beheerder' using errcode = '42501';
  end if;
  update public.groepen set naam = btrim(p_naam) where id = p_groep;
end
$$;

revoke execute on function public.maak_groep(text, text, uuid[]) from public, anon;
revoke execute on function public.groep_lid_toevoegen(uuid, uuid) from public, anon;
revoke execute on function public.groep_lid_weg(uuid, uuid) from public, anon;
revoke execute on function public.groep_leden_info(uuid) from public, anon;
revoke execute on function public.mijn_groepen() from public, anon;
revoke execute on function public.groep_hernoem(uuid, text) from public, anon;
revoke execute on function public.is_groepslid(uuid) from public, anon;
revoke execute on function public.zijn_vrienden(uuid, uuid) from public, anon, authenticated; -- alleen binnen de functies hieronder
grant execute on function public.maak_groep(text, text, uuid[]) to authenticated;
grant execute on function public.groep_lid_toevoegen(uuid, uuid) to authenticated;
grant execute on function public.groep_lid_weg(uuid, uuid) to authenticated;
grant execute on function public.groep_leden_info(uuid) to authenticated;
grant execute on function public.mijn_groepen() to authenticated;
grant execute on function public.groep_hernoem(uuid, text) to authenticated;
grant execute on function public.is_groepslid(uuid) to authenticated;
grant execute on function public.groep_max(text) to authenticated;

-- ── Realtime: nieuwe groepsberichten meteen binnen ──
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groep_berichten') then
    alter publication supabase_realtime add table public.groep_berichten;
  end if;
end $$;

-- realtime_toegang: zoals hij was, plus het kanaal groep-<id> (lezen: lid; sturen: lid, niet geblokkeerd)
create or replace function public.realtime_toegang(onderwerp text, soort text, sturen boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ik uuid := auth.uid();
  u constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  m text[];
  ander uuid;
begin
  if ik is null or onderwerp is null then return false; end if;

  if onderwerp in ('berichten-' || ik, 'reacties-' || ik, 'ongelezen-' || ik, 'meldingen-berichten-' || ik) then
    return not sturen;
  end if;

  m := regexp_match(onderwerp, '^(bel-uitnodiging|speluitnodiging)-(' || u || ')$');
  if m is not null then
    ander := m[2]::uuid;
    if not sturen then return ander = ik; end if;
    return soort = 'broadcast' and ander <> ik
      and exists (select 1 from public.friendships f where f.user_id = ik and f.friend_id = ander and f.status = 'accepted')
      and exists (select 1 from public.friendships f where f.user_id = ander and f.friend_id = ik and f.status = 'accepted')
      and not public.ben_ik_geblokkeerd();
  end if;

  m := regexp_match(onderwerp, '^(paar|syncdata|belgesprek)_(' || u || ')_(' || u || ')$');
  if m is null then m := regexp_match(onderwerp, '^(spel)_(' || u || ')_(' || u || ')_[0-9a-z]{1,20}$'); end if;
  if m is not null then
    if m[2]::uuid = ik then ander := m[3]::uuid;
    elsif m[3]::uuid = ik then ander := m[2]::uuid;
    else return false; end if;
    return ander <> ik and soort in ('broadcast', 'presence')
      and exists (select 1 from public.friendships f where f.user_id = ik and f.friend_id = ander and f.status = 'accepted')
      and exists (select 1 from public.friendships f where f.user_id = ander and f.friend_id = ik and f.status = 'accepted')
      and not public.ben_ik_geblokkeerd();
  end if;

  m := regexp_match(onderwerp, '^spel3_([0-9a-z]{1,20})$');
  if m is not null then
    return soort in ('broadcast', 'presence')
      and exists (select 1 from public.chess_three_sessions s where s.session_id = m[1] and ik = any(s.player_ids))
      and not public.ben_ik_geblokkeerd();
  end if;

  -- groepen (10 nov 2026): groep-<id>
  m := regexp_match(onderwerp, '^groep-(' || u || ')$');
  if m is not null then
    if not exists (select 1 from public.groep_leden l where l.groep_id = m[1]::uuid and l.user_id = ik) then return false; end if;
    if not sturen then return true; end if;
    return soort in ('broadcast', 'presence') and not public.ben_ik_geblokkeerd();
  end if;
  return false;
end
$$;

-- ── Elke nacht verlopen groepsberichten echt weghalen ──
create or replace function public.groepberichten_opruimen()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.groep_berichten where expires_at <= now();
$$;
revoke execute on function public.groepberichten_opruimen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'fibro-groepberichten-opruimen';
    perform cron.schedule('fibro-groepberichten-opruimen', '27 3 * * *', 'select public.groepberichten_opruimen()');
  end if;
end $$;

commit;
