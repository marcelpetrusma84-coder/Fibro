-- Fibro: account verwijderen en "download mijn gegevens" (8 oktober 2026)
-- Uitvoeren in de Supabase SQL Editor (New query, plakken, Run).
-- Nog een keer uitvoeren kan geen kwaad.
--
-- 1. verwijder_mijn_account(bevestiging): haalt je eigen account in een keer weg (alles of
--    niets). Ter bevestiging geeft de app je gebruikersnaam mee (hoofdletters maken niet uit;
--    zonder gebruikersnaam: het woord VERWIJDER).
--    Weg gaat het account (auth.users) en via de verwijzingen (CASCADE) alles wat eraan hangt:
--    profiel, vriendschappen, gastenboek (op je eigen profiel en wat je bij vrienden schreef),
--    berichten aan beide kanten met hun reacties, ongelezen-stand, blokkades, pushabonnementen,
--    sleutel- en passkey-kluis, poll-stemmen en verborgen berichten.
--    Zelf opgeruimd, want die hangen er niet aan: meldingen door of over deze persoon (die
--    hielden het verwijderen anders tegen), zelf gemaakte uitnodigingscodes, en de
--    "gelezen tot"-stand die vrienden over deze persoon hebben.
--    Ook een geblokkeerd account kan zichzelf verwijderen (AVG en App Store); opnieuw
--    beginnen kan alleen met een nieuwe uitnodiging.
--    De foto-opslag (Wallpapers, chat-fotos) was op 8 oktober leeg; zie de controle onderaan.
-- 2. mijn_gegevens(): alles wat Fibro op de server over jou bewaart, als JSON. Berichten zijn
--    op de server versleuteld; de app zet de leesbare tekst erbij op je eigen toestel.
-- Meldingen over jou en blokkades door anderen staan er niet in (die zijn van de ander).

begin;

-- --- Controles vooraf ---
do $$
declare t text; n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public'
     and (table_name, column_name) in (('profiles', 'username'), ('messages', 'sender_id'), ('messages', 'receiver_id'),
                                       ('rapporten', 'melder_id'), ('rapporten', 'gemelde_id'),
                                       ('invite_tokens', 'created_by'), ('laatst_gelezen', 'vriend_id'));
  if n <> 7 then
    raise exception 'STOP: niet alle verwachte kolommen gevonden (% van 7); er is niets aangepast', n;
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass and confrelid = 'auth.users'::regclass
                    and contype = 'f' and confdeltype = 'c') then
    raise exception 'STOP: profiles hangt niet met CASCADE aan auth.users; er is niets aangepast';
  end if;

  -- Verwijzingen die het verwijderen zouden tegenhouden (meldingen ruimen we zelf op)
  select string_agg(conrelid::regclass::text || ' (' || conname || ')', ', ') into t
    from pg_constraint
   where contype = 'f' and connamespace = 'public'::regnamespace
     and confdeltype in ('a', 'r')
     and conrelid <> 'public.rapporten'::regclass;
  if t is not null then
    raise exception 'STOP: deze verwijzingen houden het verwijderen tegen: %; er is niets aangepast', t;
  end if;

  if not has_table_privilege('auth.users', 'DELETE') then
    raise exception 'STOP: % mag geen accounts verwijderen; er is niets aangepast', current_user;
  end if;
end $$;

-- --- 1. Account verwijderen ---
create or replace function public.verwijder_mijn_account(p_bevestiging text)
returns boolean
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare mij uuid := auth.uid(); naam text;
begin
  if mij is null then raise exception 'Niet ingelogd'; end if;
  if not exists (select 1 from auth.users where id = mij) then raise exception 'Account niet gevonden'; end if;
  select username into naam from profiles where id = mij;
  if lower(btrim(coalesce(p_bevestiging, ''))) <> lower(coalesce(nullif(btrim(naam), ''), 'verwijder')) then
    raise exception 'Bevestiging klopt niet: typ je gebruikersnaam';
  end if;
  delete from rapporten where melder_id = mij or gemelde_id = mij;
  delete from invite_tokens where created_by = mij;
  delete from laatst_gelezen where vriend_id = mij;
  delete from auth.users where id = mij;
  return true;
end
$$;

-- --- 2. Download mijn gegevens ---
create or replace function public.mijn_gegevens()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.verwijder_mijn_account(text) from public, anon;
revoke all on function public.mijn_gegevens() from public, anon;
grant execute on function public.verwijder_mijn_account(text) to authenticated;
grant execute on function public.mijn_gegevens() to authenticated;

-- --- Zelftest als echte gebruiker (wordt altijd teruggedraaid) ---
do $$
declare
  x uuid; naam text; accounts int; berichten int; n int; g jsonb; t record;
