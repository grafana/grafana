#!/usr/bin/env bash
#
# Regenerates the committed migrator snapshot
# (pkg/services/sqlstore/migrator/snapshot/) by running the branch's grafana
# binary against MySQL and dumping the resulting schema.
#
# Expects a MySQL instance to already be reachable. Locally:
#   make devenv sources=mysql_schema_dump
# In CI: a `services.mysql:` block.
#
# Env vars (all optional):
#   GF_DATABASE_HOST        default 127.0.0.1:3306
#   GF_DATABASE_NAME        default grafana
#   GF_DATABASE_USER        default root
#   GF_DATABASE_PASSWORD    default rootpass
#   OUT_DIR                 default pkg/services/sqlstore/migrator/snapshot
#   MYSQL_CLIENT_IMAGE      default mysql:8.4.9
#   KEEP_TMP                if non-empty, keep the temp scratch dir

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

export GF_DATABASE_TYPE=mysql
export GF_DATABASE_HOST="${GF_DATABASE_HOST:-127.0.0.1:3306}"
export GF_DATABASE_NAME="${GF_DATABASE_NAME:-grafana}"
export GF_DATABASE_USER="${GF_DATABASE_USER:-root}"
export GF_DATABASE_PASSWORD="${GF_DATABASE_PASSWORD:-rootpass}"
export GF_LOG_LEVEL=warn

OUT_DIR=${OUT_DIR:-pkg/services/sqlstore/migrator/snapshot}
# Pin the mysql client so dump output is byte-stable across hosts. Keep this
# in sync with the workflow image and the mysql_schema_dump devenv block.
MYSQL_CLIENT_IMAGE=${MYSQL_CLIENT_IMAGE:-mysql:8.4.9}

# MYSQL_PWD avoids the "Using a password on the command line interface is
# insecure" warning the `-p<password>` form emits.
export MYSQL_PWD="$GF_DATABASE_PASSWORD"

# Parse host:port for the mysql client tools.
MYSQL_HOST="${GF_DATABASE_HOST%:*}"
MYSQL_PORT="${GF_DATABASE_HOST##*:}"

# Resolve mysqldump and mysql commands once. Use docker if available so the
# client version is pinned; otherwise fall back to whatever is on $PATH.
if command -v docker >/dev/null; then
    DOCKER_NET=${DOCKER_NET:-host}
    # -e MYSQL_PWD forwards the var into the container without exposing the
    # password on docker's argv.
    MYSQLDUMP=(docker run --rm --network "$DOCKER_NET" -e MYSQL_PWD "$MYSQL_CLIENT_IMAGE" mysqldump)
    MYSQL_CLI=(docker run --rm --network "$DOCKER_NET" -e MYSQL_PWD "$MYSQL_CLIENT_IMAGE" mysql)
    MYSQLADMIN=(docker run --rm --network "$DOCKER_NET" -e MYSQL_PWD "$MYSQL_CLIENT_IMAGE" mysqladmin)
else
    MYSQLDUMP=(mysqldump)
    MYSQL_CLI=(mysql)
    MYSQLADMIN=(mysqladmin)
fi

mkdir -p "$OUT_DIR"

# ---- 1. Build the grafana binary from the current branch ----
echo "=== Building grafana binary..."
make build-go >/dev/null

GOOS=$(go env GOOS)
GOARCH=$(go env GOARCH)
GRAFANA_BIN="$ROOT_DIR/bin/$GOOS-$GOARCH/grafana"
if [[ ! -x "$GRAFANA_BIN" ]]; then
    # Some make build-go invocations land at bin/grafana without the OS/ARCH dir.
    GRAFANA_BIN="$ROOT_DIR/bin/grafana"
fi
if [[ ! -x "$GRAFANA_BIN" ]]; then
    echo >&2 "Could not locate the grafana binary under bin/."
    exit 1
fi

