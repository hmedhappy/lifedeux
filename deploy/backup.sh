#!/usr/bin/env bash
# Saves the whole database to backups/lifedeux-YYYY-MM-DD_HHMMSS.sql.gz and keeps
# the most recent BACKUP_KEEP files (default 30). Safe to run at any time, the app keeps running.
#   ./deploy/backup.sh            or   npm run vps:backup
# Nightly at 03:00 (crontab -e):
#   0 3 * * * cd /path/to/lifedeux && mkdir -p backups && ./deploy/backup.sh >> backups/backup.log 2>&1
source "$(dirname "$0")/common.sh"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/lifedeux-$(date +%F_%H%M%S).sql.gz"
tmp="$file.part"

# --clean --if-exists: the file can be restored over an existing database.
"${compose[@]}" exec -T db pg_dump -U lifedeux -d lifedeux --clean --if-exists --no-owner | gzip > "$tmp"
if [ "$(gzip -dc "$tmp" | head -c 2000 | grep -c "PostgreSQL database dump")" = "0" ]; then
  rm -f "$tmp"
  echo "Backup failed: the dump is empty or invalid." >&2
  exit 1
fi
mv "$tmp" "$file"

keep="${BACKUP_KEEP:-30}"
ls -1t "$BACKUP_DIR"/lifedeux-*.sql.gz 2>/dev/null | tail -n +"$((keep + 1))" | xargs -r rm -f

echo "Backup saved: $file ($(du -h "$file" | cut -f1))"
