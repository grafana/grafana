package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/IBM/pgxpoolprometheus"
	sq "github.com/Masterminds/squirrel"
	"github.com/cenkalti/backoff/v4"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
)

var tracer = otel.Tracer("openfga/pkg/storage/postgres")

func startTrace(ctx context.Context, name string) (context.Context, trace.Span) {
	return tracer.Start(ctx, "postgres."+name)
}

// Datastore provides a PostgreSQL based implementation of [storage.OpenFGADatastore].
type Datastore struct {
	primaryDB                 *pgxpool.Pool
	secondaryDB               *pgxpool.Pool
	logger                    logger.Logger
	primaryDBStatsCollector   prometheus.Collector
	secondaryDBStatsCollector prometheus.Collector
	maxTuplesPerWriteField    int
	maxTypesPerModelField     int
	versionReady              bool
}

// Ensures that Datastore implements the OpenFGADatastore interface.
var _ storage.OpenFGADatastore = (*Datastore)(nil)

func parseConfig(uri string, override bool, cfg *sqlcommon.Config) (*pgxpool.Config, error) {
	c, err := pgxpool.ParseConfig(uri)
	if err != nil {
		return nil, fmt.Errorf("pgxpool parse postgres connection uri: %w", err)
	}

	if override {
		parsed, err := url.Parse(uri)
		if err != nil {
			return nil, fmt.Errorf("url parse postgres connection uri: %w", err)
		}

		if cfg.Username != "" {
			c.ConnConfig.User = cfg.Username
		} else if parsed.User != nil {
			c.ConnConfig.User = parsed.User.Username()
		}

		switch {
		case cfg.Password != "":
			c.ConnConfig.Password = cfg.Password
		case parsed.User != nil:
			if password, ok := parsed.User.Password(); ok {
				c.ConnConfig.Password = password
			}
		}
	}

	if cfg.MaxOpenConns != 0 {
		c.MaxConns = int32(cfg.MaxOpenConns)
	}

	if cfg.MinIdleConns != 0 {
		c.MinIdleConns = int32(cfg.MinIdleConns)
	}

	if cfg.MinOpenConns != 0 {
		c.MinConns = int32(cfg.MinOpenConns)
	}

	if cfg.ConnMaxLifetime != 0 {
		c.MaxConnLifetime = cfg.ConnMaxLifetime
		c.MaxConnLifetimeJitter = cfg.ConnMaxLifetime / 10 // Add 10% jitter to avoid thundering herd
	}
	if cfg.ConnMaxIdleTime != 0 {
		c.MaxConnIdleTime = cfg.ConnMaxIdleTime
	}
	return c, nil
}

// initDB initializes a new postgres database connection.
func initDB(uri string, override bool, cfg *sqlcommon.Config) (*pgxpool.Pool, error) {
	c, err := parseConfig(uri, override, cfg)
	if err != nil {
		return nil, err
	}

	db, err := pgxpool.NewWithConfig(context.Background(), c)
	if err != nil {
		return nil, fmt.Errorf("failed to establish connection: %w", err)
	}

	return db, nil
}

// New creates a new [Datastore] storage.
func New(uri string, cfg *sqlcommon.Config) (*Datastore, error) {
	primaryDB, err := initDB(uri, cfg.Username != "" || cfg.Password != "", cfg)
	if err != nil {
		return nil, fmt.Errorf("initialize postgres connection: %w", err)
	}

	var secondaryDB *pgxpool.Pool
	if cfg.SecondaryURI != "" {
		secondaryDB, err = initDB(cfg.SecondaryURI, cfg.SecondaryUsername != "" || cfg.SecondaryPassword != "", cfg)
		if err != nil {
			return nil, fmt.Errorf("initialize postgres connection: %w", err)
		}
	}

	return NewWithDB(primaryDB, secondaryDB, cfg)
}

func configureDB(db *pgxpool.Pool, cfg *sqlcommon.Config, dbName string) (prometheus.Collector, error) {
	policy := backoff.NewExponentialBackOff()
	policy.MaxElapsedTime = 1 * time.Minute
	attempt := 1
	err := backoff.Retry(func() error {
		err := db.Ping(context.Background())
		if err != nil {
			cfg.Logger.Info("waiting for database", zap.Int("attempt", attempt))
			attempt++
			return err
		}
		return nil
	}, policy)
	if err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	var collector prometheus.Collector

	if cfg.ExportMetrics {
		collector = pgxpoolprometheus.NewCollector(db, map[string]string{"db_name": dbName})
		if err := prometheus.Register(collector); err != nil {
			return nil, fmt.Errorf("initialize metrics: %w", err)
		}
	}

	return collector, nil
}

