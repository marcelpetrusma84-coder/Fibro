-- registratie-schakelaar.sql (Fibro v226): wie mag er een nieuw account maken? Voor de (open) bèta.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Drie standen:
--   open        iedereen kan een account maken (zoals het tot nu toe was; dit is de beginstand)
--   uitnodiging alleen wie een geldige, ongebruikte uitnodiging heeft (invite.html)
--   dicht       niemand kan een account maken (de noodrem). Inloggen blijft gewoon werken.
--
-- Omzetten: op de pagina Moderatie > Bèta (alleen moderators). Reserve: Supabase > Table Editor >
-- registratie_instelling, het vakje 'stand' (alleen open, uitnodiging of dicht is toegestaan).
--
-- De controle zit in de database zelf (een trigger op auth.users), niet alleen op de webpagina: zo kan niemand
-- er omheen door Supabase rechtstreeks aan te roepen. Let op: in de stand 'dicht' werkt ook 'Add user' in het
-- Supabase-dashboard niet.
--
-- Verder: beta_overzicht() voor de moderatiepagina: aantal accounts, nieuwe accounts per dag (laatste 14 dagen)
-- en wie wie heeft uitgenodigd (laatste 100). Alleen voor moderators.
--
-- Bèta-cijfers (v227), alleen totalen, nooit per persoon en nooit hoe lang iemand de app gebruikt:
--   - actieve mensen per dag: de tabel actief_per_dag telt per dag hoeveel mensen Fibro openden. Er staat alleen
--     een datum en een getal in, geen namen. Het tellen gebeurt als laatst_gezien (de heartbeat, voor het groene
--     bolletje) voor het eerst op een nieuwe dag verandert. Wie 'helemaal offline' staat, telt niet mee: daar
--     verandert laatst_gezien niet (bescherm_online in sql/profielvelden.sql). Oudere dagen dan 400 gaan weg.
--   - actief in de laatste 24 uur, 7 dagen en 30 dagen (uit laatst_gezien, ook zonder wie offline staat);
--   - komen nieuwe mensen terug: na een dag, en na een week;
--   - leeftijdsgroepen, uit het geboortejaar dat bij het aanmelden al werd bewaard;
--   - (v228) soort toestel: Android-app, Android in de browser, iPhone/iPad, computer. Alleen per dag opgeteld
--     (tabel toestel_per_dag: datum, soort, aantal), zie 5b.
begin;

do $$
begin
  if to_regprocedure('public.ben_ik_moderator()') is null then
    raise exception 'STOP: ben_ik_moderator() ontbreekt; er is niets aangepast';
  end if;
  if to_regprocedure('public.is_geblokkeerd(uuid)') is null then
    raise exception 'STOP: is_geblokkeerd(uuid) ontbreekt (sql/blokkeren.sql); er is niets aangepast';
  end if;
  if to_regclass('public.invite_tokens') is null then
    raise exception 'STOP: de tabel invite_tokens ontbreekt; er is niets aangepast';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name in ('laatst_gezien', 'toon_online')) <> 2 then
    raise exception 'STOP: profiles.laatst_gezien of profiles.toon_online ontbreekt (sql/toon-online.sql); er is niets aangepast';
  end if;
end $$;

-- 1. De instelling: altijd precies een rij
create table if not exists public.registratie_instelling (
  id integer primary key default 1 check (id = 1),
  stand text not null default 'open' check (stand in ('open', 'uitnodiging', 'dicht')),
  gewijzigd_op timestamptz not null default now(),
  gewijzigd_door uuid
);
insert into public.registratie_instelling (id, stand) values (1, 'open') on conflict (id) do nothing;

alter table public.registratie_instelling enable row level security;
revoke all on public.registratie_instelling from public, anon, authenticated;

-- 2. De stand opvragen: mag iedereen, ook zonder in te loggen (login.html en invite.html tonen dan meteen
--    een duidelijke uitleg in plaats van een formulier dat toch niet werkt)
create or replace function public.registratie_stand()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select stand from registratie_instelling where id = 1), 'open');
$$;
revoke execute on function public.registratie_stand() from public;
grant execute on function public.registratie_stand() to anon, authenticated;

