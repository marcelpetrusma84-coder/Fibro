-- Stekky: database klaar voor groei (17-11-2026)
--
-- Niets aan wat wie mag zien of doen: alleen sneller als er meer gebruikers en berichten komen.
-- 1. Beveiligingsregels (RLS): auth.uid() wordt nu een keer per opvraging uitgerekend,
--    in plaats van voor elke rij opnieuw. Schrijfwijze: (select auth.uid()). De regels zelf
--    blijven precies hetzelfde.
-- 2. Indexen op 18 koppelingen tussen tabellen (zoeken op afzender, ontvanger, vriend, ...).
-- 3. Een dubbele index bij vriendschappen weg (friendships_uniek; dezelfde controle blijft
--    bestaan via friendships_user_id_friend_id_key).
-- Opnieuw uitvoeren kan geen kwaad.

begin;

-- 1. Beveiligingsregels
alter policy "Gebruiker beheert eigen profiel" on public.profiles
  using (((select auth.uid()) = id));
alter policy "Eigen profiel of dat van een vriend" on public.profiles
  using ((((select auth.uid()) = id) OR (EXISTS ( SELECT 1
   FROM friendships f
  WHERE ((f.user_id = profiles.id) AND (f.friend_id = (select auth.uid())) AND (f.status = 'accepted'::text))))));
alter policy "Eigen vriendschappen zien" on public.friendships
  using ((((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id)));
alter policy "Eigen vriendschappen verwijderen" on public.friendships
  using ((((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id)));
alter policy "Gebruikers kunnen rapporteren" on public.rapporten
  with check (((select auth.uid()) = melder_id));
alter policy "eigen abonnement lezen" on public.push_subscriptions
  using (((select auth.uid()) = user_id));
alter policy "eigen abonnement toevoegen" on public.push_subscriptions
  with check (((select auth.uid()) = user_id));
alter policy "eigen abonnement verwijderen" on public.push_subscriptions
  using (((select auth.uid()) = user_id));
alter policy "eigen abonnement bijwerken" on public.push_subscriptions
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));
alter policy "eigen kluis lezen" on public.sleutel_kluis
  using (((select auth.uid()) = user_id));
alter policy "eigen kluis toevoegen" on public.sleutel_kluis
  with check (((select auth.uid()) = user_id));
alter policy "eigen kluis bijwerken" on public.sleutel_kluis
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));
alter policy "passkey_kluis eigen lezen" on public.passkey_kluis
  using (((select auth.uid()) = user_id));
alter policy "passkey_kluis eigen maken" on public.passkey_kluis
  with check (((select auth.uid()) = user_id));
alter policy "passkey_kluis eigen wijzigen" on public.passkey_kluis
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));
alter policy "passkey_kluis eigen weggooien" on public.passkey_kluis
  using (((select auth.uid()) = user_id));
alter policy "eigen verborgen lezen" on public.verborgen_berichten
  using ((gebruiker_id = (select auth.uid())));
alter policy chess_three_session_read_member on public.chess_three_sessions
  using (((select auth.uid()) = ANY (player_ids)));
alter policy neon_raiders_read_own on public.neon_raiders_scores
  using ((user_id = (select auth.uid())));
alter policy "Eigen gastenboek of dat van een vriend" on public.guestbook_entries
  using ((((select auth.uid()) = profile_id) OR ((select auth.uid()) = author_id) OR (EXISTS ( SELECT 1
   FROM friendships f
  WHERE ((f.user_id = guestbook_entries.profile_id) AND (f.friend_id = (select auth.uid())) AND (f.status = 'accepted'::text))))));
alter policy "Gastenboek schrijven als vriend" on public.guestbook_entries
  with check ((((select auth.uid()) = author_id) AND (NOT ben_ik_geblokkeerd()) AND ((profile_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM friendships f
  WHERE ((f.status = 'accepted'::text) AND (f.user_id = (select auth.uid())) AND (f.friend_id = guestbook_entries.profile_id)))))));
alter policy "Gastenboekbericht verwijderen" on public.guestbook_entries
  using ((((select auth.uid()) = profile_id) OR ((select auth.uid()) = author_id)));
alter policy "reacties lezen bij eigen berichten" on public.reacties
  using ((EXISTS ( SELECT 1
   FROM messages m
  WHERE ((m.id = reacties.bericht_id) AND ((m.sender_id = (select auth.uid())) OR (m.receiver_id = (select auth.uid())))))));
alter policy "eigen reactie plaatsen" on public.reacties
  with check (((user_id = (select auth.uid())) AND (NOT ben_ik_geblokkeerd()) AND (EXISTS ( SELECT 1
   FROM messages m
  WHERE ((m.id = reacties.bericht_id) AND ((m.sender_id = (select auth.uid())) OR (m.receiver_id = (select auth.uid()))) AND ((m.sender_id = m.receiver_id) OR (EXISTS ( SELECT 1
           FROM friendships f
          WHERE ((f.status = 'accepted'::text) AND (f.user_id = (select auth.uid())) AND (f.friend_id =
                CASE
                    WHEN (m.sender_id = (select auth.uid())) THEN m.receiver_id
                    ELSE m.sender_id
                END))))))))));
