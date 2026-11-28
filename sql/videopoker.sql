-- Video Poker met casino-tokens (27 nov 2026, Marcel). De SERVER deelt de kaarten, ruilt en betaalt uit, zodat niemand
-- een hand kan verzinnen (een royal flush betaalt 250×). Eenmaal uitvoeren in de Supabase SQL Editor, NA
-- sql/casino-tokens.sql (die maakt casino_saldo, casino_bij en casino_ik). Herhaalbaar.
--
-- In gewone woorden:
--  - videopoker_deel: je zet in (5, 10, 25, 50 of 100; je saldo mag niet onder -100). De server schudt een vers spel van
--    52 kaarten, bewaart de bovenste 10 en stuurt je alleen de eerste 5. Staat er nog een ronde van jou open (je ging
--    weg voor het ruilen), dan krijg je die terug en gaat er niets af.
--  - videopoker_ruil: je zegt welke kaarten je houdt (p_houd: een getal, bit 0 = de eerste kaart). De kaarten die je niet
--    houdt, worden vervangen door kaart 6, 7, ... van de bewaarde 10. De server kijkt welke hand het is
--    (videopoker_hand, dezelfde regels als videopoker.js) en betaalt inzet × de tabel uit. Nog een keer sturen is veilig.
--  - Hoogstens 30 rondes per minuut. Niemand leest of schrijft de tabel direct.
begin;

create table if not exists public.videopoker_rondes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ronde_id uuid not null,
  inzet integer not null check (inzet in (5, 10, 25, 50, 100)),
  kaarten text[] not null check (array_length(kaarten, 1) = 10),
  houd integer check (houd between 0 and 31),
  eind text[],
  hand text,
  uitbetaling integer,
  gedeeld timestamptz not null default now(),
  afgerond timestamptz,
  primary key (user_id, ronde_id)
);
create index if not exists videopoker_open on public.videopoker_rondes (user_id) where afgerond is null;
create index if not exists videopoker_tempo on public.videopoker_rondes (user_id, gedeeld);
alter table public.videopoker_rondes enable row level security;
revoke all on public.videopoker_rondes from public, anon, authenticated;

-- Welke hand is dit (5 kaarten zoals 'h10', 'sA', 'rB')? Dezelfde regels als beoordeel() in videopoker.js.
create or replace function public.videopoker_hand(k text[])
returns text language plpgsql immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  waarden constant text[] := array['2','3','4','5','6','7','8','9','10','B','V','H','A'];
  r int[];
  flush boolean;
  straat boolean;
  telling int[];
  hoogPaar boolean;
begin
  if k is null or array_length(k, 1) <> 5 then return 'niets'; end if;
  select array_agg(array_position(waarden, substr(x, 2)) + 1 order by array_position(waarden, substr(x, 2))) into r from unnest(k) x;
  flush := (select count(distinct substr(x, 1, 1)) = 1 from unnest(k) x);
  straat := (select count(distinct v) = 5 from unnest(r) v) and (r[5] - r[1] = 4 or r = array[2,3,4,5,14]);
  select array_agg(n order by n desc) into telling from (select count(*)::int n from unnest(r) v group by v) t;
  hoogPaar := exists (select 1 from unnest(r) v group by v having count(*) = 2 and v >= 11);
  if flush and straat then return case when r[1] = 10 then 'royal' else 'straight_flush' end; end if;
  if telling[1] = 4 then return 'four'; end if;
  if telling[1] = 3 and telling[2] = 2 then return 'full_house'; end if;
  if flush then return 'flush'; end if;
  if straat then return 'straight'; end if;
  if telling[1] = 3 then return 'three'; end if;
  if telling[1] = 2 and telling[2] = 2 then return 'two_pair'; end if;
  if telling[1] = 2 and hoogPaar then return 'jacks'; end if;
  return 'niets';
end;
$$;
revoke all on function public.videopoker_hand(text[]) from public, anon, authenticated;

