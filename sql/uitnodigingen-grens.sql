-- uitnodigingen-grens.sql (Fibro v255, 2 nov 2026): hoogstens 5 nieuwe mensen per persoon per week.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
-- Nodig: sql/registratie-schakelaar.sql is al uitgevoerd (dit vervangt de controle daaruit door een uitgebreide versie).
--
-- Waarom: in de stand 'uitnodiging' (Moderatie > Bèta) kan iemand alleen met een uitnodigingslink een account maken.
-- Zonder grens kan één persoon toch in korte tijd een hele klas of school binnenhalen. Nu telt de database per
-- uitnodiger hoeveel NIEUWE accounts er de laatste 7 dagen met zijn links zijn gemaakt. Bij 5 is het voor die week op.
--   - Alleen nieuwe accounts tellen. Een link waarmee iemand die al op Fibro zit vrienden wordt, telt niet mee.
--   - Moderators hebben geen grens.
--   - In de stand 'open' geldt de grens niet (dan mag iedereen toch al een account maken).
-- De grens aanpassen: verander hieronder 'grens constant int := 5' en voer dit bestand opnieuw uit.
--
-- Ook: uitnodiging_vol(token) zegt invite.html of de grens van de uitnodiger is bereikt, zodat de nieuwe persoon
-- een duidelijke uitleg krijgt in plaats van 'verlopen'. Zegt alleen ja/nee, geen namen of aantallen.
begin;

do $$ begin
  if to_regprocedure('public.controleer_nieuw_account()') is null or to_regclass('public.registratie_instelling') is null then
    raise exception 'STOP: voer eerst sql/registratie-schakelaar.sql uit; er is niets aangepast';
  end if;
end $$;

-- Hoeveel nieuwe accounts kwamen er de laatste 7 dagen binnen met de links van deze uitnodiger?
create or replace function public.nieuw_via_uitnodiger(uitnodiger uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int
    from invite_tokens i
    join auth.users u on u.id = i.used_by
   where i.created_by = uitnodiger
     and u.created_at > now() - interval '7 days'
     and u.created_at >= i.created_at          -- het account is ná de link gemaakt: dus via deze link nieuw
$$;
revoke execute on function public.nieuw_via_uitnodiger(uuid) from public, anon, authenticated;

create or replace function public.controleer_nieuw_account()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  st text;
  tok text;
  maker uuid;
  grens constant int := 5;
begin
  select stand into st from registratie_instelling where id = 1;
  if st is null or st = 'open' then
    return new;
  end if;
  if st = 'uitnodiging' then
    tok := new.raw_user_meta_data ->> 'invite_token';
    select i.created_by into maker
      from invite_tokens i
     where i.token = tok
       and i.is_used = false
       and (i.expires_at is null or i.expires_at > now())
       and i.created_by is not null
       and not public.is_geblokkeerd(i.created_by)
     limit 1;
    if tok is not null and maker is not null then
      -- v255: hoogstens 'grens' nieuwe mensen per uitnodiger per 7 dagen (moderators onbeperkt)
      if not coalesce((select is_moderator from profiles where id = maker), false)
         and public.nieuw_via_uitnodiger(maker) >= grens then
        raise exception 'FIBRO_UITNODIGINGEN_OP';
      end if;
      return new;
    end if;
    raise exception 'FIBRO_REGISTRATIE_ALLEEN_UITNODIGING';
  end if;
  raise exception 'FIBRO_REGISTRATIE_DICHT';
end;
$$;
revoke execute on function public.controleer_nieuw_account() from public, anon, authenticated;

-- Voor invite.html: is de grens van de uitnodiger van deze link bereikt? (alleen ja/nee)
create or replace function public.uitnodiging_vol(token_in text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select not coalesce(p.is_moderator, false) and public.nieuw_via_uitnodiger(i.created_by) >= 5
      from invite_tokens i
      left join profiles p on p.id = i.created_by
     where i.token = token_in and i.created_by is not null
     limit 1), false)
$$;
revoke execute on function public.uitnodiging_vol(text) from public;
grant execute on function public.uitnodiging_vol(text) to anon, authenticated;

commit;

-- Controle: verwacht 'grens actief: ja'
select 'grens actief: ' || case when pg_get_functiondef('public.controleer_nieuw_account()'::regprocedure) like '%FIBRO_UITNODIGINGEN_OP%' then 'ja' else 'nee' end as controle;
