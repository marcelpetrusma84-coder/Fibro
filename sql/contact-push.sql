-- contact-push.sql (3 nov 2026, v258): twee nieuwe pushmeldingen, rechtstreeks vanaf de server.
-- Plakken in Supabase > SQL Editor > Run. Alles of niets: gaat er iets mis, dan verandert er niets.
--
--  1. Iemand neemt je uitnodiging aan  -> jij krijgt "Sanne heeft je uitnodiging aangenomen! Zeg hoi 👋".
--     Een trigger op invite_tokens: zodra used_by voor het eerst wordt ingevuld.
--  2. Een vriend schrijft in je gastenboek -> jij krijgt "Tijn schreef in je gastenboek".
--     Een trigger op guestbook_entries: bij een nieuw bericht van iemand anders dan jezelf.
--
-- Net als bij berichten (sql/push-vanaf-server.sql) gaat alleen het id mee naar stuur-push (pg_net, na het opslaan).
-- stuur-push leest de rij zelf, controleert alles (vrienden, niet geblokkeerd, vers) en zet het id in push_log,
-- zodat elke rij hoogstens EEN melding geeft. Wat er in het gastenboek staat gaat niet mee.
-- Een melding mag nooit het opslaan tegenhouden: lukt het versturen niet, dan gaat de rest gewoon door.
begin;

create extension if not exists pg_net with schema extensions;

-- 1. Uitnodiging aangenomen
create or replace function public.uitnodiging_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('invite_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null;
  end;
  return new;
end
$$;
revoke execute on function public.uitnodiging_push() from public, anon, authenticated;

drop trigger if exists uitnodiging_push on public.invite_tokens;
create trigger uitnodiging_push
  after update of used_by on public.invite_tokens
  for each row
  when (old.used_by is null and new.used_by is not null and new.created_by is not null and new.created_by <> new.used_by)
  execute function public.uitnodiging_push();

-- 2. Nieuw gastenboekbericht
create or replace function public.gastenboek_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('gastenboek_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null;
  end;
  return new;
end
$$;
revoke execute on function public.gastenboek_push() from public, anon, authenticated;

drop trigger if exists gastenboek_push on public.guestbook_entries;
create trigger gastenboek_push
  after insert on public.guestbook_entries
  for each row
  when (new.author_id is not null and new.author_id <> new.profile_id)
  execute function public.gastenboek_push();

commit;

-- Controle (twee keer true)
select
  exists (select 1 from pg_trigger where tgname = 'uitnodiging_push' and tgrelid = 'public.invite_tokens'::regclass) as uitnodiging_trigger,
  exists (select 1 from pg_trigger where tgname = 'gastenboek_push' and tgrelid = 'public.guestbook_entries'::regclass) as gastenboek_trigger;