alter policy "eigen reactie weghalen" on public.reacties
  using ((user_id = (select auth.uid())));
alter policy "tellers lezen" on public.poll_tellers
  using (((eigenaar_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM friendships f
  WHERE ((f.status = 'accepted'::text) AND (((f.user_id = (select auth.uid())) AND (f.friend_id = poll_tellers.eigenaar_id)) OR ((f.friend_id = (select auth.uid())) AND (f.user_id = poll_tellers.eigenaar_id))))))));
alter policy "stemmers lezen" on public.poll_stemmers
  using ((stemmer_id = (select auth.uid())));
alter policy "eigen gelezen lezen" on public.laatst_gelezen
  using ((gebruiker_id = (select auth.uid())));
alter policy "eigen gelezen maken" on public.laatst_gelezen
  with check ((gebruiker_id = (select auth.uid())));
alter policy "eigen gelezen bijwerken" on public.laatst_gelezen
  using ((gebruiker_id = (select auth.uid())))
  with check ((gebruiker_id = (select auth.uid())));
alter policy "blokkades moderator leest" on public.blokkades
  using ((ben_ik_moderator() OR (gebruiker_id = (select auth.uid()))));
alter policy "blokkades moderator maakt" on public.blokkades
  with check ((ben_ik_moderator() AND (gebruiker_id <> (select auth.uid()))));
alter policy "Berichten versturen" on public.messages
  with check ((((select auth.uid()) = sender_id) AND (NOT ben_ik_geblokkeerd()) AND ((receiver_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM friendships f
  WHERE ((f.status = 'accepted'::text) AND (f.user_id = (select auth.uid())) AND (f.friend_id = messages.receiver_id)))))));
alter policy "Berichten voor zender en ontvanger" on public.messages
  using (((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)) AND ((expires_at IS NULL) OR (expires_at > now()))));
alter policy "eigen invites aanmaken" on public.invite_tokens
  with check (((created_by = (select auth.uid())) AND (NOT ben_ik_geblokkeerd())));
alter policy "eigen blokkades zien" on public.mijn_blokkades
  using ((blokkeerder_id = (select auth.uid())));
alter policy groep_berichten_sturen on public.groep_berichten
  with check (((sender_id = (select auth.uid())) AND is_groepslid(groep_id) AND (NOT ben_ik_geblokkeerd()) AND (expires_at <= (now() + '32 days'::interval))));
alter policy groep_berichten_weghalen on public.groep_berichten
  using ((sender_id = (select auth.uid())));
alter policy store_downloads_lezen on public.store_downloads
  using ((user_id = (select auth.uid())));
alter policy store_downloads_toevoegen on public.store_downloads
  with check (((user_id = (select auth.uid())) AND (NOT ben_ik_geblokkeerd())));
alter policy store_downloads_weghalen on public.store_downloads
  using ((user_id = (select auth.uid())));

-- 2. Indexen op koppelingen
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_receiver_id_idx on public.messages (receiver_id);
create index if not exists messages_antwoord_op_idx on public.messages (antwoord_op);
create index if not exists friendships_friend_id_idx on public.friendships (friend_id);
create index if not exists guestbook_entries_author_id_idx on public.guestbook_entries (author_id);
create index if not exists invite_tokens_used_by_idx on public.invite_tokens (used_by);
create index if not exists verborgen_berichten_bericht_id_idx on public.verborgen_berichten (bericht_id);
create index if not exists rapporten_melder_id_idx on public.rapporten (melder_id);
create index if not exists rapporten_gemelde_id_idx on public.rapporten (gemelde_id);
create index if not exists chess_three_sessions_host_id_idx on public.chess_three_sessions (host_id);
create index if not exists reacties_user_id_idx on public.reacties (user_id);
create index if not exists poll_stemmers_stemmer_id_idx on public.poll_stemmers (stemmer_id);
create index if not exists groep_leden_toegevoegd_door_idx on public.groep_leden (toegevoegd_door);
create index if not exists groep_berichten_sender_id_idx on public.groep_berichten (sender_id);
create index if not exists mijn_blokkades_geblokkeerde_id_idx on public.mijn_blokkades (geblokkeerde_id);
create index if not exists groep_gelezen_user_id_idx on public.groep_gelezen (user_id);
create index if not exists groepen_maker_idx on public.groepen (maker);
create index if not exists online_meldingen_vriend_idx on public.online_meldingen (vriend);

-- 3. Dubbele index weg
drop index if exists public.friendships_uniek;

commit;
