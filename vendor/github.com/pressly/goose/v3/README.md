# goose

<img align="right" width="125" src="assets/goose_logo.png">

[![Goose
CI](https://github.com/pressly/goose/actions/workflows/ci.yaml/badge.svg)](https://github.com/pressly/goose/actions/workflows/ci.yaml)
[![Go
Reference](https://pkg.go.dev/badge/github.com/pressly/goose/v3.svg)](https://pkg.go.dev/github.com/pressly/goose/v3)
[![Go Report
Card](https://goreportcard.com/badge/github.com/pressly/goose/v3)](https://goreportcard.com/report/github.com/pressly/goose/v3)

Goose is a database migration tool. Both a CLI and a library.

Manage your **database schema** by creating incremental SQL changes or Go functions.

#### Features

- Works against multiple databases:
  - Postgres, MySQL, SQLite, YDB, ClickHouse, MSSQL, and
    more.
- Supports Go migrations written as plain functions.
- Supports [embedded](https://pkg.go.dev/embed/) migrations.
- Out-of-order migrations.
- Seeding data.
- Environment variable substitution in SQL migrations.
- ... and more.

# Install

```shell
go install github.com/pressly/goose/v3/cmd/goose@latest
```

This will install the `goose` binary to your `$GOPATH/bin` directory.

Binary too big? Build a lite version by excluding the drivers you don't need:

```shell
go build -tags='no_postgres no_mysql no_sqlite3 no_ydb' -o goose ./cmd/goose

# Available build tags:
#   no_clickhouse  no_libsql   no_mssql    no_mysql
#   no_postgres    no_sqlite3  no_vertica  no_ydb
```

For macOS users `goose` is available as a [Homebrew
Formulae](https://formulae.brew.sh/formula/goose#default):

```shell
brew install goose
```

See [installation documentation](https://pressly.github.io/goose/installation/) for more details.

# Usage

<details>
<summary>Click to show <code>goose help</code> output</summary>

```
Usage: goose [OPTIONS] DRIVER DBSTRING COMMAND

or

Set environment key
GOOSE_DRIVER=DRIVER
GOOSE_DBSTRING=DBSTRING
GOOSE_MIGRATION_DIR=MIGRATION_DIR

Usage: goose [OPTIONS] COMMAND

Drivers:
    postgres
    mysql
    sqlite3
    mssql
    redshift
    tidb
    clickhouse
    ydb
    starrocks

Examples:
    goose sqlite3 ./foo.db status
    goose sqlite3 ./foo.db create init sql
    goose sqlite3 ./foo.db create add_some_column sql
    goose sqlite3 ./foo.db create fetch_user_data go
    goose sqlite3 ./foo.db up

    goose postgres "user=postgres dbname=postgres sslmode=disable" status
    goose mysql "user:password@/dbname?parseTime=true" status
    goose redshift "postgres://user:password@qwerty.us-east-1.redshift.amazonaws.com:5439/db" status
    goose tidb "user:password@/dbname?parseTime=true" status
    goose mssql "sqlserver://user:password@hostname:1433?database=master" status
    goose clickhouse "tcp://127.0.0.1:9000" status
    goose ydb "grpcs://localhost:2135/local?go_query_mode=scripting&go_fake_tx=scripting&go_query_bind=declare,numeric" status
    goose starrocks "user:password@/dbname?parseTime=true&interpolateParams=true" status

    GOOSE_DRIVER=sqlite3 GOOSE_DBSTRING=./foo.db goose status
    GOOSE_DRIVER=sqlite3 GOOSE_DBSTRING=./foo.db goose create init sql
    GOOSE_DRIVER=postgres GOOSE_DBSTRING="user=postgres dbname=postgres sslmode=disable" goose status
    GOOSE_DRIVER=mysql GOOSE_DBSTRING="user:password@/dbname" goose status
    GOOSE_DRIVER=redshift GOOSE_DBSTRING="postgres://user:password@qwerty.us-east-1.redshift.amazonaws.com:5439/db" goose status
    GOOSE_DRIVER=clickhouse GOOSE_DBSTRING="clickhouse://user:password@qwerty.clickhouse.cloud:9440/dbname?secure=true&skip_verify=false" goose status

Options:

  -allow-missing
        applies missing (out-of-order) migrations
  -certfile string
        file path to root CA's certificates in pem format (only support on mysql)
  -dir string
        directory with migration files (default ".", can be set via the GOOSE_MIGRATION_DIR env variable).
  -h    print help
  -no-color
        disable color output (NO_COLOR env variable supported)
  -no-versioning
        apply migration commands with no versioning, in file order, from directory pointed to
  -s    use sequential numbering for new migrations
  -ssl-cert string
        file path to SSL certificates in pem format (only support on mysql)
  -ssl-key string
        file path to SSL key in pem format (only support on mysql)
  -table string
        migrations table name (default "goose_db_version"). If you use a schema that is not `public`, you should set `schemaname.goose_db_version` when running commands.
  -timeout duration
        maximum allowed duration for queries to run; e.g., 1h13m
  -v    enable verbose mode
  -version
        print version

Commands:
    up                   Migrate the DB to the most recent version available
    up-by-one            Migrate the DB up by 1
    up-to VERSION        Migrate the DB to a specific VERSION
    down                 Roll back the version by 1
    down-to VERSION      Roll back to a specific VERSION
    redo                 Re-run the latest migration
    reset                Roll back all migrations
    status               Dump the migration status for the current DB
    version              Print the current version of the database
    create NAME [sql|go] Creates new migration file with the current timestamp
    fix                  Apply sequential ordering to migrations
    validate             Check migration files without running them
```

</details>

Commonly used commands:

[create](#create)<span>&nbsp;•&nbsp;</span> [up](#up)<span>&nbsp;•&nbsp;</span> [up-to](#up-to)<span>&nbsp;•&nbsp;</span> [down](#down)<span>&nbsp;•&nbsp;</span> [down-to](#down-to)<span>&nbsp;•&nbsp;</span> [status](#status)<span>&nbsp;•&nbsp;</span> [version](#version)

## create

Create a new SQL migration.

    $ goose create add_some_column sql
    $ Created new file: 20170506082420_add_some_column.sql

    $ goose -s create add_some_column sql
    $ Created new file: 00001_add_some_column.sql

Edit the newly created file to define the behavior of your migration.

You can also create a Go migration, if you then invoke it with [your own goose
binary](#go-migrations):

    $ goose create fetch_user_data go
    $ Created new file: 20170506082421_fetch_user_data.go

## up

Apply all available migrations.

    $ goose up
    $ OK    001_basics.sql
    $ OK    002_next.sql
    $ OK    003_and_again.go

## up-to

Migrate up to a specific version.

    $ goose up-to 20170506082420
    $ OK    20170506082420_create_table.sql

## up-by-one

Migrate up a single migration from the current version

    $ goose up-by-one
    $ OK    20170614145246_change_type.sql

## down

Roll back a single migration from the current version.

    $ goose down
    $ OK    003_and_again.go

## down-to

Roll back migrations to a specific version.

    $ goose down-to 20170506082527
    $ OK    20170506082527_alter_column.sql

Or, roll back all migrations (careful!):

    $ goose down-to 0

## status

Print the status of all migrations:

    $ goose status
    $   Applied At                  Migration
    $   =======================================
    $   Sun Jan  6 11:25:03 2013 -- 001_basics.sql
    $   Sun Jan  6 11:25:03 2013 -- 002_next.sql
    $   Pending                  -- 003_and_again.go

Note: for MySQL [parseTime flag](https://github.com/go-sql-driver/mysql#parsetime) must be enabled.

Note: for MySQL
[`multiStatements`](https://github.com/go-sql-driver/mysql?tab=readme-ov-file#multistatements) must
be enabled. This is required when writing multiple queries separated by ';' characters in a single
sql file.

## version

Print the current version of the database:

    $ goose version
    $ goose: version 002

# Environment Variables

If you prefer to use environment variables, instead of passing the driver and database string as
arguments, you can set the following environment variables:

**1. Via environment variables:**

```shell
export GOOSE_DRIVER=DRIVER
export GOOSE_DBSTRING=DBSTRING
export GOOSE_MIGRATION_DIR=MIGRATION_DIR
export GOOSE_TABLE=TABLENAME
```

**2. Via `.env` files with corresponding variables. `.env` file example**:

```env
GOOSE_DRIVER=postgres
GOOSE_DBSTRING=postgres://admin:admin@localhost:5432/admin_db
GOOSE_MIGRATION_DIR=./migrations
GOOSE_TABLE=custom.goose_migrations
```

Loading from `.env` files is enabled by default. To disable this feature, set the `-env=none` flag.
If you want to load from a specific file, set the `-env` flag to the file path.

For more details about environment variables, see the [official documentation on environment
variables](https://pressly.github.io/goose/documentation/environment-variables/).

# Migrations

goose supports migrations written in SQL or in Go.

## SQL Migrations

A sample SQL migration looks like:

```sql
-- +goose Up
CREATE TABLE post (
    id int NOT NULL,
    title text,
    body text,
    PRIMARY KEY(id)
);

-- +goose Down
DROP TABLE post;
```

Each migration file must have exactly one `-- +goose Up` annotation. The `-- +goose Down` annotation
is optional. If the file has both annotations, then the `-- +goose Up` annotation **must** come
first.

Notice the annotations in the comments. Any statements following `-- +goose Up` will be executed as
part of a forward migration, and any statements following `-- +goose Down` will be executed as part
of a rollback.

By default, all migrations are run within a transaction. Some statements like `CREATE DATABASE`,
however, cannot be run within a transaction. You may optionally add `-- +goose NO TRANSACTION` to
the top of your migration file in order to skip transactions within that specific migration file.
Both Up and Down migrations within this file will be run without transactions.

By default, SQL statements are delimited by semicolons - in fact, query statements must end with a
semicolon to be properly recognized by goose.

By default, all migrations are run on the public schema. If you want to use a different schema,
specify the schema name using the table option like `-table='schemaname.goose_db_version`.

More complex statements (PL/pgSQL) that have semicolons within them must be annotated with `--
+goose StatementBegin` and `-- +goose StatementEnd` to be properly recognized. For example:

```sql
-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION histories_partition_creation( DATE, DATE )
returns void AS $$
DECLARE
  create_query text;
BEGIN
  FOR create_query IN SELECT
      'CREATE TABLE IF NOT EXISTS histories_'
      || TO_CHAR( d, 'YYYY_MM' )
      || ' ( CHECK( created_at >= timestamp '''
      || TO_CHAR( d, 'YYYY-MM-DD 00:00:00' )
      || ''' AND created_at < timestamp '''
      || TO_CHAR( d + INTERVAL '1 month', 'YYYY-MM-DD 00:00:00' )
      || ''' ) ) inherits ( histories );'
    FROM generate_series( $1, $2, '1 month' ) AS d
  LOOP
    EXECUTE create_query;
  END LOOP;  -- LOOP END
END;         -- FUNCTION END
$$
language plpgsql;
-- +goose StatementEnd
```

Goose supports environment variable substitution in SQL migrations through annotations. To enable
this feature, use the `-- +goose ENVSUB ON` annotation before the queries where you want
substitution applied. It stays active until the `-- +goose ENVSUB OFF` annotation is encountered.
You can use these annotations multiple times within a file.

This feature is disabled by default for backward compatibility with existing scripts.

For `PL/pgSQL` functions or other statements where substitution is not desired, wrap the annotations
explicitly around the relevant parts. For example, to exclude escaping the `**` characters:

```sql
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION test_func()
RETURNS void AS $$
-- +goose ENVSUB ON
BEGIN
	RAISE NOTICE '${SOME_ENV_VAR}';
END;
-- +goose ENVSUB OFF
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
```

<details>
<summary>Supported expansions (click here to expand):</summary>

- `${VAR}` or $VAR - expands to the value of the environment variable `VAR`
- `${VAR:-default}` - expands to the value of the environment variable `VAR`, or `default` if `VAR`
  is unset or null
- `${VAR-default}` - expands to the value of the environment variable `VAR`, or `default` if `VAR`
  is unset
- `${VAR?err_msg}` - expands to the value of the environment variable `VAR`, or prints `err_msg` and
  error if `VAR` unset
- ~~`${VAR:?err_msg}` - expands to the value of the environment variable `VAR`, or prints `err_msg`
  and error if `VAR` unset or null.~~ **THIS IS NOT SUPPORTED**

See
[mfridman/interpolate](https://github.com/mfridman/interpolate?tab=readme-ov-file#supported-expansions)
for more details on supported expansions.

</details>

## Embedded sql migrations

Go 1.16 introduced new feature: [compile-time embedding](https://pkg.go.dev/embed/) files into
binary and corresponding [filesystem abstraction](https://pkg.go.dev/io/fs/).

This feature can be used only for applying existing migrations. Modifying operations such as `fix`
and `create` will continue to operate on OS filesystem even if using embedded files. This is
expected behaviour because `io/fs` interfaces allows read-only access.

Make sure to configure the correct SQL dialect, see [dialect.go](./dialect.go) for supported SQL
dialects.

Example usage, assuming that SQL migrations are placed in the `migrations` directory:

```go
package main

import (
    "database/sql"
    "embed"

    "github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

func main() {
    var db *sql.DB
    // setup database

    goose.SetBaseFS(embedMigrations)

    if err := goose.SetDialect("postgres"); err != nil {
        panic(err)
    }

    if err := goose.Up(db, "migrations"); err != nil {
        panic(err)
    }

    // run app
}
```

Note that we pass `"migrations"` as directory argument in `Up` because embedding saves directory
structure.

## Go Migrations

1. Create your own goose binary, see [example](./examples/go-migrations)
2. Import `github.com/pressly/goose`
3. Register your migration functions
4. Include your `migrations` package into Go build: in `main.go`, `import _ "github.com/me/myapp/migrations"`
5. Run goose command, ie. `goose.Up(db *sql.DB, dir string)`

A [sample Go migration 00002_users_add_email.go file](./examples/go-migrations/00002_rename_root.go)
looks like:

```go
package migrations

import (
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddMigration(Up, Down)
}

func Up(tx *sql.Tx) error {
	_, err := tx.Exec("UPDATE users SET username='admin' WHERE username='root';")
	if err != nil {
		return err
	}
	return nil
}

func Down(tx *sql.Tx) error {
	_, err := tx.Exec("UPDATE users SET username='root' WHERE username='admin';")
	if err != nil {
		return err
	}
	return nil
}
```

Note that Go migration files must begin with a numeric value, followed by an underscore, and must
not end with `*_test.go`.

# Hybrid Versioning

Please, read the [versioning
problem](https://github.com/pressly/goose/issues/63#issuecomment-428681694) first.

By default, if you attempt to apply missing (out-of-order) migrations `goose` will raise an error.
However, If you want to apply these missing migrations pass goose the `-allow-missing` flag, or if
using as a library supply the functional option `goose.WithAllowMissing()` to Up, UpTo or UpByOne.

However, we strongly recommend adopting a hybrid versioning approach, using both timestamps and
sequential numbers. Migrations created during the development process are timestamped and sequential
versions are ran on production. We believe this method will prevent the problem of conflicting
versions when writing software in a team environment.

To help you adopt this approach, `create` will use the current timestamp as the migration version.
When you're ready to deploy your migrations in a production environment, we also provide a helpful
`fix` command to convert your migrations into sequential order, while preserving the timestamp
ordering. We recommend running `fix` in the CI pipeline, and only when the migrations are ready for
production.

## Credit

The gopher mascot was designed by [Renée French](https://reneefrench.blogspot.com/) / [CC
3.0.](https://creativecommons.org/licenses/by/3.0/) For more info check out the [Go
Blog](https://go.dev/blog/gopher). Adapted by Ellen.

## License

Licensed under [MIT License](./LICENSE)
