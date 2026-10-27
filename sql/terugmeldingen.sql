-- terugmeldingen.sql (Fibro v222): "Fout of idee melden" uit het menu op Home (terugmelden.js).
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Anders dan de foutmelder (foutmeldingen.sql) is dit iets wat iemand zelf schrijft en verstuurt. Daarom staat hier
-- wél bij van wie het komt (user_id), zodat een moderator kan terugvragen. Verder: fout of idee, de tekst, en bij een
-- fout op welk onderdeel en welk soort toestel.
--
-- Versturen kan alleen ingelogd, via stuur_terugmelding (hoogstens 20 per persoon per dag).
-- Lezen, de status veranderen (nieuw / gelezen / opgelost) en wissen kunnen alleen moderators.
-- Verwijdert iemand zijn account, dan gaan zijn meldingen mee (CASCADE). In 'Mijn gegevens downloaden'
-- (mijn_gegevens) staan ze erbij onder 'terugmeldingen'.
begin;

do $$
begin
  if to_regprocedure('public.ben_ik_moderator()') is null then
    raise exception 'STOP: ben_ik_moderator() ontbreekt; er is niets aangepast';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'STOP: de tabel profiles ontbreekt; er is niets aangepast';
  end if;
end $$;

create table if not exists public.terugmeldingen (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  soort text not null check (soort in ('fout', 'idee')),
  tekst text not null check (char_length(tekst) between 1 and 1000),
  pagina text check (char_length(pagina) <= 80),
  toestel text check (char_length(toestel) <= 200),
  status text not null default 'nieuw' check (status in ('nieuw', 'gelezen', 'opgelost'))
);
create index if not exists terugmeldingen_tijd on public.terugmeldingen (created_at desc);
create index if not exists terugmeldingen_van on public.terugmeldingen (user_id, created_at desc);

alter table public.terugmeldingen enable row level security;
revoke all on public.terugmeldingen from public, anon, authenticated;
grant select, delete on public.terugmeldingen to authenticated;
grant update (status) on public.terugmeldingen to authenticated;

drop policy if exists terugmeldingen_lezen_moderator on public.terugmeldingen;
create policy terugmeldingen_lezen_moderator on public.terugmeldingen
  for select to authenticated using (public.ben_ik_moderator());

drop policy if exists terugmeldingen_status_moderator on public.terugmeldingen;
create policy terugmeldingen_status_moderator on public.terugmeldingen
  for update to authenticated using (public.ben_ik_moderator()) with check (public.ben_ik_moderator());

drop policy if exists terugmeldingen_wissen_moderator on public.terugmeldingen;
create policy terugmeldingen_wissen_moderator on public.terugmeldingen
  for delete to authenticated using (public.ben_ik_moderator());

create or replace function public.stuur_terugmelding(
  p_soort text,
  p_tekst text,
  p_pagina text default null,
  p_toestel text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mij uuid := auth.uid();
begin
  if mij is null then raise exception 'Je moet ingelogd zijn'; end if;
  if p_tekst is null or btrim(p_tekst) = '' then raise exception 'Schrijf eerst wat er is'; end if;
  if (select count(*) from public.terugmeldingen where user_id = mij and created_at > now() - interval '1 day') >= 20 then
    raise exception 'TE_VEEL: je hebt vandaag al 20 meldingen gestuurd';
  end if;
  insert into public.terugmeldingen (user_id, soort, tekst, pagina, toestel)
  values (
    mij,
    case when p_soort = 'idee' then 'idee' else 'fout' end,
    left(btrim(p_tekst), 1000),
    left(nullif(btrim(p_pagina), ''), 80),
    left(nullif(btrim(p_toestel), ''), 200)
  );
end
$$;
revoke all on function public.stuur_terugmelding(text, text, text, text) from public, anon;
grant execute on function public.stuur_terugmelding(text, text, text, text) to authenticated;

-- 'Mijn gegevens downloaden': de eigen meldingen erbij zetten, in de bestaande functie mijn_gegevens().
-- Die functie staat live in Supabase en kan nieuwer zijn dan het bestand in sql/. Daarom wordt hier de live versie
-- gelezen en alleen een regel toegevoegd voor 'personen'. Ontbreekt de functie, of herkent dit script hem niet,
-- dan blijft hij zoals hij is (en zegt dat in een NOTICE). Al gedaan: dan gebeurt er niets.
do $$
declare
  def text;
  nieuw text;
begin
  if to_regprocedure('public.mijn_gegevens()') is null then
    raise notice 'mijn_gegevens() bestaat niet: overgeslagen';
    return;
  end if;
  def := pg_get_functiondef('public.mijn_gegevens()'::regprocedure);
  if strpos(def, '''terugmeldingen''') > 0 then
    raise notice 'mijn_gegevens() heeft de terugmeldingen al';
    return;
  end if;
  if strpos(def, 'mij uuid') = 0 or (length(def) - length(replace(def, '''personen'',', ''))) / length('''personen'',') <> 1 then
    raise notice 'mijn_gegevens() niet herkend (geen of meer dan een keer ''personen''): niet aangepast';
    return;
  end if;
  nieuw := replace(def, '''personen'',',
    '''terugmeldingen'', coalesce((select jsonb_agg(to_jsonb(tm) order by tm.created_at) from public.terugmeldingen tm where tm.user_id = mij), ''[]''::jsonb),' || chr(10) || '    ''personen'',');
  execute nieuw;
  raise notice 'mijn_gegevens() aangevuld met terugmeldingen';
end $$;

-- Zelftest: mijn_gegevens() een keer draaien als een bestaande gebruiker. Gaat dat mis, dan stopt alles (niets aangepast).
do $$
declare x uuid;
begin
  if to_regprocedure('public.mijn_gegevens()') is null then return; end if;
  select id into x from public.profiles limit 1;
  if x is null then return; end if;
  perform set_config('request.jwt.claim.sub', x::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  if not (public.mijn_gegevens() ? 'terugmeldingen') then
    raise notice 'mijn_gegevens() werkt, maar zonder terugmeldingen (niet aangepast, zie hierboven)';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

commit;

-- Controle (vier keer true)
select
  to_regclass('public.terugmeldingen') is not null as tabel_bestaat,
  to_regprocedure('public.stuur_terugmelding(text,text,text,text)') is not null as functie_bestaat,
  (select relrowsecurity from pg_class where oid = 'public.terugmeldingen'::regclass) as alleen_moderators,
  coalesce(strpos(pg_get_functiondef(to_regprocedure('public.mijn_gegevens()')), '''terugmeldingen''') > 0, false) as in_mijn_gegevens;
