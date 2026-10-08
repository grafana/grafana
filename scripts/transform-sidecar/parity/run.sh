#!/usr/bin/env bash
# Runs the parity comparison end to end: builds the sidecar, starts it on a scratch port, writes
# fixture results from Go, and prints the comparison table.
# Usage: scripts/transform-sidecar/parity/run.sh [output dir]
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
sidecar="$root/scripts/transform-sidecar"
out="${1:-$(mktemp -d)}"
port="${TRANSFORM_SIDECAR_PORT:-18096}"

node "$sidecar/build.mjs" >/dev/null 2>&1
TRANSFORM_SIDECAR_PORT="$port" node "$sidecar/dist/server.cjs" >/dev/null &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
until curl -sf "http://127.0.0.1:$port/health" >/dev/null; do sleep 0.2; done

rm -f "$out"/*.json
(cd "$root" && TRANSFORM_SIDECAR_URL="http://127.0.0.1:$port" TRANSFORM_PARITY_OUT="$out" \
  go test ./pkg/expr -run TestTransformParityFixtures -count=1 >/dev/null)

node "$sidecar/dist/parity-compare.cjs" "$out"
echo "Fixture records and report.json: $out"
