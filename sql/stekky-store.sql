-- Stekky Store (10-11-2026): wat iemand in de store gedownload heeft, per account.
-- Eenmaal uitvoeren in de Supabase SQL Editor (of via Claude, na toestemming van Marcel).
-- Herhaalbaar: alleen "create ... if not exists" en "create or replace"; er wordt niets weggegooid.
--
-- Regels:
--   - Je ziet alleen je eigen downloads.
--   - Downloaden kan voorlopig alleen een moderator (de store is nog alleen voor moderators).
--     Later voor iedereen: de policy store_downloads_toevoegen aanpassen (het stukje ben_ik_moderator() eruit).
--   - Een geblokkeerd account kan niets downloaden.
--   - Weghalen (uit je account) mag altijd, ook van je eigen downloads.
--   - Verwijder je je account, dan gaan je downloads mee (on delete cascade).

do $$
begin
  if to_regprocedure('public.ben_ik_moderator()') is null then
    raise exception 'STOP: ben_ik_moderator() ontbreekt; er is niets aangepast';
  end if;
  if to_regprocedure('public.ben_ik_geblokkeerd()') is null then
    raise exception 'STOP: ben_ik_geblokkeerd() ontbreekt; er is niets aangepast';
  end if;
end $$;

create table if not exists public.store_downloads (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{1,64}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.store_downloads enable row level security;
revoke all on public.store_downloads from public, anon, authenticated;
grant select, insert, delete on public.store_downloads to authenticated;

-- "create policy" kent geen "or replace"; daarom alleen aanmaken als hij er nog niet is.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'store_downloads'
                 and policyname = 'store_downloads_lezen') then
    create policy store_downloads_lezen on public.store_downloads
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'store_downloads'
                 and policyname = 'store_downloads_toevoegen') then
    create policy store_downloads_toevoegen on public.store_downloads
      for insert to authenticated
      with check (user_id = auth.uid() and public.ben_ik_moderator() and not public.ben_ik_geblokkeerd());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'store_downloads'
                 and policyname = 'store_downloads_weghalen') then
    create policy store_downloads_weghalen on public.store_downloads
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- Controle: moet 3 regels tonen (lezen, toevoegen, weghalen) en rls_aan = true
select policyname, cmd,
  (select relrowsecurity from pg_class where oid = 'public.store_downloads'::regclass) as rls_aan
from pg_policies where schemaname = 'public' and tablename = 'store_downloads' order by policyname;