// NewWithDB creates a new [Datastore] storage with the provided database connection.
func NewWithDB(primaryDB, secondaryDB *pgxpool.Pool, cfg *sqlcommon.Config) (*Datastore, error) {
	primaryCollector, err := configureDB(primaryDB, cfg, "openfga")
	if err != nil {
		return nil, fmt.Errorf("configure primary db: %w", err)
	}

	var secondaryCollector prometheus.Collector
	if secondaryDB != nil {
		secondaryCollector, err = configureDB(secondaryDB, cfg, "openfga_secondary")
		if err != nil {
			return nil, fmt.Errorf("configure secondary db: %w", err)
		}
	}

	return &Datastore{
		primaryDB:                 primaryDB,
		secondaryDB:               secondaryDB,
		logger:                    cfg.Logger,
		primaryDBStatsCollector:   primaryCollector,
		secondaryDBStatsCollector: secondaryCollector,
		maxTuplesPerWriteField:    cfg.MaxTuplesPerWriteField,
		maxTypesPerModelField:     cfg.MaxTypesPerModelField,
		versionReady:              false,
	}, nil
}

func (s *Datastore) isSecondaryConfigured() bool {
	return s.secondaryDB != nil
}

// Close see [storage.OpenFGADatastore].Close.
func (s *Datastore) Close() {
	if s.primaryDBStatsCollector != nil {
		prometheus.Unregister(s.primaryDBStatsCollector)
	}
	s.primaryDB.Close()
	if s.isSecondaryConfigured() {
		if s.secondaryDBStatsCollector != nil {
			prometheus.Unregister(s.secondaryDBStatsCollector)
		}
		s.secondaryDB.Close()
	}
}

// getPgxPool returns the pgxpool.Pool based on consistency options.
func (s *Datastore) getPgxPool(consistency openfgav1.ConsistencyPreference) *pgxpool.Pool {
	if consistency == openfgav1.ConsistencyPreference_HIGHER_CONSISTENCY {
		// If we are using higher consistency, we need to use the write database.
		return s.primaryDB
	}
	if s.isSecondaryConfigured() {
		// If we are using lower consistency, we can use the read database.
		return s.secondaryDB
	}
	// If we are not using a secondary database, we can only use the primary database.
	return s.primaryDB
}

// Read see [storage.RelationshipTupleReader].Read.
func (s *Datastore) Read(
	ctx context.Context,
	store string,
	filter storage.ReadFilter,
	options storage.ReadOptions,
) (storage.TupleIterator, error) {
	ctx, span := startTrace(ctx, "Read")
	defer span.End()

	readPool := s.getPgxPool(options.Consistency.Preference)
	return s.read(ctx, store, filter, nil, readPool)
}

// ReadPage see [storage.RelationshipTupleReader].ReadPage.
func (s *Datastore) ReadPage(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadPageOptions) ([]*openfgav1.Tuple, string, error) {
	ctx, span := startTrace(ctx, "ReadPage")
	defer span.End()

	readPool := s.getPgxPool(options.Consistency.Preference)
	iter, err := s.read(ctx, store, filter, &options, readPool)
	if err != nil {
		return nil, "", err
	}
	defer iter.Stop()

	return iter.ToArray(ctx, options.Pagination)
}

func (s *Datastore) read(ctx context.Context, store string, filter storage.ReadFilter, options *storage.ReadPageOptions, db *pgxpool.Pool) (*sqlcommon.SQLTupleIterator, error) {
	_, span := startTrace(ctx, "read")
	defer span.End()

	sb := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select(
			"store", "object_type", "object_id", "relation",
			"_user",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{"store": store})
	if options != nil {
		sb = sb.OrderBy("ulid")
	}

	objectType, objectID := tupleUtils.SplitObject(filter.Object)
	if objectType != "" {
		sb = sb.Where(sq.Eq{"object_type": objectType})
	}
	if objectID != "" {
		sb = sb.Where(sq.Eq{"object_id": objectID})
	}
	if filter.Relation != "" {
		sb = sb.Where(sq.Eq{"relation": filter.Relation})
	}
	if filter.User != "" {
		userType, userID, _ := tupleUtils.ToUserParts(filter.User)
		if userID != "" {
			sb = sb.Where(sq.Eq{"_user": filter.User})
		} else {
			sb = sb.Where(sq.Like{"_user": userType + ":%"})
		}
	}

	if len(filter.Conditions) > 0 {
		// Use COALESCE to treat NULL and '' as the same value (empty string).
		// This allows filtering for "no condition" (e.g., filter.Conditions = [""])
		// to correctly match rows where condition_name is either '' OR NULL.
		sb = sb.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}

	if options != nil && options.Pagination.From != "" {
		sb = sb.Where(sq.GtOrEq{"ulid": options.Pagination.From})
	}
	if options != nil && options.Pagination.PageSize != 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	poolGetRows, err := NewPgxTxnGetRows(db, sb)
	if err != nil {
		return nil, HandleSQLError(err)
	}

	return sqlcommon.NewSQLTupleIterator(poolGetRows, HandleSQLError), nil
}

// Write see [storage.RelationshipTupleWriter].Write.
func (s *Datastore) Write(
	ctx context.Context,
	store string,
	deletes storage.Deletes,
	writes storage.Writes,
	opts ...storage.TupleWriteOption,
) error {
	ctx, span := startTrace(ctx, "Write")
	defer span.End()
	return s.write(ctx, store, deletes, writes, storage.NewTupleWriteOptions(opts...), time.Now().UTC())
}

