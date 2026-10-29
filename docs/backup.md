# Back-up van de Fibro-database

Fibro draait op het gratis plan van Supabase. Daar maakt Supabase geen dagelijkse back-ups. Daarom maakt GitHub
elke nacht een **versleutelde** kopie: `.github/workflows/database-backup.yml`.

- **Wanneer:** elke nacht om 02:17 UTC (03:17 of 04:17 in Nederland). Ook met de hand: GitHub → **Actions** →
  **Database-back-up** → **Run workflow**.
- **Wat:** de schema's `public` (alles van Fibro), `auth` (de accounts) en `storage` (de lijst met bestanden, niet de
  bestanden zelf). Berichten staan erin zoals op de server: versleuteld.
- **Versleuteld:** met AES-256 en de wachtzin `FIBRO_BACKUP_WACHTZIN`. De repo is openbaar; zonder die wachtzin is
  een kopie onleesbaar, ook voor wie hem downloadt. **Bewaar de wachtzin op papier.** Zonder wachtzin kan niemand de
  kopie openen, ook jij niet.
- **Hoe lang:** elke kopie blijft 30 dagen staan, bij de run onder **Actions** (onderaan: *Artifacts*).
- **Controle:** de workflow stopt met een rode foutmelding als een geheim ontbreekt, als de kopie niet te lezen is,
  als `profiles`, `messages` of `friendships` ontbreekt, of als de versleutelde kopie niet terug te openen is.

## Eén keer instellen

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Naam | Inhoud |
|---|---|
| `FIBRO_DB_WACHTWOORD` | het wachtwoord van de database bij Supabase (Supabase → Connect → *Reset database password* als je het niet meer weet; de app gebruikt dit wachtwoord niet) |
| `FIBRO_BACKUP_WACHTZIN` | een zelfgekozen wachtzin van minstens 12 tekens, bijvoorbeeld vier losse woorden |

Verbinding (geen geheim, staat in de workflow): Supabase → **Connect** → *Shared pooler*:
`aws-1-eu-north-1.pooler.supabase.com`, poort `5432`, gebruiker `postgres.qmgatbphiplrfxrljtbe`, Postgres 17.
Verandert er iets aan het project, pas dan `PGHOST`, `PGUSER` of `PGMAJOR` in de workflow aan.

## Kijken of het werkt

GitHub → **Actions** → **Database-back-up**: een groen vinkje per nacht. Een rood kruis: klik erop, de foutmelding
zegt wat er mis is.

## Terugzetten

1. GitHub → **Actions** → **Database-back-up** → kies een run → onderaan bij *Artifacts* downloaden en uitpakken
   (zip). Daarin staat `fibro-JJJJ-MM-DD_UUMM.dump.gpg`.
2. Ontsleutelen (vraagt om de wachtzin):
   ```sh
   gpg --output fibro.dump --decrypt fibro-JJJJ-MM-DD_UUMM.dump.gpg
   ```
3. Altijd eerst terugzetten in een **nieuwe, lege** database (een nieuw Supabase-project of een eigen Postgres 17),
   nooit zomaar over de live database heen:
   ```sh
   pg_restore --no-owner --no-privileges -d "postgresql://…nieuwe database…" fibro.dump
   ```
   Een paar meldingen over schema's die al bestaan zijn normaal.

## Later: op de eigen server

`tools/backup/fibro-backup.sh` doet hetzelfde op een eigen Linux-server (bijvoorbeeld de TransIP-server), met
`/etc/fibro-backup.conf`, het wachtwoord in `/root/.pgpass` en een cron-regel. Handig zodra Fibro naar een eigen
server verhuist. De uitleg staat bovenin het script.
