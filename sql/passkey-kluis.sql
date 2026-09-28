-- passkey-kluis.sql: dichte dozen (geheime sleutel versleuteld met een passkey-geheim)
-- Eén rij per passkey. Alleen eigen rijen. De server kan een doos niet openen.
create table if not exists public.passkey_kluis (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cred_id     text not null check (length(cred_id) between 10 and 1400),
  blob        text not null check (length(blob) between 20 and 8000),
  naam        text check (naam is null or length(naam) <= 60),
  gemaakt_op  timestamptz not null default now(),
  unique (user_id, cred_id)
);

alter table public.passkey_kluis enable row level security;

drop policy if exists "passkey_kluis eigen lezen" on public.passkey_kluis;
drop policy if exists "passkey_kluis eigen maken" on public.passkey_kluis;
drop policy if exists "passkey_kluis eigen wijzigen" on public.passkey_kluis;
drop policy if exists "passkey_kluis eigen weggooien" on public.passkey_kluis;

create policy "passkey_kluis eigen lezen" on public.passkey_kluis
  for select to authenticated using (auth.uid() = user_id);
create policy "passkey_kluis eigen maken" on public.passkey_kluis
  for insert to authenticated with check (auth.uid() = user_id);
create policy "passkey_kluis eigen wijzigen" on public.passkey_kluis
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "passkey_kluis eigen weggooien" on public.passkey_kluis
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.passkey_kluis from anon;
grant select, insert, update, delete on public.passkey_kluis to authenticated;