create or replace function public.videopoker_maal(h text)
returns integer language sql immutable
set search_path = pg_catalog, pg_temp
as $$ select case h when 'royal' then 250 when 'straight_flush' then 50 when 'four' then 25 when 'full_house' then 9
  when 'flush' then 6 when 'straight' then 4 when 'three' then 3 when 'two_pair' then 2 when 'jacks' then 1 else 0 end; $$;
revoke all on function public.videopoker_maal(text) from public, anon, authenticated;

-- Delen (de inzet gaat er meteen af)
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
  s := public.casino_bij(me);   -- zet ook je saldo-rij vast: twee keer tegelijk delen kan niet
  select v.* into open from public.videopoker_rondes v where v.user_id = me and v.afgerond is null order by v.gedeeld desc limit 1;
  if found then
    return jsonb_build_object('ronde_id', open.ronde_id, 'kaarten', to_jsonb(open.kaarten[1:5]), 'inzet', open.inzet, 'saldo', s, 'al', true);
  end if;
  if (select count(*) from public.videopoker_rondes v where v.user_id = me and v.gedeeld > now() - interval '1 minute') >= 30 then
    raise exception 'Too many rounds' using errcode = '54000';
  end if;
  if s - p_inzet < -100 then raise exception 'Not enough tokens' using errcode = 'P0001'; end if;
  -- een vers geschud spel (gen_random_uuid gebruikt de sterke toevalsgenerator van de server)
  select array_agg(c order by gen_random_uuid()) into stapel
    from unnest(array['h','r','k','s']) kl, unnest(array['2','3','4','5','6','7','8','9','10','B','V','H','A']) w, lateral (select kl || w as c) x;
  update public.casino_saldo c set saldo = c.saldo - p_inzet, bijgewerkt = now() where c.user_id = me returning c.saldo into s;
  insert into public.videopoker_rondes(user_id, ronde_id, inzet, kaarten) values (me, p_ronde_id, p_inzet, stapel[1:10]);
  return jsonb_build_object('ronde_id', p_ronde_id, 'kaarten', to_jsonb(stapel[1:5]), 'inzet', p_inzet, 'saldo', s, 'al', false);
end;
$$;
revoke all on function public.videopoker_deel(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.videopoker_deel(uuid, integer, uuid) to authenticated;

-- Ruilen en uitbetalen
create or replace function public.videopoker_ruil(p_ronde_id uuid, p_houd integer, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  me uuid := public.casino_ik(p_expected_user);
  rij public.videopoker_rondes%rowtype;
  s integer;
  nieuw text[] := array[]::text[];
  volgende int := 6;
  h text;
  terug integer;
begin
  if p_ronde_id is null or p_houd is null or p_houd < 0 or p_houd > 31 then raise exception 'Invalid hold' using errcode = '22023'; end if;
  s := public.casino_bij(me);
  select v.* into rij from public.videopoker_rondes v where v.user_id = me and v.ronde_id = p_ronde_id for update;
  if not found then raise exception 'Unknown round' using errcode = '22023'; end if;
  if rij.afgerond is not null then
    return jsonb_build_object('kaarten', to_jsonb(rij.eind), 'hand', rij.hand, 'uitbetaling', rij.uitbetaling, 'saldo', s, 'al', true);
  end if;
  for i in 1..5 loop
    if (p_houd >> (i - 1)) & 1 = 1 then nieuw := nieuw || rij.kaarten[i];
    else nieuw := nieuw || rij.kaarten[volgende]; volgende := volgende + 1; end if;
  end loop;
  h := public.videopoker_hand(nieuw);
  terug := rij.inzet * public.videopoker_maal(h);
  update public.videopoker_rondes v set houd = p_houd, eind = nieuw, hand = h, uitbetaling = terug, afgerond = now()
   where v.user_id = me and v.ronde_id = p_ronde_id;
  update public.casino_saldo c set saldo = least(c.saldo::bigint + terug, 1000000000)::integer, bijgewerkt = now()
   where c.user_id = me returning c.saldo into s;
  return jsonb_build_object('kaarten', to_jsonb(nieuw), 'hand', h, 'uitbetaling', terug, 'saldo', s, 'al', false);
end;
$$;
revoke all on function public.videopoker_ruil(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.videopoker_ruil(uuid, integer, uuid) to authenticated;

commit;