-- 3. De stand omzetten: alleen moderators
create or replace function public.zet_registratie_stand(stand_in text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.ben_ik_moderator() then
    raise exception 'Alleen moderators';
  end if;
  if stand_in is null or stand_in not in ('open', 'uitnodiging', 'dicht') then
    raise exception 'Onbekende stand';
  end if;
  insert into registratie_instelling (id, stand, gewijzigd_op, gewijzigd_door)
  values (1, stand_in, now(), auth.uid())
  on conflict (id) do update
    set stand = excluded.stand, gewijzigd_op = excluded.gewijzigd_op, gewijzigd_door = excluded.gewijzigd_door;
  return stand_in;
end;
$$;
revoke execute on function public.zet_registratie_stand(text) from public, anon;
grant execute on function public.zet_registratie_stand(text) to authenticated;

-- 4. De poortwachter: bij elk nieuw account (auth.users) de stand controleren.
--    invite.html geeft de uitnodiging mee in de gegevens van het nieuwe account (invite_token). De uitnodiging
--    wordt hier alleen bekeken, niet afgeboekt: dat doen maak_vriendschap_via_invite en gebruik_invite daarna,
--    zoals altijd.
create or replace function public.controleer_nieuw_account()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  st text;
  tok text;
begin
  select stand into st from registratie_instelling where id = 1;
  if st is null or st = 'open' then
    return new;
  end if;
  if st = 'uitnodiging' then
    tok := new.raw_user_meta_data ->> 'invite_token';
    if tok is not null and exists (
      select 1 from invite_tokens i
       where i.token = tok
         and i.is_used = false
         and (i.expires_at is null or i.expires_at > now())
         and i.created_by is not null
         and not public.is_geblokkeerd(i.created_by)
    ) then
      return new;
    end if;
    raise exception 'FIBRO_REGISTRATIE_ALLEEN_UITNODIGING';
  end if;
  raise exception 'FIBRO_REGISTRATIE_DICHT';
end;
$$;
revoke execute on function public.controleer_nieuw_account() from public, anon, authenticated;

drop trigger if exists fibro_registratie_controle on auth.users;
create trigger fibro_registratie_controle
  before insert on auth.users
  for each row execute function public.controleer_nieuw_account();

-- 5. Actieve mensen per dag: alleen een datum en een getal
create table if not exists public.actief_per_dag (
  dag date primary key,
  aantal integer not null default 0 check (aantal >= 0)
);
alter table public.actief_per_dag enable row level security;
revoke all on public.actief_per_dag from public, anon, authenticated;

create or replace function public.tel_actieve_dag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  nu_gezien timestamptz;
  oud_gezien timestamptz;
  dag_nu date;
begin
  nu_gezien := new.laatst_gezien::timestamptz;
  oud_gezien := old.laatst_gezien::timestamptz;
  -- alleen een echt teken van leven van nu (geen zelf ingevulde datum ver weg)
  if nu_gezien is null or nu_gezien < now() - interval '10 minutes' or nu_gezien > now() + interval '10 minutes' then
    return null;
  end if;
  dag_nu := (nu_gezien at time zone 'Europe/Amsterdam')::date;
  -- vandaag al geteld?
  if oud_gezien is not null and (oud_gezien at time zone 'Europe/Amsterdam')::date >= dag_nu then
    return null;
  end if;
  insert into actief_per_dag (dag, aantal) values (dag_nu, 1)
  on conflict (dag) do update set aantal = actief_per_dag.aantal + 1;
  delete from actief_per_dag where dag < dag_nu - 400;
  return null;
end;
$$;
revoke execute on function public.tel_actieve_dag() from public, anon, authenticated;

drop trigger if exists fibro_tel_actieve_dag on public.profiles;
create trigger fibro_tel_actieve_dag
  after update of laatst_gezien on public.profiles
  for each row
  when (new.laatst_gezien is distinct from old.laatst_gezien)
  execute function public.tel_actieve_dag();

-- 5b. Soort toestel per dag (v228): alleen datum, soort en aantal. Home (toestel.js) meldt een keer per dag per
--     toestel het soort; niet wie, en geen merk, model of browser. Wie 'helemaal offline' staat, telt niet mee.
--     Een dag kan nooit meer van een soort hebben dan er accounts zijn. Oudere dagen dan 400 gaan weg.
create table if not exists public.toestel_per_dag (
  dag date not null,
  soort text not null check (soort in ('android_app', 'android_web', 'iphone', 'computer', 'anders')),
  aantal integer not null default 0 check (aantal >= 0),
  primary key (dag, soort)
);
alter table public.toestel_per_dag enable row level security;
revoke all on public.toestel_per_dag from public, anon, authenticated;

create or replace function public.tel_toestel(soort_in text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  dag_nu date := (now() at time zone 'Europe/Amsterdam')::date;
begin
  if auth.uid() is null then return; end if;
  if soort_in is null or soort_in not in ('android_app', 'android_web', 'iphone', 'computer', 'anders') then return; end if;
  if exists (select 1 from profiles where id = auth.uid() and toon_online = false) then return; end if;
  insert into toestel_per_dag (dag, soort, aantal) values (dag_nu, soort_in, 1)
  on conflict (dag, soort) do update set aantal = toestel_per_dag.aantal + 1
   where toestel_per_dag.aantal < (select count(*) from profiles);
  delete from toestel_per_dag where dag < dag_nu - 400;
end;
$$;
revoke execute on function public.tel_toestel(text) from public, anon;
grant execute on function public.tel_toestel(text) to authenticated;

-- 6. Het overzicht voor de moderatiepagina
create or replace function public.beta_overzicht()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  uit jsonb;
begin
  if not public.ben_ik_moderator() then
    raise exception 'Alleen moderators';
  end if;

  with via_uitnodiging as (
    -- een account telt als 'via een uitnodiging' als het een uitnodiging gebruikte die er al was voordat het account bestond
    select distinct u.id
      from auth.users u
      join invite_tokens i on i.used_by = u.id and i.created_at <= u.created_at
  )
  select jsonb_build_object(
    'stand', public.registratie_stand(),
    'gewijzigd_op', (select gewijzigd_op from registratie_instelling where id = 1),
    'accounts', (select count(*) from auth.users),
    'via_uitnodiging', (select count(*) from via_uitnodiging),
    'laatste_24_uur', (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'per_dag', coalesce((
      select jsonb_agg(jsonb_build_object('dag', d.dag, 'aantal', d.aantal) order by d.dag desc)
        from (
          select (created_at at time zone 'Europe/Amsterdam')::date as dag, count(*) as aantal
            from auth.users
           where created_at > now() - interval '14 days'
           group by 1
        ) d
    ), '[]'::jsonb),
    -- v227: bèta-cijfers, alleen totalen. Wie 'helemaal offline' staat, telt niet mee.
    'actief_24u', (select count(*) from profiles p
                    where coalesce(p.toon_online, true) and p.laatst_gezien::timestamptz > now() - interval '24 hours'),
    'actief_7d', (select count(*) from profiles p
                   where coalesce(p.toon_online, true) and p.laatst_gezien::timestamptz > now() - interval '7 days'),
    'actief_30d', (select count(*) from profiles p
                    where coalesce(p.toon_online, true) and p.laatst_gezien::timestamptz > now() - interval '30 days'),
    'actief_per_dag', coalesce((
      select jsonb_agg(jsonb_build_object('dag', a.dag, 'aantal', a.aantal) order by a.dag desc)
        from actief_per_dag a
       where a.dag > (now() at time zone 'Europe/Amsterdam')::date - 14
    ), '[]'::jsonb),
    -- komen nieuwe mensen terug? 'van' = nieuwe accounts die oud genoeg zijn om het te weten,
    -- 'terug' = daarvan zijn er zoveel minstens een dag (of een week) na het aanmelden nog in Fibro geweest
    'terug_dag', (
      select jsonb_build_object('van', count(*), 'terug', count(*) filter (where p.laatst_gezien::timestamptz >= u.created_at + interval '1 day'))
        from auth.users u join profiles p on p.id = u.id
       where coalesce(p.toon_online, true)
         and u.created_at <= now() - interval '2 days' and u.created_at > now() - interval '30 days'
    ),
    'terug_week', (
      select jsonb_build_object('van', count(*), 'terug', count(*) filter (where p.laatst_gezien::timestamptz >= u.created_at + interval '7 days'))
        from auth.users u join profiles p on p.id = u.id
       where coalesce(p.toon_online, true)
         and u.created_at <= now() - interval '8 days' and u.created_at > now() - interval '60 days'
    ),
    'leeftijd', (
      select jsonb_build_object(
               'onder_16', count(*) filter (where l < 16),
               '16_17', count(*) filter (where l between 16 and 17),
               '18_24', count(*) filter (where l between 18 and 24),
               '25_34', count(*) filter (where l between 25 and 34),
               '35_49', count(*) filter (where l between 35 and 49),
               '50_plus', count(*) filter (where l >= 50),
               'onbekend', count(*) filter (where l is null))
        from (
          select case when (u.raw_user_meta_data ->> 'geboortejaar') ~ '^[0-9]{4}$'
                      then extract(year from now())::int - (u.raw_user_meta_data ->> 'geboortejaar')::int end as l
            from auth.users u
        ) leeftijden
    ),
    -- v228: soort toestel, de laatste 7 dagen (vandaag meegeteld) opgeteld, en vandaag apart
    'toestellen', jsonb_build_object(
      'dagen', (select count(distinct t.dag) from toestel_per_dag t
                 where t.dag > (now() at time zone 'Europe/Amsterdam')::date - 7),
      'week', coalesce((select jsonb_object_agg(x.soort, x.n) from (
                 select t.soort, sum(t.aantal) as n from toestel_per_dag t
                  where t.dag > (now() at time zone 'Europe/Amsterdam')::date - 7
                  group by t.soort) x), '{}'::jsonb),
      'vandaag', coalesce((select jsonb_object_agg(t.soort, t.aantal) from toestel_per_dag t
                 where t.dag = (now() at time zone 'Europe/Amsterdam')::date), '{}'::jsonb)
    ),
    'uitnodigingen', coalesce((
      select jsonb_agg(r order by r.wanneer desc)
        from (
          select maker.username as uitgenodigd_door,
                 nieuw.username as gebruikt_door,
                 i.used_at as wanneer,
                 (nu.created_at is not null and i.created_at <= nu.created_at) as nieuw_account
            from invite_tokens i
            left join profiles maker on maker.id = i.created_by
            left join profiles nieuw on nieuw.id = i.used_by
            left join auth.users nu on nu.id = i.used_by
           where i.is_used and i.used_at is not null
           order by i.used_at desc
           limit 100
        ) r
    ), '[]'::jsonb)
  ) into uit;

  return uit;
end;
$$;
revoke execute on function public.beta_overzicht() from public, anon;
grant execute on function public.beta_overzicht() to authenticated;

commit;
