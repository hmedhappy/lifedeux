#!/usr/bin/env bash
# Replaces the current database with a backup. A safety backup of the current state is taken first.
#   ./deploy/restore.sh backups/lifedeux-2026-09-30_030000.sql.gz
#   npm run vps:restore -- backups/lifedeux-2026-09-30_030000.sql.gz
source "$(dirname "$0")/common.sh"

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: ./deploy/restore.sh backups/lifedeux-XXXX.sql.gz" >&2
  echo "Available backups:" >&2
  ls -1t "$BACKUP_DIR"/lifedeux-*.sql.gz 2>/dev/null | head -n 10 >&2 || echo "  (none)" >&2
  exit 1
fi

if [ "${2:-}" != "--yes" ]; then
  read -r -p "Replace the current database with $file? Type OUI to confirm: " answer
  [ "$answer" = "OUI" ] || { echo "Cancelled."; exit 1; }
fi

echo "1/4 Safety backup of the current database..."
"$(dirname "$0")/backup.sh"

echo "2/4 Stopping the app..."
"${compose[@]}" stop app cron

echo "3/4 Restoring $file..."
gzip -dc "$file" | "${compose[@]}" exec -T db psql -q -v ON_ERROR_STOP=1 -U lifedeux -d lifedeux > /dev/null

echo "4/4 Starting the app (pending migrations are applied at start-up)..."
"${compose[@]}" up -d app cron
wait_for_app
echo "Restored from $file."
