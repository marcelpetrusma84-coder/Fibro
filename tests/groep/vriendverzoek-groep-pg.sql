-- Proef voor sql/vriendverzoek-groep.sql op een lege, lokale PostgreSQL (niet Supabase): een nagebouwd stukje van
-- Stekky (auth.uid, profiles, friendships, groepen, groep_leden, mijn_blokkades, is_geblokkeerd, zijn_vrienden).
-- Gebruik: psql -v ON_ERROR_STOP=1 -f dit_bestand (zie test-vriendverzoek-groep.mjs).
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create table public.profiles (id uuid primary key references auth.users, username text, geblokkeerd boolean default false);
create table public.friendships (user_id uuid, friend_id uuid, status text, primary key (user_id, friend_id));
create table public.groepen (id uuid primary key default gen_random_uuid(), naam text);
create table public.groep_leden (groep_id uuid references public.groepen, user_id uuid, primary key (groep_id, user_id));
create table public.mijn_blokkades (blokkeerder_id uuid, geblokkeerde_id uuid);
create function public.is_geblokkeerd(u uuid) returns boolean language sql stable as $$ select coalesce((select geblokkeerd from public.profiles where id = u), false) $$;
create function public.zijn_vrienden(a uuid, b uuid) returns boolean language sql stable as $$
  select a <> b and exists (select 1 from public.friendships where user_id = a and friend_id = b and status = 'accepted')
                and exists (select 1 from public.friendships where user_id = b and friend_id = a and status = 'accepted') $$;
-- mensen: Marcel (1), Bram (2), Lotte (3), Kees (4, geblokkeerd account), Joep (5, niet in de groep)
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'), ('00000000-0000-0000-0000-000000000005');
insert into public.profiles (id, username, geblokkeerd) values ('00000000-0000-0000-0000-000000000001', 'Marcel', false),
  ('00000000-0000-0000-0000-000000000002', 'Bram', false), ('00000000-0000-0000-0000-000000000003', 'Lotte', false),
  ('00000000-0000-0000-0000-000000000004', 'Kees', true), ('00000000-0000-0000-0000-000000000005', 'Joep', false);
insert into public.groepen values ('10000000-0000-0000-0000-000000000001', 'Spelavond');
insert into public.groep_leden select '10000000-0000-0000-0000-000000000001', ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 4) n;
