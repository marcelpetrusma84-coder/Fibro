-- Koningsjacht: scores per ronde, eigen/vrienden-top 10 en een anoniem wereldrecord.
-- Eenmaal uitvoeren in Supabase SQL Editor vóór nieuwe clients met scorecategorieën live gaan.
-- Dit kan vóór de app-merge: de oude parameterloze RPC blijft bestaan voor reeds geopende apps.
-- Herhaalbaar. Geen profielnamen/weergavenamen worden hier gekopieerd of gepubliceerd.
begin;

create table if not exists public.koningsjacht_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  score bigint not null check (score between 0 and 12),
  played_at timestamptz not null,
  received_at timestamptz not null default now(),
  level smallint not null default 1 check (level between 1 and 3),
  won boolean not null default false,
  mode text not null default 'solo' check (mode in ('solo', 'samen', 'wedstrijd', 'duel', 'beleg')),
  primary key (user_id, run_id)
);
create index if not exists koningsjacht_personal_rank
  on public.koningsjacht_scores (user_id, score desc, played_at, run_id);
create index if not exists koningsjacht_global_rank
  on public.koningsjacht_scores (score desc, played_at, user_id, run_id);

alter table public.koningsjacht_scores enable row level security;
revoke all on public.koningsjacht_scores from public, anon, authenticated;
grant select on public.koningsjacht_scores to authenticated;
drop policy if exists koningsjacht_read_own on public.koningsjacht_scores;
create policy koningsjacht_read_own on public.koningsjacht_scores
  for select to authenticated using (user_id = auth.uid());

-- Privéhulpfunctie: beide kanten moeten nog vrienden zijn. Een persoonlijke blokkade
-- in één van beide richtingen sluit de naam en scores uit de vriendenlijst uit.
create or replace function public.koningsjacht_friend(viewer uuid, player uuid)
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
revoke all on function public.koningsjacht_friend(uuid, uuid) from public, anon, authenticated;

-- Alleen deze functie schrijft. De eigenaar komt uit het JWT, nooit uit een clientparameter.
-- Dezelfde UUID opnieuw versturen is veilig en verandert een al vastgelegde score niet.
drop function if exists public.koningsjacht_save_score(uuid, bigint, timestamptz, integer, boolean, text);
create or replace function public.koningsjacht_save_score(
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
  if p_run_id is null or p_score is null or p_score < 0 or p_score > 12
     or p_played_at is null or not isfinite(p_played_at)
     or p_played_at < timestamptz '2020-01-01 00:00:00+00'
     or p_played_at > now() + interval '5 minutes'
     or p_level is null or p_level not between 1 and 3
     or p_won is null or p_won <> (p_score = 12) or p_mode is null or p_mode not in ('solo', 'samen', 'wedstrijd', 'duel', 'beleg') then
    raise exception 'Invalid Koningsjacht run' using errcode = '22023';
  end if;
  insert into public.koningsjacht_scores(user_id, run_id, score, played_at, level, won, mode)
  values (me, p_run_id, p_score, p_played_at, p_level, p_won, p_mode)
  on conflict (user_id, run_id) do nothing;
end;
$$;
revoke all on function public.koningsjacht_save_score(uuid, bigint, timestamptz, integer, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.koningsjacht_save_score(uuid, bigint, timestamptz, integer, boolean, text, uuid)
  to authenticated;

-- Geen vrij kiesbare spelerparameter: de uitslag is altijd voor auth.uid().
-- Nieuwe clients vragen per startniveau op (niveau 1/2/3 = 4/2/0 narren).
-- Wereldrecord: onbekende speler levert UITSLUITEND {score, level, won, mode}; geen id, naam of tijd.
create or replace function public.koningsjacht_boards(p_level integer)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
  personal jsonb;
  friends jsonb;
  world jsonb := null;
  known jsonb := '[]'::jsonb;
  record public.koningsjacht_scores%rowtype;
  record_username text;
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_level is null or p_level not between 1 and 3 then raise exception 'Invalid Koningsjacht level' using errcode = '22023'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.run_id), '[]'::jsonb)
    into personal from (
      select s.user_id, s.run_id, s.score, s.played_at, s.level, s.won, s.mode, p.username
      from public.koningsjacht_scores s join public.profiles p on p.id = s.user_id
      where s.user_id = me and s.level = p_level
      order by s.score desc, s.played_at, s.run_id limit 10
    ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.user_id, r.run_id), '[]'::jsonb)
    into friends from (
      select s.user_id, s.run_id, s.score, s.played_at, s.level, s.won, s.mode, p.username
      from public.koningsjacht_scores s join public.profiles p on p.id = s.user_id
      where s.level = p_level
        and (s.user_id = me or public.koningsjacht_friend(me, s.user_id))
        and not coalesce(p.geblokkeerd, false)
        and not exists (select 1 from public.blokkades b where b.gebruiker_id = s.user_id
                        and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()))
      order by s.score desc, s.played_at, s.user_id, s.run_id limit 10
    ) r;

  select s.* into record from public.koningsjacht_scores s join public.profiles p on p.id = s.user_id
    where s.level = p_level
      and not coalesce(p.geblokkeerd, false)
      and not exists (select 1 from public.blokkades b where b.gebruiker_id = s.user_id
                      and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()))
    order by s.score desc, s.played_at, s.user_id, s.run_id limit 1;
  if found then
    world := jsonb_build_object('score', record.score, 'level', record.level, 'won', record.won, 'mode', record.mode);
    if record.user_id = me or public.koningsjacht_friend(me, record.user_id) then
      select p.username into record_username from public.profiles p where p.id = record.user_id;
      world := world || jsonb_build_object('user_id', record.user_id, 'username', record_username,
                                          'played_at', record.played_at);
      known := jsonb_build_array(jsonb_build_object('user_id', record.user_id));
    end if;
  end if;
  return jsonb_build_object('personal', personal, 'friends', friends, 'global', world, 'known_players', known);
