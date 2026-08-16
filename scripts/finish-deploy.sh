#!/usr/bin/env bash
#
# Finishes the production deployment once a database provider's marketplace
# terms have been accepted.
#
#   1. Accept Neon's terms (one click, browser):
#      https://vercel.com/naaw/~/integrations/accept-terms/neon?source=cli
#   2. Run this.
#
# Everything after the terms click is automated: provisioning, DATABASE_URL
# wiring, migrations, seeding and a smoke test.

set -euo pipefail

SITE="${SITE:-https://chhaap-eight.vercel.app}"

step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

step "Provisioning Neon Postgres"
if vercel integration add neon \
     --environment production \
     --environment preview \
     --environment development </dev/null 2>&1 | tee /tmp/chhaap-neon.log | grep -q "integration_terms_acceptance_required"; then
  fail "Neon's terms are still not accepted. Open the link at the top of this script first."
fi
ok "Neon provisioned"

step "Confirming DATABASE_URL reached the project"
if ! vercel env ls production </dev/null 2>&1 | grep -q "DATABASE_URL"; then
  fail "DATABASE_URL is not set on the project. Check 'vercel integration resource ls'."
fi
ok "DATABASE_URL present"

# The build runs `prisma migrate deploy` via scripts/deploy-migrate.ts, so the
# schema is created as part of this deploy rather than as a separate step.
step "Deploying (migrations run during the build)"
vercel deploy --prod --yes </dev/null >/tmp/chhaap-deploy.log 2>&1 || fail "Deploy failed — see /tmp/chhaap-deploy.log"
ok "Deployed"

step "Seeding plans, templates and blog content"
vercel env pull .env.production.local --environment production </dev/null >/dev/null 2>&1
set -a; # shellcheck disable=SC1091
source .env.production.local; set +a
npm run db:seed:prod
ok "Seeded"

step "Smoke test"
for path in / /pricing /showcase /login /signup; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$SITE$path")
  [ "$code" = "200" ] || fail "$path returned $code"
  printf '  %-11s %s\n' "$path" "$code"
done

# The signup endpoint returning 503 means the database is still not reachable.
signup=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/auth/signup" \
  -H 'content-type: application/json' \
  -d '{"email":"smoke-'"$RANDOM"'@example.com","password":"smoke-test-password-123"}')
case "$signup" in
  201) ok "Signup works — accounts are live" ;;
  503) fail "Signup still reports no database. Migrations may not have run." ;;
  429) ok "Signup rate-limited (expected on repeat runs) — database is live" ;;
  *)   fail "Signup returned $signup" ;;
esac

printf '\n\033[1;32mDone.\033[0m %s is fully live.\n\n' "$SITE"
