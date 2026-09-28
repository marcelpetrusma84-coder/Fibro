-- Fibro: ongelezen berichten bijhouden.
-- Eén keer uitvoeren in de SQL-editor van Supabase. Nog een keer uitvoeren kan geen kwaad.
--
-- laatst_gelezen: per gebruiker en per vriend tot wanneer je gelezen hebt.
-- ongelezen_per_vriend(): per vriend het aantal berichten aan jou van daarna.
-- markeer_gelezen(vriend): alles van die vriend tot nu telt als gelezen.
-- Heb je bij een vriend nog nooit iets gelezen, dan tellen alleen berichten
-- vanaf 25 september 2026 mee, anders zou alles van de afgelopen maand
-- ineens als ongelezen verschijnen.

create table if not exists public.laatst_gelezen (
  gebruiker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vriend_id    uuid not null,
  gelezen_tot  timestamptz not null default now(),
  primary key (gebruiker_id, vriend_id)
);

alter table public.laatst_gelezen enable row level security;

drop policy if exists "eigen gelezen lezen" on public.laatst_gelezen;
create policy "eigen gelezen lezen" on public.laatst_gelezen
  for select using (gebruiker_id = auth.uid());

drop policy if exists "eigen gelezen maken" on public.laatst_gelezen;
create policy "eigen gelezen maken" on public.laatst_gelezen
  for insert with check (gebruiker_id = auth.uid());

drop policy if exists "eigen gelezen bijwerken" on public.laatst_gelezen;
create policy "eigen gelezen bijwerken" on public.laatst_gelezen
  for update using (gebruiker_id = auth.uid()) with check (gebruiker_id = auth.uid());

grant select, insert, update on public.laatst_gelezen to authenticated;

create or replace function public.ongelezen_per_vriend()
returns table (vriend_id uuid, aantal bigint)
language sql stable security invoker
set search_path = public
as $$
  select m.sender_id, count(*)
  from messages m
  left join laatst_gelezen g
    on g.gebruiker_id = auth.uid() and g.vriend_id = m.sender_id
  where m.receiver_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(g.gelezen_tot, timestamptz '2026-09-25 00:00:00+02')
  group by m.sender_id
$$;

create or replace function public.markeer_gelezen(p_vriend uuid)
returns void
language sql volatile security invoker
set search_path = public
as $$
  insert into laatst_gelezen (gebruiker_id, vriend_id, gelezen_tot)
  values (auth.uid(), p_vriend, now())
  on conflict (gebruiker_id, vriend_id) do update set gelezen_tot = excluded.gelezen_tot
$$;

grant execute on function public.ongelezen_per_vriend() to authenticated;
grant execute on function public.markeer_gelezen(uuid) to authenticated;
