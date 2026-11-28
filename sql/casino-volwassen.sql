-- casino-volwassen.sql (28 nov 2026, Marcel): het casino is alleen voor 18+, plus de Fruitautomaat en Hoger of lager.
-- Uitvoeren in de Supabase SQL Editor, NA sql/casino-tokens.sql en sql/videopoker.sql. Herhaalbaar: na een nieuwe
-- versie van dit bestand gewoon nog een keer uitvoeren.
-- Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- In gewone woorden:
--  1. Tokens alleen voor wie 18 of ouder is. Net als bij de minimumleeftijd (sql/minimumleeftijd.sql) telt alleen het
--     jaar: dit jaar min je geboortejaar moet 18 of meer zijn. Het geboortejaar komt uit je account (het jaar dat je bij
--     het aanmelden invulde). Het wordt hier één keer vastgezet (casino_geboortejaar): later aanpassen in je
--     accountgegevens verandert het niet. Wie geen geboortejaar heeft, krijgt geen tokens.
--     Alle casinofuncties (inzetten, uitslag, overzicht, Video Poker, de Fruitautomaat) weigeren iemand onder de 18
--     ('Adults only'), en in de lijst met rijkste vrienden staan geen mensen onder de 18.
--  2. casino_mag_hier: mogen de wachtspelletjes (Hoger of lager, de Fruitautomaat) in deze chat met tokens? Alleen als
--     jij 18+ bent en iedereen in de chat ook (met een vriend: die vriend; in een groep: alle leden). Je krijgt alleen
--     ja of nee terug, nooit iemands leeftijd.
--  3. Hoger of lager met tokens: de SERVER deelt (hogerlager_deel) en betaalt uit (hogerlager_raad). De uitbetaling
--     hangt af van de kans: floor(4947 / winnende kaarten) honderdsten, dezelfde regel als hogerlager.js. Dezelfde
--     waarde = verloren. (De eerste versie gaf altijd 2× via casino_inzet; dat was te veel en kan niet meer.)
--  4. fruitautomaat_draai: de SERVER draait de drie rollen en betaalt uit (tot 200× je inzet), net als Video Poker,
--     zodat niemand een uitslag kan verzinnen. Dezelfde tabel als fruitautomaat.js. Hoogstens 40 draaien per minuut.
--  5. (28 nov 2026, ronde 2) Elke week 500 tokens erbij in plaats van 250 (wie nieuw is, begint met 500), en ook een
--     fiche van 5: inzetten 5, 10, 25, 50 of 100 (ook bij Video Poker en de Fruitautomaat). Rood staan blijft tot -100.
begin;

-- ── 0. Weekgeld 500 (casino_bij uit casino-tokens.sql) ──
create or replace function public.casino_bij(me uuid)
returns integer language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  nu date := public.casino_deze_week();
  s integer;
begin
  insert into public.casino_saldo(user_id, saldo, week) values (me, 500, nu) on conflict (user_id) do nothing;
  select c.saldo into s from public.casino_saldo c where c.user_id = me for update;
  update public.casino_saldo c
     set saldo = least(c.saldo::bigint + 500::bigint * ((nu - c.week) / 7), 1000000000)::integer, week = nu, bijgewerkt = now()
   where c.user_id = me and c.week < nu
  returning c.saldo into s;
  if s is null then select c.saldo into s from public.casino_saldo c where c.user_id = me; end if;
  return s;
end;
$$;
revoke all on function public.casino_bij(uuid) from public, anon, authenticated;

-- ── 1. Het geboortejaar, één keer vastgezet ──
create table if not exists public.casino_geboortejaar (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jaar integer not null check (jaar between 1900 and 2100)
);
alter table public.casino_geboortejaar enable row level security;
revoke all on public.casino_geboortejaar from public, anon, authenticated;

-- Iedereen die er al is
insert into public.casino_geboortejaar(user_id, jaar)
select u.id, (u.raw_user_meta_data ->> 'geboortejaar')::int
  from auth.users u
 where (u.raw_user_meta_data ->> 'geboortejaar') ~ '^[0-9]{4}$'
   and (u.raw_user_meta_data ->> 'geboortejaar')::int between 1900 and 2100
on conflict (user_id) do nothing;

-- Elk nieuw account (na de controle op 16+ uit sql/minimumleeftijd.sql)
create or replace function public.casino_geboortejaar_bewaar()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  t text := new.raw_user_meta_data ->> 'geboortejaar';
begin
  if t ~ '^[0-9]{4}$' and t::int between 1900 and 2100 then
    insert into public.casino_geboortejaar(user_id, jaar) values (new.id, t::int) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.casino_geboortejaar_bewaar() from public, anon, authenticated;
