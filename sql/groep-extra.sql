-- groep-extra.sql (10 nov 2026, groepschat): ongelezen-tellers en pushmeldingen voor groepen.
-- Na sql/groepen.sql en sql/groep-onbekenden.sql uitvoeren. Nog een keer uitvoeren kan geen kwaad.
--
-- 1. groep_berichten.stil: een 'stil' bericht (een reactie, 'weggehaald') telt niet als ongelezen en geeft geen
--    pushmelding. De app zet het; wat erin staat blijft versleuteld.
-- 2. groep_gelezen: tot wanneer je een groep gelezen hebt (zoals laatst_gelezen voor de gewone chat).
--    groep_ongelezen() geeft per groep het aantal nieuwe berichten van anderen; groep_markeer_gelezen(groep).
-- 3. Een pushmelding bij een nieuw bericht in een groep: een trigger roept stuur-push aan met { groep_bericht_id }
--    (zoals sql/push-vanaf-server.sql bij de gewone chat). De functie stuur-push moet daarvoor de nieuwe versie hebben.

begin;

alter table public.groep_berichten add column if not exists stil boolean not null default false;

create table if not exists public.groep_gelezen (
  groep_id    uuid not null references public.groepen(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  gelezen_tot timestamptz not null default now(),
  primary key (groep_id, user_id)
);
alter table public.groep_gelezen enable row level security;
revoke all on public.groep_gelezen from public, anon, authenticated;

create or replace function public.groep_markeer_gelezen(p_groep uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  insert into public.groep_gelezen (groep_id, user_id, gelezen_tot)
  select p_groep, auth.uid(), now() where public.is_groepslid(p_groep)
  on conflict (groep_id, user_id) do update set gelezen_tot = now();
$$;

create or replace function public.groep_ongelezen()
returns table (groep_id uuid, aantal integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.groep_id,
         (select count(*)::int from public.groep_berichten b
           where b.groep_id = l.groep_id and b.sender_id <> auth.uid() and not b.stil and b.expires_at > now()
             and b.created_at > coalesce((select g.gelezen_tot from public.groep_gelezen g
                                           where g.groep_id = l.groep_id and g.user_id = auth.uid()), l.created_at))
    from public.groep_leden l
   where l.user_id = auth.uid();
$$;

revoke execute on function public.groep_markeer_gelezen(uuid) from public, anon;
revoke execute on function public.groep_ongelezen() from public, anon;
grant execute on function public.groep_markeer_gelezen(uuid) to authenticated;
grant execute on function public.groep_ongelezen() to authenticated;

-- Pushmelding (via stuur-push)
create extension if not exists pg_net with schema extensions;
create or replace function public.groep_bericht_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/stuur-push',
      body := jsonb_build_object('groep_bericht_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  exception when others then
    null; -- een melding mag nooit het versturen van een bericht tegenhouden
  end;
  return new;
end
$$;
revoke execute on function public.groep_bericht_push() from public, anon, authenticated;

drop trigger if exists groep_bericht_push on public.groep_berichten;
create trigger groep_bericht_push
  after insert on public.groep_berichten
  for each row
  when (not new.stil)
  execute function public.groep_bericht_push();

commit;
