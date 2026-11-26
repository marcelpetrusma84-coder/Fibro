-- Scores voor alle spellen (26 nov 2026, Marcel): één gedeelde lijst, jouw top 10 en die van je vrienden.
-- Eenmaal uitvoeren in de Supabase SQL Editor vóór de scoreborden in de spellen worden gebruikt. Herhaalbaar.
--
-- In gewone woorden:
--  - Elk afgelopen potje is één rij: welk spel, welk niveau, de score (spellen met punten) of gewonnen ja/nee
--    (spellen zonder punten, zoals Four in a Row, Schaken en Pesten tegen de computer).
--  - Alleen spel_score_opslaan schrijft, en altijd voor jezelf (uit je inlog, nooit uit wat de app meestuurt).
--    Hoogstens 30 potjes per minuut, zodat niemand de lijst kan volspammen.
--  - Je ziet alleen je eigen rijen en, via spel_scorebord / spel_scores_overzicht, die van je vrienden.
--    Wie geblokkeerd is (door de moderators, of door jou of je vriend), staat er niet tussen.
--  - Er worden geen namen gekopieerd: alleen de gebruikersnaam uit profiles, zoals bij Koningsjacht.
-- Koningsjacht en Neon Raiders houden hun eigen lijsten (koningsjacht_scores, neon_raiders_scores).
begin;

create table if not exists public.spel_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  spel text not null check (spel ~ '^[a-z0-9_-]{1,40}$'),
  niveau text not null default '' check (niveau ~ '^[a-z0-9_-]{0,20}$'),
  soort text not null check (soort in ('punten', 'winst')),
  score bigint not null default 0 check (score between 0 and 1000000000),
  gewonnen boolean not null default false,
  played_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (user_id, run_id)
);
create index if not exists spel_scores_rang on public.spel_scores (spel, soort, score desc, played_at);
create index if not exists spel_scores_eigen on public.spel_scores (user_id, spel, soort);
create index if not exists spel_scores_tempo on public.spel_scores (user_id, received_at);

alter table public.spel_scores enable row level security;
revoke all on public.spel_scores from public, anon, authenticated;
grant select on public.spel_scores to authenticated;
drop policy if exists spel_scores_eigen_lezen on public.spel_scores;
create policy spel_scores_eigen_lezen on public.spel_scores
  for select to authenticated using (user_id = auth.uid());

-- Privéhulp: allebei nog vrienden, en niemand heeft de ander geblokkeerd (zoals koningsjacht_friend).
create or replace function public.spel_vriend(viewer uuid, player uuid)
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
revoke all on function public.spel_vriend(uuid, uuid) from public, anon, authenticated;

