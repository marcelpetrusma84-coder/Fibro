-- push-vanaf-server.sql (3 nov 2026): de pushmelding bij een nieuw bericht of buzz komt van de server zelf.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
-- Eerst stuurde alleen de app van de AFZENDER om een melding (stuur-push). Sloot die Fibro meteen, of viel zijn internet
-- net weg, dan stond het bericht wel op de server maar kreeg de ontvanger geen melding. Nu roept de database zelf
-- stuur-push aan zodra er een bericht bij komt (pg_net, na het opslaan, zonder het versturen op te houden).
-- stuur-push leest afzender en ontvanger uit het bericht, controleert alles zoals altijd (vrienden, niet geblokkeerd)
-- en zet het id in push_log: zo geeft elk bericht hoogstens EEN melding, ook als de app er ook nog om vraagt.
--
-- Alleen bij een versleuteld bericht (inhoud begint met 'e2e:') en een buzz ('buzz:'). Speluitnodigingen en belregels
-- niet: daar zorgt de app al voor (of er hoort geen melding bij). De inhoud van een bericht gaat niet mee: alleen het id.
begin;

create extension if not exists pg_net with schema extensions;

-- Het slot: welk bericht had al een melding (een dag bewaren is genoeg)
create table if not exists public.push_log (
  message_id uuid primary key,
  tijd timestamptz not null default now()
);
alter table public.push_log enable row level security;
revoke all on public.push_log from public, anon, authenticated;

create or replace function public.bericht_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('message_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null; -- een melding mag nooit het versturen van een bericht tegenhouden
  end;
  return new;
end
$$;
revoke execute on function public.bericht_push() from public, anon, authenticated;

drop trigger if exists bericht_push on public.messages;
create trigger bericht_push
  after insert on public.messages
  for each row
  when (new.content like 'e2e:%' or new.content = 'buzz:')
  execute function public.bericht_push();

-- Elke nacht push_log opruimen (meldingen ouder dan een dag zijn niet meer nodig)
select cron.unschedule('fibro-pushlog-opruimen') where exists (select 1 from cron.job where jobname = 'fibro-pushlog-opruimen');
select cron.schedule('fibro-pushlog-opruimen', '41 3 * * *', $$delete from public.push_log where tijd < now() - interval '1 day'$$);

commit;

-- Controle (vier keer true)
select
  exists (select 1 from pg_extension where extname = 'pg_net') as pg_net_aan,
  to_regclass('public.push_log') is not null as slot_bestaat,
  exists (select 1 from pg_trigger where tgname = 'bericht_push' and tgrelid = 'public.messages'::regclass) as trigger_staat,
  exists (select 1 from cron.job where jobname = 'fibro-pushlog-opruimen') as opruimen_gepland;
