-- Fibro: eigen keuze online/offline, los van online_status (29-09-2026)
-- toon_online = false betekent "helemaal offline": niemand ziet jou online,
-- en jij ziet zelf ook niemand online.
alter table public.profiles
  add column if not exists toon_online boolean not null default true;

-- Controle: moet 1 regel tonen (toon_online, boolean, true)
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'toon_online';
