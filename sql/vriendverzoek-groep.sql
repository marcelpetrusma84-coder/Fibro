-- vriendverzoek-groep.sql (18 nov 2026, Marcel): vriend worden met iemand uit een groepschat.
--
-- In een groep zie je soms iemand die (nog) niet je vriend is. Bij Leden staat dan "Vriend worden". Die persoon krijgt
-- een verzoek (in de groep en bij Vrienden) en kiest Ja of Nee. Ja = vrienden, net als met een uitnodigingslink
-- (beide kanten 'accepted' in friendships). Nee = niets; de vrager hoort dat niet, en kan 30 dagen niet opnieuw vragen.
--
-- Alles gaat via de functies hieronder (security definer); de tabel zelf is voor de app dicht. Controles:
--   - je moet ingelogd en niet geblokkeerd zijn; de ander ook niet geblokkeerd;
--   - jullie zitten allebei in die groep (op het moment van vragen);
--   - geen persoonlijke blokkade tussen jullie (in welke richting dan ook);
--   - hoogstens 20 verzoeken per dag; een 'nee' van de laatste 30 dagen = geen nieuw verzoek (maar dat zie je niet);
--   - vroeg de ander jou al? Dan zijn jullie meteen vrienden.
-- Opnieuw uitvoeren kan geen kwaad.
begin;

create table if not exists public.vriendverzoeken (
  id uuid primary key default gen_random_uuid(),
  van uuid not null references auth.users(id) on delete cascade,
  naar uuid not null references auth.users(id) on delete cascade,
  groep_id uuid references public.groepen(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'ja', 'nee')),
  created_at timestamptz not null default now(),
  beantwoord timestamptz,
  check (van <> naar)
);
create unique index if not exists vriendverzoeken_open on public.vriendverzoeken (van, naar) where status = 'open';
create index if not exists vriendverzoeken_naar on public.vriendverzoeken (naar) where status = 'open';
alter table public.vriendverzoeken enable row level security;
revoke all on public.vriendverzoeken from public, anon, authenticated;

