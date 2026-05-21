# MySQL schema snapshot

Tooling that regenerates and verifies `pkg/services/sqlstore/migrator/snapshot/`,
the embedded baseline `MySQLDialect.CreateDatabaseFromSnapshot` uses as the
fresh-database fast-path.

The CI workflow at `.github/workflows/pr-verify-schema.yml` runs
`make schema-dump-verify` on every PR that touches a migration. If a developer
adds a migration but forgets to regenerate the snapshot, the workflow fails
with a diff.

## How to update the snapshot

Updates should be done when you add or modify a schema migration in
`pkg/services/sqlstore/migrations/`, `pkg/services/sqlstore/migrator/`, or
`pkg/storage/unified/migrations/`.

**Note:** Before regenerating these SQL files, double-check your own
migrations for any new `INSERT INTO ... VALUES ...` rows. The dump excludes
several data tables by default
(see `--ignore-table=` lines in `scripts/schema-dump/dump.sh`); if your
migration relies on seeded data, either remove the table from the ignore list
or dump it separately.

1. Start the bundled MySQL devenv:

   ```console
   $ make devenv sources=mysql_schema_dump
   ```

   This brings up an empty `mysql:8.4.9` container on port 3306, configured to
   match the version the snapshot is generated with.

2. Regenerate the snapshot:

   ```console
   $ make schema-dump
   ```

   This builds the grafana binary, runs `cli admin db-migrate` plus a brief
   `grafana server` boot against the devenv MySQL, then dumps the resulting
   schema into `pkg/services/sqlstore/migrator/snapshot/`.

3. Verify the new files make sense — diff them against the previous versions.
   Migration log entries may appear in different orders because Grafana
   migrations are non-deterministic between versions.

4. Open a PR with the updated snapshot files. CI will run
   `make schema-dump-verify` against your branch to confirm the snapshot
   matches what the migrator now produces.

## Files

| Path        | What it does                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `dump.sh`   | The end-to-end pipeline. Reads env vars (see top of file) so the same script works locally and in CI's `services.mysql` block. |
| `verify.sh` | Runs `dump.sh` into a temp dir and diffs against the committed snapshot. Used by `make schema-dump-verify`.                    |
