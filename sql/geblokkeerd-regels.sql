-- geblokkeerd-regels.sql (4 nov 2026, v260): likes en de postbus werken weer.
--
-- Het probleem: de regels van profiel_likes (sql/profiel-likes.sql) en profiel_post (sql/profiel-post.sql) vroegen
-- public.is_geblokkeerd(uuid). Die functie is bewust dicht voor de app (sql/blokkeren.sql: "alleen voor gebruik binnen
-- andere functies", revoke execute ... from authenticated). Een regel draait met de rechten van de gebruiker, dus elk
-- liken en elk postbuspakketje gaf 'permission denied' (42501, HTTP 403). Logs 3-4 nov: 800 x POST profiel_post 403,
-- elke like 403; 0 rijen in beide tabellen.
--
-- De oplossing: dezelfde controle als bij berichten (de regel "Berichten versturen"): public.ben_ik_geblokkeerd(),
-- die alleen over jezelf iets zegt en wel voor de app open staat. is_geblokkeerd blijft dicht.
-- Verder verandert er niets aan de regels.

begin;

drop policy if exists profiel_likes_zetten on public.profiel_likes;
create policy profiel_likes_zetten on public.profiel_likes for insert to authenticated
  with check (
    (select auth.uid()) = liker
    and not (select public.ben_ik_geblokkeerd())
    and exists (select 1 from public.friendships f
                 where f.user_id = liker and f.friend_id = eigenaar and f.status = 'accepted'));

drop policy if exists profiel_likes_wijzigen on public.profiel_likes;
create policy profiel_likes_wijzigen on public.profiel_likes for update to authenticated
  using ((select auth.uid()) = liker)
  with check ((select auth.uid()) = liker and not (select public.ben_ik_geblokkeerd()));

drop policy if exists profiel_post_zetten on public.profiel_post;
create policy profiel_post_zetten on public.profiel_post for insert to authenticated
  with check (
    (select auth.uid()) = afzender
    and not (select public.ben_ik_geblokkeerd())
    and exists (select 1 from public.friendships f
                 where f.user_id = afzender and f.friend_id = ontvanger and f.status = 'accepted'));

drop policy if exists profiel_post_vervangen on public.profiel_post;
create policy profiel_post_vervangen on public.profiel_post for update to authenticated
  using ((select auth.uid()) = afzender)
  with check (
    (select auth.uid()) = afzender
    and not (select public.ben_ik_geblokkeerd())
    and exists (select 1 from public.friendships f
                 where f.user_id = afzender and f.friend_id = ontvanger and f.status = 'accepted'));

commit;

-- Controle (verwacht: 0 regels met is_geblokkeerd, ben_ik_geblokkeerd voor de app: true, is_geblokkeerd voor de app: false)
select 'regels met is_geblokkeerd' as wat, count(*)::text as uitkomst from pg_policy
 where coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), '') like '%is_geblokkeerd(%'
union all select 'ben_ik_geblokkeerd voor app', has_function_privilege('authenticated', 'public.ben_ik_geblokkeerd()', 'EXECUTE')::text
union all select 'is_geblokkeerd voor app', has_function_privilege('authenticated', 'public.is_geblokkeerd(uuid)', 'EXECUTE')::text;
