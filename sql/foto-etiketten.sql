-- Fibro: een eigen etiket per foto (11 oktober 2026)
-- Uitvoeren in de Supabase SQL Editor (New query, plakken, Run).
-- Nog een keer uitvoeren kan geen kwaad.
--
-- Tot nu toe was updated_at het etiket voor allebei je foto's: een nieuwe avatar (+-20 kB)
-- liet vrienden ook je achtergrond (tot 1,5 MB) opnieuw ophalen, en andersom.
-- Nu krijgt elke foto een eigen etiket: avatar_versie en wallpaper_versie, de vingerafdruk
-- (md5) van de foto zelf. Geen foto: leeg (null). Dezelfde foto opnieuw opslaan: zelfde etiket.
-- De database zet ze zelf (een trigger), telkens als die foto meegestuurd wordt. De app hoeft
-- er niets voor te doen en niemand kan er iets anders in zetten. Bij online/offline, je mood
-- of andere wijzigingen doet de trigger niets, dus het kost de server bijna niets.
-- Vrienden halen een foto daarna alleen nog op als het etiket van die foto anders is.
-- updated_at blijft zoals het was (voor toestellen die de nieuwe pagina's nog niet hebben).

begin;

-- --- Controles vooraf ---
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name in ('id', 'avatar_data', 'wallpaper_data');
  if n <> 3 then
    raise exception 'STOP: profiles mist avatar_data of wallpaper_data; er is niets aangepast';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name in ('avatar_versie', 'wallpaper_versie') and data_type <> 'text') then
    raise exception 'STOP: avatar_versie of wallpaper_versie bestaat al, maar is geen tekst; er is niets aangepast';
  end if;
  if not exists (select 1 from profiles p join auth.users u on u.id = p.id
                  where not coalesce(p.geblokkeerd, false)) then
    raise exception 'STOP: geen gewoon account gevonden voor de zelftest; er is niets aangepast';
  end if;
end $$;

-- --- 1. Twee etiketten ---
alter table public.profiles add column if not exists avatar_versie text;
alter table public.profiles add column if not exists wallpaper_versie text;

-- --- 2. De database zet ze zelf ---
create or replace function public.zet_fotoversie()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_argv[0] = 'avatar' then
    new.avatar_versie := md5(new.avatar_data);
  else
    new.wallpaper_versie := md5(new.wallpaper_data);
  end if;
  return new;
end;
$$;
-- alleen voor de trigger, niet om zelf aan te roepen
revoke all on function public.zet_fotoversie() from public, anon, authenticated;

drop trigger if exists zet_avatar_versie on public.profiles;
create trigger zet_avatar_versie
  before insert or update of avatar_data, avatar_versie on public.profiles
  for each row execute function public.zet_fotoversie('avatar');

drop trigger if exists zet_wallpaper_versie on public.profiles;
create trigger zet_wallpaper_versie
  before insert or update of wallpaper_data, wallpaper_versie on public.profiles
  for each row execute function public.zet_fotoversie('wallpaper');

-- --- 3. Etiketten voor de foto's die er al staan (alleen waar het nog niet klopt) ---
update public.profiles
   set avatar_versie = md5(avatar_data), wallpaper_versie = md5(wallpaper_data)
 where avatar_versie is distinct from md5(avatar_data)
    or wallpaper_versie is distinct from md5(wallpaper_data);

do $$
begin
  if exists (select 1 from profiles
              where avatar_versie is distinct from md5(avatar_data)
                 or wallpaper_versie is distinct from md5(wallpaper_data)) then
    raise exception 'STOP: niet alle foto''s kregen een goed etiket; er is niets aangepast';
  end if;
end $$;

-- --- Zelftest als een echte gebruiker (alles wordt teruggedraaid) ---
do $$
declare
  x uuid; a0 text; w0 text; a1 text; w1 text; u0 timestamptz; u1 timestamptz;
  foto_a text := 'data:image/webp;base64,WlRhdmF0YXI=';
  foto_w text := 'data:image/jpeg;base64,WlR3YWxscGFwZXI=';
