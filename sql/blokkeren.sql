-- Fibro: blokkeren afdwingen (30-09-2026)
--
-- Een geblokkeerd account kan niet meer: berichten sturen, in gastenboeken
-- schrijven, reageren, stemmen, uitnodigingen maken of gebruiken, en zijn
-- profiel wijzigen (behalve online-status). Wel: inloggen, eigen berichten
-- lezen, vrienden verwijderen, melden.
--
-- Geblokkeerd = vlag profiles.geblokkeerd (moderatie.html zet die)
--            OF een actieve rij in de nieuwe tabel blokkades
--               (met reden en eventueel een einddatum; tot = leeg is voor altijd).
-- blokkades: alleen moderators lezen en schrijven; de geblokkeerde ziet
-- alleen zijn eigen blokkades. Niets wordt verwijderd (dient als logboek):
-- opheffen = opgeheven_op invullen.
-- Beperking: bellen en P2P-sync lopen via realtime-kanalen, niet via deze regels.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

-- 1. Tabel blokkades
create table if not exists public.blokkades (
  id uuid primary key default gen_random_uuid(),
  gebruiker_id uuid not null references public.profiles(id) on delete cascade,
  reden text not null check (length(reden) between 1 and 500),
  van timestamptz not null default now(),
  tot timestamptz,
  door uuid default auth.uid(),
  opgeheven_op timestamptz,
  opgeheven_door uuid,
  created_at timestamptz not null default now()
);
create index if not exists blokkades_gebruiker on public.blokkades (gebruiker_id);
alter table public.blokkades enable row level security;
revoke all on public.blokkades from anon, authenticated;
grant select, insert, update on public.blokkades to authenticated;

drop policy if exists "blokkades moderator leest" on public.blokkades;
create policy "blokkades moderator leest" on public.blokkades
  for select using (public.ben_ik_moderator() or gebruiker_id = auth.uid());
drop policy if exists "blokkades moderator maakt" on public.blokkades;
create policy "blokkades moderator maakt" on public.blokkades
  for insert with check (public.ben_ik_moderator() and gebruiker_id <> auth.uid());
drop policy if exists "blokkades moderator werkt bij" on public.blokkades;
create policy "blokkades moderator werkt bij" on public.blokkades
  for update using (public.ben_ik_moderator()) with check (public.ben_ik_moderator());

-- Logboek eerlijk houden: wie, wie en waarom liggen vast
create or replace function public.bescherm_blokkades()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.door := auth.uid();
    new.created_at := now();
    new.opgeheven_op := null;
    new.opgeheven_door := null;
    return new;
  end if;
  if new.gebruiker_id is distinct from old.gebruiker_id
     or new.reden is distinct from old.reden
     or new.van is distinct from old.van
     or new.door is distinct from old.door
     or new.created_at is distinct from old.created_at then
    raise exception 'Alleen tot en opheffen kunnen worden gewijzigd';
  end if;
  if new.opgeheven_op is distinct from old.opgeheven_op then
    new.opgeheven_door := auth.uid();
  else
    new.opgeheven_door := old.opgeheven_door;
  end if;
  return new;
end;
$$;
drop trigger if exists bescherm_blokkades on public.blokkades;
create trigger bescherm_blokkades
  before insert or update on public.blokkades
  for each row execute function public.bescherm_blokkades();

-- 2. Controlefuncties
-- is_geblokkeerd(id): alleen voor gebruik binnen andere functies
create or replace function public.is_geblokkeerd(wie uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select geblokkeerd from profiles where id = wie), false)
      or exists (select 1 from blokkades b
                 where b.gebruiker_id = wie
                   and b.opgeheven_op is null
                   and b.van <= now()
                   and (b.tot is null or b.tot > now()));
$$;
revoke execute on function public.is_geblokkeerd(uuid) from public, anon, authenticated;

-- ben_ik_geblokkeerd(): alleen over jezelf, mag iedereen aanroepen
create or replace function public.ben_ik_geblokkeerd()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and public.is_geblokkeerd(auth.uid());
$$;

-- 3. Regels
drop policy if exists "Berichten versturen" on public.messages;
create policy "Berichten versturen" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and not public.ben_ik_geblokkeerd()
    and (receiver_id = auth.uid()
         or exists (select 1 from public.friendships f
                    where f.status = 'accepted'
                      and f.user_id = auth.uid() and f.friend_id = receiver_id))
  );

drop policy if exists "Gastenboek schrijven als vriend" on public.guestbook_entries;
create policy "Gastenboek schrijven als vriend" on public.guestbook_entries
  for insert with check (
    auth.uid() = author_id
    and not public.ben_ik_geblokkeerd()
    and (profile_id = auth.uid()
         or exists (select 1 from public.friendships f
                    where f.status = 'accepted'
                      and f.user_id = auth.uid() and f.friend_id = profile_id))
  );

