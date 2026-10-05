#!/usr/bin/env bash
# Run by GitHub Actions over SSH after the tests pass (the CI key may only run this script:
# see "Déploiement automatique" in deploy/DEPLOY.md).
#   "<sha>"          main    -> production (this checkout): database saved, then deploy.sh
#   "staging <sha>"  staging -> the staging checkout (STAGING_DIR, default ../medelys-staging): deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# What the CI asks for, passed as the SSH command (forced commands keep it in SSH_ORIGINAL_COMMAND).
read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-$*}"
if [ "${#args[@]}" = 2 ] && [ "${args[0]}" = "staging" ]; then
  branch=staging
  sha="${args[1]}"
  cd "${STAGING_DIR:-../medelys-staging}"
elif [ "${#args[@]}" = 1 ]; then
  branch=main
  sha="${args[0]}"
else
  echo "ci-deploy: expected '<sha>' or 'staging <sha>', got '${SSH_ORIGINAL_COMMAND:-$*}'." >&2
  exit 2
fi
if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ci-deploy: expected a full commit sha, got '${sha}'." >&2
  exit 2
fi

exec 9>"/tmp/medelys-deploy-${branch}.lock"
flock -n 9 || { echo "ci-deploy: another ${branch} deployment is running." >&2; exit 3; }

git fetch --quiet origin "$branch"
if [ "$(git rev-parse "origin/${branch}")" != "$sha" ]; then
  # Not the head of the branch (a newer push reached it, and its own run deploys it).
  echo "ci-deploy: ${sha} is not the head of ${branch}, skipping." >&2
  exit 0
fi

echo "== $(date -u +%FT%TZ) deploying ${branch} ${sha}"
# Staging holds demo data only: no backup.
if [ "$branch" = "main" ]; then ./deploy/backup.sh; fi
git checkout --quiet -B "$branch" "$sha"

SKIP_PULL=1 ./deploy/deploy.sh
