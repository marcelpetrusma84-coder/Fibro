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

-- 5. Het overzicht voor de moderatiepagina
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
