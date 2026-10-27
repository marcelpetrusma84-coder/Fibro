-- foutmeldingen.sql (Fibro v221): de foutmelder (foutmelder.js) bewaart hier wat er technisch misgaat in de app.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Wat er in een melding staat: de pagina (bijvoorbeeld chat.html), het soort fout, de foutregel, in welk bestand en
-- op welke regel, de stapel (welke functies), en het soort toestel en browser. Geen account, geen berichten, geen
-- namen: foutmelder.js haalt internetadressen, id's en foto-gegevens er al uit voordat hij iets verstuurt.
--
-- Opslaan kan alleen via de functie meld_fout (ook zonder in te loggen, voor fouten op de inlogpagina), met grenzen:
-- korte teksten, hoogstens 300 meldingen per uur voor heel Fibro, en meldingen ouder dan 30 dagen gaan vanzelf weg.
-- Lezen en wissen kunnen alleen moderators (ben_ik_moderator), op de pagina Moderatie > Foutmeldingen.
begin;

do $$
begin
  if to_regprocedure('public.ben_ik_moderator()') is null then
    raise exception 'STOP: ben_ik_moderator() ontbreekt; er is niets aangepast';
  end if;
end $$;

create table if not exists public.foutmeldingen (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  pagina text not null check (char_length(pagina) <= 80),
  soort text not null check (soort in ('fout', 'belofte')),
  bericht text not null check (char_length(bericht) <= 300),
  bron text check (char_length(bron) <= 200),
  stapel text check (char_length(stapel) <= 1500),
  toestel text check (char_length(toestel) <= 200)
);
create index if not exists foutmeldingen_tijd on public.foutmeldingen (created_at desc);

alter table public.foutmeldingen enable row level security;
revoke all on public.foutmeldingen from public, anon, authenticated;
grant select, delete on public.foutmeldingen to authenticated;

drop policy if exists foutmeldingen_lezen_moderator on public.foutmeldingen;
create policy foutmeldingen_lezen_moderator on public.foutmeldingen
  for select to authenticated using (public.ben_ik_moderator());

drop policy if exists foutmeldingen_wissen_moderator on public.foutmeldingen;
create policy foutmeldingen_wissen_moderator on public.foutmeldingen
  for delete to authenticated using (public.ben_ik_moderator());

create or replace function public.meld_fout(
  p_pagina text,
  p_soort text,
  p_bericht text,
  p_bron text default null,
  p_stapel text default null,
  p_toestel text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_bericht is null or btrim(p_bericht) = '' then return; end if;
  -- tegen volspammen: hoogstens 300 per uur voor heel Fibro
  if (select count(*) from public.foutmeldingen where created_at > now() - interval '1 hour') >= 300 then return; end if;
  delete from public.foutmeldingen where created_at < now() - interval '30 days';
  insert into public.foutmeldingen (pagina, soort, bericht, bron, stapel, toestel)
  values (
    left(coalesce(nullif(btrim(p_pagina), ''), '?'), 80),
    case when p_soort = 'belofte' then 'belofte' else 'fout' end,
    left(btrim(p_bericht), 300),
    left(nullif(btrim(p_bron), ''), 200),
    left(nullif(btrim(p_stapel), ''), 1500),
    left(nullif(btrim(p_toestel), ''), 200)
  );
end
$$;
revoke all on function public.meld_fout(text, text, text, text, text, text) from public;
grant execute on function public.meld_fout(text, text, text, text, text, text) to anon, authenticated;

commit;

-- Controle (drie keer true)
select
  to_regclass('public.foutmeldingen') is not null as tabel_bestaat,
  to_regprocedure('public.meld_fout(text,text,text,text,text,text)') is not null as functie_bestaat,
  (select relrowsecurity from pg_class where oid = 'public.foutmeldingen'::regclass) as alleen_moderators;
