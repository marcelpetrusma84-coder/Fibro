-- online-melding.sql (5 nov 2026, v266): een pushmelding "🟢 Bram is nu online", slim en niet irritant.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets. Nog een keer
-- uitvoeren kan geen kwaad.
--
-- Waarom: berichten, foto's en spellen gaan rechtstreeks van toestel naar toestel (p2p). Dat werkt het best als jullie
-- allebei online zijn. Met deze melding weet je wanneer een vriend er is.
--
-- Hoe het werkt:
--  1. De schakelaar (☰ > Instellingen > Melding als een vriend online komt) staat in chat_instellingen.melding_online.
--     Standaard AAN (ook voor wie al een account heeft); wie hem uitzet, krijgt ze niet meer.
--  2. Een trigger op profiles ziet dat iemand online komt (heartbeat.js zet online_status op true). Alleen als hij
--     minstens 30 minuten weg was (laatst_gezien van VOOR deze update). Even wegklikken en terugkomen telt dus niet.
--     Wie zichzelf onzichtbaar maakte (toon_online = false) geeft nooit een melding.
--  3. stuur-push (type 'online') kiest per vriend of de melding mag (zie daar: niet 's nachts, niet als je zelf al
--     online bent, dezelfde vriend hoogstens eens per 3 uur, hoogstens een online-melding per 20 minuten en 6 per dag).
--     Wat er verstuurd is staat in online_meldingen (alleen voor de server; na 2 dagen opgeruimd).

begin;

create extension if not exists pg_net with schema extensions;

-- 1. De schakelaar (chat_instellingen bestaat al: sql/gelezen-vinkjes.sql)
alter table public.chat_instellingen add column if not exists melding_online boolean not null default true;

create or replace function public.zet_melding_online(p_aan boolean)
returns void
language sql volatile security invoker
set search_path = ''
as $$
  insert into public.chat_instellingen (gebruiker_id, melding_online, bijgewerkt)
  values ((select auth.uid()), coalesce(p_aan, true), now())
  on conflict (gebruiker_id) do update set melding_online = excluded.melding_online, bijgewerkt = now()
$$;
revoke execute on function public.zet_melding_online(boolean) from public, anon;
grant execute on function public.zet_melding_online(boolean) to authenticated;

-- 2. Welke online-meldingen zijn er verstuurd (alleen de server leest en schrijft hier)
create table if not exists public.online_meldingen (
  id        bigint generated always as identity primary key,
  ontvanger uuid not null references auth.users(id) on delete cascade,
  vriend    uuid not null references auth.users(id) on delete cascade,
  tijd      timestamptz not null default now()
);
create index if not exists online_meldingen_ontvanger_tijd on public.online_meldingen (ontvanger, tijd desc);
alter table public.online_meldingen enable row level security;
revoke all on public.online_meldingen from public, anon, authenticated;

-- 3. De trigger: iemand komt online na minstens 30 minuten weg
create or replace function public.online_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('online_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null; -- een melding mag het online komen nooit tegenhouden
  end;
  return new;
end
$$;
revoke execute on function public.online_push() from public, anon, authenticated;

drop trigger if exists online_push on public.profiles;
create trigger online_push
  after update of online_status, laatst_gezien on public.profiles
  for each row
  when (new.online_status is true
        and new.toon_online is not false
        and (old.laatst_gezien is null or old.laatst_gezien < now() - interval '30 minutes'))
  execute function public.online_push();

-- 4. Elke nacht opruimen (ouder dan 2 dagen is niet meer nodig)
select cron.unschedule('fibro-onlinemeldingen-opruimen') where exists (select 1 from cron.job where jobname = 'fibro-onlinemeldingen-opruimen');
select cron.schedule('fibro-onlinemeldingen-opruimen', '37 3 * * *', $$delete from public.online_meldingen where tijd < now() - interval '2 days'$$);

commit;

-- Controle (vier keer true)
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chat_instellingen' and column_name = 'melding_online') as schakelaar_bestaat,
  to_regclass('public.online_meldingen') is not null as logboek_bestaat,
  exists (select 1 from pg_trigger where tgname = 'online_push' and tgrelid = 'public.profiles'::regclass) as trigger_staat,
  exists (select 1 from cron.job where jobname = 'fibro-onlinemeldingen-opruimen') as opruimen_gepland;
