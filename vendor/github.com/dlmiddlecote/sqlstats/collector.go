package sqlstats

import (
	"database/sql"
)

const (
	namespace = "go_sql_stats"
	subsystem = "connections"
)

// StatsGetter is an interface that gets sql.DBStats.
// It's implemented by e.g. *sql.DB or *sqlx.DB.
type StatsGetter interface {
	Stats() sql.DBStats
}
