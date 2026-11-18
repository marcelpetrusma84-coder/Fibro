-- groep-geblokkeerd.sql (17 nov 2026): iemand die je persoonlijk blokkeerde, in een groep.
-- Zijn berichten tellen niet mee in het tellertje van ongelezen berichten (groep_ongelezen).
-- (De pushmelding staat in de edge function stuur-push: wie de afzender blokkeerde, krijgt er geen.)
-- Verder verandert er niets: hij blijft lid en merkt niets. Opnieuw uitvoeren kan geen kwaad.
begin;

create or replace function public.groep_ongelezen()
returns table (groep_id uuid, aantal integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.groep_id,
         (select count(*)::int from public.groep_berichten b
           where b.groep_id = l.groep_id and b.sender_id <> auth.uid() and not b.stil and b.expires_at > now()
             and b.created_at > coalesce((select g.gelezen_tot from public.groep_gelezen g
                                           where g.groep_id = l.groep_id and g.user_id = auth.uid()), l.created_at)
             and not exists (select 1 from public.mijn_blokkades mb
                              where mb.blokkeerder_id = auth.uid() and mb.geblokkeerde_id = b.sender_id))
    from public.groep_leden l
   where l.user_id = auth.uid();
$$;

revoke execute on function public.groep_ongelezen() from public, anon;
grant execute on function public.groep_ongelezen() to authenticated;

commit;
