-- Three-player chess lobby and private Realtime room.
-- Apply this migration in Supabase before using the three-player invite option.
begin;

create table if not exists public.chess_three_sessions (
  session_id text primary key check (session_id ~ '^[0-9a-z]{1,20}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  player_ids uuid[] not null,
  created_at timestamptz not null default now(),
  constraint chess_three_sessions_three_players check (cardinality(player_ids) = 3),
  constraint chess_three_sessions_unique_players check (
    player_ids[1] <> player_ids[2] and player_ids[1] <> player_ids[3] and player_ids[2] <> player_ids[3]
  ),
  constraint chess_three_sessions_host_is_player check (host_id = any(player_ids))
);

alter table public.chess_three_sessions enable row level security;
revoke all on public.chess_three_sessions from anon, public;
grant select on public.chess_three_sessions to authenticated;
drop policy if exists chess_three_session_read_member on public.chess_three_sessions;
create policy chess_three_session_read_member on public.chess_three_sessions
  for select to authenticated using (auth.uid() = any(player_ids));

create or replace function public.create_chess_three_session(p_session_id text, p_player_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  host uuid := auth.uid();
  friend uuid;
begin
  if host is null then raise exception 'Authentication required'; end if;
  if p_session_id is null or p_session_id !~ '^[0-9a-z]{1,20}$' then raise exception 'Invalid session id'; end if;
  if p_player_ids is null or cardinality(p_player_ids) <> 3 or cardinality(array(select distinct unnest(p_player_ids))) <> 3 then
    raise exception 'Exactly three different players are required';
  end if;
  if not host = any(p_player_ids) then raise exception 'The host must be in the roster'; end if;

  foreach friend in array p_player_ids loop
    if friend <> host and not (
      exists (select 1 from public.friendships f where f.user_id = host and f.friend_id = friend and f.status = 'accepted')
      and exists (select 1 from public.friendships f where f.user_id = friend and f.friend_id = host and f.status = 'accepted')
    ) then raise exception 'Every invitee must be an accepted friend of the host'; end if;
  end loop;

  insert into public.chess_three_sessions(session_id, host_id, player_ids)
  values (p_session_id, host, p_player_ids);
end
$$;
revoke all on function public.create_chess_three_session(text, uuid[]) from public, anon;
grant execute on function public.create_chess_three_session(text, uuid[]) to authenticated;

-- Extend the existing private-channel authorization. All the prior channel
-- rules are preserved; the new room is available only to its three roster ids.
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
  return false;
end
$$;

revoke all on function public.realtime_toegang(text, text, boolean) from public, anon;
grant execute on function public.realtime_toegang(text, text, boolean) to authenticated;
commit;
