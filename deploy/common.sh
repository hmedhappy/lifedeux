# Shared helpers for the VPS scripts (sourced, not run directly).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env.production ]; then
  echo "Missing .env.production (run the scripts from the LifeDeux folder on the VPS)." >&2
  exit 1
fi

# Reads one value without executing the file as shell code.
env_value() { grep -E "^$1=" .env.production | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

compose=(docker compose --env-file .env.production -f docker-compose.prod.yml)
# A second copy on the same server (staging) needs its own containers and database volume.
if [ -n "$(env_value COMPOSE_PROJECT_NAME)" ]; then compose+=(-p "$(env_value COMPOSE_PROJECT_NAME)"); fi
if [ -n "${COMPOSE_OVERRIDE:-}" ]; then compose+=(-f "$COMPOSE_OVERRIDE"); fi
if [ "$(env_value USE_CADDY)" != "0" ]; then compose+=(--profile caddy); fi

BACKUP_DIR="${BACKUP_DIR:-backups}"

wait_for_app() {
  for _ in $(seq 1 60); do
    if curl -fs -o /dev/null "http://127.0.0.1:$(env_value APP_PORT | sed 's/^$/3010/')/fr"; then return 0; fi
    sleep 2
  done
  echo "The app did not come back. Check: ${compose[*]} logs --tail 40 app" >&2
  return 1
}