# ---- 2. Wait for MySQL ----
echo "=== Waiting for MySQL at $GF_DATABASE_HOST..."
maxTries=30
while (( maxTries > 0 )) && ! "${MYSQLADMIN[@]}" ping -h "$MYSQL_HOST" -P "$MYSQL_PORT" \
        -u "$GF_DATABASE_USER" --silent >/dev/null 2>&1; do
    sleep 1
    maxTries=$((maxTries - 1))
done
if (( maxTries == 0 )); then
    echo >&2 "MySQL never became reachable."
    exit 1
fi

# ---- 3. Sanity-check the target DB exists and is empty ----
echo "=== Checking database $GF_DATABASE_NAME is reachable and empty..."
existing_tables=$("${MYSQL_CLI[@]}" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$GF_DATABASE_USER" \
    -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$GF_DATABASE_NAME';" 2>/dev/null \
    | tr -d '[:space:]')
if [[ ! "$existing_tables" =~ ^[0-9]+$ ]]; then
    echo >&2 "Could not query $GF_DATABASE_NAME (got: '$existing_tables')."
    exit 1
fi
if [[ "$existing_tables" -ne 0 ]]; then
    echo >&2 "Database $GF_DATABASE_NAME is not empty ($existing_tables tables). Drop it before running this script."
    exit 1
fi

# ---- 4. Per-run scratch dir for grafana's data/log/plugin paths so we don't
#         pollute the repo's data/ directory. ----
RUNTIME_DIR=$(mktemp -d)
if [[ -z "${KEEP_TMP:-}" ]]; then
    trap 'rm -rf "$RUNTIME_DIR"' EXIT
fi

CFG_OVERRIDES=(
    cfg:default.paths.data="$RUNTIME_DIR"
    cfg:default.paths.logs="$RUNTIME_DIR/log"
    cfg:default.paths.plugins="$RUNTIME_DIR/plugins"
)

# ---- 5. Run db-migrate (validates the new subcommand + applies main migrations) ----
echo "=== Running grafana cli admin db-migrate..."
"$GRAFANA_BIN" cli --homepath "$ROOT_DIR" admin db-migrate "${CFG_OVERRIDES[@]}"

# ---- 6. Briefly boot grafana server to trigger the remaining migration subsystems
#         (unified storage, resource backend, secret keepers). ----
echo "=== Booting grafana server to flush remaining migrations..."
SERVER_LOG="$RUNTIME_DIR/server.log"
"$GRAFANA_BIN" server --homepath "$ROOT_DIR" "${CFG_OVERRIDES[@]}" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true; [[ -z "${KEEP_TMP:-}" ]] && rm -rf "$RUNTIME_DIR"' EXIT

# Wait for HTTP readiness (means apiserver registry has seeded resources too).
maxTries=60
while (( maxTries > 0 )) && ! curl -sf -o /dev/null http://127.0.0.1:3000/api/health; do
    sleep 1
    maxTries=$((maxTries - 1))
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo >&2 "grafana server exited unexpectedly. Tail of log:"
        tail -n 40 "$SERVER_LOG" >&2 || true
        exit 1
    fi
done
if (( maxTries == 0 )); then
    echo >&2 "grafana server never became ready. Tail of log:"
    tail -n 40 "$SERVER_LOG" >&2 || true
    exit 1
fi

kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

# ---- 7. Dump schema + per-subsystem migration logs ----
MYSQLDUMP_OPTS=(
    -h "$MYSQL_HOST" -P "$MYSQL_PORT"
    -u "$GF_DATABASE_USER"
    --skip-disable-keys --skip-add-drop-table --skip-add-locks
)

echo "=== Dumping schema..."
"${MYSQLDUMP[@]}" "${MYSQLDUMP_OPTS[@]}" --no-data "$GF_DATABASE_NAME" \
    > "$OUT_DIR/00-schema.sql"

