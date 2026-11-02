-- minimumleeftijd.sql (Fibro v255, 2 nov 2026): Fibro is vanaf 16 jaar, ook in de database zelf.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Waarom: login.html en invite.html weigeren al een geboortejaar van jonger dan 16 (v225). Maar dat is alleen de
-- webpagina; wie Supabase rechtstreeks aanroept, kan daar omheen. Deze controle zit in de database (een trigger op
-- auth.users), net als de registratie-schakelaar (sql/registratie-schakelaar.sql).
--
-- Wat er gebeurt bij een nieuw account:
--   - geen geldig geboortejaar (4 cijfers) in de gegevens van het account: geweigerd (FIBRO_GEBOORTEJAAR_ONTBREEKT);
--   - huidig jaar min geboortejaar kleiner dan 16: geweigerd (FIBRO_TE_JONG).
-- Net als op de webpagina telt alleen het jaar: wie in december 2010 is geboren, mag in 2026 al (dan 15 of 16).
-- Bestaande accounts merken hier niets van; inloggen blijft gewoon werken.
--
-- Let op: 'Add user' in het Supabase-dashboard maakt een account zonder geboortejaar en wordt dus ook geweigerd.
-- Wil je toch zo een account maken, voeg dan bij 'User Metadata' {"geboortejaar": 1990} toe (of het echte jaar).
begin;

create or replace function public.controleer_leeftijd()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  jaar_tekst text := new.raw_user_meta_data ->> 'geboortejaar';
begin
  if jaar_tekst is null or jaar_tekst !~ '^[0-9]{4}$' then
    raise exception 'FIBRO_GEBOORTEJAAR_ONTBREEKT';
  end if;
  if extract(year from now())::int - jaar_tekst::int < 16 then
    raise exception 'FIBRO_TE_JONG';
  end if;
  return new;
end;
$$;
revoke execute on function public.controleer_leeftijd() from public, anon, authenticated;

drop trigger if exists fibro_leeftijd_controle on auth.users;
create trigger fibro_leeftijd_controle
  before insert on auth.users
  for each row execute function public.controleer_leeftijd();

commit;

-- Controle: verwacht 'trigger fibro_leeftijd_controle: 1'
select 'trigger fibro_leeftijd_controle: ' || count(*) as controle
  from pg_trigger
 where tgname = 'fibro_leeftijd_controle' and not tgisinternal;
