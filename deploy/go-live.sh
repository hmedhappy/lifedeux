#!/usr/bin/env bash
# Opening to the public: backup, stop recreating demo data, delete every test account.
# Kept: specialties, medications, procedures, accommodations and settings.
# The admin account is recreated from ADMIN_EMAIL / ADMIN_PASSWORD in .env.production.
#   ./deploy/go-live.sh           or   npm run vps:go-live
source "$(dirname "$0")/common.sh"

echo "This deletes ALL accounts (doctors, patients, agents, admins) and their bookings,"
echo "consultations, messages, prescriptions and payments. Specialties and medications are kept."
if [ "${1:-}" != "--yes" ]; then
  read -r -p "Type OUI to continue: " answer
  [ "$answer" = "OUI" ] || { echo "Cancelled."; exit 1; }
fi

echo "1/4 Backup before deleting anything..."
"$(dirname "$0")/backup.sh"

echo "2/4 Turning off demo data (SEED_DEMO=false)..."
if grep -qE "^SEED_DEMO=" .env.production; then
  sed -i -E 's/^SEED_DEMO=.*/SEED_DEMO=false/' .env.production
else
  echo "SEED_DEMO=false" >> .env.production
fi
# Recreate the container so it reads the new value (deploy.sh would otherwise re-create demo accounts).
"${compose[@]}" up -d --force-recreate app
wait_for_app

echo "3/4 Deleting test accounts..."
"${compose[@]}" exec -T app npm run --silent db:reset-users -- --yes

echo "4/4 Checking the reference data is still there..."
"${compose[@]}" exec -T app npm run --silent db:seed:reference

echo
echo "Done. Log in with ADMIN_EMAIL from .env.production. The backup above lets you undo this with ./deploy/restore.sh."
