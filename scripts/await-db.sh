#!/usr/bin/env bash
#
# Waits for Neon's marketplace terms to be accepted, then finishes the whole
# deployment unattended.
#
# The terms click is the one step that legally requires a human. Everything
# after it — provisioning, DATABASE_URL wiring, migrations, seeding, smoke
# testing — runs from here, so the person only has to click once and walk away.

set -uo pipefail
cd "$(dirname "$0")/.."

SITE="${SITE:-https://chhaap-eight.vercel.app}"
LOG=/tmp/chhaap-await-db.log
DEADLINE=$(( $(date +%s) + 1800 ))   # give up after 30 minutes
INTERVAL=20

: > "$LOG"
say() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }

say "Waiting for Neon terms acceptance…"

while :; do
  if [ "$(date +%s)" -gt "$DEADLINE" ]; then
    say "TIMED OUT after 30 minutes — terms were never accepted."
    exit 1
  fi

  out=$(vercel integration add neon \
          --environment production \
          --environment preview \
          --environment development </dev/null 2>&1)

  if echo "$out" | grep -q "integration_terms_acceptance_required"; then
    sleep "$INTERVAL"
    continue
  fi

  say "Terms accepted — Neon provisioning started."
  echo "$out" >> "$LOG"
  break
done

# Provisioning is asynchronous; DATABASE_URL can lag the install by a few seconds.
say "Waiting for DATABASE_URL to land on the project…"
for _ in $(seq 1 30); do
  if vercel env ls production </dev/null 2>&1 | grep -q "DATABASE_URL"; then
    say "DATABASE_URL present."
    break
  fi
  sleep 5
done

if ! vercel env ls production </dev/null 2>&1 | grep -q "DATABASE_URL"; then
  say "FAILED: DATABASE_URL never appeared. Check 'vercel integration resource ls'."
  exit 1
fi

# Migrations run inside the build via scripts/deploy-migrate.ts.
say "Deploying (migrations run during the build)…"
if ! vercel deploy --prod --yes </dev/null >>"$LOG" 2>&1; then
  say "FAILED: deploy error — see $LOG"
  exit 1
fi
say "Deployed."

say "Seeding plans, templates and blog content…"
vercel env pull .env.production.local --environment production </dev/null >>"$LOG" 2>&1
set -a; . ./.env.production.local; set +a
if npm run db:seed:prod >>"$LOG" 2>&1; then
  say "Seeded."
else
  say "WARNING: seeding failed — the app still runs, but templates/blog will be empty."
fi

say "Smoke testing…"
for path in / /pricing /showcase /login /signup; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$SITE$path")
  say "  $path -> $code"
done

signup=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/auth/signup" \
  -H 'content-type: application/json' \
  -d '{"email":"smoke-'"$RANDOM"'@example.com","password":"smoke-test-password-123"}')

case "$signup" in
  201|429) say "SUCCESS: accounts are live (signup returned $signup). $SITE is fully working." ;;
  503)     say "FAILED: signup still reports no database — migrations likely did not run." ; exit 1 ;;
  *)       say "FAILED: signup returned $signup" ; exit 1 ;;
esac
