-- ONLY in an empty disposable PostgreSQL database. Synthetic schemas, no real accounts.
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;
create table public.profiles(id uuid primary key, username text, geblokkeerd boolean default false);
create table public.friendships(user_id uuid, friend_id uuid, status text, primary key(user_id, friend_id));
create table public.mijn_blokkades(blokkeerder_id uuid, geblokkeerde_id uuid);
create table public.blokkades(gebruiker_id uuid, opgeheven_op timestamptz, van timestamptz, tot timestamptz);
create function public.ben_ik_geblokkeerd() returns boolean language sql stable security definer as $$
  select coalesce((select geblokkeerd from public.profiles where id = auth.uid()), false)
$$;
