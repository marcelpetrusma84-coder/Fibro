-- mijn-gegevens-likes.sql (4 nov 2026, v258): 'Mijn gegevens downloaden' laat ook de likes zien die je gaf en kreeg
-- (sql/profiel-likes.sql). Eerst profiel-likes.sql uitvoeren. Verder precies gelijk aan sql/mijn-gegevens-postbus.sql.
-- Plakken in Supabase > SQL Editor > Run.
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
    'profiel_likes', coalesce((select jsonb_agg(to_jsonb(pl) order by pl.created_at) from public.profiel_likes pl where pl.liker = mij or pl.eigenaar = mij), '[]'::jsonb),
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
