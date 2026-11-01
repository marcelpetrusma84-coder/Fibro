-- profiel-versie.sql (Fibro v246, 31 oktober 2026): zien welke vriend zijn profiel heeft geüpdatet.
-- Plakken in Supabase > SQL Editor > Run. Herhaalbaar; gaat er iets mis, dan verandert er niets.
--
-- Foto's, widgets, stickers en muziek gaan rechtstreeks van telefoon naar telefoon (sync.js), niet via de server.
-- Daarom zet elke telefoon nu alleen een korte vingerafdruk van zijn profiel in profiles.profiel_versie
-- (bijvoorbeeld 'p1-1a2b3c4d5e6f7a8b'): geen foto, geen tekst, alleen een code die verandert als je iets verandert.
-- Op de pagina Vrienden vergelijkt Fibro die code met wat er van die vriend al op je toestel staat:
--   "Profiel geüpdatet · zie je zodra jullie allebei online zijn"  (nieuw, maar nog niet binnen)
--   "Profiel geüpdatet"                                            (binnen, nog niet bekeken)
-- Lezen: wie het profiel nu al mag lezen (je vrienden). Schrijven: alleen jezelf, zoals de rest van je profiel.
-- De rechten-trigger (bescherm_profielrechten) laat deze kolom gewoon toe; updated_at verandert er niet door.
begin;

alter table public.profiles add column if not exists profiel_versie text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiel_versie_kort'
                   and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiel_versie_kort check (profiel_versie is null or char_length(profiel_versie) <= 40);
  end if;
end $$;

commit;

-- Controle: hier hoort één regel te staan (profiel_versie, text)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'profiel_versie';
