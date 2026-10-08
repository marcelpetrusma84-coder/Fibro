-- nep-supabase.sql: een kleine nabootsing van de Fibro-database (Supabase) in een gewone PostgreSQL 16,
-- om SQL-bestanden uit sql/ vooraf te proberen. Alleen nep-gegevens (Bram, Lotte, Marcel).
-- Kolommen en regels van messages zoals de SQL Editor ze op 8 oktober 2026 liet zien.
-- v38: alle tabellen met een verwijzing naar een account, met dezelfde verwijzingen (bij wissen:
-- CASCADE / SET NULL / NO ACTION) als de echte database op 8 oktober 2026 (account verwijderen).
-- pg_cron bestaat hier niet: schema cron met job/schedule/unschedule nagebootst; haal in het
-- te testen bestand de regel 'create extension if not exists pg_cron;' weg.
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
drop schema if exists cron cascade; create schema cron;
drop schema if exists storage cascade; create schema storage;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
-- zoals Supabase: nieuwe functies in public krijgen vanzelf rechten voor anon en authenticated
alter default privileges in schema public grant execute on functions to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);

-- foto-opslag zoals Supabase: de twee emmers (op 8 oktober 2026 allebei leeg)
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
insert into storage.buckets (id, name, public) values ('Wallpapers', 'Wallpapers', true), ('chat-fotos', 'chat-fotos', true);

create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (n, s, c)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(j bigint) returns boolean language sql as $$ delete from cron.job where jobid = j returning true $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, username text, display_name text, avatar_url text,
  geblokkeerd boolean default false, is_moderator boolean default false,
  is_plus boolean default false, online_status boolean default false, toon_online boolean default true,
  updated_at timestamptz default now(), public_key text, avatar_data text, wallpaper_data text);
create table public.friendships (id uuid unique default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade, status text, primary key (user_id, friend_id));
create table public.messages (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade, content text not null, delivered boolean default false,
  delivered_at timestamptz, expires_at timestamptz default (now() + interval '24 hours'), screenshot_allowed boolean default false,
  screenshot_allowed_until timestamptz, created_at timestamptz default now(), antwoord_op uuid references messages(id) on delete set null);
create table public.reacties (id uuid primary key default gen_random_uuid(), bericht_id uuid not null references messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, soort text, inhoud text);
create table public.verborgen_berichten (gebruiker_id uuid not null references auth.users(id) on delete cascade,
  bericht_id uuid not null references messages(id) on delete cascade, gemaakt_op timestamptz not null default now(), primary key (gebruiker_id, bericht_id));
create table public.blokkades (id uuid primary key default gen_random_uuid(), gebruiker_id uuid not null references profiles(id) on delete cascade,
  reden text not null, van timestamptz not null default now(), tot timestamptz, door uuid, opgeheven_op timestamptz, opgeheven_door uuid,
  created_at timestamptz not null default now());
create table public.guestbook_entries (id uuid primary key default gen_random_uuid(), profile_id uuid references profiles(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade, content text, created_at timestamptz default now());
create table public.invite_tokens (id uuid primary key default gen_random_uuid(), token text, created_by uuid,
  used_by uuid references profiles(id) on delete set null, expires_at timestamptz, created_at timestamptz default now());
create table public.laatst_gelezen (gebruiker_id uuid not null references auth.users(id) on delete cascade, vriend_id uuid not null,
  gelezen_tot timestamptz not null default now(), primary key (gebruiker_id, vriend_id));
create table public.mijn_blokkades (blokkeerder_id uuid not null references profiles(id) on delete cascade,
  geblokkeerde_id uuid not null references profiles(id) on delete cascade, created_at timestamptz not null default now(),
  primary key (blokkeerder_id, geblokkeerde_id));
create table public.passkey_kluis (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  cred_id text not null, blob text not null, naam text, gemaakt_op timestamptz not null default now());
create table public.poll_tellers (eigenaar_id uuid not null references auth.users(id) on delete cascade, poll_id text not null,
  optie int not null, aantal int not null default 0, primary key (eigenaar_id, poll_id, optie));
create table public.poll_stemmers (eigenaar_id uuid not null references auth.users(id) on delete cascade, poll_id text not null,
  stemmer_id uuid not null references auth.users(id) on delete cascade, primary key (eigenaar_id, poll_id, stemmer_id));
create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id) on delete cascade,
  endpoint text, p256dh text, auth text, created_at timestamptz default now());
create table public.rapporten (id uuid primary key default gen_random_uuid(), melder_id uuid references profiles(id),
  gemelde_id uuid references profiles(id), bericht_inhoud text, reden text, status text default 'open', created_at timestamptz default now());
create table public.sleutel_kluis (user_id uuid primary key references auth.users(id) on delete cascade, blob text);

create function public.ben_ik_geblokkeerd() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select geblokkeerd from profiles where id = auth.uid()), false) $$;
-- zoals bescherm_profielrechten: de app zelf mag geen moderator worden en een geblokkeerd account
-- mag zijn profiel niet zelf verwijderen (SQL Editor en functies met security definer wel)
create function public.bescherm_profielrechten() returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if coalesce(old.geblokkeerd, false) then raise exception 'Een geblokkeerd account kan zijn profiel niet verwijderen'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.is_moderator is distinct from old.is_moderator then
    raise exception 'is_moderator kan alleen via de SQL Editor worden gewijzigd';
  end if;
  return new;
