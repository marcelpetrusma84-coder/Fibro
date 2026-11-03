-- profielen-publiek-dicht.sql (bugtest 3 nov 2026): de lijst van alle gebruikers is niet meer zonder inloggen te lezen.
-- AL UITGEVOERD op 3 nov 2026 (Supabase-migratie profielen_publiek_dicht); nog een keer uitvoeren kan geen kwaad.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Wat er mis was: de view profielen_publiek (id, gebruikersnaam, publieke sleutel en avatar van iedereen die niet
-- geblokkeerd is) draaide met de rechten van de maker (SECURITY DEFINER) en mocht door 'anon' gelezen worden. Met de
-- sleutel die in de app staat kon dus iedereen, zonder account, de hele gebruikerslijst ophalen. De tabel profiles zelf
-- was wel goed afgeschermd.
--
-- Alleen invite.html gebruikte de view: om bij een uitnodiging de naam en avatar te tonen van wie je uitnodigde. Daarvoor
-- komt nu uitnodiger_van_invite(token): die geeft alleen naam en avatar, en alleen bij een geldige, ongebruikte
-- uitnodiging. invite.html probeert eerst deze functie (en valt terug op de view zolang dit bestand niet is uitgevoerd).
begin;

create or replace function public.uitnodiger_van_invite(token_in text)
returns table(username text, avatar_url text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.username, p.avatar_url
  from invite_tokens t
  join profiles p on p.id = t.created_by
  where t.token = token_in
    and t.is_used = false
    and (t.expires_at is null or t.expires_at > now())
    and coalesce(p.geblokkeerd, false) = false
  limit 1;
$$;
revoke all on function public.uitnodiger_van_invite(text) from public;
grant execute on function public.uitnodiger_van_invite(text) to anon, authenticated;

-- De view dicht voor iedereen behalve de server zelf (de view blijft bestaan, voor als iets anders hem nog nodig heeft)
revoke all on public.profielen_publiek from anon, authenticated;
alter view public.profielen_publiek set (security_invoker = true);

commit;

-- Controle (twee keer true)
select
  to_regprocedure('public.uitnodiger_van_invite(text)') is not null as functie_bestaat,
  not has_table_privilege('anon', 'public.profielen_publiek', 'select') as lijst_dicht_zonder_inloggen;