end;
$$;
revoke all on function public.koningsjacht_boards(integer) from public, anon, authenticated;
grant execute on function public.koningsjacht_boards(integer) to authenticated;

-- Backward compatibility: oudere appversies roepen nog zonder argument aan.
-- Laat deze overload bestaan (en herstel hem als de eerdere migratie hem al had verwijderd).
create or replace function public.koningsjacht_boards()
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
  personal jsonb;
  friends jsonb;
  world jsonb := null;
  known jsonb := '[]'::jsonb;
  record public.koningsjacht_scores%rowtype;
  record_username text;
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.run_id), '[]'::jsonb)
    into personal from (
      select s.user_id, s.run_id, s.score, s.played_at, s.level, s.won, s.mode, p.username
      from public.koningsjacht_scores s join public.profiles p on p.id = s.user_id
      where s.user_id = me
      order by s.score desc, s.played_at, s.run_id limit 10
    ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.user_id, r.run_id), '[]'::jsonb)
    into friends from (
      select s.user_id, s.run_id, s.score, s.played_at, s.level, s.won, s.mode, p.username
      from public.koningsjacht_scores s join public.profiles p on p.id = s.user_id
      where (s.user_id = me or public.koningsjacht_friend(me, s.user_id))
        and not coalesce(p.geblokkeerd, false)
        and not exists (select 1 from public.blokkades b where b.gebruiker_id = s.user_id
                        and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()))
      order by s.score desc, s.played_at, s.user_id, s.run_id limit 10
    ) r;

  select s.* into record from public.koningsjacht_scores s join public.profiles p on p.id = s.user_id
    where not coalesce(p.geblokkeerd, false)
      and not exists (select 1 from public.blokkades b where b.gebruiker_id = s.user_id
                      and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()))
    order by s.score desc, s.played_at, s.user_id, s.run_id limit 1;
  if found then
    world := jsonb_build_object('score', record.score, 'level', record.level, 'won', record.won, 'mode', record.mode);
    if record.user_id = me or public.koningsjacht_friend(me, record.user_id) then
      select p.username into record_username from public.profiles p where p.id = record.user_id;
      world := world || jsonb_build_object('user_id', record.user_id, 'username', record_username,
                                          'played_at', record.played_at);
      known := jsonb_build_array(jsonb_build_object('user_id', record.user_id));
    end if;
  end if;
  return jsonb_build_object('personal', personal, 'friends', friends, 'global', world, 'known_players', known);
end;
$$;
revoke all on function public.koningsjacht_boards() from public, anon, authenticated;
grant execute on function public.koningsjacht_boards() to authenticated;
commit;