// execute SELECT … FOR UPDATE statement for all the rows indicated by the lockKeys
// return a map of all the existing keys.
func selectAllExistingRowsForUpdate(ctx context.Context,
	lockKeys []sqlcommon.TupleLockKey,
	txn PgxQuery,
	store string) (map[string]*openfgav1.Tuple, error) {
	total := len(lockKeys)
	stbl := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)
	existing := make(map[string]*openfgav1.Tuple, total)

	for start := 0; start < total; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > total {
			end = total
		}
		keys := lockKeys[start:end]

		if err := selectExistingRowsForWrite(ctx, stbl, txn, store, keys, existing); err != nil {
			return nil, err
		}
	}
	return existing, nil
}

// For the prepared deleteConditions, execute delete tuples.
func executeDeleteTuples(ctx context.Context, txn PgxExec, store string, deleteConditions sq.Or) error {
	stbl := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	for start, totalDeletes := 0, len(deleteConditions); start < totalDeletes; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalDeletes {
			end = totalDeletes
		}

		deleteConditionsBatch := deleteConditions[start:end]

		stmt, args, err := stbl.Delete("tuple").Where(sq.Eq{"store": store}).
			Where(deleteConditionsBatch).ToSql()
		if err != nil {
			// Should never happen because we craft the delete statement
			return HandleSQLError(err)
		}

		res, err := txn.Exec(ctx, stmt, args...)
		if err != nil {
			return HandleSQLError(err)
		}
		rowsAffected := res.RowsAffected()

		if rowsAffected != int64(len(deleteConditionsBatch)) {
			// If we deleted fewer rows than planned (after read before write), means we hit a race condition - someone else deleted the same row(s).
			return storage.ErrWriteConflictOnDelete
		}
	}
	return nil
}

// For the prepared writeItems, execute insert writeItems.
func executeWriteTuples(ctx context.Context, txn PgxExec, writeItems [][]interface{}) error {
	stbl := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	for start, totalWrites := 0, len(writeItems); start < totalWrites; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalWrites {
			end = totalWrites
		}

		writesBatch := writeItems[start:end]

		insertBuilder := stbl.
			Insert("tuple").
			Columns(
				"store",
				"object_type",
				"object_id",
				"relation",
				"_user",
				"user_type",
				"condition_name",
				"condition_context",
				"ulid",
				"inserted_at",
			)

		for _, item := range writesBatch {
			insertBuilder = insertBuilder.Values(item...)
		}

		stmt, args, err := insertBuilder.ToSql()
		if err != nil {
			// Should never happen because we craft the insert statement
			return HandleSQLError(err)
		}

		_, err = txn.Exec(ctx, stmt, args...)
		if err != nil {
			dberr := HandleSQLError(err)
			if errors.Is(dberr, storage.ErrCollision) {
				// ErrCollision is returned on duplicate write (constraint violation), meaning we hit a race condition - someone else inserted the same row(s).
				return storage.ErrWriteConflictOnInsert
			}
			return dberr
		}
	}
	return nil
}

func executeInsertChanges(ctx context.Context, txn PgxExec, changeLogItems [][]interface{}) error {
	stbl := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)
	for start, totalItems := 0, len(changeLogItems); start < totalItems; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalItems {
			end = totalItems
		}

		changeLogBatch := changeLogItems[start:end]

		changelogBuilder := stbl.
			Insert("changelog").
			Columns(
				"store",
				"object_type",
				"object_id",
				"relation",
				"_user",
				"condition_name",
				"condition_context",
				"operation",
				"ulid",
				"inserted_at",
			)

		for _, item := range changeLogBatch {
			changelogBuilder = changelogBuilder.Values(item...)
		}

		stmt, args, err := changelogBuilder.ToSql()
		if err != nil {
			// Should never happen because we craft the insert statement
			return HandleSQLError(err)
		}

		_, err = txn.Exec(ctx, stmt, args...)

		if err != nil {
			return HandleSQLError(err)
		}
	}
	return nil
}

func (s *Datastore) write(
	ctx context.Context,
	store string,
	deletes storage.Deletes,
	writes storage.Writes,
	opts storage.TupleWriteOptions,
	now time.Time,
) error {
	txn, err := s.primaryDB.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return HandleSQLError(err)
	}
	// Important - use the same txn (instead of via db) to ensure all works are done as a transaction

	defer func() { _ = txn.Rollback(ctx) }()

	// 2. Compile a SELECT … FOR UPDATE statement to read the tuples for writes and lock tuples for deletes
	// Build a deduped, sorted list of keys to lock.
	lockKeys := sqlcommon.MakeTupleLockKeys(deletes, writes)

	if len(lockKeys) == 0 {
		// Nothing to do.
		return nil
	}

	// 3. If list compiled in step 2 is not empty, execute SELECT … FOR UPDATE statement
	existing, err := selectAllExistingRowsForUpdate(ctx, lockKeys, txn, store)
	if err != nil {
		return err
	}

	// 4. Construct the deleteConditions, write and changelog items to be written
	deleteConditions, writeItems, changeLogItems, err := sqlcommon.GetDeleteWriteChangelogItems(store, existing,
		sqlcommon.WriteData{
			Deletes: deletes,
			Writes:  writes,
			Opts:    opts,
			Now:     now,
		})
	if err != nil {
		return err
	}

	err = executeDeleteTuples(ctx, txn, store, deleteConditions)
	if err != nil {
		return err
	}

	err = executeWriteTuples(ctx, txn, writeItems)
	if err != nil {
		return err
	}

	// 5. Execute INSERT changelog statements
	err = executeInsertChanges(ctx, txn, changeLogItems)
	if err != nil {
		return err
	}

	// 6. Commit Transaction
	if err := txn.Commit(ctx); err != nil {
		return HandleSQLError(err)
	}

	return nil
}