end $$;
create trigger bescherm_profielrechten before insert or update or delete on public.profiles for each row execute function public.bescherm_profielrechten();

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.friendships enable row level security;
alter table public.reacties enable row level security;
alter table public.rapporten enable row level security;
alter table public.invite_tokens enable row level security;
alter table public.laatst_gelezen enable row level security;
create policy "profielen lezen" on public.profiles for select using (true);
create policy "eigen profiel" on public.profiles for update using (id = auth.uid());
create policy "vrienden lezen" on public.friendships for select using (user_id = auth.uid() or friend_id = auth.uid());
create policy "Berichten voor zender en ontvanger" on public.messages for select using ((auth.uid() = sender_id) or (auth.uid() = receiver_id));
create policy "Berichten versturen" on public.messages for insert with check (
  auth.uid() = sender_id and not ben_ik_geblokkeerd()
  and (receiver_id = auth.uid() or exists (select 1 from friendships f where f.status = 'accepted' and f.user_id = auth.uid() and f.friend_id = messages.receiver_id)));
create policy "reacties" on public.reacties for all using (true);
create policy "Gebruikers kunnen rapporteren" on public.rapporten for insert with check (melder_id = auth.uid());
create policy "eigen invites aanmaken" on public.invite_tokens for insert with check (true);
create policy "eigen gelezen lezen" on public.laatst_gelezen for select using (gebruiker_id = auth.uid());
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- nep-gegevens: Marcel (m), Bram (b), Lotte (l); Marcel-Bram en Marcel-Lotte zijn vrienden
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'marcel@nep.invalid'), ('bbbb0001-0000-4000-8000-000000000001', 'bram@nep.invalid'),
  ('cccc0002-0000-4000-8000-000000000002', 'lotte@nep.invalid');
insert into auth.identities (user_id) select id from auth.users;
insert into profiles (id, username, public_key) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Marcel', 'pk-m'), ('bbbb0001-0000-4000-8000-000000000001', 'Bram', 'pk-b'),
  ('cccc0002-0000-4000-8000-000000000002', 'Lotte', 'pk-l');
insert into friendships (user_id, friend_id, status) values
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
insert into reacties (bericht_id, user_id, soort, inhoud) select id, sender_id, 'emoji', 'x' from messages where content = 'e2e:oud50';
-- v38: van elke soort iets, zodat account verwijderen overal iets te doen heeft
insert into messages (sender_id, receiver_id, content) values ('bbbb0001-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002', 'e2e:bram-lotte');
insert into reacties (bericht_id, user_id, soort, inhoud) select id, 'cccc0002-0000-4000-8000-000000000002', 'emoji', 'y' from messages where content = 'e2e:oud51';
insert into verborgen_berichten (gebruiker_id, bericht_id) select 'bbbb0001-0000-4000-8000-000000000001', id from messages where content = 'e2e:oud2';
insert into blokkades (gebruiker_id, reden, door) values ('bbbb0001-0000-4000-8000-000000000001', 'test', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into guestbook_entries (profile_id, author_id, content) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbb0001-0000-4000-8000-000000000001', 'hoi Marcel'),
  ('bbbb0001-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hoi Bram'),
  ('cccc0002-0000-4000-8000-000000000002', 'bbbb0001-0000-4000-8000-000000000001', 'hoi Lotte');
insert into invite_tokens (token, created_by, used_by) values
  ('t-bram-1', 'bbbb0001-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002'),
  ('t-bram-2', 'bbbb0001-0000-4000-8000-000000000001', null),
  ('t-marcel', 'aaaaaaaa-0000-4000-8000-000000000001', 'bbbb0001-0000-4000-8000-000000000001');
insert into laatst_gelezen (gebruiker_id, vriend_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbb0001-0000-4000-8000-000000000001'),
  ('bbbb0001-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('cccc0002-0000-4000-8000-000000000002', 'bbbb0001-0000-4000-8000-000000000001');
insert into mijn_blokkades (blokkeerder_id, geblokkeerde_id) values
  ('bbbb0001-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002'),
  ('cccc0002-0000-4000-8000-000000000002', 'bbbb0001-0000-4000-8000-000000000001');
insert into passkey_kluis (user_id, cred_id, blob) values ('bbbb0001-0000-4000-8000-000000000001', 'cred-bram-0001', 'blob-bram-0000000000000000');
insert into poll_tellers (eigenaar_id, poll_id, optie, aantal) values ('aaaaaaaa-0000-4000-8000-000000000001', 'p1', 0, 1), ('bbbb0001-0000-4000-8000-000000000001', 'p2', 1, 1);
insert into poll_stemmers (eigenaar_id, poll_id, stemmer_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'p1', 'bbbb0001-0000-4000-8000-000000000001'),
  ('bbbb0001-0000-4000-8000-000000000001', 'p2', 'aaaaaaaa-0000-4000-8000-000000000001');
insert into push_subscriptions (user_id, endpoint) values ('bbbb0001-0000-4000-8000-000000000001', 'https://push.nep.invalid/bram'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'https://push.nep.invalid/marcel');
insert into rapporten (melder_id, gemelde_id, reden) values
  ('bbbb0001-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002', 'nep 1'),
  ('cccc0002-0000-4000-8000-000000000002', 'bbbb0001-0000-4000-8000-000000000001', 'nep 2'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002', 'nep 3');
insert into sleutel_kluis (user_id, blob) values ('bbbb0001-0000-4000-8000-000000000001', 'kluis-bram'), ('aaaaaaaa-0000-4000-8000-000000000001', 'kluis-marcel');
