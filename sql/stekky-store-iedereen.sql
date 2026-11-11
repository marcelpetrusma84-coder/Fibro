-- Stekky Store voor iedereen (11-11-2026): iedereen met een account mag downloaden, niet alleen moderators.
-- Eenmaal uitvoeren in de Supabase SQL Editor (of via Claude, na toestemming van Marcel), NA sql/stekky-store.sql.
-- Herhaalbaar. Er wordt niets weggegooid behalve de oude regel "alleen moderators mogen toevoegen".
--
-- Wat blijft hetzelfde:
--   - Je ziet alleen je eigen downloads, en je kunt alleen voor jezelf downloaden (user_id = jij).
--   - Een geblokkeerd account kan niets downloaden.
--   - Weghalen mag altijd (alleen je eigen).

do $$
begin
  if to_regclass('public.store_downloads') is null then
    raise exception 'STOP: tabel store_downloads ontbreekt; voer eerst sql/stekky-store.sql uit. Er is niets aangepast';
  end if;
  if to_regprocedure('public.ben_ik_geblokkeerd()') is null then
    raise exception 'STOP: ben_ik_geblokkeerd() ontbreekt; er is niets aangepast';
  end if;
end $$;

begin;
drop policy if exists store_downloads_toevoegen on public.store_downloads;
create policy store_downloads_toevoegen on public.store_downloads
  for insert to authenticated
  with check (user_id = auth.uid() and not public.ben_ik_geblokkeerd());
commit;

-- Controle: de regel "toevoegen" noemt geen ben_ik_moderator meer
select policyname, cmd, with_check from pg_policies
where schemaname = 'public' and tablename = 'store_downloads' order by policyname;
