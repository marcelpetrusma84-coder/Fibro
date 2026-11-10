-- groep-onbekenden.sql (10 nov 2026, groepschat): zelf kiezen of je in een groep mag met mensen die je niet kent.
-- Na sql/groepen.sql uitvoeren. Nog een keer uitvoeren kan geen kwaad.
--
-- De schakelaar staat in het menu ☰ op Home: Instellingen > 👥 Groepen met onbekenden (standaard aan).
--  - Aan: je mag in een groep met vrienden van vrienden (mensen die je zelf niet als vriend hebt).
--  - Uit: je komt alleen in een groep als je iedereen erin als vriend hebt. Maakt iemand een groep, of voegt de
--    beheerder iemand toe, waarbij dat niet klopt, dan weigert de server het. De fout zegt wie het uit heeft staan
--    (in 'detail' het id), zodat de app kan zeggen: "Lotte wil alleen in groepen waarin ze iedereen kent".
--  - Groepen waar je al in zit, blijven zoals ze zijn.
-- Ook hier: twee kleine reparaties uit de veiligheidscontrole van Supabase (op 10 nov al los uitgevoerd):
-- zijn_vrienden() is niet meer door de app aan te roepen, en groep_max() heeft een vaste search_path.

begin;

alter table public.chat_instellingen add column if not exists groep_onbekenden boolean not null default true;

create or replace function public.zet_groep_onbekenden(p_aan boolean)
returns void
language sql volatile security invoker
set search_path = ''
as $$
  insert into public.chat_instellingen (gebruiker_id, groep_onbekenden, bijgewerkt)
  values ((select auth.uid()), coalesce(p_aan, true), now())
  on conflict (gebruiker_id) do update set groep_onbekenden = excluded.groep_onbekenden, bijgewerkt = now()
$$;
revoke execute on function public.zet_groep_onbekenden(boolean) from public, anon;
grant execute on function public.zet_groep_onbekenden(boolean) to authenticated;

-- Staat iemand open voor groepen met onbekenden? Geen rij = ja (standaard aan).
create or replace function public.groep_open_voor_onbekenden(p_wie uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select c.groep_onbekenden from public.chat_instellingen c where c.gebruiker_id = p_wie), true);
$$;

-- Mogen a en b samen in een groep? Als ze vrienden zijn, of als ze er allebei voor open staan.
-- Geeft het id terug van wie het niet wil (null = mag).
create or replace function public.groep_wie_wil_niet(a uuid, b uuid)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when a = b or public.zijn_vrienden(a, b) then null
    when not public.groep_open_voor_onbekenden(b) then b
    when not public.groep_open_voor_onbekenden(a) then a
    else null end;
$$;
revoke execute on function public.groep_open_voor_onbekenden(uuid) from public, anon, authenticated;
revoke execute on function public.groep_wie_wil_niet(uuid, uuid) from public, anon, authenticated;

-- Reparaties uit de veiligheidscontrole
revoke execute on function public.zijn_vrienden(uuid, uuid) from public, anon, authenticated;
alter function public.groep_max(text) set search_path = public, pg_temp;

-- maak_groep: zoals in groepen.sql, plus de controle op onbekenden (elk paar in de nieuwe groep)
create or replace function public.maak_groep(p_naam text, p_soort text, p_leden uuid[])
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ik    uuid := auth.uid();
  nieuw uuid;
  lid   uuid;
  ander uuid;
  wie   uuid;
  leden uuid[];
  allen uuid[];
begin
  if ik is null then raise exception 'niet ingelogd' using errcode = '42501'; end if;
  if public.ben_ik_geblokkeerd() then raise exception 'geblokkeerd' using errcode = '42501'; end if;
  if p_soort not in ('chat', 'voice', 'webcam') then raise exception 'onbekende soort' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x), '{}') into leden from unnest(coalesce(p_leden, '{}')) x where x <> ik;
  if cardinality(leden) < 1 then raise exception 'kies minstens een vriend' using errcode = '22023'; end if;
  if cardinality(leden) + 1 > public.groep_max(p_soort) then raise exception 'te veel leden' using errcode = '22023'; end if;
  foreach lid in array leden loop
    if not public.zijn_vrienden(ik, lid) then raise exception 'alleen vrienden' using errcode = '42501'; end if;
  end loop;
  allen := array_append(leden, ik);
  foreach lid in array allen loop
    foreach ander in array allen loop
      if lid < ander then
        wie := public.groep_wie_wil_niet(lid, ander);
        if wie is not null then
          raise exception 'wil alleen in groepen met bekenden' using errcode = 'P0001', hint = 'onbekenden', detail = wie::text;
        end if;
      end if;
    end loop;
  end loop;
  insert into public.groepen (naam, soort, maker) values (btrim(p_naam), p_soort, ik) returning id into nieuw;
  insert into public.groep_leden (groep_id, user_id, rol, toegevoegd_door) values (nieuw, ik, 'beheerder', ik);
  insert into public.groep_leden (groep_id, user_id, rol, toegevoegd_door) select nieuw, x, 'lid', ik from unnest(leden) x;
  return nieuw;
end
$$;

-- groep_lid_toevoegen: zoals in groepen.sql, plus de controle op onbekenden (de nieuwe tegen elk lid)
create or replace function public.groep_lid_toevoegen(p_groep uuid, p_lid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ik    uuid := auth.uid();
  s     text;
  wie   uuid;
begin
  if ik is null or public.ben_ik_geblokkeerd() then raise exception 'geen toegang' using errcode = '42501'; end if;
  if not exists (select 1 from public.groep_leden where groep_id = p_groep and user_id = ik and rol = 'beheerder') then
    raise exception 'alleen de beheerder' using errcode = '42501';
  end if;
  if not public.zijn_vrienden(ik, p_lid) then raise exception 'alleen vrienden' using errcode = '42501'; end if;
  select soort into s from public.groepen where id = p_groep for update;
  if (select count(*) from public.groep_leden where groep_id = p_groep) >= public.groep_max(s) then
    raise exception 'groep is vol' using errcode = '22023';
  end if;
  select public.groep_wie_wil_niet(p_lid, l.user_id) into wie
    from public.groep_leden l
   where l.groep_id = p_groep and public.groep_wie_wil_niet(p_lid, l.user_id) is not null
   limit 1;
  if wie is not null then
    raise exception 'wil alleen in groepen met bekenden' using errcode = 'P0001', hint = 'onbekenden', detail = wie::text;
  end if;
  insert into public.groep_leden (groep_id, user_id, rol, toegevoegd_door) values (p_groep, p_lid, 'lid', ik)
    on conflict (groep_id, user_id) do nothing;
end
$$;

revoke execute on function public.maak_groep(text, text, uuid[]) from public, anon;
revoke execute on function public.groep_lid_toevoegen(uuid, uuid) from public, anon;
grant execute on function public.maak_groep(text, text, uuid[]) to authenticated;
grant execute on function public.groep_lid_toevoegen(uuid, uuid) to authenticated;

commit;
