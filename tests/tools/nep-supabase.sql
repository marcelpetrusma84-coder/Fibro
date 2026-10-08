-- nep-supabase.sql: een kleine nabootsing van de Fibro-database (Supabase) in een gewone PostgreSQL 16,
-- om SQL-bestanden uit sql/ vooraf te proberen. Alleen nep-gegevens (Bram, Lotte, Marcel).
-- Kolommen en regels van messages zoals de SQL Editor ze op 8 oktober 2026 liet zien.
-- pg_cron bestaat hier niet: schema cron met job/schedule/unschedule nagebootst; haal in het
-- te testen bestand de regel 'create extension if not exists pg_cron;' weg.
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
drop schema if exists cron cascade; create schema cron;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;

create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (n, s, c)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(j bigint) returns boolean language sql as $$ delete from cron.job where jobid = j returning true $$;

create table public.profiles (
  id uuid primary key, username text, avatar_url text, geblokkeerd boolean default false, is_moderator boolean default false,
  is_plus boolean default false, online_status boolean default false, toon_online boolean default true,
  updated_at timestamptz default now(), public_key text);
create table public.friendships (user_id uuid references profiles(id), friend_id uuid references profiles(id), status text, primary key (user_id, friend_id));
create table public.messages (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade, content text not null, delivered boolean default false,
  delivered_at timestamptz, expires_at timestamptz default (now() + interval '24 hours'), screenshot_allowed boolean default false,
  screenshot_allowed_until timestamptz, created_at timestamptz default now(), antwoord_op uuid references messages(id) on delete set null);
create table public.reacties (id bigserial primary key, bericht_id uuid not null references messages(id), user_id uuid, emoji text);
create table public.verborgen_berichten (gebruiker_id uuid, bericht_id uuid not null references messages(id) on delete cascade, primary key (gebruiker_id, bericht_id));

create function public.ben_ik_geblokkeerd() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select geblokkeerd from profiles where id = auth.uid()), false) $$;
-- zoals bescherm_profielrechten: de app zelf mag geen moderator worden
create function public.bescherm_profielrechten() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and tg_op = 'UPDATE' and new.is_moderator is distinct from old.is_moderator then
    raise exception 'is_moderator kan alleen via de SQL Editor worden gewijzigd';
  end if;
  return new;
end $$;
create trigger bescherm_profielrechten before update on public.profiles for each row execute function public.bescherm_profielrechten();

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.friendships enable row level security;
alter table public.reacties enable row level security;
create policy "profielen lezen" on public.profiles for select using (true);
create policy "eigen profiel" on public.profiles for update using (id = auth.uid());
create policy "vrienden lezen" on public.friendships for select using (user_id = auth.uid() or friend_id = auth.uid());
create policy "Berichten voor zender en ontvanger" on public.messages for select using ((auth.uid() = sender_id) or (auth.uid() = receiver_id));
create policy "Berichten versturen" on public.messages for insert with check (
  auth.uid() = sender_id and not ben_ik_geblokkeerd()
  and (receiver_id = auth.uid() or exists (select 1 from friendships f where f.status = 'accepted' and f.user_id = auth.uid() and f.friend_id = messages.receiver_id)));
create policy "reacties" on public.reacties for all using (true);
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- nep-gegevens: Marcel (m), Bram (b), Lotte (l); Marcel-Bram en Marcel-Lotte zijn vrienden
insert into profiles (id, username) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Marcel'), ('bbbb0001-0000-4000-8000-000000000001', 'Bram'), ('cccc0002-0000-4000-8000-000000000002', 'Lotte');
insert into friendships values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbb0001-0000-4000-8000-000000000001', 'accepted'),
  ('bbbb0001-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'accepted'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002', 'accepted'),
  ('cccc0002-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'accepted');
-- oude berichten zoals nu: 31 dagen na versturen (veel al verlopen), speluitnodigingen 24 uur
insert into messages (sender_id, receiver_id, content, created_at, expires_at)
select case when i % 2 = 0 then 'aaaaaaaa-0000-4000-8000-000000000001'::uuid else 'bbbb0001-0000-4000-8000-000000000001'::uuid end,
       case when i % 2 = 0 then 'bbbb0001-0000-4000-8000-000000000001'::uuid else 'aaaaaaaa-0000-4000-8000-000000000001'::uuid end,
       'e2e:oud' || i, now() - make_interval(days => i), now() - make_interval(days => i) + interval '31 days'
from generate_series(0, 79) i;
insert into messages (sender_id, receiver_id, content, created_at, expires_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002', 'spelinvite:pong:x:1', now() - interval '3 days', now() - interval '2 days');
insert into reacties (bericht_id, user_id, emoji) select id, sender_id, 'x' from messages where content = 'e2e:oud50';
