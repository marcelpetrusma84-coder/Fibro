-- Casino-tokens (27 nov 2026, Marcel): speelgeld voor de casinospellen (Black Jack en Poker Texas Hold'em).
-- Eenmaal uitvoeren in de Supabase SQL Editor, NA sql/spel-scores.sql (die maakt spel_vriend en spel_speler_zichtbaar).
-- Herhaalbaar. Let op (28 nov 2026): voer daarna ALTIJD ook sql/casino-volwassen.sql uit (alleen 18+, Hoger of lager
-- en de Fruitautomaat); dit bestand zet anders de oude casino_ik, casino_inzet en casino_overzicht terug.
--
-- In gewone woorden:
--  - Iedereen krijgt elke week 250 tokens erbij (de week begint maandag 00:00, Nederlandse tijd). Wie een paar weken
--    niet speelde, krijgt die weken er allemaal bij. De eerste keer begin je met 250.
--  - Je saldo kan zakken tot -100, niet verder. Een inzet die je onder -100 zou brengen, mag niet.
--  - Tokens zijn niets waard: je kunt ze niet kopen, niet inwisselen en niet aan iemand geven.
--  - Alleen deze functies veranderen je saldo, en altijd je eigen saldo (uit je inlog, nooit uit wat de app stuurt):
--      casino_inzet    je zet in voordat de kaarten worden gedeeld (de inzet gaat er meteen af);
--      casino_uitslag  na het potje: gewonnen = 2× je inzet terug, gelijkspel = je inzet terug, verloren = niets.
--    Ga je weg midden in een potje, dan ben je je inzet kwijt (net als in een echt casino).
--  - casino_overzicht: je saldo, wanneer de volgende 250 komen, de rijkste vrienden en je laatste potjes.
--  - Hoogstens 100 per potje en hoogstens 20 potjes per minuut.
-- Let op: de uitslag tegen de computer komt van je eigen toestel. Wie heel erg zijn best doet, kan dus valsspelen.
-- Omdat de tokens niets waard zijn, is dat geen ramp; er wordt wel alles bijgehouden (casino_inzetten).
begin;

create table if not exists public.casino_saldo (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  saldo integer not null check (saldo between -100 and 1000000000),
  week date not null,                              -- de maandag van de laatste week die is bijgeschreven
  bijgewerkt timestamptz not null default now()
);
create table if not exists public.casino_inzetten (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  spel text not null check (spel ~ '^[a-z0-9_-]{1,40}$'),
  inzet integer not null check (inzet between 1 and 100),
  uitslag text check (uitslag in ('winst', 'verlies', 'gelijk')),
  geplaatst timestamptz not null default now(),
  afgerond timestamptz,
  primary key (user_id, run_id)
);
create index if not exists casino_inzetten_tempo on public.casino_inzetten (user_id, geplaatst);

-- Niemand leest of schrijft de tabellen direct; alles gaat via de functies hieronder.
alter table public.casino_saldo enable row level security;
alter table public.casino_inzetten enable row level security;
revoke all on public.casino_saldo from public, anon, authenticated;
revoke all on public.casino_inzetten from public, anon, authenticated;

-- De maandag van deze week (Nederlandse tijd)
create or replace function public.casino_deze_week()
returns date language sql stable
set search_path = pg_catalog, pg_temp
as $$ select (date_trunc('week', now() at time zone 'Europe/Amsterdam'))::date; $$;
revoke all on function public.casino_deze_week() from public, anon, authenticated;

-- Privéhulp: zet de weken die nog niet zijn bijgeschreven erbij en geeft het saldo (de rij blijft vast tot het einde).
create or replace function public.casino_bij(me uuid)
returns integer language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  nu date := public.casino_deze_week();
  s integer;
begin
  insert into public.casino_saldo(user_id, saldo, week) values (me, 250, nu) on conflict (user_id) do nothing;
  select c.saldo into s from public.casino_saldo c where c.user_id = me for update;
  update public.casino_saldo c
     set saldo = least(c.saldo::bigint + 250::bigint * ((nu - c.week) / 7), 1000000000)::integer, week = nu, bijgewerkt = now()
   where c.user_id = me and c.week < nu
  returning c.saldo into s;
  if s is null then select c.saldo into s from public.casino_saldo c where c.user_id = me; end if;
  return s;
end;
$$;
revoke all on function public.casino_bij(uuid) from public, anon, authenticated;

-- Privéhulp: de gewone controles (ingelogd, niet van account gewisseld, niet geblokkeerd)
create or replace function public.casino_ik(p_expected_user uuid)
returns uuid language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_user is distinct from me then raise exception 'Account changed' using errcode = '42501'; end if;
  if public.ben_ik_geblokkeerd() then raise exception 'Account restricted' using errcode = '42501'; end if;
  return me;
end;
$$;
revoke all on function public.casino_ik(uuid) from public, anon, authenticated;

-- Inzetten. Dezelfde run_id opnieuw sturen is veilig (er gaat niets extra af).
create or replace function public.casino_inzet(p_run_id uuid, p_spel text, p_inzet integer, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  oud public.casino_inzetten%rowtype;
  s integer;
begin
  if p_run_id is null or p_spel is null or p_spel not in ('eenentwintigen', 'pokertexasholdem')
     or p_inzet is null or p_inzet < 1 or p_inzet > 100 then
    raise exception 'Invalid bet' using errcode = '22023';
  end if;
  s := public.casino_bij(me);   -- zet ook je rij vast, zodat twee inzetten tegelijk niet allebei door kunnen
  select i.* into oud from public.casino_inzetten i where i.user_id = me and i.run_id = p_run_id;
  if found then return jsonb_build_object('saldo', s, 'inzet', oud.inzet, 'al', true); end if;
  if (select count(*) from public.casino_inzetten i where i.user_id = me and i.geplaatst > now() - interval '1 minute') >= 20 then
    raise exception 'Too many bets' using errcode = '54000';
  end if;
  if s - p_inzet < -100 then raise exception 'Not enough tokens' using errcode = 'P0001'; end if;
  update public.casino_saldo c set saldo = c.saldo - p_inzet, bijgewerkt = now() where c.user_id = me returning c.saldo into s;
  insert into public.casino_inzetten(user_id, run_id, spel, inzet) values (me, p_run_id, p_spel, p_inzet);
  return jsonb_build_object('saldo', s, 'inzet', p_inzet, 'al', false);
end;
$$;
revoke all on function public.casino_inzet(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.casino_inzet(uuid, text, integer, uuid) to authenticated;

-- De uitslag van een potje. Nog een keer sturen is veilig (er komt niets extra bij). Binnen 24 uur.
create or replace function public.casino_uitslag(p_run_id uuid, p_uitslag text, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  rij public.casino_inzetten%rowtype;
  s integer;
  terug integer;
begin
  if p_run_id is null or p_uitslag is null or p_uitslag not in ('winst', 'verlies', 'gelijk') then
    raise exception 'Invalid result' using errcode = '22023';
  end if;
  s := public.casino_bij(me);
  select i.* into rij from public.casino_inzetten i where i.user_id = me and i.run_id = p_run_id for update;
  if not found then raise exception 'Unknown bet' using errcode = '22023'; end if;
  if rij.uitslag is not null then return jsonb_build_object('saldo', s, 'uitslag', rij.uitslag, 'al', true); end if;
  if rij.geplaatst < now() - interval '24 hours' then raise exception 'Bet expired' using errcode = '22023'; end if;
  terug := case p_uitslag when 'winst' then 2 * rij.inzet when 'gelijk' then rij.inzet else 0 end;
  update public.casino_inzetten i set uitslag = p_uitslag, afgerond = now() where i.user_id = me and i.run_id = p_run_id;
  update public.casino_saldo c set saldo = least(c.saldo::bigint + terug, 1000000000)::integer, bijgewerkt = now()
   where c.user_id = me returning c.saldo into s;
  return jsonb_build_object('saldo', s, 'uitslag', p_uitslag, 'terug', terug, 'al', false);
end;
$$;
revoke all on function public.casino_uitslag(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.casino_uitslag(uuid, text, uuid) to authenticated;

-- Voor de casino-widget op Home en het inzetscherm.
--  vrienden: jij en je 5 rijkste vrienden (alleen echte vrienden, zonder wie geblokkeerd is), het meeste eerst.
--  laatste: je laatste 5 afgeronde potjes.
create or replace function public.casino_overzicht()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(auth.uid());
  nu date := public.casino_deze_week();
  s integer;
  vrienden jsonb;
  laatste jsonb;
begin
  s := public.casino_bij(me);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.saldo desc, r.user_id), '[]'::jsonb) into vrienden from (
    select * from (
      select c.user_id, p.username,
             least(c.saldo::bigint + 250::bigint * greatest((nu - c.week) / 7, 0), 1000000000)::integer as saldo
      from public.casino_saldo c join public.profiles p on p.id = c.user_id
      where c.user_id <> me and public.spel_vriend(me, c.user_id) and public.spel_speler_zichtbaar(c.user_id)
      order by 3 desc, c.user_id limit 5) v
    union all
    select me, (select p.username from public.profiles p where p.id = me), s) r;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.afgerond desc), '[]'::jsonb) into laatste from (
    select i.spel, i.inzet, i.uitslag, i.afgerond from public.casino_inzetten i
    where i.user_id = me and i.uitslag is not null order by i.afgerond desc limit 5) r;
  return jsonb_build_object('saldo', s, 'weekbedrag', 250, 'minimum', -100, 'max_inzet', 100,
    'volgende', ((nu + 7)::timestamp at time zone 'Europe/Amsterdam'), 'vrienden', vrienden, 'laatste', laatste);
end;
$$;
revoke all on function public.casino_overzicht() from public, anon, authenticated;
grant execute on function public.casino_overzicht() to authenticated;

commit;
