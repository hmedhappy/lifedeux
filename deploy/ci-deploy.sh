#!/usr/bin/env bash
# Run by GitHub Actions over SSH after the tests pass on main (the CI key may only run this script:
# see "Déploiement automatique" in deploy/DEPLOY.md). Saves the database, moves the checkout to
# the tested commit of main, then rebuilds and restarts the app with deploy.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

# The commit the CI tested, passed as the SSH command (forced commands keep it in SSH_ORIGINAL_COMMAND).
sha="${SSH_ORIGINAL_COMMAND:-${1:-}}"
if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ci-deploy: expected a full commit sha, got '${sha}'." >&2
  exit 2
fi

exec 9>/tmp/medelys-deploy.lock
flock -n 9 || { echo "ci-deploy: another deployment is running." >&2; exit 3; }

echo "== $(date -u +%FT%TZ) deploying ${sha}"
./deploy/backup.sh

git fetch --quiet origin main
if [ "$(git rev-parse origin/main)" != "$sha" ]; then
  # A newer push reached main: its own run deploys it.
  echo "ci-deploy: main has moved past ${sha}, skipping." >&2
  exit 0
fi
git checkout --quiet -B main "$sha"

SKIP_PULL=1 ./deploy/deploy.sh