drop policy if exists "eigen reactie plaatsen" on public.reacties;
create policy "eigen reactie plaatsen" on public.reacties
  for insert with check (
    user_id = auth.uid()
    and not public.ben_ik_geblokkeerd()
    and exists (select 1 from public.messages m
                where m.id = reacties.bericht_id
                  and (m.sender_id = auth.uid() or m.receiver_id = auth.uid()))
  );

drop policy if exists "eigen invites aanmaken" on public.invite_tokens;
create policy "eigen invites aanmaken" on public.invite_tokens
  for insert to authenticated with check (
    created_by = auth.uid()
    and not public.ben_ik_geblokkeerd()
  );

-- 4. Functies
create or replace function public.stem_op_poll(eigenaar_in uuid, poll_id_in text, optie_in integer, aantal_opties integer)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  mij uuid := auth.uid();
begin
  if mij is null then return 'niet ingelogd'; end if;
  if public.is_geblokkeerd(mij) then return 'geblokkeerd'; end if;
  if poll_id_in is null or length(poll_id_in) > 64 then return 'ongeldige poll'; end if;
  if aantal_opties is null or aantal_opties < 2 or aantal_opties > 10 then return 'ongeldige poll'; end if;
  if optie_in is null or optie_in < 0 or optie_in >= aantal_opties then return 'ongeldige optie'; end if;

  if not exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.user_id = mij and f.friend_id = eigenaar_in)
        or (f.friend_id = mij and f.user_id = eigenaar_in))
  ) then
    return 'geen vriend';
  end if;

  -- Eerst vastleggen DAT je stemt; lukt dat niet, dan had je al gestemd
  insert into poll_stemmers (eigenaar_id, poll_id, stemmer_id)
  values (eigenaar_in, poll_id_in, mij)
  on conflict do nothing;
  if not found then return 'al gestemd'; end if;

  -- Dan de teller ophogen, zonder naam
  insert into poll_tellers (eigenaar_id, poll_id, optie, aantal)
  values (eigenaar_in, poll_id_in, optie_in, 1)
  on conflict (eigenaar_id, poll_id, optie)
  do update set aantal = poll_tellers.aantal + 1;

  return 'ok';
end;
$function$;

create or replace function public.maak_vriendschap_via_invite(token_in text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare mij uuid; uitnodiger uuid;
begin
  mij := auth.uid();
  if mij is null then return false; end if;
  if public.is_geblokkeerd(mij) then return false; end if;

  -- Token afboeken en uitnodiger ophalen in een stap: kan maar een keer lukken.
  -- Een token van een geblokkeerd account werkt niet (en blijft onaangeroerd).
  update invite_tokens
     set is_used = true, used_at = now(), used_by = mij
   where token = token_in and is_used = false
     and (expires_at is null or expires_at > now())
     and created_by <> mij
     and not public.is_geblokkeerd(created_by)
  returning created_by into uitnodiger;

  if uitnodiger is null then return false; end if;

  insert into friendships (user_id, friend_id, status)
  values (mij, uitnodiger, 'accepted') on conflict do nothing;
  insert into friendships (user_id, friend_id, status)
  values (uitnodiger, mij, 'accepted') on conflict do nothing;
  return true;
end;
$function$;

create or replace function public.gebruik_invite(token_in text, gebruiker uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare aantal integer;
begin
  if auth.uid() is null then return false; end if;
  if public.is_geblokkeerd(auth.uid()) then return false; end if;
  update invite_tokens set is_used = true, used_at = now(), used_by = auth.uid()
  where token = token_in and is_used = false
    and (expires_at is null or expires_at > now());
  get diagnostics aantal = row_count;
  return aantal > 0;
end;
$function$;

-- 5. Profielen: geblokkeerd account mag alleen nog online-velden wijzigen
create or replace function public.bescherm_profielrechten()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

commit;

-- Controle: verwacht 'regels met blokkade: 4', 'functies met blokkade: 4',
-- 'blokkades: RLS aan, 3 regels', 'triggers: 2', 'is_geblokkeerd voor app: false'.
select 'regels met blokkade' as soort, count(*)::text as detail
from pg_policies
where schemaname = 'public' and with_check like '%ben_ik_geblokkeerd%'
union all
select 'functies met blokkade', count(*)::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('stem_op_poll', 'maak_vriendschap_via_invite', 'gebruik_invite', 'bescherm_profielrechten')
  and pg_get_functiondef(p.oid) like '%geblokkeerd(%'
union all
select 'blokkades', case when c.relrowsecurity then 'RLS aan, ' else 'RLS UIT, ' end
       || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'blokkades') || ' regels'
from pg_class c where c.oid = 'public.blokkades'::regclass
union all
select 'triggers', count(*)::text
from pg_trigger
where not tgisinternal
  and tgname in ('bescherm_profielrechten', 'bescherm_blokkades')
union all
select 'is_geblokkeerd voor app',
       has_function_privilege('authenticated', 'public.is_geblokkeerd(uuid)', 'EXECUTE')::text;
