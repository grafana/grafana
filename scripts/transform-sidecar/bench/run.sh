#!/usr/bin/env bash
# Runs the benchmark end to end: builds the sidecar, starts it on a scratch port, measures the Go
# side, then measures the browser baseline and prints the combined report.
# Usage: scripts/transform-sidecar/bench/run.sh [output dir] [iterations]
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
sidecar="$root/scripts/transform-sidecar"
out="${1:-$(mktemp -d)}"
iterations="${2:-5}"
port="${TRANSFORM_SIDECAR_PORT:-18096}"

node "$sidecar/build.mjs" >/dev/null 2>&1
TRANSFORM_SIDECAR_PORT="$port" TRANSFORM_SIDECAR_TIMEOUT_MS=120000 TRANSFORM_SIDECAR_MAX_BODY_BYTES=1073741824 \
  node "$sidecar/dist/server.cjs" >/dev/null &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
until curl -sf "http://127.0.0.1:$port/health" >/dev/null; do sleep 0.2; done

mkdir -p "$out"
rm -f "$out"/*.json "$out"/report.md
(cd "$root" && TRANSFORM_SIDECAR_URL="http://127.0.0.1:$port" TRANSFORM_BENCH_OUT="$out" TRANSFORM_BENCH_ITERATIONS="$iterations" \
  go test ./pkg/expr -run TestTransformSidecarBenchmark -count=1 -timeout 30m >/dev/null)

node "$sidecar/dist/bench-browser.cjs" "$out" "$iterations"
echo "Raw results and report.md: $out"