begin
  -- iemand met zoveel mogelijk: eerst met een melding, dan met de meeste berichten
  select p.id, p.username into x, naam
    from profiles p
   order by exists (select 1 from rapporten r where r.melder_id = p.id or r.gemelde_id = p.id) desc,
            (select count(*) from messages m where m.sender_id = p.id or m.receiver_id = p.id) desc
   limit 1;
  if x is null then
    raise notice 'zelftest overgeslagen: geen profielen gevonden';
    return;
  end if;
  select count(*) into accounts from auth.users;
  select count(*) into berichten from messages where sender_id = x or receiver_id = x;

  begin
    -- zonder inloggen mag het niet
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform set_config('role', 'anon', true);
    begin
      perform verwijder_mijn_account('x');
      raise exception 'ZT: zonder inloggen mocht verwijderen';
    exception when insufficient_privilege then null;
    end;
    begin
      perform mijn_gegevens();
      raise exception 'ZT: zonder inloggen mocht gegevens ophalen';
    exception when insufficient_privilege then null;
    end;

    -- ingelogd als x: eerst de gegevens
    perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    g := mijn_gegevens();
    if g->'profiel'->>'id' is distinct from x::text then raise exception 'ZT: gegevens horen bij een ander'; end if;
    if g->'account'->>'id' is distinct from x::text then raise exception 'ZT: account ontbreekt in de gegevens'; end if;
    if jsonb_array_length(g->'berichten') <> berichten then
      raise exception 'ZT: % berichten in de gegevens, verwacht %', jsonb_array_length(g->'berichten'), berichten;
    end if;

    -- verkeerde naam: niets weg
    begin
      perform verwijder_mijn_account('dit-is-niet-de-naam-zt');
      raise exception 'ZT: verkeerde naam werd geaccepteerd';
    exception when raise_exception then
      if sqlerrm like 'ZT:%' then raise; end if;
      if sqlerrm not like 'Bevestiging klopt niet%' then raise exception 'ZT: onverwachte fout: %', sqlerrm; end if;
    end;

    -- goede naam (hoofdletters maken niet uit)
    if verwijder_mijn_account(upper(coalesce(nullif(btrim(naam), ''), 'verwijder'))) is not true then
      raise exception 'ZT: verwijderen gaf geen true';
    end if;

    reset role;
    if exists (select 1 from auth.users where id = x) then raise exception 'ZT: account bestaat nog'; end if;
    if exists (select 1 from profiles where id = x) then raise exception 'ZT: profiel bestaat nog'; end if;
    -- in geen enkele tabel nog iets dat naar x verwijst
    for t in
      select c.conrelid::regclass::text as tabel, a.attname as kolom
        from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      union all select 'invite_tokens', 'created_by'
      union all select 'laatst_gelezen', 'vriend_id'
    loop
      execute format('select count(*) from %s where %I = $1', t.tabel, t.kolom) into n using x;
      if n > 0 then raise exception 'ZT: nog % rij(en) in %.%', n, t.tabel, t.kolom; end if;
    end loop;
    select count(*) into n from auth.users;
    if n <> accounts - 1 then raise exception 'ZT: % accounts weg in plaats van 1', accounts - n; end if;

    raise exception 'ZELFTEST_OK';
  exception when others then
    if sqlerrm <> 'ZELFTEST_OK' then
      raise exception 'STOP: zelftest mislukt (%); er is niets aangepast', sqlerrm;
    end if;
  end;
  raise notice 'zelftest geslaagd';
end $$;

commit;

-- --- Controle ---
select 'account verwijderen (functie)' as wat,
       case when to_regprocedure('public.verwijder_mijn_account(text)') is not null then 'ja' else 'nee' end as uitkomst
union all
select 'gegevens downloaden (functie)',
       case when to_regprocedure('public.mijn_gegevens()') is not null then 'ja' else 'nee' end
union all
select 'ingelogd mag verwijderen / downloaden',
       case when has_function_privilege('authenticated', 'public.verwijder_mijn_account(text)', 'execute') then 'ja' else 'nee' end || ' / ' ||
       case when has_function_privilege('authenticated', 'public.mijn_gegevens()', 'execute') then 'ja' else 'nee' end
union all
select 'zonder inloggen mag verwijderen / downloaden',
       case when has_function_privilege('anon', 'public.verwijder_mijn_account(text)', 'execute') then 'ja' else 'nee' end || ' / ' ||
       case when has_function_privilege('anon', 'public.mijn_gegevens()', 'execute') then 'ja' else 'nee' end
union all
select 'verwijzingen die het tegenhouden',
       coalesce((select string_agg(conrelid::regclass::text, ', ') from pg_constraint
                  where contype = 'f' and connamespace = 'public'::regnamespace and confdeltype in ('a', 'r')
                    and conrelid <> 'public.rapporten'::regclass), 'geen')
union all
select 'accounts (moet gelijk blijven)', (select count(*)::text from auth.users)
union all
select 'bestanden in de foto-opslag', (select count(*)::text from storage.objects);
