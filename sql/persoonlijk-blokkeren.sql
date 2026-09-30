-- Fibro: gebruikers blokkeren elkaar zelf (30-09-2026)
--
-- Blokkeren (via blokkeer_persoon):
--   - verbreekt de vriendschap (beide richtingen);
--   - daarna kunnen jullie niet opnieuw vrienden worden via een uitnodiging,
--     in welke richting dan ook, zolang de blokkade staat;
--   - de ander krijgt geen melding en kan niet zien dat je hem blokkeerde.
-- Berichten, gastenboek, polls en profiel vragen al om vriendschap. Reageren
-- op (oude) berichten vraagt nu ook om vriendschap.
-- Wie wie blokkeert ziet alleen de blokkeerder zelf (ook niet de moderator).
-- Deblokkeren haalt alleen de blokkade weg; vrienden worden kan dan weer met
-- een nieuwe uitnodiging.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

-- 1. Tabel
create table if not exists public.mijn_blokkades (
  blokkeerder_id uuid not null references public.profiles(id) on delete cascade,
  geblokkeerde_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blokkeerder_id, geblokkeerde_id),
  check (blokkeerder_id <> geblokkeerde_id)
);
alter table public.mijn_blokkades enable row level security;
revoke all on public.mijn_blokkades from anon, authenticated;
grant select on public.mijn_blokkades to authenticated;
drop policy if exists "eigen blokkades zien" on public.mijn_blokkades;
create policy "eigen blokkades zien" on public.mijn_blokkades
  for select using (blokkeerder_id = auth.uid());

-- 2. Functies voor de app
create or replace function public.blokkeer_persoon(ander uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare mij uuid := auth.uid();
begin
  if mij is null or ander is null or ander = mij then return false; end if;
  if not exists (select 1 from profiles where id = ander) then return false; end if;

  insert into mijn_blokkades (blokkeerder_id, geblokkeerde_id)
  values (mij, ander) on conflict do nothing;

  delete from friendships
  where (user_id = mij and friend_id = ander)
     or (user_id = ander and friend_id = mij);
  return true;
end;
$function$;

create or replace function public.deblokkeer_persoon(ander uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return false; end if;
  delete from mijn_blokkades
  where blokkeerder_id = auth.uid() and geblokkeerde_id = ander;
  return found;
end;
$function$;

create or replace function public.mijn_geblokkeerden()
returns table (id uuid, username text, sinds timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.username, mb.created_at
  from mijn_blokkades mb
  join profiles p on p.id = mb.geblokkeerde_id
  where mb.blokkeerder_id = auth.uid()
  order by mb.created_at desc;
$$;

revoke execute on function public.blokkeer_persoon(uuid) from public, anon;
revoke execute on function public.deblokkeer_persoon(uuid) from public, anon;
revoke execute on function public.mijn_geblokkeerden() from public, anon;
grant execute on function public.blokkeer_persoon(uuid) to authenticated;
grant execute on function public.deblokkeer_persoon(uuid) to authenticated;
grant execute on function public.mijn_geblokkeerden() to authenticated;

-- 3. Uitnodigingen: geen nieuwe vriendschap als een van beiden de ander blokkeerde
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
  if public.is_geblokkeerd(mij) then return false; end if;

  -- Token afboeken en uitnodiger ophalen in een stap: kan maar een keer lukken.
  -- Een token van een geblokkeerd account werkt niet (en blijft onaangeroerd),
  -- net als bij een persoonlijke blokkade tussen beiden.
  update invite_tokens
     set is_used = true, used_at = now(), used_by = mij
   where token = token_in and is_used = false
     and (expires_at is null or expires_at > now())
     and created_by <> mij
     and not public.is_geblokkeerd(created_by)
     and not exists (select 1 from mijn_blokkades mb
                     where (mb.blokkeerder_id = mij and mb.geblokkeerde_id = invite_tokens.created_by)
                        or (mb.blokkeerder_id = invite_tokens.created_by and mb.geblokkeerde_id = mij))
  returning created_by into uitnodiger;

  if uitnodiger is null then return false; end if;

  insert into friendships (user_id, friend_id, status)
  values (mij, uitnodiger, 'accepted') on conflict do nothing;
  insert into friendships (user_id, friend_id, status)
  values (uitnodiger, mij, 'accepted') on conflict do nothing;
  return true;
end;
$function$;

-- 4. Reageren alleen bij berichten met een vriend (of aan jezelf)
drop policy if exists "eigen reactie plaatsen" on public.reacties;
create policy "eigen reactie plaatsen" on public.reacties
  for insert with check (
    user_id = auth.uid()
    and not public.ben_ik_geblokkeerd()
    and exists (
      select 1 from public.messages m
      where m.id = reacties.bericht_id
        and (m.sender_id = auth.uid() or m.receiver_id = auth.uid())
        and (m.sender_id = m.receiver_id
             or exists (select 1 from public.friendships f
                        where f.status = 'accepted'
                          and f.user_id = auth.uid()
                          and f.friend_id = case when m.sender_id = auth.uid()
                                                 then m.receiver_id else m.sender_id end))
    )
  );

commit;

-- Controle: verwacht 'mijn_blokkades: RLS aan, 1 regels', 'functies voor app: 3',
-- 'uitnodiging kijkt naar blokkade: true', 'reageren vraagt vriendschap: true'.
select 'mijn_blokkades' as soort,
       case when c.relrowsecurity then 'RLS aan, ' else 'RLS UIT, ' end
       || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'mijn_blokkades') || ' regels' as detail
from pg_class c where c.oid = 'public.mijn_blokkades'::regclass
union all
select 'functies voor app',
       (has_function_privilege('authenticated', 'public.blokkeer_persoon(uuid)', 'EXECUTE')::int
      + has_function_privilege('authenticated', 'public.deblokkeer_persoon(uuid)', 'EXECUTE')::int
      + has_function_privilege('authenticated', 'public.mijn_geblokkeerden()', 'EXECUTE')::int)::text
union all
select 'uitnodiging kijkt naar blokkade',
       (pg_get_functiondef('public.maak_vriendschap_via_invite(text)'::regprocedure) like '%mijn_blokkades%')::text
union all
select 'reageren vraagt vriendschap',
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reacties'
               and policyname = 'eigen reactie plaatsen' and with_check like '%friendships%')::text;
