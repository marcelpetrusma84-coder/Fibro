-- Fibro: de taal van elk account (12 oktober 2026, v148)
--
-- profiles.taal = 'nl' of 'en', standaard 'nl' (zo was Fibro altijd).
-- De app zet hier de taal in die je gekozen hebt (alleen als die anders is dan wat
-- er al staat). De functie stuur-push kiest daarmee de tekst van een pushmelding
-- in de taal van de ontvanger, in plaats van in de taal van de afzender.
-- Een kolom met een vaste standaardwaarde toevoegen is in PostgreSQL alleen een
-- notitie bij de tabel: de bestaande rijen worden niet herschreven.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

alter table public.profiles add column if not exists taal text not null default 'nl';

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.profiles'::regclass and conname = 'profiles_taal_check') then
    alter table public.profiles add constraint profiles_taal_check check (taal in ('nl', 'en'));
  end if;
end $$;

commit;

-- Controle: verwacht een regel 'kolom' (text, standaard 'nl', leeg mag: NO), een regel
-- 'regel' (alleen nl of en) en per taal het aantal profielen (eerst allemaal nl).
select 'kolom' as soort,
       data_type || ', standaard ' || column_default || ', leeg mag: ' || is_nullable as detail
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'taal'
union all
select 'regel', pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass and conname = 'profiles_taal_check'
union all
select 'profielen met taal ' || taal, count(*)::text
from public.profiles
group by taal;