dump_log_table() {
    local table=$1 outfile=$2
    if ! "${MYSQL_CLI[@]}" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$GF_DATABASE_USER" -N -e \
            "SELECT 1 FROM information_schema.tables WHERE table_schema='$GF_DATABASE_NAME' AND table_name='$table' LIMIT 1;" \
            | grep -q 1; then
        rm -f "$outfile"
        return
    fi
    "${MYSQLDUMP[@]}" "${MYSQLDUMP_OPTS[@]}" --skip-set-charset \
        --no-create-info --complete-insert --extended-insert \
        "$GF_DATABASE_NAME" "$table" > "$outfile"
}

dump_log_table migration_log              "$OUT_DIR/99-migration_log.sql"
dump_log_table secret_migration_log       "$OUT_DIR/96-secret_migration_log.sql"
dump_log_table resource_migration_log     "$OUT_DIR/97-resource_migration_log.sql"
dump_log_table unifiedstorage_migration_log "$OUT_DIR/95-unifiedstorage_migration_log.sql"

# Data dump
echo "=== Dumping data..."
"${MYSQLDUMP[@]}" "${MYSQLDUMP_OPTS[@]}" --skip-set-charset \
    --no-create-info --complete-insert --extended-insert \
    --ignore-table="$GF_DATABASE_NAME".alert_configuration \
    --ignore-table="$GF_DATABASE_NAME".alert_configuration_history \
    --ignore-table="$GF_DATABASE_NAME".builtin_role \
    --ignore-table="$GF_DATABASE_NAME".kv_store \
    --ignore-table="$GF_DATABASE_NAME".migration_log \
    --ignore-table="$GF_DATABASE_NAME".org \
    --ignore-table="$GF_DATABASE_NAME".org_user \
    --ignore-table="$GF_DATABASE_NAME".permission \
    --ignore-table="$GF_DATABASE_NAME".resource \
    --ignore-table="$GF_DATABASE_NAME".resource_history \
    --ignore-table="$GF_DATABASE_NAME".resource_last_import_time \
    --ignore-table="$GF_DATABASE_NAME".resource_migration_log \
    --ignore-table="$GF_DATABASE_NAME".resource_version \
    --ignore-table="$GF_DATABASE_NAME".role \
    --ignore-table="$GF_DATABASE_NAME".secret_migration_log \
    --ignore-table="$GF_DATABASE_NAME".seed_assignment \
    --ignore-table="$GF_DATABASE_NAME".server_lock \
    --ignore-table="$GF_DATABASE_NAME".unifiedstorage_migration_log \
    --ignore-table="$GF_DATABASE_NAME".user \
    "$GF_DATABASE_NAME" > "$OUT_DIR/98-data.sql"

# ---- 8. Normalise output. ----
echo "=== Normalising dumps..."
for f in "$OUT_DIR"/*.sql; do
    [[ -f "$f" ]] || continue
    sed -i.bak \
        -e '/^-- Dump completed on/d' \
        -e 's/^-- Host: [^ ]*/-- Host: localhost/' \
        -e 's/^\(.*\) AUTO_INCREMENT=[0-9]* \(.*\)$/\1 \2/' \
        -e 's/\([^ ]\)20[0-9][0-9]-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9]:[0-5][0-9]/\12022-01-01 00:00:00/g' \
        -e 's/VALUES (/VALUES\n  (/g' \
        -e 's/),(/),\n  (/g' \
        "$f"
    rm -f "$f.bak"
done

# Strip the auto-increment `id` column from `*_migration_log` dumps so the
# snapshot replays correctly on a fresh DB (AUTO_INCREMENT regenerates them).
for table in migration_log secret_migration_log resource_migration_log unifiedstorage_migration_log; do
    file_glob="$OUT_DIR/*${table}.sql"
    for f in $file_glob; do
        [[ -f "$f" ]] || continue
        sed -i.bak \
            -e "s/^INSERT INTO \`$table\` (\`id\`, /INSERT INTO \`$table\` (/" \
            -e 's/^  ([0-9][0-9]*,/  (/' \
            "$f"
        rm -f "$f.bak"
    done
done

echo "=== Done. Snapshot written to $OUT_DIR"
