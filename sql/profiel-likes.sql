-- profiel-likes.sql (4 nov 2026, v258): likes onder foto's, muziek en video's op een profiel (profielreacties.js).
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Een vriend tikt op ❤️ (of 😂 🔥 😍 😮 👏) onder een foto, nummer of video. De server bewaart alleen WIE bij WIE iets
-- leuk vond en een vingerafdruk van dat stuk (item, dezelfde als sync.js gebruikt), nooit de foto of het nummer zelf:
-- die blijven rechtstreeks tussen de telefoons gaan. Een nieuwe foto op dezelfde plek = nieuwe vingerafdruk = opnieuw 0.
--  - Wie het profiel kan zien (de eigenaar en zijn vrienden) ziet hoeveel likes er zijn (profiel_like_tellers).
--  - Alleen de eigenaar ziet wie het waren. Je eigen likes zie je ook zelf.
--  - Een like geeft de eigenaar een pushmelding (trigger, stuur-push 'like'); dezelfde vriend hoogstens een per 10 min.
--  - Geen vrienden meer: de likes tellen niet meer mee en worden 's nachts opgeruimd.
-- Een geschreven reactie gaat NIET hierin: die is een gewoon versleuteld chatbericht aan de eigenaar.
begin;

create table if not exists public.profiel_likes (
  id uuid primary key default gen_random_uuid(),
  eigenaar uuid not null references public.profiles(id) on delete cascade,
  liker uuid not null references public.profiles(id) on delete cascade,
  soort text not null check (soort in ('foto', 'muziek', 'video')),
  item text not null check (item ~ '^[0-9a-f]{1,16}$'),
  emoji text not null default '❤️' check (emoji in ('❤️', '😂', '🔥', '😍', '😮', '👏')),
  created_at timestamptz not null default now(),
  unique (eigenaar, soort, item, liker),
  check (eigenaar <> liker)
);
create index if not exists profiel_likes_eigenaar on public.profiel_likes (eigenaar, soort, item);
create index if not exists profiel_likes_liker on public.profiel_likes (liker);

-- De tijd is altijd die van de server; bij wijzigen kan alleen de emoji veranderen
create or replace function public.profiel_likes_vast()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.id := old.id; new.eigenaar := old.eigenaar; new.liker := old.liker;
    new.soort := old.soort; new.item := old.item; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists profiel_likes_vast on public.profiel_likes;
create trigger profiel_likes_vast before insert or update on public.profiel_likes
  for each row execute function public.profiel_likes_vast();

alter table public.profiel_likes enable row level security;
revoke all on public.profiel_likes from public, anon, authenticated;
grant select, insert, update, delete on public.profiel_likes to authenticated;

-- Lezen: je eigen likes, en als eigenaar wie jou iets leuk vond
drop policy if exists profiel_likes_lezen on public.profiel_likes;
create policy profiel_likes_lezen on public.profiel_likes for select to authenticated
  using ((select auth.uid()) = liker or (select auth.uid()) = eigenaar);

-- Liken: alleen als jezelf, alleen bij een vriend, niet als je account geblokkeerd is
drop policy if exists profiel_likes_zetten on public.profiel_likes;
create policy profiel_likes_zetten on public.profiel_likes for insert to authenticated
  with check (
    (select auth.uid()) = liker
    and not public.is_geblokkeerd((select auth.uid()))
    and exists (select 1 from public.friendships f
                 where f.user_id = liker and f.friend_id = eigenaar and f.status = 'accepted'));

drop policy if exists profiel_likes_wijzigen on public.profiel_likes;
create policy profiel_likes_wijzigen on public.profiel_likes for update to authenticated
  using ((select auth.uid()) = liker)
  with check ((select auth.uid()) = liker and not public.is_geblokkeerd((select auth.uid())));

-- Weghalen: je eigen like, of als eigenaar een like bij jou
drop policy if exists profiel_likes_wissen on public.profiel_likes;
create policy profiel_likes_wissen on public.profiel_likes for delete to authenticated
  using ((select auth.uid()) = liker or (select auth.uid()) = eigenaar);

-- Hoeveel likes (per stuk en emoji) heeft dit profiel? Voor de eigenaar en zijn vrienden; zonder namen.
-- Alleen likes van wie nog vrienden is tellen mee.
create or replace function public.profiel_like_tellers(p_eigenaar uuid)
returns table (soort text, item text, emoji text, aantal integer)
language sql stable security definer set search_path = '' as $$
  select l.soort, l.item, l.emoji, count(*)::integer
    from public.profiel_likes l
   where l.eigenaar = p_eigenaar
     and ((select auth.uid()) = p_eigenaar
          or exists (select 1 from public.friendships f
                      where f.user_id = (select auth.uid()) and f.friend_id = p_eigenaar and f.status = 'accepted'))
     and exists (select 1 from public.friendships f2
                  where f2.user_id = l.liker and f2.friend_id = p_eigenaar and f2.status = 'accepted')
   group by l.soort, l.item, l.emoji
$$;
revoke execute on function public.profiel_like_tellers(uuid) from public, anon;
grant execute on function public.profiel_like_tellers(uuid) to authenticated;

-- Pushmelding bij een nieuwe like (alleen het id gaat mee; stuur-push leest de rest en houdt het rustig)
create extension if not exists pg_net with schema extensions;
create or replace function public.profiel_like_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('like_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null; -- een melding mag een like nooit tegenhouden
  end;
  return new;
end
$$;
revoke execute on function public.profiel_like_push() from public, anon, authenticated;
drop trigger if exists profiel_like_push on public.profiel_likes;
create trigger profiel_like_push after insert on public.profiel_likes
  for each row execute function public.profiel_like_push();

-- Elke nacht opruimen: likes van wie geen vriend meer is
select cron.unschedule('fibro-profiellikes-opruimen') where exists (select 1 from cron.job where jobname = 'fibro-profiellikes-opruimen');
select cron.schedule('fibro-profiellikes-opruimen', '53 3 * * *', $$
  delete from public.profiel_likes l
   where not exists (select 1 from public.friendships f
                      where f.user_id = l.liker and f.friend_id = l.eigenaar and f.status = 'accepted')
$$);

commit;

-- Controle (vier keer true)
select
  to_regclass('public.profiel_likes') is not null as tabel_bestaat,
  (select relrowsecurity from pg_class where oid = 'public.profiel_likes'::regclass) as afgeschermd,
  exists (select 1 from pg_trigger where tgname = 'profiel_like_push') as melding_trigger,
  exists (select 1 from cron.job where jobname = 'fibro-profiellikes-opruimen') as opruimen_gepland;
