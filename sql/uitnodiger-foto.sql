-- uitnodiger-foto.sql (v265, 4 november 2026): de uitnodigingspagina (invite.html) toont ook de profielfoto van wie
-- uitnodigt. Alleen met een geldige, ongebruikte en niet verlopen uitnodiging, en niet van een geblokkeerd account
-- (zelfde voorwaarden als voorheen). Er komt alleen avatar_data bij; de weergavenaam staat niet op de server en reist
-- mee achter het hekje van de link (#n=, vrienden.html).
begin;
drop function if exists public.uitnodiger_van_invite(text);
create function public.uitnodiger_van_invite(token_in text)
returns table(username text, avatar_url text, avatar_data text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.username, p.avatar_url,
         case when p.avatar_data like 'data:image/%' and length(p.avatar_data) <= 400000 then p.avatar_data end
  from invite_tokens t
  join profiles p on p.id = t.created_by
  where t.token = token_in
    and t.is_used = false
    and (t.expires_at is null or t.expires_at > now())
    and coalesce(p.geblokkeerd, false) = false
  limit 1;
$$;
revoke all on function public.uitnodiger_van_invite(text) from public;
grant execute on function public.uitnodiger_van_invite(text) to anon, authenticated;
commit;