-- Privéhulp: niet geblokkeerd door de moderators (zoals in koningsjacht_boards).
create or replace function public.spel_speler_zichtbaar(player uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (select 1 from public.profiles p where p.id = player and not coalesce(p.geblokkeerd, false))
    and not exists (select 1 from public.blokkades b where b.gebruiker_id = player
                    and b.opgeheven_op is null and b.van <= now() and (b.tot is null or b.tot > now()));
$$;
revoke all on function public.spel_speler_zichtbaar(uuid) from public, anon, authenticated;

-- Opslaan. Dezelfde run_id opnieuw sturen is veilig (verandert niets).
create or replace function public.spel_score_opslaan(
  p_run_id uuid, p_spel text, p_niveau text, p_soort text, p_score bigint, p_gewonnen boolean,
  p_played_at timestamptz, p_expected_user uuid default auth.uid()
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
  if p_run_id is null or p_spel is null or p_spel !~ '^[a-z0-9_-]{1,40}$'
     or p_niveau is null or p_niveau !~ '^[a-z0-9_-]{0,20}$'
     or p_soort is null or p_soort not in ('punten', 'winst')
     or p_score is null or p_score < 0 or p_score > 1000000000 or p_gewonnen is null
     or (p_soort = 'winst' and p_score <> (case when p_gewonnen then 1 else 0 end))
     or p_played_at is null or not isfinite(p_played_at)
     or p_played_at < timestamptz '2020-01-01 00:00:00+00' or p_played_at > now() + interval '5 minutes' then
    raise exception 'Invalid game score' using errcode = '22023';
  end if;
  if (select count(*) from public.spel_scores s where s.user_id = me and s.received_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many scores' using errcode = '54000';
  end if;
  insert into public.spel_scores(user_id, run_id, spel, niveau, soort, score, gewonnen, played_at)
  values (me, p_run_id, p_spel, p_niveau, p_soort, p_score, p_gewonnen, p_played_at)
  on conflict (user_id, run_id) do nothing;
end;
$$;
revoke all on function public.spel_score_opslaan(uuid, text, text, text, bigint, boolean, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.spel_score_opslaan(uuid, text, text, text, bigint, boolean, timestamptz, uuid)
  to authenticated;

-- Het scorebord van één spel.
--  punten: personal = jouw 10 beste potjes; friends = de 10 beste potjes van jou en je vrienden;
--          global = de hoogste score op Stekky (van een onbekende: alleen de score).
--  winst:  personal = per niveau hoe vaak je won en speelde; friends = jij en je vrienden, meeste overwinningen eerst
--          (p_niveau = '' telt alle niveaus samen).
create or replace function public.spel_scorebord(p_spel text, p_soort text, p_niveau text default '')
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
  personal jsonb;
  friends jsonb;
  world jsonb := null;
  rec public.spel_scores%rowtype;
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_spel is null or p_spel !~ '^[a-z0-9_-]{1,40}$' or p_soort not in ('punten', 'winst')
     or p_niveau is null or p_niveau !~ '^[a-z0-9_-]{0,20}$' then
    raise exception 'Invalid board' using errcode = '22023';
  end if;
  if p_soort = 'punten' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.run_id), '[]'::jsonb) into personal from (
      select s.user_id, s.run_id, s.score, s.niveau, s.played_at, p.username
      from public.spel_scores s join public.profiles p on p.id = s.user_id
      where s.user_id = me and s.spel = p_spel and s.soort = 'punten'
      order by s.score desc, s.played_at, s.run_id limit 10) r;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.score desc, r.played_at, r.user_id, r.run_id), '[]'::jsonb) into friends from (
      select s.user_id, s.run_id, s.score, s.niveau, s.played_at, p.username
      from public.spel_scores s join public.profiles p on p.id = s.user_id
      where s.spel = p_spel and s.soort = 'punten'
        and (s.user_id = me or (public.spel_vriend(me, s.user_id) and public.spel_speler_zichtbaar(s.user_id)))
      order by s.score desc, s.played_at, s.user_id, s.run_id limit 10) r;
    select s.* into rec from public.spel_scores s
      where s.spel = p_spel and s.soort = 'punten' and public.spel_speler_zichtbaar(s.user_id)
      order by s.score desc, s.played_at, s.user_id, s.run_id limit 1;
    if found then
      world := jsonb_build_object('score', rec.score, 'niveau', rec.niveau);
      if rec.user_id = me or public.spel_vriend(me, rec.user_id) then
        world := world || jsonb_build_object('user_id', rec.user_id, 'played_at', rec.played_at,
          'username', (select p.username from public.profiles p where p.id = rec.user_id));
      end if;
    end if;
  else
    select coalesce(jsonb_agg(to_jsonb(r) order by r.niveau), '[]'::jsonb) into personal from (
      select s.niveau, count(*) filter (where s.gewonnen) as gewonnen, count(*) as gespeeld
      from public.spel_scores s where s.user_id = me and s.spel = p_spel and s.soort = 'winst'
      group by s.niveau) r;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.gewonnen desc, r.gespeeld, r.user_id), '[]'::jsonb) into friends from (
      select s.user_id, p.username, count(*) filter (where s.gewonnen) as gewonnen, count(*) as gespeeld,
             max(s.played_at) filter (where s.gewonnen) as laatst
      from public.spel_scores s join public.profiles p on p.id = s.user_id
      where s.spel = p_spel and s.soort = 'winst' and (p_niveau = '' or s.niveau = p_niveau)
        and (s.user_id = me or (public.spel_vriend(me, s.user_id) and public.spel_speler_zichtbaar(s.user_id)))
      group by s.user_id, p.username
      order by count(*) filter (where s.gewonnen) desc, count(*), s.user_id limit 10) r;
  end if;
  return jsonb_build_object('soort', p_soort, 'personal', personal, 'friends', friends, 'global', world);
end;
$$;
revoke all on function public.spel_scorebord(text, text, text) from public, anon, authenticated;
grant execute on function public.spel_scorebord(text, text, text) to authenticated;

-- Voor de widget op Home: per spel dat je speelde je beste (punten: hoogste score; winst: aantal overwinningen)
-- en de beste vriend in dat spel. Hoogstens 40 spellen, het laatst gespeelde eerst.
create or replace function public.spel_scores_overzicht()
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
  uitslag jsonb;
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  with mijn as (
    select s.spel, s.soort,
           case when s.soort = 'punten' then max(s.score) else count(*) filter (where s.gewonnen) end as waarde,
           max(s.played_at) as laatst
    from public.spel_scores s where s.user_id = me group by s.spel, s.soort
    order by max(s.played_at) desc limit 40
  ), vrienden as (
    select s.spel, s.soort, s.user_id,
           case when s.soort = 'punten' then max(s.score) else count(*) filter (where s.gewonnen) end as waarde
    from public.spel_scores s join mijn m on m.spel = s.spel and m.soort = s.soort
    where s.user_id <> me and public.spel_vriend(me, s.user_id) and public.spel_speler_zichtbaar(s.user_id)
    group by s.spel, s.soort, s.user_id
  ), beste as (
    select distinct on (v.spel, v.soort) v.spel, v.soort, v.user_id, v.waarde
    from vrienden v order by v.spel, v.soort, v.waarde desc, v.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'spel', m.spel, 'soort', m.soort, 'mijn', m.waarde, 'laatst', m.laatst,
      'vriend', case when b.user_id is null then null else jsonb_build_object(
        'user_id', b.user_id, 'waarde', b.waarde,
        'username', (select p.username from public.profiles p where p.id = b.user_id)) end)
    order by m.laatst desc), '[]'::jsonb)
    into uitslag
  from mijn m left join beste b on b.spel = m.spel and b.soort = m.soort;
  return uitslag;
end;
$$;
revoke all on function public.spel_scores_overzicht() from public, anon, authenticated;
grant execute on function public.spel_scores_overzicht() to authenticated;

commit;
