-- vriendverzoek-push.sql (18 nov 2026, Marcel): een pushmelding bij een vriendverzoek uit een groepschat
-- ("👋 Lotte wil vrienden worden"). Na sql/vriendverzoek-groep.sql. Net als de andere meldingen van de server
-- (sql/contact-push.sql): de trigger stuurt alleen het id naar de edge function stuur-push; die haalt alles uit de
-- rij zelf en stuurt hoogstens een melding per verzoek (push_log). Wie in ☰ > Pushmeldingen 'Vrienden' uitzette, krijgt
-- er geen. Opnieuw uitvoeren kan geen kwaad.
begin;
create extension if not exists pg_net with schema extensions;

create or replace function public.vriendverzoek_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('vriendverzoek_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null;   -- een melding die niet lukt, mag het verzoek nooit tegenhouden
  end;
  return new;
end
$$;
revoke execute on function public.vriendverzoek_push() from public, anon, authenticated;

drop trigger if exists vriendverzoek_push on public.vriendverzoeken;
create trigger vriendverzoek_push
  after insert on public.vriendverzoeken
  for each row
  when (new.status = 'open')
  execute function public.vriendverzoek_push();

commit;
