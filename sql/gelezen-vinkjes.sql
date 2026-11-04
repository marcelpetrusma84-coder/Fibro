-- gelezen-vinkjes.sql (4 nov 2026, v261): blauwe vinkjes als je vriend je bericht gelezen heeft.
--
-- Wanneer iemand gelezen heeft, staat al in laatst_gelezen (sql/ongelezen.sql): per gebruiker en vriend 'gelezen_tot'.
-- Die tabel is alleen voor jezelf leesbaar. Deze functie geeft je vriend precies een ding terug: tot wanneer jij
-- zijn berichten gelezen hebt. En alleen als:
--   - jullie vrienden zijn,
--   - jij leesbevestigingen niet hebt uitgezet, en
--   - hij ze ook niet heeft uitgezet (zoals bij WhatsApp: uit = je ziet ze bij anderen ook niet).
-- De schakelaar (menu > Instellingen > Gelezen-vinkjes) staat in chat_instellingen. Geen rij = aan.
--
-- Eén keer uitvoeren in de SQL-editor van Supabase. Nog een keer uitvoeren kan geen kwaad.

begin;

create table if not exists public.chat_instellingen (
  gebruiker_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  leesbevestiging boolean not null default true,
  bijgewerkt      timestamptz not null default now()
);
alter table public.chat_instellingen enable row level security;

drop policy if exists chat_instellingen_lezen on public.chat_instellingen;
create policy chat_instellingen_lezen on public.chat_instellingen for select to authenticated
  using ((select auth.uid()) = gebruiker_id);
drop policy if exists chat_instellingen_maken on public.chat_instellingen;
create policy chat_instellingen_maken on public.chat_instellingen for insert to authenticated
  with check ((select auth.uid()) = gebruiker_id);
drop policy if exists chat_instellingen_wijzigen on public.chat_instellingen;
create policy chat_instellingen_wijzigen on public.chat_instellingen for update to authenticated
  using ((select auth.uid()) = gebruiker_id) with check ((select auth.uid()) = gebruiker_id);

revoke all on public.chat_instellingen from anon;
grant select, insert, update on public.chat_instellingen to authenticated;

-- Je eigen keuze zetten
create or replace function public.zet_leesbevestiging(p_aan boolean)
returns void
language sql volatile security invoker
set search_path = ''
as $$
  insert into public.chat_instellingen (gebruiker_id, leesbevestiging, bijgewerkt)
  values ((select auth.uid()), coalesce(p_aan, true), now())
  on conflict (gebruiker_id) do update set leesbevestiging = excluded.leesbevestiging, bijgewerkt = now()
$$;

-- Tot wanneer heeft deze vriend jouw berichten gelezen? null = onbekend of niet te zien.
create or replace function public.gelezen_door(p_vriend uuid)
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select g.gelezen_tot
    from public.laatst_gelezen g
   where (select auth.uid()) is not null
     and g.gebruiker_id = p_vriend
     and g.vriend_id = (select auth.uid())
     and exists (select 1 from public.friendships f
                  where f.user_id = (select auth.uid()) and f.friend_id = p_vriend and f.status = 'accepted')
     and coalesce((select c.leesbevestiging from public.chat_instellingen c where c.gebruiker_id = p_vriend), true)
     and coalesce((select c.leesbevestiging from public.chat_instellingen c where c.gebruiker_id = (select auth.uid())), true)
$$;

revoke execute on function public.zet_leesbevestiging(boolean) from public, anon;
revoke execute on function public.gelezen_door(uuid) from public, anon;
grant execute on function public.zet_leesbevestiging(boolean) to authenticated;
grant execute on function public.gelezen_door(uuid) to authenticated;

commit;

-- Controle (verwacht: chat_instellingen RLS aan: true, gelezen_door voor app: true, voor anon: false)
select 'chat_instellingen RLS aan' as wat, relrowsecurity::text as uitkomst from pg_class where oid = 'public.chat_instellingen'::regclass
union all select 'gelezen_door voor app', has_function_privilege('authenticated', 'public.gelezen_door(uuid)', 'EXECUTE')::text
union all select 'gelezen_door voor anon', has_function_privilege('anon', 'public.gelezen_door(uuid)', 'EXECUTE')::text;
