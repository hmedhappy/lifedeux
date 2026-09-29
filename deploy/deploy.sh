#!/usr/bin/env bash
# Builds and (re)starts LifeDeux on this server. Safe to run again for every update.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "Missing .env.production. Run: cp deploy/.env.production.example .env.production  and fill it in." >&2
  exit 1
fi
if grep -v "^#" .env.production | grep -q "CHANGE_ME"; then
  echo "Some values in .env.production are still CHANGE_ME. Fill them in first." >&2
  exit 1
fi

if grep -E "^POSTGRES_PASSWORD=" .env.production | cut -d= -f2- | grep -q '[^A-Za-z0-9_-]'; then
  echo "POSTGRES_PASSWORD may only contain letters, digits, - and _ (it is used inside a URL)." >&2
  echo "Generate one with: openssl rand -hex 24" >&2
  exit 1
fi

# Read only the few settings this script needs (the file is not executed as shell code).
env_value() { grep -E "^$1=" .env.production | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
USE_CADDY="$(env_value USE_CADDY)"
APP_PORT="$(env_value APP_PORT)"
APP_URL="$(env_value APP_URL)"

compose=(docker compose --env-file .env.production -f docker-compose.prod.yml)
# Optional extra compose file (e.g. a local override); not needed on a normal VPS.
if [ -n "${COMPOSE_OVERRIDE:-}" ]; then
  compose+=(-f "$COMPOSE_OVERRIDE")
fi
if [ "${USE_CADDY:-1}" = "1" ]; then
  compose+=(--profile caddy)
fi

if [ "${SKIP_PULL:-0}" != "1" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  git pull --ff-only
fi

"${compose[@]}" up -d --build --remove-orphans

echo "Waiting for the app to start..."
started=0
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null "http://127.0.0.1:${APP_PORT:-3010}/fr"; then started=1; break; fi
  sleep 2
done
if [ "$started" != "1" ]; then
  echo "The app did not start. Last log lines:" >&2
  "${compose[@]}" logs --tail 40 app >&2
  exit 1
fi

# Idempotent: creates the admin and the reference data (plus demo data when SEED_DEMO=true).
"${compose[@]}" exec -T app npx tsx prisma/seed.ts

"${compose[@]}" ps
echo
echo "Done. Open ${APP_URL}"
