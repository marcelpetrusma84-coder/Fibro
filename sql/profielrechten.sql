-- Fibro: rechten in profielen beschermen (30-09-2026)
-- Via de app (rol authenticated/anon) kan niemand meer:
--   - zichzelf of een ander moderator maken (is_moderator),
--   - zichzelf deblokkeren; geblokkeerd wijzigen mag alleen een moderator, bij een ander,
--   - als geblokkeerd account het eigen profiel verwijderen (om opnieuw te beginnen).
-- Via de SQL Editor (rol postgres) kan alles nog wel.

create or replace function public.bescherm_profielrechten()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Alleen verzoeken uit de app controleren; SQL Editor en service_role mogen alles.
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_moderator := false;
    new.geblokkeerd := false;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if coalesce(old.geblokkeerd, false) then
      raise exception 'Een geblokkeerd account kan zijn profiel niet verwijderen';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.is_moderator is distinct from old.is_moderator then
    raise exception 'is_moderator kan alleen via de SQL Editor worden gewijzigd';
  end if;
  if new.geblokkeerd is distinct from old.geblokkeerd
     and not (public.ben_ik_moderator() and new.id <> auth.uid()) then
    raise exception 'Alleen een moderator kan iemand anders blokkeren of deblokkeren';
  end if;
  return new;
end;
$$;

drop trigger if exists bescherm_profielrechten on public.profiles;
create trigger bescherm_profielrechten
  before insert or update or delete on public.profiles
  for each row execute function public.bescherm_profielrechten();

-- Controle: moet 1 regel tonen (bescherm_profielrechten)
select tgname from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;
