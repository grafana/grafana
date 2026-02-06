package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/pressly/goose/v3/database/dialect"
	"github.com/pressly/goose/v3/internal/dialects"
)

// Dialect is the type of database dialect.
type Dialect string

const (
	DialectCustom     Dialect = ""
	DialectClickHouse Dialect = "clickhouse"
	DialectAuroraDSQL Dialect = "dsql"
	DialectMSSQL      Dialect = "mssql"
	DialectMySQL      Dialect = "mysql"
	DialectPostgres   Dialect = "postgres"
	DialectRedshift   Dialect = "redshift"
	DialectSQLite3    Dialect = "sqlite3"
	DialectStarrocks  Dialect = "starrocks"
	DialectTiDB       Dialect = "tidb"
	DialectTurso      Dialect = "turso"
	DialectYdB        Dialect = "ydb"

	// DEPRECATED: Vertica support is deprecated and will be removed in a future release.
	DialectVertica Dialect = "vertica"
)

// NewStore returns a new [Store] implementation for the given dialect.
func NewStore(d Dialect, tableName string) (Store, error) {
	if d == DialectCustom {
		return nil, errors.New("custom dialect is not supported")
	}
	lookup := map[Dialect]dialect.Querier{
		DialectClickHouse: dialects.NewClickhouse(),
		DialectAuroraDSQL: dialects.NewAuroraDSQL(),
		DialectMSSQL:      dialects.NewSqlserver(),
		DialectMySQL:      dialects.NewMysql(),
		DialectPostgres:   dialects.NewPostgres(),
		DialectRedshift:   dialects.NewRedshift(),
		DialectSQLite3:    dialects.NewSqlite3(),
		DialectStarrocks:  dialects.NewStarrocks(),
		DialectTiDB:       dialects.NewTidb(),
		DialectTurso:      dialects.NewTurso(),
		DialectVertica:    dialects.NewVertica(),
		DialectYdB:        dialects.NewYDB(),
	}
	querier, ok := lookup[d]
	if !ok {
		return nil, fmt.Errorf("unknown dialect: %q", d)
	}
	return NewStoreFromQuerier(tableName, querier)
}

// NewStoreFromQuerier returns a new [Store] implementation for the given querier.
//
// Most of the time you should use [NewStore] instead of this function, as it will automatically
// create a dialect-specific querier for you. This function is useful if you want to use a custom
// querier that is not part of the standard dialects.
func NewStoreFromQuerier(tableName string, querier dialect.Querier) (Store, error) {
	if tableName == "" {
		return nil, errors.New("table name must not be empty")
	}
	if querier == nil {
		return nil, errors.New("querier must not be nil")
	}
	return &store{
		tableName: tableName,
		querier:   newQueryController(querier),
	}, nil
}

type store struct {
	tableName string
	querier   *queryController
}

var _ Store = (*store)(nil)

func (s *store) Tablename() string {
	return s.tableName
}

func (s *store) CreateVersionTable(ctx context.Context, db DBTxConn) error {
	q := s.querier.CreateTable(s.tableName)
	if _, err := db.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("failed to create version table %q: %w", s.tableName, err)
	}
	return nil
}

func (s *store) Insert(ctx context.Context, db DBTxConn, req InsertRequest) error {
	q := s.querier.InsertVersion(s.tableName)
	if _, err := db.ExecContext(ctx, q, req.Version, true); err != nil {
		return fmt.Errorf("failed to insert version %d: %w", req.Version, err)
	}
	return nil
}

func (s *store) Delete(ctx context.Context, db DBTxConn, version int64) error {
	q := s.querier.DeleteVersion(s.tableName)
	if _, err := db.ExecContext(ctx, q, version); err != nil {
		return fmt.Errorf("failed to delete version %d: %w", version, err)
	}
	return nil
}

func (s *store) GetMigration(
	ctx context.Context,
	db DBTxConn,
	version int64,
) (*GetMigrationResult, error) {
	q := s.querier.GetMigrationByVersion(s.tableName)
	var result GetMigrationResult
	if err := db.QueryRowContext(ctx, q, version).Scan(
		&result.Timestamp,
		&result.IsApplied,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %d", ErrVersionNotFound, version)
		}
		return nil, fmt.Errorf("failed to get migration %d: %w", version, err)
	}
	return &result, nil
}

func (s *store) GetLatestVersion(ctx context.Context, db DBTxConn) (int64, error) {
	q := s.querier.GetLatestVersion(s.tableName)
	var version sql.NullInt64
	if err := db.QueryRowContext(ctx, q).Scan(&version); err != nil {
		return -1, fmt.Errorf("failed to get latest version: %w", err)
	}
	if !version.Valid {
		return -1, fmt.Errorf("latest %w", ErrVersionNotFound)
	}
	return version.Int64, nil
}

func (s *store) ListMigrations(
	ctx context.Context,
	db DBTxConn,
) ([]*ListMigrationsResult, error) {
	q := s.querier.ListMigrations(s.tableName)
	rows, err := db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("failed to list migrations: %w", err)
	}
	defer rows.Close()

	var migrations []*ListMigrationsResult
	for rows.Next() {
		var result ListMigrationsResult
		if err := rows.Scan(&result.Version, &result.IsApplied); err != nil {
			return nil, fmt.Errorf("failed to scan list migrations result: %w", err)
		}
		migrations = append(migrations, &result)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return migrations, nil
}

//
//
//
// Additional methods that are not part of the core Store interface, but are extended by the
// [controller.StoreController] type.
//
//
//

func (s *store) TableExists(ctx context.Context, db DBTxConn) (bool, error) {
	q := s.querier.TableExists(s.tableName)
	if q == "" {
		return false, errors.ErrUnsupported
	}
	var exists bool
	// Note, we do not pass the table name as an argument to the query, as the query should be
	// pre-defined by the dialect.
	if err := db.QueryRowContext(ctx, q).Scan(&exists); err != nil {
		return false, fmt.Errorf("failed to check if table exists: %w", err)
	}
	return exists, nil
}

var _ dialect.Querier = (*queryController)(nil)

type queryController struct{ dialect.Querier }

// newQueryController returns a new QueryController that wraps the given Querier.
func newQueryController(querier dialect.Querier) *queryController {
	return &queryController{Querier: querier}
}

// Optional methods

// TableExists returns the SQL query string to check if the version table exists. If the Querier
// does not implement this method, it will return an empty string.
//
// Returns a boolean value.
func (c *queryController) TableExists(tableName string) string {
	if t, ok := c.Querier.(interface{ TableExists(string) string }); ok {
		return t.TableExists(tableName)
	}
	return ""
}