// ReadUserTuple see [storage.RelationshipTupleReader].ReadUserTuple.
func (s *Datastore) ReadUserTuple(ctx context.Context, store string, filter storage.ReadUserTupleFilter, options storage.ReadUserTupleOptions) (*openfgav1.Tuple, error) {
	ctx, span := startTrace(ctx, "ReadUserTuple")
	defer span.End()

	readStbl := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)
	objectType, objectID := tupleUtils.SplitObject(filter.Object)
	userType := tupleUtils.GetUserTypeFromUser(filter.User)

	var conditionName sql.NullString
	var conditionContext []byte
	var record storage.TupleRecord

	stbl := readStbl.
		Select(
			"object_type", "object_id", "relation",
			"_user",
			"condition_name", "condition_context",
		).
		From("tuple").
		Where(sq.Eq{
			"store":       store,
			"object_type": objectType,
			"object_id":   objectID,
			"relation":    filter.Relation,
			"_user":       filter.User,
			"user_type":   userType,
		})

	if len(filter.Conditions) > 0 {
		stbl = stbl.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}
	stmt, args, err := stbl.ToSql()
	if err != nil {
		return nil, HandleSQLError(err)
	}
	db := s.getPgxPool(options.Consistency.Preference)
	row := db.QueryRow(ctx, stmt, args...)

	err = row.Scan(
		&record.ObjectType,
		&record.ObjectID,
		&record.Relation,
		&record.User,
		&conditionName,
		&conditionContext,
	)

	if err != nil {
		return nil, HandleSQLError(err)
	}

	if conditionName.String != "" {
		record.ConditionName = conditionName.String

		if conditionContext != nil {
			var conditionContextStruct structpb.Struct
			if err := proto.Unmarshal(conditionContext, &conditionContextStruct); err != nil {
				return nil, err
			}
			record.ConditionContext = &conditionContextStruct
		}
	}

	return record.AsTuple(), nil
}

// ReadUsersetTuples see [storage.RelationshipTupleReader].ReadUsersetTuples.
func (s *Datastore) ReadUsersetTuples(
	ctx context.Context,
	store string,
	filter storage.ReadUsersetTuplesFilter,
	options storage.ReadUsersetTuplesOptions,
) (storage.TupleIterator, error) {
	_, span := startTrace(ctx, "ReadUsersetTuples")
	defer span.End()

	db := s.getPgxPool(options.Consistency.Preference)
	sb := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select(
			"store", "object_type", "object_id", "relation",
			"_user",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{"store": store}).
		Where(sq.Eq{"user_type": tupleUtils.UserSet})

	objectType, objectID := tupleUtils.SplitObject(filter.Object)
	if objectType != "" {
		sb = sb.Where(sq.Eq{"object_type": objectType})
	}
	if objectID != "" {
		sb = sb.Where(sq.Eq{"object_id": objectID})
	}
	if filter.Relation != "" {
		sb = sb.Where(sq.Eq{"relation": filter.Relation})
	}
	if len(filter.AllowedUserTypeRestrictions) > 0 {
		orConditions := sq.Or{}
		for _, userset := range filter.AllowedUserTypeRestrictions {
			if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Relation); ok {
				orConditions = append(orConditions, sq.Like{
					"_user": userset.GetType() + ":%#" + userset.GetRelation(),
				})
			}
			if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Wildcard); ok {
				orConditions = append(orConditions, sq.Eq{
					"_user": userset.GetType() + ":*",
				})
			}
		}
		sb = sb.Where(orConditions)
	}
	if len(filter.Conditions) > 0 {
		sb = sb.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}

	poolGetRows, err := NewPgxTxnGetRows(db, sb)
	if err != nil {
		return nil, HandleSQLError(err)
	}

	return sqlcommon.NewSQLTupleIterator(poolGetRows, HandleSQLError), nil
}