drop trigger if exists fibro_casino_geboortejaar on auth.users;
create trigger fibro_casino_geboortejaar
  after insert on auth.users
  for each row execute function public.casino_geboortejaar_bewaar();

-- Privéhulp: is iemand 18 of ouder?
create or replace function public.casino_volwassen(u uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (select 1 from public.casino_geboortejaar g
                  where g.user_id = u and extract(year from now() at time zone 'Europe/Amsterdam')::int - g.jaar >= 18);
$$;
revoke all on function public.casino_volwassen(uuid) from public, anon, authenticated;

-- De gewone controles van alle casinofuncties, nu ook: 18 of ouder
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
  if not public.casino_volwassen(me) then raise exception 'Adults only' using errcode = '42501'; end if;
  return me;
end;
$$;
revoke all on function public.casino_ik(uuid) from public, anon, authenticated;

-- Het overzicht: dezelfde als in casino-tokens.sql, maar zonder vrienden onder de 18
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
             least(c.saldo::bigint + 500::bigint * greatest((nu - c.week) / 7, 0), 1000000000)::integer as saldo
      from public.casino_saldo c join public.profiles p on p.id = c.user_id
      where c.user_id <> me and public.spel_vriend(me, c.user_id) and public.spel_speler_zichtbaar(c.user_id)
        and public.casino_volwassen(c.user_id)
      order by 3 desc, c.user_id limit 5) v
    union all
    select me, (select p.username from public.profiles p where p.id = me), s) r;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.afgerond desc), '[]'::jsonb) into laatste from (
    select i.spel, i.inzet, i.uitslag, i.afgerond from public.casino_inzetten i
    where i.user_id = me and i.uitslag is not null order by i.afgerond desc limit 5) r;
  return jsonb_build_object('saldo', s, 'weekbedrag', 500, 'minimum', -100, 'max_inzet', 100,
    'volgende', ((nu + 7)::timestamp at time zone 'Europe/Amsterdam'), 'vrienden', vrienden, 'laatste', laatste);
end;
$$;
revoke all on function public.casino_overzicht() from public, anon, authenticated;
grant execute on function public.casino_overzicht() to authenticated;

-- ── 2. Mogen de wachtspelletjes hier met tokens? (alleen ja of nee) ──
-- p_vriend: de chat met één vriend; p_groep: een groepschat. Geen van beide: alleen jijzelf.
create or replace function public.casino_mag_hier(p_vriend uuid default null, p_groep uuid default null)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or public.ben_ik_geblokkeerd() or not public.casino_volwassen(me) then return false; end if;
  if p_vriend is not null then
    if not public.spel_vriend(me, p_vriend) or not public.casino_volwassen(p_vriend) then return false; end if;
  end if;
  if p_groep is not null then
    if not exists (select 1 from public.groep_leden l where l.groep_id = p_groep and l.user_id = me) then return false; end if;
    if exists (select 1 from public.groep_leden l where l.groep_id = p_groep and not public.casino_volwassen(l.user_id)) then return false; end if;
  end if;
  return true;
end;
$$;
revoke all on function public.casino_mag_hier(uuid, uuid) from public, anon, authenticated;
grant execute on function public.casino_mag_hier(uuid, uuid) to authenticated;

-- ── 3. Inzetten bij Black Jack en Poker (2× terug). Hoger of lager heeft nu een eigen server (hieronder). ──
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

-- ── 4. De Fruitautomaat: de server draait ──
create table if not exists public.fruitautomaat_rondes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ronde_id uuid not null,
  inzet integer not null check (inzet in (5, 10, 25, 50, 100)),
  rollen text[] not null check (array_length(rollen, 1) = 3),
  uitbetaling integer not null check (uitbetaling >= 0),
  gedraaid timestamptz not null default now(),
  primary key (user_id, ronde_id)
);
create index if not exists fruitautomaat_tempo on public.fruitautomaat_rondes (user_id, gedraaid);
alter table public.fruitautomaat_rondes enable row level security;
revoke all on public.fruitautomaat_rondes from public, anon, authenticated;
-- ronde 2: ook een inzet van 5 (voor een tabel die er al was)
alter table public.fruitautomaat_rondes drop constraint if exists fruitautomaat_rondes_inzet_check;
alter table public.fruitautomaat_rondes add constraint fruitautomaat_rondes_inzet_check check (inzet in (5, 10, 25, 50, 100));