begin
  select p.id into x from profiles p join auth.users u on u.id = p.id
   where not coalesce(p.geblokkeerd, false) order by p.id limit 1;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    update profiles set updated_at = '2000-01-01T00:00:00Z' where id = x;
    select avatar_versie, wallpaper_versie, updated_at into a0, w0, u0 from profiles where id = x;

    -- andere avatar: alleen het avatar-etiket verandert
    update profiles set avatar_data = foto_a where id = x;
    select avatar_versie, wallpaper_versie into a1, w1 from profiles where id = x;
    if a1 is distinct from md5(foto_a) then raise exception 'ZT: avatar-etiket niet gezet (%)', a1; end if;
    if w1 is distinct from w0 then raise exception 'ZT: achtergrond-etiket veranderde mee'; end if;

    -- andere achtergrond: alleen het achtergrond-etiket verandert
    update profiles set wallpaper_data = foto_w where id = x;
    select avatar_versie, wallpaper_versie into a1, w1 from profiles where id = x;
    if w1 is distinct from md5(foto_w) then raise exception 'ZT: achtergrond-etiket niet gezet (%)', w1; end if;
    if a1 is distinct from md5(foto_a) then raise exception 'ZT: avatar-etiket veranderde mee'; end if;

    -- online/offline: niets verandert
    update profiles set online_status = not coalesce(online_status, false) where id = x;
    select avatar_versie, wallpaper_versie into a1, w1 from profiles where id = x;
    if a1 is distinct from md5(foto_a) or w1 is distinct from md5(foto_w) then raise exception 'ZT: etiket veranderde bij online/offline'; end if;

    -- een eigen etiket invullen gaat niet: de database zet het terug
    update profiles set avatar_versie = 'nep', wallpaper_versie = 'nep' where id = x;
    select avatar_versie, wallpaper_versie into a1, w1 from profiles where id = x;
    if a1 is distinct from md5(foto_a) or w1 is distinct from md5(foto_w) then raise exception 'ZT: een eigen etiket bleef staan'; end if;

    -- foto weg: etiket leeg
    update profiles set avatar_data = null, wallpaper_data = null where id = x;
    select avatar_versie, wallpaper_versie into a1, w1 from profiles where id = x;
    if a1 is not null or w1 is not null then raise exception 'ZT: etiket bleef staan zonder foto'; end if;

    -- updated_at doet de database niets mee
    select updated_at into u1 from profiles where id = x;
    if u1 is distinct from u0 then raise exception 'ZT: updated_at veranderde'; end if;

    -- de trigger-functie zelf aanroepen mag niet
    if has_function_privilege('authenticated', 'public.zet_fotoversie()', 'execute') then
      raise exception 'ZT: de app mag zet_fotoversie zelf aanroepen';
    end if;

    raise exception 'ZELFTEST_OK';
  exception when others then
    if sqlerrm <> 'ZELFTEST_OK' then
      raise exception 'STOP: zelftest mislukt (%); er is niets aangepast', sqlerrm;
    end if;
  end;
  raise notice 'zelftest geslaagd';
end $$;

commit;

-- de server (PostgREST) de nieuwe kolommen meteen laten kennen
notify pgrst, 'reload schema';

-- --- Controle ---
select 'etiketten (kolommen)' as wat,
       (select count(*)::text from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name in ('avatar_versie', 'wallpaper_versie')) || ' van 2' as uitkomst
union all
select 'database zet ze zelf (triggers)',
       (select count(*)::text from pg_trigger
         where tgrelid = 'public.profiles'::regclass and not tgisinternal
           and tgname in ('zet_avatar_versie', 'zet_wallpaper_versie')) || ' van 2'
union all
select 'profielen met avatarfoto / met etiket',
       (select count(*)::text from profiles where avatar_data is not null) || ' / ' ||
       (select count(*)::text from profiles where avatar_versie is not null)
union all
select 'profielen met achtergrond / met etiket',
       (select count(*)::text from profiles where wallpaper_data is not null) || ' / ' ||
       (select count(*)::text from profiles where wallpaper_versie is not null)
union all
select 'etiketten die niet kloppen (moet 0 zijn)',
       (select count(*)::text from profiles
         where avatar_versie is distinct from md5(avatar_data)
            or wallpaper_versie is distinct from md5(wallpaper_data))
union all
select 'vrienden mogen de etiketten lezen',
       case when has_column_privilege('authenticated', 'public.profiles', 'avatar_versie', 'select')
             and has_column_privilege('authenticated', 'public.profiles', 'wallpaper_versie', 'select') then 'ja' else 'nee' end
union all
select 'profielen (moet gelijk blijven)', (select count(*)::text from profiles);
