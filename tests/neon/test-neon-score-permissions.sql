-- Run after neon-score-fixture.sql + sql/neon-raiders-scores.sql in a DISPOSABLE database.
-- psql -v ON_ERROR_STOP=1 ... -f tests/neon/test-neon-score-permissions.sql
begin;
insert into public.profiles(id, username) values
  ('10000000-0000-4000-8000-000000000001', 'Self'),
  ('20000000-0000-4000-8000-000000000002', 'Friend'),
  ('30000000-0000-4000-8000-000000000003', 'Stranger');
insert into public.friendships values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'accepted'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'accepted');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
do $$ begin
  perform public.neon_raiders_save_score('00000000-0000-4000-8000-000000000001', 100, now() - interval '1 hour');
  perform public.neon_raiders_save_score('00000000-0000-4000-8000-000000000001', 999, now());
  if (select count(*) from public.neon_raiders_scores) <> 1 then raise exception 'Duplicate run counted'; end if;
  if (select score from public.neon_raiders_scores limit 1) <> 100 then raise exception 'Duplicate run updated'; end if;
  begin
    perform public.neon_raiders_save_score('00000000-0000-4000-8000-000000000002', -1, now());
    raise exception 'Invalid score accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.neon_raiders_save_score('00000000-0000-4000-8000-000000000002', 10, now(),
      1, false, 'solo', '20000000-0000-4000-8000-000000000002');
    raise exception 'Changed account accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.neon_raiders_scores(user_id, run_id, score, played_at)
      values(auth.uid(), '00000000-0000-4000-8000-000000000002', 100, now());
    raise exception 'Direct write allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000002"}';
select public.neon_raiders_save_score('00000000-0000-4000-8000-000000000002', 500, now());
set local request.jwt.claims = '{"sub":"30000000-0000-4000-8000-000000000003"}';
select public.neon_raiders_save_score('00000000-0000-4000-8000-000000000003', 1000, now());
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
do $$ declare boards jsonb := public.neon_raiders_boards(); begin
  if (select count(*) from public.neon_raiders_scores) <> 1 then raise exception 'RLS exposes other scores'; end if;
  if jsonb_array_length(boards->'personal') <> 1 then raise exception 'Wrong personal board'; end if;
  if jsonb_array_length(boards->'friends') <> 2 then raise exception 'Wrong friends board'; end if;
  if boards->'global' <> '{"score":1000}'::jsonb then raise exception 'Stranger identity exposed: %', boards->'global'; end if;
  if boards->'known_players' <> '[]'::jsonb then raise exception 'Stranger id leaked'; end if;
end $$;
reset role;
delete from public.neon_raiders_scores where user_id = '30000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$ declare boards jsonb := public.neon_raiders_boards(); begin
  if boards->'global'->>'username' <> 'Friend' then raise exception 'Friend username unavailable'; end if;
  if (boards->'global'->>'score')::integer <> 500 then raise exception 'Wrong friend world record'; end if;
end $$;
reset role;
insert into public.mijn_blokkades values
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$ declare boards jsonb := public.neon_raiders_boards(); begin
  if jsonb_array_length(boards->'friends') <> 1 then raise exception 'Blocked friend score leaked'; end if;
  if boards->'global' <> '{"score":500}'::jsonb then raise exception 'Blocked friend identity leaked'; end if;
end $$;
reset role;
delete from public.mijn_blokkades;
delete from public.friendships where user_id = '20000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ declare boards jsonb := public.neon_raiders_boards(); begin
  if jsonb_array_length(boards->'friends') <> 1 then raise exception 'One-way friendship allowed'; end if;
  if boards->'global' <> '{"score":500}'::jsonb then raise exception 'Former friend identity leaked'; end if;
  if has_function_privilege('authenticated', 'public.neon_raiders_friend(uuid,uuid)', 'EXECUTE') then
    raise exception 'Private helper exposed';
  end if;
end $$;
reset role;
update public.profiles set geblokkeerd = true where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin
    perform public.neon_raiders_save_score('00000000-0000-4000-8000-000000000004', 99, now());
    raise exception 'Moderated account can submit';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.neon_raiders_boards();
    raise exception 'Anonymous leaderboard access allowed';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon', 'public.neon_raiders_save_score(uuid,bigint,timestamptz,integer,boolean,text,uuid)', 'EXECUTE') then
    raise exception 'Anonymous score submission allowed';
  end if;
end $$;
reset role;
update public.profiles set geblokkeerd = false where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare n integer; boards jsonb; begin
  for n in 1..14 loop
    perform public.neon_raiders_save_score(('99999999-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
      100 + n, now() - interval '1 minute');
  end loop;
  boards := public.neon_raiders_boards();
  if jsonb_array_length(boards->'personal') <> 10 or (boards->'personal'->0->>'score')::integer <> 114
     or (boards->'personal'->9->>'score')::integer <> 105 then raise exception 'Best ten ordering failed'; end if;
  begin
    perform public.neon_raiders_save_score('88888888-0000-4000-8000-000000000001', 1, now() + interval '1 day');
    raise exception 'Future timestamp accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
rollback;
select 'PASS Neon Raiders SQL: identity redaction, mutual friends, block, RLS, idempotency, input and grants' as result;