// ReadStartingWithUser see [storage.RelationshipTupleReader].ReadStartingWithUser.
func (s *Datastore) ReadStartingWithUser(
	ctx context.Context,
	store string,
	filter storage.ReadStartingWithUserFilter,
	options storage.ReadStartingWithUserOptions,
) (storage.TupleIterator, error) {
	_, span := startTrace(ctx, "ReadStartingWithUser")
	defer span.End()

	db := s.getPgxPool(options.Consistency.Preference)
	readStbl := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)
	var targetUsersArg []string
	for _, u := range filter.UserFilter {
		targetUser := u.GetObject()
		if u.GetRelation() != "" {
			targetUser = strings.Join([]string{u.GetObject(), u.GetRelation()}, "#")
		}
		targetUsersArg = append(targetUsersArg, targetUser)
	}

	builder := readStbl.
		Select(
			"store", "object_type", "object_id", "relation",
			"_user",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{
			"store":       store,
			"object_type": filter.ObjectType,
			"relation":    filter.Relation,
			"_user":       targetUsersArg,
		}).OrderBy("object_id collate \"C\"")

	if filter.ObjectIDs != nil && filter.ObjectIDs.Size() > 0 {
		builder = builder.Where(sq.Eq{"object_id": filter.ObjectIDs.Values()})
	}
	if len(filter.Conditions) > 0 {
		builder = builder.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}
	poolGetRows, err := NewPgxTxnGetRows(db, builder)
	if err != nil {
		return nil, HandleSQLError(err)
	}
	return sqlcommon.NewSQLTupleIterator(poolGetRows, HandleSQLError), nil
}

// MaxTuplesPerWrite see [storage.RelationshipTupleWriter].MaxTuplesPerWrite.
func (s *Datastore) MaxTuplesPerWrite() int {
	return s.maxTuplesPerWriteField
}

// ReadAuthorizationModel see [storage.AuthorizationModelReadBackend].ReadAuthorizationModel.
func (s *Datastore) ReadAuthorizationModel(ctx context.Context, store string, modelID string) (*openfgav1.AuthorizationModel, error) {
	ctx, span := startTrace(ctx, "ReadAuthorizationModel")
	defer span.End()

	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)
	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select("authorization_model_id", "schema_version", "type", "type_definition", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{
			"store":                  store,
			"authorization_model_id": modelID,
		}).ToSql()
	if err != nil {
		return nil, HandleSQLError(err)
	}

	rows, err := db.Query(ctx, stmt, args...)
	if err != nil {
		return nil, HandleSQLError(err)
	}
	defer rows.Close()
	ret, err := sqlcommon.ConstructAuthorizationModelFromSQLRows(&pgxRowsWrapper{rows})
	if err != nil {
		return nil, HandleSQLError(err)
	}

	return ret, nil
}

// ReadAuthorizationModels see [storage.AuthorizationModelReadBackend].ReadAuthorizationModels.
func (s *Datastore) ReadAuthorizationModels(ctx context.Context, store string, options storage.ReadAuthorizationModelsOptions) ([]*openfgav1.AuthorizationModel, string, error) {
	ctx, span := startTrace(ctx, "ReadAuthorizationModels")
	defer span.End()

	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)

	sb := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select("authorization_model_id").
		Distinct().
		From("authorization_model").
		Where(sq.Eq{"store": store}).
		OrderBy("authorization_model_id desc")

	if options.Pagination.From != "" {
		sb = sb.Where(sq.LtOrEq{"authorization_model_id": options.Pagination.From})
	}
	if options.Pagination.PageSize > 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	stmt, args, err := sb.ToSql()
	if err != nil {
		return nil, "", HandleSQLError(err)
	}

	rows, err := db.Query(ctx, stmt, args...)
	if err != nil {
		return nil, "", HandleSQLError(err)
	}

	defer rows.Close()

	var modelIDs []string
	var modelID string

	for rows.Next() {
		err = rows.Scan(&modelID)
		if err != nil {
			return nil, "", HandleSQLError(err)
		}

		modelIDs = append(modelIDs, modelID)
	}

	if err := rows.Err(); err != nil {
		return nil, "", HandleSQLError(err)
	}

	var token string
	numModelIDs := len(modelIDs)
	if len(modelIDs) > options.Pagination.PageSize {
		numModelIDs = options.Pagination.PageSize
		token = modelID
	}

	// TODO: make this concurrent with a maximum of 5 goroutines. This may be helpful:
	// https://stackoverflow.com/questions/25306073/always-have-x-number-of-goroutines-running-at-any-time
	models := make([]*openfgav1.AuthorizationModel, 0, numModelIDs)
	// We use numModelIDs here to avoid retrieving possibly one extra model.
	for i := 0; i < numModelIDs; i++ {
		model, err := s.ReadAuthorizationModel(ctx, store, modelIDs[i])
		if err != nil {
			return nil, "", err
		}
		models = append(models, model)
	}

	return models, token, nil
}

