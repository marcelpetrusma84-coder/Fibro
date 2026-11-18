-- Ongelezen chatberichten voor de gezamenlijke Stekky-melding.
-- Vereist ongelezen.sql, berichten-bewaren.sql, berichten-verwijderen.sql en groep-extra.sql.
begin;

create or replace function public.chat_melding_teller_voor(p_gebruiker uuid)
returns jsonb
language sql
stable
strict
security definer
set search_path = ''
as $$
  with directe_chat as (
    select count(*) as aantal
      from public.messages m
      left join public.laatst_gelezen g
        on g.gebruiker_id = p_gebruiker and g.vriend_id = m.sender_id
     where m.receiver_id = p_gebruiker
       and m.sender_id <> p_gebruiker
       and m.created_at > coalesce(g.gelezen_tot, timestamptz '2026-09-25 00:00:00+02')
       and (m.expires_at is null or m.expires_at > statement_timestamp())
       -- De chat toont ook oude, onversleutelde tekst. Alleen de vaste systeemregels vallen buiten de teller.
       and m.content not in ('buzz:', 'verwijderd:')
       and m.content not like 'oproep:%'
       and m.content not like 'spelinvite:%'
       and not exists (
         select 1 from public.verborgen_berichten v
          where v.gebruiker_id = p_gebruiker and v.bericht_id = m.id
       )
  ), groepschat as (
    select count(*) as aantal
      from public.groep_leden l
      join public.groep_berichten b on b.groep_id = l.groep_id
      left join public.groep_gelezen g on g.groep_id = l.groep_id and g.user_id = l.user_id
     where l.user_id = p_gebruiker
       and b.sender_id <> p_gebruiker
       and not b.stil
       and b.expires_at > statement_timestamp()
       and b.created_at > coalesce(g.gelezen_tot, l.created_at)
  )
  select jsonb_build_object(
    'aantal', least(d.aantal + g.aantal, 2147483647)::integer,
    'gemeten', floor(extract(epoch from statement_timestamp()) * 1000)::bigint
  )
    from directe_chat d cross join groepschat g;
$$;

revoke all on function public.chat_melding_teller_voor(uuid) from public, anon, authenticated;
grant execute on function public.chat_melding_teller_voor(uuid) to service_role;

create or replace function public.chat_melding_teller()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.chat_melding_teller_voor(auth.uid());
$$;

revoke all on function public.chat_melding_teller() from public, anon, service_role;
grant execute on function public.chat_melding_teller() to authenticated;

commit;
