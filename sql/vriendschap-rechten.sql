-- Fibro: vriendschappen niet meer te wijzigen via de app (30 september 2026)
--
-- Gat: de UPDATE-regel "Vriendschap beheren" liet beide kanten elke kolom
-- wijzigen. Wie een vriendschapsrij had, kon die ombuigen naar een willekeurig
-- ander account en zo diens profiel, gastenboek en polls lezen.
-- De app werkt friendships nergens bij (alleen lezen en verwijderen;
-- aanmaken gaat via maak_vriendschap_via_invite), dus de regel kan weg.
-- "Vrienden lezen" is dubbel: "Eigen vriendschappen zien" dekt hem al.

begin;
drop policy if exists "Vriendschap beheren" on public.friendships;
drop policy if exists "Vrienden lezen" on public.friendships;
commit;

-- Controle: verwacht 2 regels (DELETE en SELECT), 0 rijen zonder
-- omgekeerde rij, en alleen status accepted.
select 'regel' as soort, policyname || ' (' || cmd || ')' as detail
from pg_policies
where schemaname = 'public' and tablename = 'friendships'
union all
select 'rijen zonder omgekeerde rij', count(*)::text
from public.friendships f
where not exists (select 1 from public.friendships g
                  where g.user_id = f.friend_id and g.friend_id = f.user_id)
union all
select 'status ' || coalesce(status, 'leeg'), count(*)::text
from public.friendships
group by status;
