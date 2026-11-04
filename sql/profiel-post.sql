-- profiel-post.sql (3 nov 2026): de postbus voor kleine profielupdates (postbus.js).
-- 3 nov 2026: tabel en opruimen zijn al uitgevoerd; het stuk voor mijn_gegevens staat ook los in sql/mijn-gegevens-postbus.sql.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Per vriend één versleuteld pakketje met je kleine profielonderdelen (indeling van je widgets, tekstwidgets, blokstijl,
-- weergavenaam), voor als jullie niet tegelijk online zijn. De server kan het niet lezen (zelfde sleutels als berichten).
-- Alleen de nieuwste stand: afzender + ontvanger is de sleutel, een nieuw pakketje vervangt het oude.
-- De ontvanger wist het zodra hij het heeft; na 31 dagen, of als jullie geen vrienden meer zijn, ruimt de server het op.
-- Foto's, muziek, video's en stickers gaan hier niet in: die blijven rechtstreeks tussen de telefoons gaan.
begin;

create table if not exists public.profiel_post (
  afzender uuid not null references public.profiles(id) on delete cascade,
  ontvanger uuid not null references public.profiles(id) on delete cascade,
  inhoud text not null check (char_length(inhoud) <= 200000 and inhoud like 'e2e:%'),
  bijgewerkt timestamptz not null default now(),
  primary key (afzender, ontvanger),
  check (afzender <> ontvanger)
);
create index if not exists profiel_post_ontvanger on public.profiel_post (ontvanger);

-- bijgewerkt is altijd de tijd van de server
create or replace function public.profiel_post_tijd()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.bijgewerkt := now();
  return new;
end $$;
drop trigger if exists profiel_post_tijd on public.profiel_post;
create trigger profiel_post_tijd before insert or update on public.profiel_post
  for each row execute function public.profiel_post_tijd();

alter table public.profiel_post enable row level security;
revoke all on public.profiel_post from public, anon, authenticated;
grant select, insert, update, delete on public.profiel_post to authenticated;

drop policy if exists profiel_post_lezen on public.profiel_post;
create policy profiel_post_lezen on public.profiel_post for select to authenticated
  using ((select auth.uid()) = ontvanger or (select auth.uid()) = afzender);

-- Klaarzetten: alleen als jezelf, alleen voor een vriend, niet als je account geblokkeerd is
drop policy if exists profiel_post_zetten on public.profiel_post;
create policy profiel_post_zetten on public.profiel_post for insert to authenticated
  with check (
    (select auth.uid()) = afzender
    and not (select public.ben_ik_geblokkeerd()) -- v260: is_geblokkeerd is dicht voor de app (sql/geblokkeerd-regels.sql)
    and exists (select 1 from public.friendships f
                 where f.user_id = afzender and f.friend_id = ontvanger and f.status = 'accepted'));

drop policy if exists profiel_post_vervangen on public.profiel_post;
create policy profiel_post_vervangen on public.profiel_post for update to authenticated
  using ((select auth.uid()) = afzender)
  with check (
    (select auth.uid()) = afzender
    and not (select public.ben_ik_geblokkeerd()) -- v260: is_geblokkeerd is dicht voor de app (sql/geblokkeerd-regels.sql)
    and exists (select 1 from public.friendships f
                 where f.user_id = afzender and f.friend_id = ontvanger and f.status = 'accepted'));

drop policy if exists profiel_post_wissen on public.profiel_post;
create policy profiel_post_wissen on public.profiel_post for delete to authenticated
  using ((select auth.uid()) = ontvanger or (select auth.uid()) = afzender);

-- Elke nacht opruimen: ouder dan 31 dagen, of geen vrienden meer
select cron.unschedule('fibro-profielpost-opruimen') where exists (select 1 from cron.job where jobname = 'fibro-profielpost-opruimen');
select cron.schedule('fibro-profielpost-opruimen', '47 3 * * *', $$
  delete from public.profiel_post p
   where p.bijgewerkt < now() - interval '31 days'
      or not exists (select 1 from public.friendships f
                      where f.user_id = p.afzender and f.friend_id = p.ontvanger and f.status = 'accepted')
$$);