// FindLatestAuthorizationModel see [storage.AuthorizationModelReadBackend].FindLatestAuthorizationModel.
func (s *Datastore) FindLatestAuthorizationModel(ctx context.Context, store string) (*openfgav1.AuthorizationModel, error) {
	ctx, span := startTrace(ctx, "FindLatestAuthorizationModel")
	defer span.End()

	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)
	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select("authorization_model_id", "schema_version", "type", "type_definition", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{"store": store}).
		OrderBy("authorization_model_id desc").ToSql()
	if err != nil {
		return nil, HandleSQLError(err)
	}
	rows, err := db.Query(ctx, stmt, args...)
	if err != nil {
		return nil, HandleSQLError(err)
	}
	defer rows.Close()
	ret, err := sqlcommon.ConstructAuthorizationModelFromSQLRows(&pgxRowsWrapper{rows})
	if err != nil {
		return nil, HandleSQLError(err)
	}

	return ret, nil
}

// MaxTypesPerAuthorizationModel see [storage.TypeDefinitionWriteBackend].MaxTypesPerAuthorizationModel.
func (s *Datastore) MaxTypesPerAuthorizationModel() int {
	return s.maxTypesPerModelField
}

// WriteAuthorizationModel see [storage.TypeDefinitionWriteBackend].WriteAuthorizationModel.
func (s *Datastore) WriteAuthorizationModel(ctx context.Context, store string, model *openfgav1.AuthorizationModel) error {
	ctx, span := startTrace(ctx, "WriteAuthorizationModel")
	defer span.End()

	schemaVersion := model.GetSchemaVersion()
	typeDefinitions := model.GetTypeDefinitions()

	if len(typeDefinitions) < 1 {
		return nil
	}

	pbdata, err := proto.Marshal(model)
	if err != nil {
		return err
	}

	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Insert("authorization_model").
		Columns("store", "authorization_model_id", "schema_version", "type", "type_definition", "serialized_protobuf").
		Values(store, model.GetId(), schemaVersion, "", nil, pbdata).
		ToSql()
	if err != nil {
		return HandleSQLError(err)
	}
	_, err = s.primaryDB.Exec(ctx, stmt, args...)
	if err != nil {
		return HandleSQLError(err)
	}

	return nil
}

// CreateStore adds a new store to storage.
func (s *Datastore) CreateStore(ctx context.Context, store *openfgav1.Store) (*openfgav1.Store, error) {
	ctx, span := startTrace(ctx, "CreateStore")
	defer span.End()

	var id, name string
	var createdAt, updatedAt time.Time

	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Insert("store").
		Columns("id", "name", "created_at", "updated_at").
		Values(store.GetId(), store.GetName(), sq.Expr("NOW()"), sq.Expr("NOW()")).
		Suffix("returning id, name, created_at, updated_at").ToSql()

	if err != nil {
		return nil, HandleSQLError(err)
	}

	row := s.primaryDB.QueryRow(ctx, stmt, args...)
	err = row.Scan(&id, &name, &createdAt, &updatedAt)

	if err != nil {
		return nil, HandleSQLError(err)
	}

	return &openfgav1.Store{
		Id:        id,
		Name:      name,
		CreatedAt: timestamppb.New(createdAt),
		UpdatedAt: timestamppb.New(updatedAt),
	}, nil
}

// GetStore retrieves the details of a specific store using its storeID.
func (s *Datastore) GetStore(ctx context.Context, id string) (*openfgav1.Store, error) {
	ctx, span := startTrace(ctx, "GetStore")
	defer span.End()

	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)
	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select("id", "name", "created_at", "updated_at").
		From("store").
		Where(sq.Eq{
			"id":         id,
			"deleted_at": nil,
		}).ToSql()

	if err != nil {
		return nil, HandleSQLError(err)
	}

	row := db.QueryRow(ctx, stmt, args...)

	var storeID, name string
	var createdAt, updatedAt time.Time
	err = row.Scan(&storeID, &name, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, storage.ErrNotFound
		}
		return nil, HandleSQLError(err)
	}

	return &openfgav1.Store{
		Id:        storeID,
		Name:      name,
		CreatedAt: timestamppb.New(createdAt),
		UpdatedAt: timestamppb.New(updatedAt),
	}, nil
}

