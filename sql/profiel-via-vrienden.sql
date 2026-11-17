-- profiel-via-vrienden.sql (17 nov 2026, stap 2 van docs/profiel-via-vrienden.md). NOG NIET UITGEVOERD.
-- Uitvoeren in Supabase > SQL editor, pas als Marcel of Tijn dat zegt.
--
-- In gewone woorden: Bram (tussenpersoon) heeft het nieuwste profiel van Anna. Sanne vraagt erom. Bram mag het alleen
-- geven als Sanne ook echt een vriend van Anna is. Die vriendenlijsten kan de app niet zien (en dat blijft zo); deze
-- functie beantwoordt alleen die ene vraag, en alleen voor wie zelf vriend is van allebei.
--   select public.deelt_vriend('<anna>', '<sanne>');  -- door Bram: true alleen als Bram-Anna, Bram-Sanne en Anna-Sanne vrienden zijn
-- Geblokkeerd of de vriendschap opgezegd: geen vrienden meer, dus false.

create or replace function public.deelt_vriend(eigenaar uuid, ander uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and eigenaar is not null and ander is not null
     and auth.uid() <> eigenaar and auth.uid() <> ander
     and public.zijn_vrienden(auth.uid(), eigenaar)
     and public.zijn_vrienden(auth.uid(), ander)
     and public.zijn_vrienden(eigenaar, ander);
$$;

revoke all on function public.deelt_vriend(uuid, uuid) from public, anon;
grant execute on function public.deelt_vriend(uuid, uuid) to authenticated;