-- 'Mijn gegevens downloaden' laat ook deze pakketjes zien (versleuteld, zoals ze op de server staan)
create or replace function public.mijn_gegevens()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare mij uuid := auth.uid();
begin
  if mij is null then raise exception 'Niet ingelogd'; end if;
  return jsonb_build_object(
    'uitleg', 'Alles wat Fibro op de server over jou bewaart. Berichten zijn op de server versleuteld; de app zet de leesbare tekst erbij als dat op dit toestel kan.',
    'gemaakt_op', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'aangemaakt_op', u.created_at, 'laatst_ingelogd_op', u.last_sign_in_at)
                  from auth.users u where u.id = mij),
    'profiel', (select to_jsonb(p) from profiles p where p.id = mij),
    'vriendschappen', coalesce((select jsonb_agg(to_jsonb(f)) from friendships f where f.user_id = mij or f.friend_id = mij), '[]'::jsonb),
    'berichten', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from messages m where m.sender_id = mij or m.receiver_id = mij), '[]'::jsonb),
    'reacties', coalesce((select jsonb_agg(to_jsonb(r)) from reacties r where r.user_id = mij), '[]'::jsonb),
    'gastenboek', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from guestbook_entries g where g.profile_id = mij or g.author_id = mij), '[]'::jsonb),
    'uitnodigingen', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from invite_tokens i where i.created_by = mij or i.used_by = mij), '[]'::jsonb),
    'gelezen_tot', coalesce((select jsonb_agg(to_jsonb(l)) from laatst_gelezen l where l.gebruiker_id = mij), '[]'::jsonb),
    'door_jou_geblokkeerd', coalesce((select jsonb_agg(to_jsonb(b)) from mijn_blokkades b where b.blokkeerder_id = mij), '[]'::jsonb),
    'blokkades_door_moderator', coalesce((select jsonb_agg(to_jsonb(b) - 'door' - 'opgeheven_door') from blokkades b where b.gebruiker_id = mij), '[]'::jsonb),
    'meldingen_door_jou', coalesce((select jsonb_agg(to_jsonb(r)) from rapporten r where r.melder_id = mij), '[]'::jsonb),
    'pushmeldingen', coalesce((select jsonb_agg(to_jsonb(s)) from push_subscriptions s where s.user_id = mij), '[]'::jsonb),
    'poll_stemmen', coalesce((select jsonb_agg(to_jsonb(s)) from poll_stemmers s where s.stemmer_id = mij), '[]'::jsonb),
    'poll_uitslagen', coalesce((select jsonb_agg(to_jsonb(t)) from poll_tellers t where t.eigenaar_id = mij), '[]'::jsonb),
    'verborgen_berichten', coalesce((select jsonb_agg(to_jsonb(v)) from verborgen_berichten v where v.gebruiker_id = mij), '[]'::jsonb),
    'sleutel_kluis', coalesce((select jsonb_agg(to_jsonb(k)) from sleutel_kluis k where k.user_id = mij), '[]'::jsonb),
    'passkey_kluis', coalesce((select jsonb_agg(to_jsonb(k)) from passkey_kluis k where k.user_id = mij), '[]'::jsonb),
    'terugmeldingen', coalesce((select jsonb_agg(to_jsonb(tm) order by tm.created_at) from public.terugmeldingen tm where tm.user_id = mij), '[]'::jsonb),
    'profiel_postbus', coalesce((select jsonb_agg(to_jsonb(pp) order by pp.bijgewerkt) from public.profiel_post pp where pp.afzender = mij or pp.ontvanger = mij), '[]'::jsonb),
    'personen', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'public_key', p.public_key))
                            from profiles p
                           where p.id <> mij and p.id in (
                                 select case when m.sender_id = mij then m.receiver_id else m.sender_id end
                                   from messages m where m.sender_id = mij or m.receiver_id = mij
                                 union
                                 select case when f.user_id = mij then f.friend_id else f.user_id end
                                   from friendships f where f.user_id = mij or f.friend_id = mij
                                 union
                                 select case when g.profile_id = mij then g.author_id else g.profile_id end
                                   from guestbook_entries g where g.profile_id = mij or g.author_id = mij)), '[]'::jsonb)
  );
end
$function$;

commit;

-- Controle (drie keer true)
select
  to_regclass('public.profiel_post') is not null as postbus_bestaat,
  (select relrowsecurity from pg_class where oid = 'public.profiel_post'::regclass) as afgeschermd,
  exists (select 1 from cron.job where jobname = 'fibro-profielpost-opruimen') as opruimen_gepland;