// ListStores provides a paginated list of all stores present in the storage.
func (s *Datastore) ListStores(ctx context.Context, options storage.ListStoresOptions) ([]*openfgav1.Store, string, error) {
	ctx, span := startTrace(ctx, "ListStores")
	defer span.End()

	whereClause := sq.And{
		sq.Eq{"deleted_at": nil},
	}

	if len(options.IDs) > 0 {
		whereClause = append(whereClause, sq.Eq{"id": options.IDs})
	}

	if options.Name != "" {
		whereClause = append(whereClause, sq.Eq{"name": options.Name})
	}

	if options.Pagination.From != "" {
		whereClause = append(whereClause, sq.GtOrEq{"id": options.Pagination.From})
	}

	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)
	sb := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select("id", "name", "created_at", "updated_at").
		From("store").
		Where(whereClause).
		OrderBy("id")

	if options.Pagination.PageSize > 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	stmt, args, err := sb.ToSql()
	if err != nil {
		return nil, "", HandleSQLError(err)
	}

	rows, err := db.Query(ctx, stmt, args...)
	if err != nil {
		return nil, "", HandleSQLError(err)
	}
	defer rows.Close()

	var stores []*openfgav1.Store
	var id string
	for rows.Next() {
		var name string
		var createdAt, updatedAt time.Time
		err := rows.Scan(&id, &name, &createdAt, &updatedAt)
		if err != nil {
			return nil, "", HandleSQLError(err)
		}

		stores = append(stores, &openfgav1.Store{
			Id:        id,
			Name:      name,
			CreatedAt: timestamppb.New(createdAt),
			UpdatedAt: timestamppb.New(updatedAt),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, "", HandleSQLError(err)
	}

	if len(stores) > options.Pagination.PageSize {
		return stores[:options.Pagination.PageSize], id, nil
	}

	return stores, "", nil
}

// DeleteStore removes a store from storage.
func (s *Datastore) DeleteStore(ctx context.Context, id string) error {
	ctx, span := startTrace(ctx, "DeleteStore")
	defer span.End()

	db := s.primaryDB
	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Update("store").
		Set("deleted_at", sq.Expr("NOW()")).
		Where(sq.Eq{"id": id}).ToSql()
	if err != nil {
		return HandleSQLError(err)
	}

	_, err = db.Exec(ctx, stmt, args...)
	if err != nil {
		return HandleSQLError(err)
	}

	return nil
}

// WriteAssertions see [storage.AssertionsBackend].WriteAssertions.
func (s *Datastore) WriteAssertions(ctx context.Context, store, modelID string, assertions []*openfgav1.Assertion) error {
	ctx, span := startTrace(ctx, "WriteAssertions")
	defer span.End()

	marshalledAssertions, err := proto.Marshal(&openfgav1.Assertions{Assertions: assertions})
	if err != nil {
		return err
	}

	db := s.primaryDB

	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Insert("assertion").
		Columns("store", "authorization_model_id", "assertions").
		Values(store, modelID, marshalledAssertions).
		Suffix("ON CONFLICT (store, authorization_model_id) DO UPDATE SET assertions = ?", marshalledAssertions).
		ToSql()
	if err != nil {
		return HandleSQLError(err)
	}
	_, err = db.Exec(ctx, stmt, args...)
	if err != nil {
		return HandleSQLError(err)
	}

	return nil
}

// ReadAssertions see [storage.AssertionsBackend].ReadAssertions.
func (s *Datastore) ReadAssertions(ctx context.Context, store, modelID string) ([]*openfgav1.Assertion, error) {
	ctx, span := startTrace(ctx, "ReadAssertions")
	defer span.End()

	var marshalledAssertions []byte
	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)

	stmt, args, err := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select("assertions").
		From("assertion").
		Where(sq.Eq{
			"store":                  store,
			"authorization_model_id": modelID,
		}).ToSql()

	if err != nil {
		return nil, HandleSQLError(err)
	}

	err = db.QueryRow(ctx, stmt, args...).Scan(&marshalledAssertions)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []*openfgav1.Assertion{}, nil
		}
		return nil, HandleSQLError(err)
	}

	var assertions openfgav1.Assertions
	err = proto.Unmarshal(marshalledAssertions, &assertions)
	if err != nil {
		return nil, err
	}

	return assertions.GetAssertions(), nil
}

// ReadChanges see [storage.ChangelogBackend].ReadChanges.
func (s *Datastore) ReadChanges(ctx context.Context, store string, filter storage.ReadChangesFilter, options storage.ReadChangesOptions) ([]*openfgav1.TupleChange, string, error) {
	ctx, span := startTrace(ctx, "ReadChanges")
	defer span.End()

	objectTypeFilter := filter.ObjectType
	horizonOffset := filter.HorizonOffset

	orderBy := "ulid asc"
	if options.SortDesc {
		orderBy = "ulid desc"
	}
	db := s.getPgxPool(openfgav1.ConsistencyPreference_MINIMIZE_LATENCY)

	sb := sq.StatementBuilder.PlaceholderFormat(sq.Dollar).
		Select(
			"ulid", "object_type", "object_id", "relation",
			"_user",
			"operation",
			"condition_name", "condition_context", "inserted_at",
		).
		From("changelog").
		Where(sq.Eq{"store": store}).
		Where(fmt.Sprintf("inserted_at < NOW() - interval '%dms'", horizonOffset.Milliseconds())).
		OrderBy(orderBy)

	if objectTypeFilter != "" {
		sb = sb.Where(sq.Eq{"object_type": objectTypeFilter})
	}
	if options.Pagination.From != "" {
		sb = sqlcommon.AddFromUlid(sb, options.Pagination.From, options.SortDesc)
	}
	if options.Pagination.PageSize > 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize)) // + 1 is NOT used here as we always return a continuation token.
	}

	stmt, args, err := sb.ToSql()
	if err != nil {
		return nil, "", HandleSQLError(err)
	}

	rows, err := db.Query(ctx, stmt, args...)
	if err != nil {
		return nil, "", HandleSQLError(err)
	}
	defer rows.Close()

	var changes []*openfgav1.TupleChange
	var ulid string
	for rows.Next() {
		var objectType, objectID, relation, user string
		var operation int
		var insertedAt time.Time
		var conditionName sql.NullString
		var conditionContext []byte

		err = rows.Scan(
			&ulid,
			&objectType,
			&objectID,
			&relation,
			&user,
			&operation,
			&conditionName,
			&conditionContext,
			&insertedAt,
		)
		if err != nil {
			return nil, "", HandleSQLError(err)
		}

		var conditionContextStruct structpb.Struct
		if conditionName.String != "" {
			if conditionContext != nil {
				if err := proto.Unmarshal(conditionContext, &conditionContextStruct); err != nil {
					return nil, "", err
				}
			}
		}

		tk := tupleUtils.NewTupleKeyWithCondition(
			tupleUtils.BuildObject(objectType, objectID),
			relation,
			user,
			conditionName.String,
			&conditionContextStruct,
		)

		changes = append(changes, &openfgav1.TupleChange{
			TupleKey:  tk,
			Operation: openfgav1.TupleOperation(operation),
			Timestamp: timestamppb.New(insertedAt.UTC()),
		})
	}

	if len(changes) == 0 {
		return nil, "", storage.ErrNotFound
	}

	return changes, ulid, nil
}

