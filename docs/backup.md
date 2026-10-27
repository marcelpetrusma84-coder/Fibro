# Back-up van de Fibro-database

Fibro draait op het gratis plan van Supabase. Daar maakt Supabase geen dagelijkse back-ups. Daarom maakt onze
eigen server bij TransIP (dezelfde als de TURN-server) elke nacht een kopie.

- Script: `tools/backup/fibro-backup.sh` → op de server `/usr/local/bin/fibro-backup.sh`
- Instellingen: `/etc/fibro-backup.conf` (zonder wachtwoord)
- Wachtwoord: alleen in `/root/.pgpass` (alleen root kan het lezen)
- Kopieën: `/var/backups/fibro/fibro-JJJJ-MM-DD_UUMM.dump`, de nieuwste 14 blijven staan
- Logboek: `/var/backups/fibro/logboek.txt` (één regel per nacht: `GOED` of `FOUT`)
- Wanneer: elke nacht om 03:17 (`/etc/cron.d/fibro-backup`)

In de kopie zitten de schema's `public` (alles van Fibro), `auth` (de accounts) en `storage` (de lijst met
bestanden, niet de bestanden zelf). Berichten staan erin zoals op de server: versleuteld.

## Eén keer instellen

Nodig: de Postgres-versie van Supabase (`show server_version;` in de SQL Editor) en de gegevens van de
**Session pooler** (Supabase → **Connect** → Session pooler): host, poort en gebruiker. De pooler werkt via IPv4.

Op de server (als root), voor Debian of Ubuntu, met `17` als voorbeeld voor de versie:

```sh
# 1. pg_dump in dezelfde hoofdversie als Supabase
apt-get update && apt-get install -y postgresql-common
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt-get install -y postgresql-client-17

# 2. het script
curl -fsSL https://raw.githubusercontent.com/marcelpetrusma84-coder/Fibro/main/tools/backup/fibro-backup.sh -o /usr/local/bin/fibro-backup.sh
chmod 755 /usr/local/bin/fibro-backup.sh

# 3. instellingen (geen wachtwoord)
cat > /etc/fibro-backup.conf <<'CONF'
PGHOST=aws-0-eu-central-1.pooler.supabase.com
PGPORT=5432
PGUSER=postgres.qmgatbphiplrfxrljtbe
PGDATABASE=postgres
PGMAJOR=17
BEWAAR=14
CONF

# 4. het wachtwoord (vraagt erom; het verschijnt niet op het scherm)
read -rs -p 'Databasewachtwoord: ' W; echo
printf '%s:%s:%s:%s:%s\n' "$(. /etc/fibro-backup.conf; echo $PGHOST)" 5432 postgres "$(. /etc/fibro-backup.conf; echo $PGUSER)" "$W" > /root/.pgpass
chmod 600 /root/.pgpass; unset W

# 5. proef
/usr/local/bin/fibro-backup.sh

# 6. elke nacht om 03:17
echo '17 3 * * * root /usr/local/bin/fibro-backup.sh >/dev/null 2>&1' > /etc/cron.d/fibro-backup
```

## Kijken of het werkt

```sh
tail -n 5 /var/backups/fibro/logboek.txt
ls -lh /var/backups/fibro/
```

## Terugzetten

Altijd eerst in een **nieuwe, lege** database (een nieuw Supabase-project of een eigen Postgres), nooit zomaar
over de live database heen:

```sh
pg_restore --no-owner --no-privileges -d "postgresql://…nieuwe database…" /var/backups/fibro/fibro-JJJJ-MM-DD_UUMM.dump
```

Een paar meldingen over schema's die al bestaan zijn normaal.