-- Eén rol: een getal 0..31 wordt een plaatje (gewichten als in fruitautomaat.js: 6, 7, 6, 5, 4, 3, 1 van de 32)
create or replace function public.fruitautomaat_symbool(n integer)
returns text language sql immutable
set search_path = pg_catalog, pg_temp
as $$ select case when n < 6 then 'kers' when n < 13 then 'citroen' when n < 19 then 'sinaas' when n < 24 then 'druif'
  when n < 28 then 'bel' when n < 31 then 'ster' else 'zeven' end; $$;
revoke all on function public.fruitautomaat_symbool(integer) from public, anon, authenticated;

-- Hoeveel keer je inzet je terugkrijgt (dezelfde tabel als fruitautomaat.js)
create or replace function public.fruitautomaat_maal(r text[])
returns integer language plpgsql immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  kersen int;
begin
  if r is null or array_length(r, 1) <> 3 then return 0; end if;
  if r[1] = r[2] and r[2] = r[3] then
    return case r[1] when 'zeven' then 200 when 'ster' then 60 when 'bel' then 40 when 'druif' then 20
      when 'sinaas' then 15 when 'citroen' then 12 when 'kers' then 10 else 0 end;
  end if;
  kersen := (r[1] = 'kers')::int + (r[2] = 'kers')::int + (r[3] = 'kers')::int;
  if kersen = 2 then return 4; end if;
  if kersen = 1 and r[1] = 'kers' then return 1; end if;
  return 0;
end;
$$;
revoke all on function public.fruitautomaat_maal(text[]) from public, anon, authenticated;

