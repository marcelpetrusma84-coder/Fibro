-- Fibro: gevoelige profielvelden (30-09-2026)
--
-- 1. geboortejaar: vrienden konden het lezen (hele profielrij is leesbaar voor
--    vrienden). De app bewaart het bij registratie al in de accountgegevens
--    (auth.users, niet zichtbaar voor anderen). Profielen met een geboortejaar
--    in profiles dat nog niet in de accountgegevens staat, krijgen het daar
--    alsnog; daarna verdwijnt de kolom uit profiles.
-- 2. Helemaal offline (toon_online = false) wordt nu ook door de database
--    afgedwongen: online_status is dan altijd false en laatst_gezien blijft
--    staan op het moment dat je offline ging. Vrienden zien niet meer dat je
--    actief bent.
-- Opnieuw uitvoeren kan geen kwaad.

begin;

-- 1. Geboortejaar naar de accountgegevens, kolom weg
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'geboortejaar') then
    execute $q$
      update auth.users u
         set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                                  || jsonb_build_object('geboortejaar', p.geboortejaar)
        from public.profiles p
       where p.id = u.id
         and p.geboortejaar is not null
         and not (coalesce(u.raw_user_meta_data, '{}'::jsonb) ? 'geboortejaar')
    $q$;
  end if;
end $$;

alter table public.profiles drop column if exists geboortejaar;

-- 2. Helemaal offline afdwingen
create or replace function public.bescherm_online()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.toon_online, true) = false then
    new.online_status := false;
    if tg_op = 'UPDATE' then
      new.laatst_gezien := old.laatst_gezien;
    else
      new.laatst_gezien := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bescherm_online on public.profiles;
create trigger bescherm_online
  before insert or update on public.profiles
  for each row execute function public.bescherm_online();

commit;

-- Controle: verwacht 'geboortejaar in profiles: weg', 'trigger bescherm_online: 1',
-- 'offline maar online_status true: 0', en 'geboortejaar in accounts' minstens 34.
select 'geboortejaar in profiles' as soort,
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'profiles'
                           and column_name = 'geboortejaar') then 'NOG AANWEZIG' else 'weg' end as detail
union all
select 'trigger bescherm_online', count(*)::text
from pg_trigger where tgname = 'bescherm_online' and not tgisinternal
union all
select 'offline maar online_status true', count(*)::text
from public.profiles where toon_online = false and online_status = true
union all
select 'geboortejaar in accounts', count(*)::text
from auth.users where raw_user_meta_data ? 'geboortejaar';
