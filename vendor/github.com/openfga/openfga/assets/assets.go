// Package assets contains database migration scripts and test files
package assets

import "embed"

const (
	MySQLMigrationDir    = "migrations/mysql"
	PostgresMigrationDir = "migrations/postgres"
	SqliteMigrationDir   = "migrations/sqlite"
)

// EmbedMigrations within the openfga binary.
//
//go:embed migrations/*
var EmbedMigrations embed.FS

// EmbedPlayground within the openfga binary.
//
//go:embed playground/*
var EmbedPlayground embed.FS

// EmbedTests within the openfga binary.
//
//go:embed tests/*
var EmbedTests embed.FS
