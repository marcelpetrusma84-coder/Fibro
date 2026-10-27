#!/bin/sh
# fibro-backup.sh - elke nacht een kopie van de Fibro-database (Supabase) op deze server.
# Staat in /usr/local/bin/fibro-backup.sh en draait via /etc/cron.d/fibro-backup. Zie docs/backup.md.
#
# Instellingen: /etc/fibro-backup.conf (geen wachtwoord). Het wachtwoord staat alleen in /root/.pgpass (chmod 600).
# Kopieen: /var/backups/fibro/fibro-JJJJ-MM-DD_UUMM.dump (alleen root kan ze lezen); de nieuwste BEWAAR blijven staan.
# Logboek: /var/backups/fibro/logboek.txt (een regel per keer: GOED of FOUT).
set -eu

CONF=/etc/fibro-backup.conf
[ -r "$CONF" ] || { echo "STOP: $CONF ontbreekt" >&2; exit 1; }
. "$CONF"
: "${PGHOST:?}" "${PGPORT:?}" "${PGUSER:?}" "${PGDATABASE:=postgres}" "${PGMAJOR:?}" "${BEWAAR:=14}"
export PGHOST PGPORT PGUSER PGDATABASE
export PGSSLMODE="${PGSSLMODE:-require}"
export PGPASSFILE="${PGPASSFILE:-/root/.pgpass}"

BIN="/usr/lib/postgresql/$PGMAJOR/bin"
MAP="${MAP:-/var/backups/fibro}"
umask 077
mkdir -p "$MAP"
chmod 700 "$MAP"

STEMPEL=$(date +%Y-%m-%d_%H%M)
DOEL="$MAP/fibro-$STEMPEL.dump"
DEELS="$DOEL.bezig"

fout() {
  rm -f "$DEELS"
  echo "$(date -Iseconds) FOUT $1" >> "$MAP/logboek.txt"
  echo "FOUT: $1" >&2
  exit 1
}

# public = alles van Fibro; auth = de accounts; storage = de lijst met bestanden (niet de bestanden zelf)
"$BIN/pg_dump" --format=custom --compress=9 --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --file="$DEELS" 2> "$MAP/laatste-fout.txt" || fout "pg_dump mislukt: $(tail -n 3 "$MAP/laatste-fout.txt" | tr '\n' ' ')"

# controleren of de kopie te lezen is, en of de belangrijkste tabellen erin zitten
"$BIN/pg_restore" --list "$DEELS" > "$MAP/inhoud.txt" 2>/dev/null || fout "kopie is niet te lezen"
for tabel in profiles messages friendships; do
  grep -q "TABLE DATA public $tabel " "$MAP/inhoud.txt" || fout "tabel $tabel ontbreekt in de kopie"
done

mv "$DEELS" "$DOEL"
rm -f "$MAP/laatste-fout.txt"

# alleen de nieuwste BEWAAR kopieen houden
ls -1t "$MAP"/fibro-*.dump 2>/dev/null | tail -n +"$((BEWAAR + 1))" | while read -r oud; do rm -f "$oud"; done

echo "$(date -Iseconds) GOED $(basename "$DOEL") $(du -h "$DOEL" | cut -f1)" >> "$MAP/logboek.txt"
echo "GOED: $DOEL ($(du -h "$DOEL" | cut -f1))"
