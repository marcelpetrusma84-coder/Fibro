-- Neon Raiders: scores per ronde, eigen/vrienden-top 10 en een anoniem wereldrecord.
-- Eenmaal uitvoeren in Supabase SQL Editor vóór de nieuwe scorelijsten worden gebruikt.
-- Herhaalbaar. Geen profielnamen/weergavenamen worden hier gekopieerd of gepubliceerd.
begin;

create table if not exists public.neon_raiders_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  score bigint not null check (score between 0 and 2147483647),
  played_at timestamptz not null,
  received_at timestamptz not null default now(),
  level smallint not null default 1 check (level between 1 and 7),
  won boolean not null default false,
  mode text not null default 'solo' check (mode in ('solo', 'co-op')),
  primary key (user_id, run_id)
);
create index if not exists neon_raiders_personal_rank
  on public.neon_raiders_scores (user_id, score desc, played_at, run_id);
create index if not exists neon_raiders_global_rank
  on public.neon_raiders_scores (score desc, played_at, user_id, run_id);

alter table public.neon_raiders_scores enable row level security;
revoke all on public.neon_raiders_scores from public, anon, authenticated;
grant select on public.neon_raiders_scores to authenticated;
drop policy if exists neon_raiders_read_own on public.neon_raiders_scores;
create policy neon_raiders_read_own on public.neon_raiders_scores
  for select to authenticated using (user_id = auth.uid());

-- Privéhulpfunctie: beide kanten moeten nog vrienden zijn. Een persoonlijke blokkade
-- in één van beide richtingen sluit de naam en scores uit de vriendenlijst uit.
create or replace function public.neon_raiders_friend(viewer uuid, player uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select viewer is not null and player is not null and viewer <> player
    and exists (select 1 from public.friendships f
                where f.user_id = viewer and f.friend_id = player and f.status = 'accepted')
    and exists (select 1 from public.friendships f
                where f.user_id = player and f.friend_id = viewer and f.status = 'accepted')
    and not exists (select 1 from public.mijn_blokkades b
                    where (b.blokkeerder_id = viewer and b.geblokkeerde_id = player)
                       or (b.blokkeerder_id = player and b.geblokkeerde_id = viewer));
$$;
revoke all on function public.neon_raiders_friend(uuid, uuid) from public, anon, authenticated;

-- Alleen deze functie schrijft. De eigenaar komt uit het JWT, nooit uit een clientparameter.
-- Dezelfde UUID opnieuw versturen is veilig en verandert een al vastgelegde score niet.
drop function if exists public.neon_raiders_save_score(uuid, bigint, timestamptz, integer, boolean, text);
create or replace function public.neon_raiders_save_score(
  p_run_id uuid, p_score bigint, p_played_at timestamptz,
  p_level integer default 1, p_won boolean default false, p_mode text default 'solo',
  p_expected_user uuid default auth.uid()
)
returns void language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_user is distinct from me then raise exception 'Account changed' using errcode = '42501'; end if;
  if public.ben_ik_geblokkeerd() then raise exception 'Account restricted' using errcode = '42501'; end if;
  if p_run_id is null or p_score is null or p_score < 0 or p_score > 2147483647
     or p_played_at is null or not isfinite(p_played_at)
     or p_played_at < timestamptz '2020-01-01 00:00:00+00'
     or p_played_at > now() + interval '5 minutes'
     or p_level is null or p_level not between 1 and 7
     or p_won is null or p_mode is null or p_mode not in ('solo', 'co-op') then
    raise exception 'Invalid Neon Raiders run' using errcode = '22023';
  end if;
  insert into public.neon_raiders_scores(user_id, run_id, score, played_at, level, won, mode)
  values (me, p_run_id, p_score, p_played_at, p_level, p_won, p_mode)
  on conflict (user_id, run_id) do nothing;
end;
$$;
revoke all on function public.neon_raiders_save_score(uuid, bigint, timestamptz, integer, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.neon_raiders_save_score(uuid, bigint, timestamptz, integer, boolean, text, uuid)
  to authenticated;

-- Geen vrij kiesbare spelerparameter: de uitslag is altijd voor auth.uid().
-- Wereldrecord: onbekende speler levert UITSLUITEND {score}; ook geen id, naam of tijd.
create or replace function public.neon_raiders_boards()
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
  personal jsonb;
  friends jsonb;
  world jsonb := null;
  known jsonb := '[]'::jsonb;
  record public.neon_raiders_scores%rowtype;
  record_username text;
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.run_id), '[]'::jsonb)
    into personal from (
      select s.user_id, s.run_id, s.score, s.played_at, p.username
      from public.neon_raiders_scores s join public.profiles p on p.id = s.user_id
      where s.user_id = me
      order by s.score desc, s.played_at, s.run_id limit 10
    ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.user_id, r.run_id), '[]'::jsonb)
    into friends from (
      select s.user_id, s.run_id, s.score, s.played_at, p.username
      from public.neon_raiders_scores s join public.profiles p on p.id = s.user_id
      where (s.user_id = me or public.neon_raiders_friend(me, s.user_id))
        and not coalesce(p.geblokkeerd, false)
        and not exists (select 1 from public.blokkades b where b.gebruiker_id = s.user_id
                        and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()))
      order by s.score desc, s.played_at, s.user_id, s.run_id limit 10
    ) r;

  select s.* into record from public.neon_raiders_scores s join public.profiles p on p.id = s.user_id
    where not coalesce(p.geblokkeerd, false)
      and not exists (select 1 from public.blokkades b where b.gebruiker_id = s.user_id
                      and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()))
    order by s.score desc, s.played_at, s.user_id, s.run_id limit 1;
  if found then
    world := jsonb_build_object('score', record.score);
    if record.user_id = me or public.neon_raiders_friend(me, record.user_id) then
      select p.username into record_username from public.profiles p where p.id = record.user_id;
      world := world || jsonb_build_object('user_id', record.user_id, 'username', record_username,
                                          'played_at', record.played_at);
      known := jsonb_build_array(jsonb_build_object('user_id', record.user_id));
    end if;
  end if;
  return jsonb_build_object('personal', personal, 'friends', friends, 'global', world, 'known_players', known);
end;
$$;
revoke all on function public.neon_raiders_boards() from public, anon, authenticated;
grant execute on function public.neon_raiders_boards() to authenticated;
commit;
