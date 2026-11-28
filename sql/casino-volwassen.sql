-- casino-volwassen.sql (28 nov 2026, Marcel): het casino is alleen voor 18+, plus de Fruitautomaat en Hoger of lager.
-- Eenmaal uitvoeren in de Supabase SQL Editor, NA sql/casino-tokens.sql en sql/videopoker.sql. Herhaalbaar.
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
--  3. Hoger of lager mag nu ook met tokens (casino_inzet, 2× terug, net als Black Jack).
--  4. fruitautomaat_draai: de SERVER draait de drie rollen en betaalt uit (tot 200× je inzet), net als Video Poker,
--     zodat niemand een uitslag kan verzinnen. Dezelfde tabel als fruitautomaat.js. Hoogstens 40 draaien per minuut.
begin;

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
             least(c.saldo::bigint + 250::bigint * greatest((nu - c.week) / 7, 0), 1000000000)::integer as saldo
      from public.casino_saldo c join public.profiles p on p.id = c.user_id
      where c.user_id <> me and public.spel_vriend(me, c.user_id) and public.spel_speler_zichtbaar(c.user_id)
        and public.casino_volwassen(c.user_id)
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

-- ── 3. Inzetten: dezelfde als in casino-tokens.sql, nu ook voor Hoger of lager ──
create or replace function public.casino_inzet(p_run_id uuid, p_spel text, p_inzet integer, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  oud public.casino_inzetten%rowtype;
  s integer;
begin
  if p_run_id is null or p_spel is null or p_spel not in ('eenentwintigen', 'pokertexasholdem', 'hogerlager')
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
  inzet integer not null check (inzet in (10, 25, 50, 100)),
  rollen text[] not null check (array_length(rollen, 1) = 3),
  uitbetaling integer not null check (uitbetaling >= 0),
  gedraaid timestamptz not null default now(),
  primary key (user_id, ronde_id)
);
create index if not exists fruitautomaat_tempo on public.fruitautomaat_rondes (user_id, gedraaid);
alter table public.fruitautomaat_rondes enable row level security;
revoke all on public.fruitautomaat_rondes from public, anon, authenticated;

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
  if p_ronde_id is null or p_inzet is null or p_inzet not in (10, 25, 50, 100) then
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

commit;

-- Controle: verwacht 'trigger fibro_casino_geboortejaar: 1' en het aantal accounts met een vast geboortejaar
select 'trigger fibro_casino_geboortejaar: ' || count(*) as controle from pg_trigger
 where tgname = 'fibro_casino_geboortejaar' and not tgisinternal
union all
select 'accounts met geboortejaar: ' || count(*) from public.casino_geboortejaar;
