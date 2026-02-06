package goose

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"text/template"
	"time"
)

type tmplVars struct {
	Version   string
	CamelName string
}

var (
	sequential = false
)

// SetSequential set whether to use sequential versioning instead of timestamp based versioning
func SetSequential(s bool) {
	sequential = s
}

// Create writes a new blank migration file.
func CreateWithTemplate(db *sql.DB, dir string, tmpl *template.Template, name, migrationType string) error {
	version := time.Now().UTC().Format(timestampFormat)

	if sequential {
		// always use DirFS here because it's modifying operation
		migrations, err := collectMigrationsFS(osFS{}, dir, minVersion, maxVersion, registeredGoMigrations)
		if err != nil && !errors.Is(err, ErrNoMigrationFiles) {
			return err
		}

		vMigrations, err := migrations.versioned()
		if err != nil {
			return err
		}

		if last, err := vMigrations.Last(); err == nil {
			version = fmt.Sprintf(seqVersionTemplate, last.Version+1)
		} else {
			version = fmt.Sprintf(seqVersionTemplate, int64(1))
		}
	}

	filename := fmt.Sprintf("%v_%v.%v", version, snakeCase(name), migrationType)

	if tmpl == nil {
		if migrationType == "go" {
			tmpl = goSQLMigrationTemplate
		} else {
			tmpl = sqlMigrationTemplate
		}
	}

	path := filepath.Join(dir, filename)
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		return fmt.Errorf("failed to create migration file: %w", err)
	}

	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create migration file: %w", err)
	}
	defer f.Close()

	vars := tmplVars{
		Version:   version,
		CamelName: camelCase(name),
	}
	if err := tmpl.Execute(f, vars); err != nil {
		return fmt.Errorf("failed to execute tmpl: %w", err)
	}

	log.Printf("Created new file: %s", f.Name())
	return nil
}

// Create writes a new blank migration file.
func Create(db *sql.DB, dir, name, migrationType string) error {
	return CreateWithTemplate(db, dir, nil, name, migrationType)
}

var sqlMigrationTemplate = template.Must(template.New("goose.sql-migration").Parse(`-- +goose Up
-- +goose StatementBegin
SELECT 'up SQL query';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 'down SQL query';
-- +goose StatementEnd
`))

var goSQLMigrationTemplate = template.Must(template.New("goose.go-migration").Parse(`package migrations

import (
	"context"
	"database/sql"
	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddMigrationContext(up{{.CamelName}}, down{{.CamelName}})
}

func up{{.CamelName}}(ctx context.Context, tx *sql.Tx) error {
	// This code is executed when the migration is applied.
	return nil
}

func down{{.CamelName}}(ctx context.Context, tx *sql.Tx) error {
	// This code is executed when the migration is rolled back.
	return nil
}
`))
