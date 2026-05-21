#!/usr/bin/env bash
#
# Runs scripts/schema-dump/dump.sh into a temp dir and diffs it against the
# committed snapshot. Fails if they don't match.
#
# Reuses the same env knobs as dump.sh — see that script for details.

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
BASELINE="$ROOT_DIR/pkg/services/sqlstore/migrator/snapshot"
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

OUT_DIR="$SCRATCH" "$ROOT_DIR/scripts/schema-dump/dump.sh"

if diff -r "$BASELINE" "$SCRATCH" >/dev/null; then
    echo "Schema snapshot matches the committed baseline."
    exit 0
fi

echo >&2
echo >&2 "============================================================"
echo >&2 "Schema snapshot drift detected."
echo >&2 ""
echo >&2 "The migrator+server now produces a schema that differs from"
echo >&2 "pkg/services/sqlstore/migrator/snapshot/. If you added or"
echo >&2 "modified a migration this is expected — regenerate locally:"
echo >&2 ""
echo >&2 "    make devenv sources=mysql_schema_dump"
echo >&2 "    make schema-dump"
echo >&2 ""
echo >&2 "Then commit the updated snapshot files."
echo >&2 "============================================================"
echo >&2

diff -r "$BASELINE" "$SCRATCH" || true
exit 1