func isDBReady(ctx context.Context, versionReady bool, db *pgxpool.Pool) (storage.ReadinessStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	err := db.Ping(ctx)
	if err != nil {
		return storage.ReadinessStatus{}, err
	}

	sqlDB := stdlib.OpenDBFromPool(db)
	defer func() {
		_ = sqlDB.Close()
	}()
	return sqlcommon.IsVersionReady(ctx, versionReady, sqlDB)
}

// IsReady see [sqlcommon.IsReady].
func (s *Datastore) IsReady(ctx context.Context) (storage.ReadinessStatus, error) {
	primaryStatus, err := isDBReady(ctx, s.versionReady, s.primaryDB)
	if err != nil {
		return primaryStatus, err
	}

	// if secondary is not configured, return primary status only
	if !s.isSecondaryConfigured() {
		s.versionReady = primaryStatus.IsReady
		return primaryStatus, nil
	}

	if primaryStatus.IsReady && primaryStatus.Message == "" {
		primaryStatus.Message = "ready"
	}

	secondaryStatus, err := isDBReady(ctx, s.versionReady, s.secondaryDB)
	if err != nil {
		secondaryStatus.Message = err.Error()
		secondaryStatus.IsReady = false
	}

	if secondaryStatus.IsReady && secondaryStatus.Message == "" {
		secondaryStatus.Message = "ready"
	}

	multipleReadyStatus := storage.ReadinessStatus{}
	messageTpl := "primary: %s, secondary: %s"
	multipleReadyStatus.IsReady = primaryStatus.IsReady && secondaryStatus.IsReady
	multipleReadyStatus.Message = fmt.Sprintf(messageTpl, primaryStatus.Message, secondaryStatus.Message)

	s.versionReady = multipleReadyStatus.IsReady

	return multipleReadyStatus, nil
}

// HandleSQLError processes an SQL error and converts it into a more
// specific error type based on the nature of the SQL error.
func HandleSQLError(err error, args ...interface{}) error {
	if errors.Is(err, sql.ErrNoRows) {
		return storage.ErrNotFound
	}

	if strings.Contains(err.Error(), "duplicate key value") {
		if len(args) > 0 {
			if tk, ok := args[0].(*openfgav1.TupleKey); ok {
				return storage.InvalidWriteInputError(tk, openfgav1.TupleOperation_TUPLE_OPERATION_WRITE)
			}
		}
		return storage.ErrCollision
	}

	return fmt.Errorf("sql error: %w", err)
}

// selectExistingRowsForWrite selects existing rows for the given keys and locks them FOR UPDATE.
// The existing rows are added to the existing map.
func selectExistingRowsForWrite(ctx context.Context, stbl sq.StatementBuilderType, txn PgxQuery, store string, keys []sqlcommon.TupleLockKey, existing map[string]*openfgav1.Tuple) error {
	inExpr, args := sqlcommon.BuildRowConstructorIN(keys)

	sb := stbl.
		Select(sqlcommon.SQLIteratorColumns()...).
		From("tuple").
		Where(sq.Eq{"store": store}).
		// Row-constructor IN on full composite key for precise point locks.
		Where(sq.Expr("(object_type, object_id, relation, _user, user_type) IN "+inExpr, args...)).
		Suffix("FOR UPDATE")

	poolGetRows, err := NewPgxTxnGetRows(txn, sb)
	if err != nil {
		return HandleSQLError(err)
	}

	iter := sqlcommon.NewSQLTupleIterator(poolGetRows, HandleSQLError)
	defer iter.Stop()

	items, _, err := iter.ToArray(ctx, storage.PaginationOptions{PageSize: len(keys)})

	if err != nil {
		return err
	}
	for _, tuple := range items {
		existing[tupleUtils.TupleKeyToString(tuple.GetKey())] = tuple
	}
	return nil
}
