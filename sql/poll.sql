-- Fibro: anoniem stemmen op polls van vrienden

create table if not exists public.poll_tellers (
  eigenaar_id uuid not null references auth.users(id) on delete cascade,
  poll_id     text not null,
  optie       int  not null check (optie between 0 and 9),
  aantal      int  not null default 0 check (aantal >= 0),
  primary key (eigenaar_id, poll_id, optie)
);

create table if not exists public.poll_stemmers (
  eigenaar_id uuid not null references auth.users(id) on delete cascade,
  poll_id     text not null,
  stemmer_id  uuid not null references auth.users(id) on delete cascade,
  primary key (eigenaar_id, poll_id, stemmer_id)
);

alter table public.poll_tellers  enable row level security;
alter table public.poll_stemmers enable row level security;

-- Tellers: zichtbaar voor de eigenaar en zijn vrienden
drop policy if exists "tellers lezen" on public.poll_tellers;
create policy "tellers lezen" on public.poll_tellers
  for select to authenticated
  using (
    eigenaar_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = poll_tellers.eigenaar_id)
          or (f.friend_id = auth.uid() and f.user_id = poll_tellers.eigenaar_id))
    )
  );

-- Stemmers: je ziet alleen je eigen regel, dus niemand ziet wie er stemde
drop policy if exists "stemmers lezen" on public.poll_stemmers;
create policy "stemmers lezen" on public.poll_stemmers
  for select to authenticated
  using (stemmer_id = auth.uid());

-- Niemand schrijft direct; alleen via de functie
grant select on public.poll_tellers, public.poll_stemmers to authenticated;
revoke insert, update, delete on public.poll_tellers, public.poll_stemmers from anon, authenticated;

create or replace function public.stem_op_poll(
  eigenaar_in uuid, poll_id_in text, optie_in int, aantal_opties int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mij uuid := auth.uid();
begin
  if mij is null then return 'niet ingelogd'; end if;
  if poll_id_in is null or length(poll_id_in) > 64 then return 'ongeldige poll'; end if;
  if aantal_opties is null or aantal_opties < 2 or aantal_opties > 10 then return 'ongeldige poll'; end if;
  if optie_in is null or optie_in < 0 or optie_in >= aantal_opties then return 'ongeldige optie'; end if;

  if not exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.user_id = mij and f.friend_id = eigenaar_in)
        or (f.friend_id = mij and f.user_id = eigenaar_in))
  ) then
    return 'geen vriend';
  end if;

  -- Eerst vastleggen DAT je stemt; lukt dat niet, dan had je al gestemd
  insert into poll_stemmers (eigenaar_id, poll_id, stemmer_id)
  values (eigenaar_in, poll_id_in, mij)
  on conflict do nothing;
  if not found then return 'al gestemd'; end if;

  -- Dan de teller ophogen, zonder naam
  insert into poll_tellers (eigenaar_id, poll_id, optie, aantal)
  values (eigenaar_in, poll_id_in, optie_in, 1)
  on conflict (eigenaar_id, poll_id, optie)
  do update set aantal = poll_tellers.aantal + 1;

  return 'ok';
end;
$$;

revoke all on function public.stem_op_poll(uuid, text, int, int) from public, anon;
grant execute on function public.stem_op_poll(uuid, text, int, int) to authenticated;

notify pgrst, 'reload schema';
