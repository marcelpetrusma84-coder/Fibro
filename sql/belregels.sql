-- Fibro: belregels in de chat (v152, 15 oktober 2026)
--
-- Na een gesprek zet de app van de beller een regel in de chat: een gewoon bericht in
-- messages met als inhoud 'oproep:<soort>:<a|v>:<seconden>' (zie belregel.js).
-- Van die regels telt alleen een gemiste oproep ('oproep:gemist:...') als ongelezen;
-- een gesprek of een geweigerde oproep geeft geen rood bolletje.
-- Deze SQL past alleen ongelezen_per_vriend() aan (uit sql/ongelezen.sql); de rest blijft.
-- Eén keer uitvoeren in de SQL-editor van Supabase. Nog een keer uitvoeren kan geen kwaad.

begin;

-- --- Controles vooraf ---
do $$
declare n int;
begin
  if to_regclass('public.laatst_gelezen') is null then
    raise exception 'STOP: tabel laatst_gelezen bestaat niet (eerst sql/ongelezen.sql); er is niets aangepast';
  end if;
  if to_regprocedure('public.ongelezen_per_vriend()') is null then
    raise exception 'STOP: functie ongelezen_per_vriend() bestaat niet (eerst sql/ongelezen.sql); er is niets aangepast';
  end if;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name in ('sender_id', 'receiver_id', 'content', 'created_at');
  if n <> 4 then
    raise exception 'STOP: tabel messages heeft niet de verwachte kolommen (% van 4); er is niets aangepast', n;
  end if;
end $$;

-- --- De functie: zoals in sql/ongelezen.sql, plus de regel over belregels ---
create or replace function public.ongelezen_per_vriend()
returns table (vriend_id uuid, aantal bigint)
language sql stable security invoker
set search_path = public
as $$
  select m.sender_id, count(*)
  from messages m
  left join laatst_gelezen g
    on g.gebruiker_id = auth.uid() and g.vriend_id = m.sender_id
  where m.receiver_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(g.gelezen_tot, timestamptz '2026-09-25 00:00:00+02')
    and (coalesce(m.content, '') not like 'oproep:%' or m.content like 'oproep:gemist:%')
  group by m.sender_id
$$;

grant execute on function public.ongelezen_per_vriend() to authenticated;

-- --- Zelftest als echte gebruikers (wordt altijd teruggedraaid) ---
do $$
declare
  a uuid; b uuid; voor_b bigint; na_b bigint; voor_a bigint; na_a bigint; n int;
begin
  select f.user_id, f.friend_id into a, b
    from friendships f
   where f.status = 'accepted' and f.user_id <> f.friend_id
   limit 1;
  if a is null then
    raise notice 'zelftest overgeslagen: geen vriendenpaar gevonden';
    return;
  end if;

  begin
    -- voor: hoeveel ongelezen heeft b van a, en a van b
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    select coalesce((select o.aantal from ongelezen_per_vriend() o where o.vriend_id = a), 0) into voor_b;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    select coalesce((select o.aantal from ongelezen_per_vriend() o where o.vriend_id = b), 0) into voor_a;

    -- a stuurt b vier belregels en een gewoon bericht (rechtstreeks, buiten de regels om)
    reset role;
    insert into messages (sender_id, receiver_id, content) values
      (a, b, 'oproep:gemist:a:0'),
      (a, b, 'oproep:gemist:v:0'),
      (a, b, 'oproep:gesprek:a:154'),
      (a, b, 'oproep:geweigerd:v:0'),
      (a, b, 'e2e:zelftest');

    -- b moet ze kunnen zien, anders zegt de telling niets
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    select count(*) into n from messages where sender_id = a and receiver_id = b and content = 'e2e:zelftest';
    if n <> 1 then raise exception 'ZELFTEST_OVERGESLAGEN'; end if;

    -- b: alleen de twee gemiste oproepen en het gewone bericht tellen
    select coalesce((select o.aantal from ongelezen_per_vriend() o where o.vriend_id = a), 0) into na_b;
    if na_b - voor_b <> 3 then
      raise exception 'ZT: verwacht 3 ongelezen erbij, het zijn er %', na_b - voor_b;
    end if;

    -- b leest het gesprek: dan niets meer ongelezen van a
    perform markeer_gelezen(a);
    select count(*) into n from ongelezen_per_vriend() o where o.vriend_id = a;
    if n <> 0 then raise exception 'ZT: na lezen nog ongelezen'; end if;

    -- a: zijn eigen belregels tellen bij hemzelf niet
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    select coalesce((select o.aantal from ongelezen_per_vriend() o where o.vriend_id = b), 0) into na_a;
    if na_a <> voor_a then raise exception 'ZT: eigen belregels tellen mee (% -> %)', voor_a, na_a; end if;

    raise exception 'ZELFTEST_OK';
  exception when others then
    if sqlerrm = 'ZELFTEST_OVERGESLAGEN' then
      raise notice 'zelftest overgeslagen: testberichten niet te zien';
    elsif sqlerrm <> 'ZELFTEST_OK' then
      raise exception 'STOP: zelftest mislukt (%); er is niets aangepast', sqlerrm;
    else
      raise notice 'zelftest geslaagd';
    end if;
  end;
end $$;

commit;

-- --- Controle ---
select 'ongelezen telt alleen gemiste oproepen' as wat,
       case when pg_get_functiondef('public.ongelezen_per_vriend()'::regprocedure) like '%oproep:gemist:%' then 'ja' else 'nee' end as uitkomst
union all
select 'ingelogd mag tellen',
       case when has_function_privilege('authenticated', 'public.ongelezen_per_vriend()', 'execute') then 'ja' else 'nee' end
union all
select 'belregels tot nu toe', (select count(*)::text from public.messages where content like 'oproep:%')
union all
select 'testberichten over', (select count(*)::text from public.messages where content = 'e2e:zelftest');