-- Draaien: inzet eraf, drie rollen, uitbetalen. Dezelfde ronde_id nog een keer sturen geeft dezelfde uitslag terug.
create or replace function public.fruitautomaat_draai(p_ronde_id uuid, p_inzet integer, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  oud public.fruitautomaat_rondes%rowtype;
  s integer;
  r text[];
  terug integer;
begin
  if p_ronde_id is null or p_inzet is null or p_inzet not in (5, 10, 25, 50, 100) then
    raise exception 'Invalid bet' using errcode = '22023';
  end if;
  s := public.casino_bij(me);   -- zet ook je saldo-rij vast: twee keer tegelijk draaien kan niet
  select f.* into oud from public.fruitautomaat_rondes f where f.user_id = me and f.ronde_id = p_ronde_id;
  if found then
    return jsonb_build_object('rollen', to_jsonb(oud.rollen), 'inzet', oud.inzet, 'uitbetaling', oud.uitbetaling, 'saldo', s, 'al', true);
  end if;
  if (select count(*) from public.fruitautomaat_rondes f where f.user_id = me and f.gedraaid > now() - interval '1 minute') >= 40 then
    raise exception 'Too many spins' using errcode = '54000';
  end if;
  if s - p_inzet < -100 then raise exception 'Not enough tokens' using errcode = 'P0001'; end if;
  -- drie rollen (gen_random_uuid gebruikt de sterke toevalsgenerator van de server; 256 is deelbaar door 32)
  select array_agg(public.fruitautomaat_symbool(get_byte(uuid_send(gen_random_uuid()), 0) % 32) order by i) into r
    from generate_series(1, 3) i;
  terug := p_inzet * public.fruitautomaat_maal(r);
  update public.casino_saldo c set saldo = least(c.saldo::bigint - p_inzet + terug, 1000000000)::integer, bijgewerkt = now()
   where c.user_id = me returning c.saldo into s;
  insert into public.fruitautomaat_rondes(user_id, ronde_id, inzet, rollen, uitbetaling) values (me, p_ronde_id, p_inzet, r, terug);
  return jsonb_build_object('rollen', to_jsonb(r), 'inzet', p_inzet, 'uitbetaling', terug, 'saldo', s, 'al', false);
end;
$$;
revoke all on function public.fruitautomaat_draai(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.fruitautomaat_draai(uuid, integer, uuid) to authenticated;


-- ── 5. Video Poker: ook een inzet van 5 (videopoker_deel uit videopoker.sql) ──
alter table public.videopoker_rondes drop constraint if exists videopoker_rondes_inzet_check;
alter table public.videopoker_rondes add constraint videopoker_rondes_inzet_check check (inzet in (5, 10, 25, 50, 100));
create or replace function public.videopoker_deel(p_ronde_id uuid, p_inzet integer, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  open public.videopoker_rondes%rowtype;
  s integer;
  stapel text[];
begin
  if p_ronde_id is null or p_inzet is null or p_inzet not in (5, 10, 25, 50, 100) then
    raise exception 'Invalid bet' using errcode = '22023';
  end if;
  s := public.casino_bij(me);
  select v.* into open from public.videopoker_rondes v where v.user_id = me and v.afgerond is null order by v.gedeeld desc limit 1;
  if found then
    return jsonb_build_object('ronde_id', open.ronde_id, 'kaarten', to_jsonb(open.kaarten[1:5]), 'inzet', open.inzet, 'saldo', s, 'al', true);
  end if;
  if (select count(*) from public.videopoker_rondes v where v.user_id = me and v.gedeeld > now() - interval '1 minute') >= 30 then
    raise exception 'Too many rounds' using errcode = '54000';
  end if;
  if s - p_inzet < -100 then raise exception 'Not enough tokens' using errcode = 'P0001'; end if;
  select array_agg(c order by gen_random_uuid()) into stapel
    from unnest(array['h','r','k','s']) kl, unnest(array['2','3','4','5','6','7','8','9','10','B','V','H','A']) w, lateral (select kl || w as c) x;
  update public.casino_saldo c set saldo = c.saldo - p_inzet, bijgewerkt = now() where c.user_id = me returning c.saldo into s;
  insert into public.videopoker_rondes(user_id, ronde_id, inzet, kaarten) values (me, p_ronde_id, p_inzet, stapel[1:10]);
  return jsonb_build_object('ronde_id', p_ronde_id, 'kaarten', to_jsonb(stapel[1:5]), 'inzet', p_inzet, 'saldo', s, 'al', false);
end;
$$;
revoke all on function public.videopoker_deel(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.videopoker_deel(uuid, integer, uuid) to authenticated;

-- ── 6. Hoger of lager: de server deelt en betaalt uit ──
create table if not exists public.hogerlager_rondes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ronde_id uuid not null,
  kaart text not null,
  volgende text not null,
  keuze text check (keuze in ('hoger', 'lager')),
  inzet integer check (inzet in (5, 10, 25, 50, 100)),
  uitslag text check (uitslag in ('winst', 'verlies')),
  uitbetaling integer check (uitbetaling >= 0),
  gedeeld timestamptz not null default now(),
  afgerond timestamptz,
  primary key (user_id, ronde_id)
);
create index if not exists hogerlager_tempo on public.hogerlager_rondes (user_id, gedeeld);
alter table public.hogerlager_rondes enable row level security;
revoke all on public.hogerlager_rondes from public, anon, authenticated;

-- De waarde van een kaart ('h7', 'sH', 'kA'): 2 .. 14 (aas het hoogst), zoals rang() in kaarten-motor.js
create or replace function public.hogerlager_rang(k text)
returns integer language sql immutable
set search_path = pg_catalog, pg_temp
as $$ select array_position(array['2','3','4','5','6','7','8','9','10','B','V','H','A'], substr(k, 2)) + 1; $$;
revoke all on function public.hogerlager_rang(text) from public, anon, authenticated;

-- De uitbetaling in honderdsten: floor(4947 / winnende kaarten); 0 = kan niet (dezelfde regel als hogerlager.js)
create or replace function public.hogerlager_maal100(k text, keuze text)
returns integer language plpgsql immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  r int := public.hogerlager_rang(k);
  w int;
begin
  if r is null or keuze not in ('hoger', 'lager') then return 0; end if;
  w := case keuze when 'hoger' then 4 * (14 - r) else 4 * (r - 2) end;
  if w <= 0 then return 0; end if;
  return 4947 / w;   -- gehele deling = naar beneden afronden
end;
$$;
revoke all on function public.hogerlager_maal100(text, text) from public, anon, authenticated;

-- Delen: een vers geschud spel, je ziet alleen de eerste kaart. Nog geen inzet.
create or replace function public.hogerlager_deel(p_ronde_id uuid, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  oud public.hogerlager_rondes%rowtype;
  stapel text[];
begin
  if p_ronde_id is null then raise exception 'Invalid round' using errcode = '22023'; end if;
  select h.* into oud from public.hogerlager_rondes h where h.user_id = me and h.ronde_id = p_ronde_id;
  if found then return jsonb_build_object('ronde_id', oud.ronde_id, 'kaart', oud.kaart, 'al', true); end if;
  if (select count(*) from public.hogerlager_rondes h where h.user_id = me and h.gedeeld > now() - interval '1 minute') >= 60 then
    raise exception 'Too many rounds' using errcode = '54000';
  end if;
  select array_agg(c order by gen_random_uuid()) into stapel
    from unnest(array['h','r','k','s']) kl, unnest(array['2','3','4','5','6','7','8','9','10','B','V','H','A']) w, lateral (select kl || w as c) x;
  insert into public.hogerlager_rondes(user_id, ronde_id, kaart, volgende) values (me, p_ronde_id, stapel[1], stapel[2]);
  return jsonb_build_object('ronde_id', p_ronde_id, 'kaart', stapel[1], 'al', false);
end;
$$;
revoke all on function public.hogerlager_deel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hogerlager_deel(uuid, uuid) to authenticated;

-- Raden: de inzet gaat eraf, de volgende kaart draait om, bij winst inzet × maal100 / 100 terug. Nog een keer sturen
-- geeft dezelfde uitslag (en kost niets extra). Binnen een uur na het delen.
create or replace function public.hogerlager_raad(p_ronde_id uuid, p_keuze text, p_inzet integer, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  rij public.hogerlager_rondes%rowtype;
  s integer;
  m int;
  a int;
  b int;
  uit text;
  terug integer;
begin
  if p_ronde_id is null or p_keuze is null or p_keuze not in ('hoger', 'lager') or p_inzet is null or p_inzet not in (5, 10, 25, 50, 100) then
    raise exception 'Invalid bet' using errcode = '22023';
  end if;
  s := public.casino_bij(me);   -- zet ook je saldo-rij vast
  select h.* into rij from public.hogerlager_rondes h where h.user_id = me and h.ronde_id = p_ronde_id for update;
  if not found then raise exception 'Unknown round' using errcode = '22023'; end if;
  if rij.afgerond is not null then
    return jsonb_build_object('kaart', rij.kaart, 'volgende', rij.volgende, 'keuze', rij.keuze, 'inzet', rij.inzet, 'uitslag', rij.uitslag,
      'uitbetaling', rij.uitbetaling, 'saldo', s, 'al', true);
  end if;
  if rij.gedeeld < now() - interval '1 hour' then raise exception 'Round expired' using errcode = '22023'; end if;
  m := public.hogerlager_maal100(rij.kaart, p_keuze);
  if m = 0 then raise exception 'Invalid bet' using errcode = '22023'; end if;
  if s - p_inzet < -100 then raise exception 'Not enough tokens' using errcode = 'P0001'; end if;
  a := public.hogerlager_rang(rij.kaart); b := public.hogerlager_rang(rij.volgende);
  uit := case when a <> b and ((b > a) = (p_keuze = 'hoger')) then 'winst' else 'verlies' end;
  terug := case when uit = 'winst' then (p_inzet * m) / 100 else 0 end;
  update public.hogerlager_rondes h set keuze = p_keuze, inzet = p_inzet, uitslag = uit, uitbetaling = terug, afgerond = now()
   where h.user_id = me and h.ronde_id = p_ronde_id;
  update public.casino_saldo c set saldo = least(c.saldo::bigint - p_inzet + terug, 1000000000)::integer, bijgewerkt = now()
   where c.user_id = me returning c.saldo into s;
  return jsonb_build_object('kaart', rij.kaart, 'volgende', rij.volgende, 'keuze', p_keuze, 'inzet', p_inzet, 'uitslag', uit,
    'uitbetaling', terug, 'saldo', s, 'al', false);
end;
$$;
revoke all on function public.hogerlager_raad(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.hogerlager_raad(uuid, text, integer, uuid) to authenticated;

commit;

-- Controle: verwacht 'trigger fibro_casino_geboortejaar: 1', het aantal accounts met een vast geboortejaar en
-- 'weekgeld 500 en fiche 5: ja'
select 'trigger fibro_casino_geboortejaar: ' || count(*) as controle from pg_trigger
 where tgname = 'fibro_casino_geboortejaar' and not tgisinternal
union all
select 'accounts met geboortejaar: ' || count(*) from public.casino_geboortejaar
union all
select 'weekgeld 500 en fiche 5: ' || case when position('500::bigint' in (select prosrc from pg_proc where proname = 'casino_bij')) > 0
  and pg_get_constraintdef((select oid from pg_constraint where conname = 'videopoker_rondes_inzet_check')) like '%5, 10%'
  and to_regprocedure('public.hogerlager_raad(uuid, text, integer, uuid)') is not null then 'ja' else 'NEE' end;
