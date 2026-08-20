#!/usr/bin/env bash
# Full end-to-end verification: reset, apply schema straight from SCHEMA.md,
# seed, then assert behaviour.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"

PSQL="docker exec srer-pg psql -U postgres -v ON_ERROR_STOP=1"

echo "== extracting SQL from SCHEMA.md =="
python extract.py | head -1

echo "== resetting database and roles =="
$PSQL -d postgres -q \
  -c "drop database if exists journal;" \
  -c "drop role if exists anon;" \
  -c "drop role if exists authenticated;" \
  -c "drop role if exists service_role;" \
  -c "create database journal;"

# The seed comes from supabase/seed.sql -- the same file the real stack uses.
# Keeping a second copy here is what let the two drift apart before.
docker cp ../../supabase/seed.sql srer-pg:/tmp/seed.sql >/dev/null
for f in prelude schema tests; do
  docker cp "$f.sql" srer-pg:/tmp/"$f.sql" >/dev/null
done

echo "== applying prelude (Supabase shim) =="
$PSQL -d journal --single-transaction -q -f /tmp/prelude.sql

echo "== applying schema.sql (extracted verbatim from SCHEMA.md) =="
$PSQL -d journal --single-transaction -q -f /tmp/schema.sql
echo "   schema applied with no errors"

echo "== seeding =="
$PSQL -d journal --single-transaction -q -f /tmp/seed.sql
echo "   seed applied"

echo "== tests =="
$PSQL -d journal -q -f /tmp/tests.sql
