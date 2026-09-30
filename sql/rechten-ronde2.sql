-- Fibro: rechten ronde 2 - gastenboek, berichten, uitnodigingen (30-09-2026)
--
-- 1. Gastenboek: schrijven alleen in je eigen gastenboek of dat van een vriend
--    (was: bij iedereen). Eigenaar en schrijver mogen een bericht verwijderen.
-- 2. Berichten: versturen alleen naar vrienden (was: naar iedereen).
-- 3. Uitnodigingen: maak_vriendschap_via_invite boekt het token zelf af, in
--    dezelfde stap (was: pas in een losse tweede aanroep, die je kon overslaan).
--    gebruik_invite gebruikt altijd de ingelogde gebruiker als used_by
--    (was: een vrij in te vullen id). De app-aanroepen blijven ongewijzigd.
-- 4. Opruimen: lege kolommen herstelsleutel en herstelsleutel_hint (vrienden
--    konden ze lezen), en zet_herstelsleutel schreef naar een kolom die niet
--    bestaat. De functie blijft bestaan, maar doet niets meer.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

-- 1. Gastenboek
drop policy if exists "Gastenboek schrijven als vriend" on public.guestbook_entries;
create policy "Gastenboek schrijven als vriend" on public.guestbook_entries
  for insert with check (
    auth.uid() = author_id
    and (profile_id = auth.uid()
         or exists (select 1 from public.friendships f
                    where f.status = 'accepted'
                      and f.user_id = auth.uid() and f.friend_id = profile_id))
  );
drop policy if exists "Gastenboekbericht verwijderen" on public.guestbook_entries;
create policy "Gastenboekbericht verwijderen" on public.guestbook_entries
  for delete using (auth.uid() = profile_id or auth.uid() = author_id);

-- 2. Berichten
drop policy if exists "Berichten versturen" on public.messages;
create policy "Berichten versturen" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and (receiver_id = auth.uid()
         or exists (select 1 from public.friendships f
                    where f.status = 'accepted'
                      and f.user_id = auth.uid() and f.friend_id = receiver_id))
  );

-- 3. Uitnodigingen
create or replace function public.maak_vriendschap_via_invite(token_in text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare mij uuid; uitnodiger uuid;
begin
  mij := auth.uid();
  if mij is null then return false; end if;

  -- Token afboeken en uitnodiger ophalen in een stap: kan maar een keer lukken
  update invite_tokens
     set is_used = true, used_at = now(), used_by = mij
   where token = token_in and is_used = false
     and (expires_at is null or expires_at > now())
     and created_by <> mij
  returning created_by into uitnodiger;

  if uitnodiger is null then return false; end if;

  insert into friendships (user_id, friend_id, status)
  values (mij, uitnodiger, 'accepted') on conflict do nothing;
  insert into friendships (user_id, friend_id, status)
  values (uitnodiger, mij, 'accepted') on conflict do nothing;
  return true;
end;
$function$;

-- Tweede parameter blijft bestaan zodat de app werkt, maar wordt genegeerd
create or replace function public.gebruik_invite(token_in text, gebruiker uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare aantal integer;
begin
  if auth.uid() is null then return false; end if;
  update invite_tokens set is_used = true, used_at = now(), used_by = auth.uid()
  where token = token_in and is_used = false
    and (expires_at is null or expires_at > now());
  get diagnostics aantal = row_count;
  return aantal > 0;
end;
$function$;

-- 4. Opruimen
create or replace function public.zet_herstelsleutel(hash_in text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Bewust leeg: de hash werd nergens gebruikt en vrienden zouden hem
  -- kunnen lezen. Herstel loopt via sleutel_kluis.
  return;
end;
$function$;

alter table public.profiles drop column if exists herstelsleutel;
alter table public.profiles drop column if exists herstelsleutel_hint;

commit;

-- Controle: verwacht 4 regels (2 gastenboek, 1 berichten versturen,
-- 1 berichten lezen) en 'herstelkolommen over: 0'.
select 'regel' as soort, tablename || ': ' || policyname || ' (' || cmd || ')' as detail
from pg_policies
where schemaname = 'public'
  and tablename in ('guestbook_entries', 'messages')
  and cmd in ('INSERT', 'DELETE', 'SELECT')
  and policyname in ('Gastenboek schrijven als vriend', 'Gastenboekbericht verwijderen',
                     'Berichten versturen', 'Berichten voor zender en ontvanger')
union all
select 'herstelkolommen over', count(*)::text
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('herstelsleutel', 'herstelsleutel_hint');
