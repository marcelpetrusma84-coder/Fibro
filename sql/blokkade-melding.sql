-- Fibro: mijn_blokkade() voor de melding in de app (30-09-2026)
--
-- Geeft voor de ingelogde gebruiker precies een regel terug:
--   geblokkeerd (true/false), tot (leeg = voor altijd of onbekend), reden (kan leeg zijn).
-- Kijkt naar de vlag profiles.geblokkeerd en naar actieve rijen in blokkades.
-- Zegt alleen iets over jezelf. Niet ingelogd: geen regel.
-- Opnieuw uitvoeren kan geen kwaad.

create or replace function public.mijn_blokkade()
returns table (geblokkeerd boolean, tot timestamptz, reden text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with actief as (
    select b.tot, b.reden
    from blokkades b
    where b.gebruiker_id = auth.uid()
      and b.opgeheven_op is null
      and b.van <= now()
      and (b.tot is null or b.tot > now())
  ),
  vlag as (
    select coalesce((select p.geblokkeerd from profiles p where p.id = auth.uid()), false) as aan
  )
  select
    (select aan from vlag) or exists (select 1 from actief),
    case
      when (select aan from vlag) or exists (select 1 from actief where tot is null) then null
      else (select max(tot) from actief)
    end,
    (select reden from actief order by tot desc nulls first limit 1)
  where auth.uid() is not null;
$$;

revoke execute on function public.mijn_blokkade() from public, anon;
grant execute on function public.mijn_blokkade() to authenticated;

-- Controle: verwacht 'mijn_blokkade voor app: true' en 'mijn_blokkade zonder inloggen: false'
select 'mijn_blokkade voor app' as soort,
       has_function_privilege('authenticated', 'public.mijn_blokkade()', 'EXECUTE')::text as detail
union all
select 'mijn_blokkade zonder inloggen',
       has_function_privilege('anon', 'public.mijn_blokkade()', 'EXECUTE')::text;