-- geen persoonlijke blokkade tussen a en b (in welke richting dan ook)
create or replace function public.geen_blokkade(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select not exists (select 1 from public.mijn_blokkades mb
                      where (mb.blokkeerder_id = a and mb.geblokkeerde_id = b)
                         or (mb.blokkeerder_id = b and mb.geblokkeerde_id = a));
$$;
revoke execute on function public.geen_blokkade(uuid, uuid) from public, anon, authenticated;

create or replace function public.maak_vrienden(a uuid, b uuid)
returns void
language sql volatile security definer
set search_path = public, pg_temp
as $$
  insert into public.friendships (user_id, friend_id, status) values (a, b, 'accepted') on conflict do nothing;
  insert into public.friendships (user_id, friend_id, status) values (b, a, 'accepted') on conflict do nothing;
$$;
revoke execute on function public.maak_vrienden(uuid, uuid) from public, anon, authenticated;

-- Vraag iemand uit een groep om vrienden te worden. Antwoord: 'verstuurd', 'vrienden' (hij vroeg jou al),
-- 'al vrienden' of 'niet' (blokkade of geblokkeerd account; zonder te zeggen welke).
create or replace function public.vraag_vriend(p_naar uuid, p_groep uuid)
returns text
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  ik uuid := auth.uid();
  terug uuid;
  n int;
begin
  if ik is null then raise exception 'niet ingelogd' using errcode = '42501'; end if;
  if public.is_geblokkeerd(ik) then raise exception 'geblokkeerd' using errcode = '42501'; end if;
  if p_naar is null or p_naar = ik or p_groep is null then raise exception 'ongeldig' using errcode = '22023'; end if;
  if not exists (select 1 from public.groep_leden l where l.groep_id = p_groep and l.user_id = ik)
     or not exists (select 1 from public.groep_leden l where l.groep_id = p_groep and l.user_id = p_naar) then
    raise exception 'niet in dezelfde groep' using errcode = '42501';
  end if;
  if public.zijn_vrienden(ik, p_naar) then return 'al vrienden'; end if;
  if public.is_geblokkeerd(p_naar) or not public.geen_blokkade(ik, p_naar) then return 'niet'; end if;
  -- vroeg hij mij al? dan meteen vrienden
  select v.id into terug from public.vriendverzoeken v where v.van = p_naar and v.naar = ik and v.status = 'open' limit 1;
  if terug is not null then
    update public.vriendverzoeken set status = 'ja', beantwoord = now() where id = terug;
    perform public.maak_vrienden(ik, p_naar);
    return 'vrienden';
  end if;
  if exists (select 1 from public.vriendverzoeken v where v.van = ik and v.naar = p_naar and v.status = 'open') then
    return 'verstuurd';
  end if;
  -- net nee gezegd: geen nieuw verzoek (de vrager ziet gewoon 'verstuurd')
  if exists (select 1 from public.vriendverzoeken v where v.van = ik and v.naar = p_naar and v.status = 'nee'
             and v.beantwoord > now() - interval '30 days') then
    return 'verstuurd';
  end if;
  select count(*) into n from public.vriendverzoeken v where v.van = ik and v.created_at > now() - interval '1 day';
  if n >= 20 then raise exception 'te veel verzoeken' using errcode = 'P0001'; end if;
  insert into public.vriendverzoeken (van, naar, groep_id) values (ik, p_naar, p_groep)
    on conflict (van, naar) where status = 'open' do nothing;
  return 'verstuurd';
end
$$;
revoke execute on function public.vraag_vriend(uuid, uuid) from public, anon;
grant execute on function public.vraag_vriend(uuid, uuid) to authenticated;

-- Mijn open verzoeken: 'in' = iemand vraagt mij, 'uit' = ik vroeg iemand (zolang hij niet geantwoord heeft).
-- Een 'nee' verschijnt nergens: dan staat bij de vrager weer gewoon de knop.
create or replace function public.mijn_vriendverzoeken()
returns table (id uuid, richting text, wie uuid, username text, groep_id uuid, groep_naam text, created_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select v.id, case when v.naar = auth.uid() then 'in' else 'uit' end,
         case when v.naar = auth.uid() then v.van else v.naar end,
         p.username, v.groep_id, g.naam, v.created_at
    from public.vriendverzoeken v
    join public.profiles p on p.id = case when v.naar = auth.uid() then v.van else v.naar end
    left join public.groepen g on g.id = v.groep_id
   where v.status = 'open' and auth.uid() in (v.van, v.naar)
     and not public.is_geblokkeerd(p.id)
     and public.geen_blokkade(v.van, v.naar)
   order by v.created_at desc
   limit 100;
$$;
revoke execute on function public.mijn_vriendverzoeken() from public, anon;
grant execute on function public.mijn_vriendverzoeken() to authenticated;

-- Ja of nee op een verzoek aan mij. true = gelukt.
create or replace function public.beantwoord_vriendverzoek(p_id uuid, p_ja boolean)
returns boolean
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  ik uuid := auth.uid();
  vrager uuid;
begin
  if ik is null then raise exception 'niet ingelogd' using errcode = '42501'; end if;
  if public.is_geblokkeerd(ik) then raise exception 'geblokkeerd' using errcode = '42501'; end if;
  update public.vriendverzoeken set status = case when p_ja then 'ja' else 'nee' end, beantwoord = now()
   where id = p_id and naar = ik and status = 'open'
  returning van into vrager;
  if vrager is null then return false; end if;
  if p_ja then
    if public.is_geblokkeerd(vrager) or not public.geen_blokkade(ik, vrager) then return false; end if;
    perform public.maak_vrienden(ik, vrager);
  end if;
  return true;
end
$$;
revoke execute on function public.beantwoord_vriendverzoek(uuid, boolean) from public, anon;
grant execute on function public.beantwoord_vriendverzoek(uuid, boolean) to authenticated;

commit;
