package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/oklog/ulid/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
)

var tracer = otel.Tracer("openfga/pkg/storage/sqlite")

func startTrace(ctx context.Context, name string) (context.Context, trace.Span) {
	return tracer.Start(ctx, "sqlite."+name)
}

var tupleColumns = []string{
	"store", "object_type", "object_id", "relation",
	"user_object_type", "user_object_id", "user_relation",
	"condition_name", "condition_context", "ulid", "inserted_at",
}

// Datastore provides a SQLite based implementation of [storage.OpenFGADatastore].
type Datastore struct {
	stbl                   sq.StatementBuilderType
	db                     *sql.DB
	dbInfo                 *sqlcommon.DBInfo
	logger                 logger.Logger
	dbStatsCollector       prometheus.Collector
	maxTuplesPerWriteField int
	maxTypesPerModelField  int
	versionReady           bool
}

// Ensures that SQLite implements the OpenFGADatastore interface.
var _ storage.OpenFGADatastore = (*Datastore)(nil)

// PrepareDSN Prepare a raw DSN from config for use with SQLite, specifying defaults for journal mode and busy timeout.
func PrepareDSN(uri string) (string, error) {
	// Set journal mode and busy timeout pragmas if not specified.
	query := url.Values{}
	var err error

	if i := strings.Index(uri, "?"); i != -1 {
		query, err = url.ParseQuery(uri[i+1:])
		if err != nil {
			return uri, fmt.Errorf("error parsing dsn: %w", err)
		}

		uri = uri[:i]
	}

	foundJournalMode := false
	foundBusyTimeout := false
	for _, val := range query["_pragma"] {
		if strings.HasPrefix(val, "journal_mode") {
			foundJournalMode = true
		} else if strings.HasPrefix(val, "busy_timeout") {
			foundBusyTimeout = true
		}
	}

	if !foundJournalMode {
		query.Add("_pragma", "journal_mode(WAL)")
	}
	if !foundBusyTimeout {
		query.Add("_pragma", "busy_timeout(100)")
	}

	// Set transaction mode to immediate if not specified
	if !query.Has("_txlock") {
		query.Set("_txlock", "immediate")
	}

	uri += "?" + query.Encode()

	return uri, nil
}

// New creates a new [Datastore] storage.
func New(uri string, cfg *sqlcommon.Config) (*Datastore, error) {
	uri, err := PrepareDSN(uri)
	if err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", uri)
	if err != nil {
		return nil, fmt.Errorf("initialize sqlite connection: %w", err)
	}

	return NewWithDB(db, cfg)
}

// NewWithDB creates a new [Datastore] storage with the provided database connection.
func NewWithDB(db *sql.DB, cfg *sqlcommon.Config) (*Datastore, error) {
	var collector prometheus.Collector
	if cfg.ExportMetrics {
		collector = collectors.NewDBStatsCollector(db, "openfga")
		if err := prometheus.Register(collector); err != nil {
			return nil, fmt.Errorf("initialize metrics: %w", err)
		}
	}

	stbl := sq.StatementBuilder.RunWith(db)
	dbInfo := sqlcommon.NewDBInfo(stbl, HandleSQLError, "sqlite")

	return &Datastore{
		stbl:                   stbl,
		db:                     db,
		dbInfo:                 dbInfo,
		logger:                 cfg.Logger,
		dbStatsCollector:       collector,
		maxTuplesPerWriteField: cfg.MaxTuplesPerWriteField,
		maxTypesPerModelField:  cfg.MaxTypesPerModelField,
		versionReady:           false,
	}, nil
}

// Close see [storage.OpenFGADatastore].Close.
func (s *Datastore) Close() {
	if s.dbStatsCollector != nil {
		prometheus.Unregister(s.dbStatsCollector)
	}
	_ = s.db.Close()
}

// Read see [storage.RelationshipTupleReader].Read.
func (s *Datastore) Read(
	ctx context.Context,
	store string,
	filter storage.ReadFilter,
	_ storage.ReadOptions,
) (storage.TupleIterator, error) {
	ctx, span := startTrace(ctx, "Read")
	defer span.End()

	return s.read(ctx, store, filter, nil)
}

// ReadPage see [storage.RelationshipTupleReader].ReadPage.
func (s *Datastore) ReadPage(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadPageOptions) ([]*openfgav1.Tuple, string, error) {
	ctx, span := startTrace(ctx, "ReadPage")
	defer span.End()

	iter, err := s.read(ctx, store, filter, &options)
	if err != nil {
		return nil, "", err
	}
	defer iter.Stop()

	return iter.ToArray(ctx, options.Pagination)
}

func (s *Datastore) read(ctx context.Context, store string, filter storage.ReadFilter, options *storage.ReadPageOptions) (*SQLTupleIterator, error) {
	_, span := startTrace(ctx, "read")
	defer span.End()

	sb := s.stbl.
		Select(
			"store", "object_type", "object_id", "relation",
			"user_object_type", "user_object_id", "user_relation",
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
		userObjectType, userObjectID, userRelation := tupleUtils.ToUserParts(filter.User)
		if userObjectType != "" {
			sb = sb.Where(sq.Eq{
				"user_object_type": userObjectType,
			})
		}
		if userObjectID != "" {
			sb = sb.Where(sq.Eq{
				"user_object_id": userObjectID,
			})
		}
		if userRelation != "" {
			sb = sb.Where(sq.Eq{
				"user_relation": userRelation,
			})
		}
	}

	if len(filter.Conditions) > 0 {
		// Use COALESCE to treat NULL and '' as the same value (empty string).
		// This allows filtering for "no condition" (e.g., filter.Conditions = [""])
		// to correctly match rows where condition_name is either '' OR NULL.
		sb = sb.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}

	if options != nil && options.Pagination.From != "" {
		token := options.Pagination.From
		sb = sb.Where(sq.GtOrEq{"ulid": token})
	}
	if options != nil && options.Pagination.PageSize != 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	return NewSQLTupleIterator(sb, HandleSQLError), nil
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

// tupleLockKey represents the composite key we lock on.
type tupleLockKey struct {
	objectType     string
	objectID       string
	relation       string
	userObjectType string
	userObjectID   string
	userRelation   string
	userType       tupleUtils.UserType
}

// makeTupleLockKeys flattens deletes+writes into a deduped, sorted slice to ensure stable lock order.
func makeTupleLockKeys(deletes storage.Deletes, writes storage.Writes) []tupleLockKey {
	keys := make([]tupleLockKey, 0, len(deletes)+len(writes))

	seen := make(map[string]struct{}, cap(keys))
	add := func(tk *openfgav1.TupleKey) {
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())
		userObjectType, userObjectID, userRelation := tupleUtils.ToUserParts(tk.GetUser())
		k := tupleLockKey{
			objectType:     objectType,
			objectID:       objectID,
			relation:       tk.GetRelation(),
			userObjectType: userObjectType,
			userObjectID:   userObjectID,
			userRelation:   userRelation,
			userType:       tupleUtils.GetUserTypeFromUser(tk.GetUser()),
		}
		s := strings.Join([]string{
			k.objectType,
			k.objectID,
			k.relation,
			k.userObjectType,
			k.userObjectID,
			k.userRelation,
			string(k.userType),
		}, "\x00")
		if _, ok := seen[s]; ok {
			return
		}
		seen[s] = struct{}{}
		keys = append(keys, k)
	}

	for _, tk := range deletes {
		add(tupleUtils.TupleKeyWithoutConditionToTupleKey(tk))
	}
	for _, tk := range writes {
		add(tk)
	}

	// Sort deterministically by the composite key to keep lock order stable.
	sort.Slice(keys, func(i, j int) bool {
		a, b := keys[i], keys[j]
		if a.objectType != b.objectType {
			return a.objectType < b.objectType
		}
		if a.objectID != b.objectID {
			return a.objectID < b.objectID
		}
		if a.relation != b.relation {
			return a.relation < b.relation
		}
		if a.userObjectType != b.userObjectType {
			return a.userObjectType < b.userObjectType
		}
		if a.userObjectID != b.userObjectID {
			return a.userObjectID < b.userObjectID
		}
		if a.userRelation != b.userRelation {
			return a.userRelation < b.userRelation
		}
		return a.userType < b.userType
	})

	return keys
}

// buildRowConstructorIN builds "((?,?,?,?,?,?,?),(?,?,?,?,?,?,?),...)" and arg list for row-constructor IN.
func buildRowConstructorIN(keys []tupleLockKey) (string, []interface{}) {
	if len(keys) == 0 {
		return "", nil
	}
	var sb strings.Builder
	args := make([]interface{}, 0, len(keys)*7)
	sb.WriteByte('(')
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString("(?,?,?,?,?,?,?)")
		args = append(args,
			k.objectType,
			k.objectID,
			k.relation,
			k.userObjectType,
			k.userObjectID,
			k.userRelation,
			k.userType,
		)
	}
	sb.WriteByte(')')
	return sb.String(), args
}

// selectExistingRowsForWrite selects existing rows for the given keys and locks them FOR UPDATE.
// The existing rows are added to the existing map.
func (s *Datastore) selectExistingRowsForWrite(ctx context.Context, store string, keys []tupleLockKey, txn *sql.Tx, existing map[string]*openfgav1.Tuple) error {
	inExpr, args := buildRowConstructorIN(keys)

	selectBuilder := s.stbl.
		Select(tupleColumns...).
		Where(sq.Eq{"store": store}).
		From("tuple").
		// Row-constructor IN on full composite key for precise point locks.
		Where(sq.Expr("(object_type, object_id, relation, user_object_type, user_object_id, user_relation, user_type) IN "+inExpr, args...)).
		RunWith(txn) // make sure to run in the same transaction

	iter := NewSQLTupleIterator(selectBuilder, HandleSQLError)
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

// Write provides the common method for writing to database across sql storage.
func (s *Datastore) write(
	ctx context.Context,
	store string,
	deletes storage.Deletes,
	writes storage.Writes,
	opts storage.TupleWriteOptions,
	now time.Time,
) error {
	// 1. Begin Transaction ( Isolation Level = READ COMMITTED )
	var txn *sql.Tx
	err := busyRetry(func() error {
		var err error
		txn, err = s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
		return err
	})
	if err != nil {
		return HandleSQLError(err)
	}
	defer func() {
		_ = txn.Rollback()
	}()

	// 2. Compile a SELECT … FOR UPDATE statement to read the tuples for writes and lock tuples for deletes
	// Build a deduped, sorted list of keys to lock.
	lockKeys := makeTupleLockKeys(deletes, writes)
	total := len(lockKeys)
	if total == 0 {
		// Nothing to do.
		return nil
	}

	existing := make(map[string]*openfgav1.Tuple, total)

	// 3. If list compiled in step 2 is not empty, execute SELECT … FOR UPDATE statement

	for start := 0; start < total; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > total {
			end = total
		}
		keys := lockKeys[start:end]

		if err = s.selectExistingRowsForWrite(ctx, store, keys, txn, existing); err != nil {
			return err
		}
	}

	changeLogItems := make([][]interface{}, 0, len(deletes)+len(writes))

	// ensures increasingly unique values within a single thread
	entropy := ulid.DefaultEntropy()

	deleteConditions := sq.Or{}

	// 4. For deletes
	// a. If on_missing: error ( default behavior ):
	// - Execute DELETEs as a single statement.
	//   On conflict ( row count != delete count ) - rollback & return an error
	// b. If on_missing: ignore use the result from Step 3.a.
	// - Based on the results from step 3.a, which identified and locked existing rows,
	//   the system will generate DELETE tuple and INSERT changelog statements only for those specific tuples
	// - For rows that don’t exist in DB - ignore, no-op
	// - Execute DELETEs as a single statement.
	//   On conflict ( row count != delete count ) - rollback & return a HTTP 409 Conflict error
	for _, tk := range deletes {
		if _, ok := existing[tupleUtils.TupleKeyToString(tk)]; !ok {
			// If the tuple does not exist, we can not delete it.
			switch opts.OnMissingDelete {
			case storage.OnMissingDeleteIgnore:
				continue
			case storage.OnMissingDeleteError:
				fallthrough
			default:
				return storage.InvalidWriteInputError(
					tk,
					openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
				)
			}
		}

		id := ulid.MustNew(ulid.Timestamp(now), entropy).String()
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())
		userObjectType, userObjectID, userRelation := tupleUtils.ToUserParts(tk.GetUser())

		deleteConditions = append(deleteConditions, sq.Eq{
			"object_type":      objectType,
			"object_id":        objectID,
			"relation":         tk.GetRelation(),
			"user_object_type": userObjectType,
			"user_object_id":   userObjectID,
			"user_relation":    userRelation,
			"user_type":        tupleUtils.GetUserTypeFromUser(tk.GetUser()),
		})

		changeLogItems = append(changeLogItems, []interface{}{
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			userObjectType,
			userObjectID,
			userRelation,
			"",
			nil, // Redact condition info for deletes since we only need the base triplet (object, relation, user).
			openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
			id,
			sq.Expr("datetime('subsec')"),
		})
	}

	writeItems := make([][]interface{}, 0, len(writes))

	// 5. For writes
	// a. If on_duplicate: error ( default behavior )
	// - Execute INSERTs as a single statement.
	//   On duplicate insert we’d get a CONSTRAINT VIOLATION error, return 400 Bad Request
	// b. If on_duplicate: ignore
	// - Based on the results from step 3.a, which identified and locked existing rows, the system will compare values to the ones we’re trying to insert
	// - On conflict ( values not identical ) - return an error 409 Conflict
	// - For rows that DO NOT exist in DB - create both INSERT tuple & INSERT changelog statements
	// c. Execute INSERTs as a single statement
	//   On error, return 409 Conflict
	for _, tk := range writes {
		if existingTuple, ok := existing[tupleUtils.TupleKeyToString(tk)]; ok {
			// If the tuple exists, we can not write it.
			switch opts.OnDuplicateInsert {
			case storage.OnDuplicateInsertIgnore:
				// If the tuple exists and the condition is the same, we can ignore it.
				// We need to use its serialized text instead of reflect.DeepEqual to avoid comparing internal values.
				if proto.Equal(existingTuple.GetKey().GetCondition(), tk.GetCondition()) {
					continue
				}
				// If tuple conditions are different, we throw an error.
				return storage.TupleConditionConflictError(tk)
			case storage.OnDuplicateInsertError:
				fallthrough
			default:
				return storage.InvalidWriteInputError(
					tk,
					openfgav1.TupleOperation_TUPLE_OPERATION_WRITE,
				)
			}
		}

		id := ulid.MustNew(ulid.Timestamp(now), entropy).String()
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())
		userObjectType, userObjectID, userRelation := tupleUtils.ToUserParts(tk.GetUser())

		conditionName, conditionContext, err := sqlcommon.MarshalRelationshipCondition(tk.GetCondition())
		if err != nil {
			return err
		}

		writeItems = append(writeItems, []interface{}{
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			userObjectType,
			userObjectID,
			userRelation,
			tupleUtils.GetUserTypeFromUser(tk.GetUser()),
			conditionName,
			conditionContext,
			id,
			sq.Expr("datetime('subsec')"),
		})

		changeLogItems = append(changeLogItems, []interface{}{
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			userObjectType,
			userObjectID,
			userRelation,
			conditionName,
			conditionContext,
			openfgav1.TupleOperation_TUPLE_OPERATION_WRITE,
			id,
			sq.Expr("datetime('subsec')"),
		})
	}

	for start, totalDeletes := 0, len(deleteConditions); start < totalDeletes; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalDeletes {
			end = totalDeletes
		}

		deleteConditionsBatch := deleteConditions[start:end]

		res, err := s.stbl.Delete("tuple").Where(sq.Eq{"store": store}).
			Where(deleteConditionsBatch).
			RunWith(txn). // Part of a txn.
			ExecContext(ctx)
		if err != nil {
			return HandleSQLError(err)
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return HandleSQLError(err)
		}

		if rowsAffected != int64(len(deleteConditionsBatch)) {
			// If we deleted fewer rows than planned (after read before write), means we hit a race condition - someone else deleted the same row(s).
			return storage.ErrWriteConflictOnDelete
		}
	}

	for start, totalWrites := 0, len(writeItems); start < totalWrites; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalWrites {
			end = totalWrites
		}

		writesBatch := writeItems[start:end]

		insertBuilder := s.stbl.
			Insert("tuple").
			Columns(
				"store",
				"object_type",
				"object_id",
				"relation",
				"user_object_type",
				"user_object_id",
				"user_relation",
				"user_type",
				"condition_name",
				"condition_context",
				"ulid",
				"inserted_at",
			)

		for _, item := range writesBatch {
			insertBuilder = insertBuilder.Values(item...)
		}

		_, err = insertBuilder.
			RunWith(txn). // Part of a txn.
			ExecContext(ctx)
		if err != nil {
			dberr := HandleSQLError(err)
			if errors.Is(dberr, storage.ErrCollision) {
				// ErrCollision is returned on duplicate write (constraint violation), meaning we hit a race condition - someone else inserted the same row(s).
				return storage.ErrWriteConflictOnInsert
			}
			return dberr
		}
	}

	// 6. Execute INSERT changelog statements
	for start, totalItems := 0, len(changeLogItems); start < totalItems; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalItems {
			end = totalItems
		}

		changeLogBatch := changeLogItems[start:end]

		changelogBuilder := s.stbl.
			Insert("changelog").
			Columns(
				"store",
				"object_type",
				"object_id",
				"relation",
				"user_object_type",
				"user_object_id",
				"user_relation",
				"condition_name",
				"condition_context",
				"operation",
				"ulid",
				"inserted_at",
			)

		for _, item := range changeLogBatch {
			changelogBuilder = changelogBuilder.Values(item...)
		}

		_, err = changelogBuilder.RunWith(txn).ExecContext(ctx) // Part of a txn.
		if err != nil {
			return HandleSQLError(err)
		}
	}

	err = busyRetry(func() error {
		return txn.Commit()
	})
	if err != nil {
		return HandleSQLError(err)
	}

	return nil
}

// ReadUserTuple see [storage.RelationshipTupleReader].ReadUserTuple.
func (s *Datastore) ReadUserTuple(ctx context.Context, store string, filter storage.ReadUserTupleFilter, _ storage.ReadUserTupleOptions) (*openfgav1.Tuple, error) {
	ctx, span := startTrace(ctx, "ReadUserTuple")
	defer span.End()

	objectType, objectID := tupleUtils.SplitObject(filter.Object)
	userType := tupleUtils.GetUserTypeFromUser(filter.User)
	userObjectType, userObjectID, userRelation := tupleUtils.ToUserParts(filter.User)

	var conditionName sql.NullString
	var conditionContext []byte
	var record storage.TupleRecord

	sb := s.stbl.
		Select(
			"object_type", "object_id", "relation",
			"user_object_type", "user_object_id", "user_relation",
			"condition_name", "condition_context",
		).
		From("tuple").
		Where(sq.Eq{
			"store":            store,
			"object_type":      objectType,
			"object_id":        objectID,
			"relation":         filter.Relation,
			"user_object_type": userObjectType,
			"user_object_id":   userObjectID,
			"user_relation":    userRelation,
			"user_type":        userType,
		})

	if len(filter.Conditions) > 0 {
		sb = sb.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}

	err := sb.QueryRowContext(ctx).
		Scan(
			&record.ObjectType,
			&record.ObjectID,
			&record.Relation,
			&record.UserObjectType,
			&record.UserObjectID,
			&record.UserRelation,
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
	_ storage.ReadUsersetTuplesOptions,
) (storage.TupleIterator, error) {
	_, span := startTrace(ctx, "ReadUsersetTuples")
	defer span.End()

	sb := s.stbl.
		Select(
			"store", "object_type", "object_id", "relation",
			"user_object_type", "user_object_id", "user_relation",
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
				orConditions = append(orConditions, sq.Eq{
					"user_object_type": userset.GetType(),
					"user_relation":    userset.GetRelation(),
				})
			}
			if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Wildcard); ok {
				orConditions = append(orConditions, sq.Eq{
					"user_object_type": userset.GetType(),
					"user_object_id":   "*",
				})
			}
		}
		sb = sb.Where(orConditions)
	}

	if len(filter.Conditions) > 0 {
		sb = sb.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}

	return NewSQLTupleIterator(sb, HandleSQLError), nil
}

// ReadStartingWithUser see [storage.RelationshipTupleReader].ReadStartingWithUser.
func (s *Datastore) ReadStartingWithUser(
	ctx context.Context,
	store string,
	filter storage.ReadStartingWithUserFilter,
	_ storage.ReadStartingWithUserOptions,
) (storage.TupleIterator, error) {
	_, span := startTrace(ctx, "ReadStartingWithUser")
	defer span.End()

	var targetUsersArg sq.Or
	for _, u := range filter.UserFilter {
		userObjectType, userObjectID, userRelation := tupleUtils.ToUserPartsFromObjectRelation(u)
		targetUser := sq.Eq{
			"user_object_type": userObjectType,
			"user_object_id":   userObjectID,
		}
		if userRelation != "" {
			targetUser["user_relation"] = userRelation
		}
		targetUsersArg = append(targetUsersArg, targetUser)
	}

	builder := s.stbl.
		Select(
			"store", "object_type", "object_id", "relation",
			"user_object_type", "user_object_id", "user_relation",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{
			"store":       store,
			"object_type": filter.ObjectType,
			"relation":    filter.Relation,
		}).
		Where(targetUsersArg).OrderBy("object_id")

	if filter.ObjectIDs != nil && filter.ObjectIDs.Size() > 0 {
		builder = builder.Where(sq.Eq{"object_id": filter.ObjectIDs.Values()})
	}

	if len(filter.Conditions) > 0 {
		builder = builder.Where(sq.Eq{"COALESCE(condition_name, '')": filter.Conditions})
	}

	return NewSQLTupleIterator(builder, HandleSQLError), nil
}

// MaxTuplesPerWrite see [storage.RelationshipTupleWriter].MaxTuplesPerWrite.
func (s *Datastore) MaxTuplesPerWrite() int {
	return s.maxTuplesPerWriteField
}

func constructAuthorizationModelFromSQLRows(rows *sql.Rows) (*openfgav1.AuthorizationModel, error) {
	if rows.Next() {
		var modelID string
		var schemaVersion string
		var marshalledModel []byte

		err := rows.Scan(&modelID, &schemaVersion, &marshalledModel)
		if err != nil {
			return nil, HandleSQLError(err)
		}

		var model openfgav1.AuthorizationModel
		if err := proto.Unmarshal(marshalledModel, &model); err != nil {
			return nil, err
		}

		return &model, nil
	}

	if err := rows.Err(); err != nil {
		return nil, HandleSQLError(err)
	}

	return nil, storage.ErrNotFound
}

// ReadAuthorizationModel see [storage.AuthorizationModelReadBackend].ReadAuthorizationModel.
func (s *Datastore) ReadAuthorizationModel(ctx context.Context, store string, modelID string) (*openfgav1.AuthorizationModel, error) {
	ctx, span := startTrace(ctx, "ReadAuthorizationModel")
	defer span.End()

	rows, err := s.stbl.
		Select("authorization_model_id", "schema_version", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{
			"store":                  store,
			"authorization_model_id": modelID,
		}).
		QueryContext(ctx)
	if err != nil {
		return nil, HandleSQLError(err)
	}
	defer rows.Close()

	return constructAuthorizationModelFromSQLRows(rows)
}

// ReadAuthorizationModels see [storage.AuthorizationModelReadBackend].ReadAuthorizationModels.
func (s *Datastore) ReadAuthorizationModels(ctx context.Context, store string, options storage.ReadAuthorizationModelsOptions) ([]*openfgav1.AuthorizationModel, string, error) {
	ctx, span := startTrace(ctx, "ReadAuthorizationModels")
	defer span.End()

	sb := s.stbl.
		Select("authorization_model_id", "schema_version", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{"store": store}).
		OrderBy("authorization_model_id desc")

	if options.Pagination.From != "" {
		sb = sb.Where(sq.LtOrEq{"authorization_model_id": options.Pagination.From})
	}
	if options.Pagination.PageSize > 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	rows, err := sb.QueryContext(ctx)
	if err != nil {
		return nil, "", HandleSQLError(err)
	}
	defer rows.Close()

	var modelID string
	var schemaVersion string
	var marshalledModel []byte

	models := make([]*openfgav1.AuthorizationModel, 0, options.Pagination.PageSize)
	var token string

	for rows.Next() {
		err = rows.Scan(&modelID, &schemaVersion, &marshalledModel)
		if err != nil {
			return nil, "", HandleSQLError(err)
		}

		if options.Pagination.PageSize > 0 && len(models) >= options.Pagination.PageSize {
			return models, modelID, nil
		}

		var model openfgav1.AuthorizationModel
		if err := proto.Unmarshal(marshalledModel, &model); err != nil {
			return nil, "", err
		}

		models = append(models, &model)
	}

	if err := rows.Err(); err != nil {
		return nil, "", HandleSQLError(err)
	}

	return models, token, nil
}

// FindLatestAuthorizationModel see [storage.AuthorizationModelReadBackend].FindLatestAuthorizationModel.
func (s *Datastore) FindLatestAuthorizationModel(ctx context.Context, store string) (*openfgav1.AuthorizationModel, error) {
	ctx, span := startTrace(ctx, "FindLatestAuthorizationModel")
	defer span.End()

	rows, err := s.stbl.
		Select("authorization_model_id", "schema_version", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{"store": store}).
		OrderBy("authorization_model_id desc").
		Limit(1).
		QueryContext(ctx)
	if err != nil {
		return nil, HandleSQLError(err)
	}
	defer rows.Close()

	return constructAuthorizationModelFromSQLRows(rows)
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

	err = busyRetry(func() error {
		_, err := s.stbl.
			Insert("authorization_model").
			Columns("store", "authorization_model_id", "schema_version", "serialized_protobuf").
			Values(store, model.GetId(), schemaVersion, pbdata).
			ExecContext(ctx)
		return err
	})
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

	err := busyRetry(func() error {
		return s.stbl.
			Insert("store").
			Columns("id", "name", "created_at", "updated_at").
			Values(store.GetId(), store.GetName(), sq.Expr("datetime('subsec')"), sq.Expr("datetime('subsec')")).
			Suffix("returning id, name, created_at, updated_at").
			QueryRowContext(ctx).
			Scan(&id, &name, &createdAt, &updatedAt)
	})
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

	row := s.stbl.
		Select("id", "name", "created_at", "updated_at").
		From("store").
		Where(sq.Eq{
			"id":         id,
			"deleted_at": nil,
		}).
		QueryRowContext(ctx)

	var storeID, name string
	var createdAt, updatedAt time.Time
	err := row.Scan(&storeID, &name, &createdAt, &updatedAt)
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

	sb := s.stbl.
		Select("id", "name", "created_at", "updated_at").
		From("store").
		Where(whereClause).
		OrderBy("id")

	if options.Pagination.PageSize > 0 {
		sb = sb.Limit(uint64(options.Pagination.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	rows, err := sb.QueryContext(ctx)
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

	_, err := s.stbl.
		Update("store").
		Set("deleted_at", sq.Expr("datetime('subsec')")).
		Where(sq.Eq{"id": id}).
		ExecContext(ctx)
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

	err = busyRetry(func() error {
		_, err := s.stbl.
			Insert("assertion").
			Columns("store", "authorization_model_id", "assertions").
			Values(store, modelID, marshalledAssertions).
			Suffix("ON CONFLICT (store, authorization_model_id) DO UPDATE SET assertions = ?", marshalledAssertions).
			ExecContext(ctx)
		return err
	})
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
	err := s.stbl.
		Select("assertions").
		From("assertion").
		Where(sq.Eq{
			"store":                  store,
			"authorization_model_id": modelID,
		}).
		QueryRowContext(ctx).
		Scan(&marshalledAssertions)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
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

	sb := s.stbl.
		Select(
			"ulid", "object_type", "object_id", "relation",
			"user_object_type", "user_object_id", "user_relation",
			"operation",
			"condition_name", "condition_context", "inserted_at",
		).
		From("changelog").
		Where(sq.Eq{"store": store}).
		Where(fmt.Sprintf("inserted_at <= datetime('subsec','-%f seconds')", horizonOffset.Seconds())).
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

	rows, err := sb.QueryContext(ctx)
	if err != nil {
		return nil, "", HandleSQLError(err)
	}
	defer rows.Close()

	var changes []*openfgav1.TupleChange
	var ulid string
	for rows.Next() {
		var objectType, objectID, relation, userObjectType, userObjectID, userRelation string
		var operation int
		var insertedAt time.Time
		var conditionName sql.NullString
		var conditionContext []byte

		err = rows.Scan(
			&ulid,
			&objectType,
			&objectID,
			&relation,
			&userObjectType,
			&userObjectID,
			&userRelation,
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
			tupleUtils.FromUserParts(userObjectType, userObjectID, userRelation),
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

// IsReady see [sqlcommon.IsReady].
func (s *Datastore) IsReady(ctx context.Context) (storage.ReadinessStatus, error) {
	versionReady, err := sqlcommon.IsReady(ctx, s.versionReady, s.db)
	if err != nil {
		return versionReady, err
	}
	s.versionReady = versionReady.IsReady
	return versionReady, nil
}

// HandleSQLError processes an SQL error and converts it into a more
// specific error type based on the nature of the SQL error.
func HandleSQLError(err error, args ...interface{}) error {
	if errors.Is(err, sql.ErrNoRows) {
		return storage.ErrNotFound
	}

	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) {
		if sqliteErr.Code()&0xFF == sqlite3.SQLITE_CONSTRAINT {
			if len(args) > 0 {
				if tk, ok := args[0].(*openfgav1.TupleKey); ok {
					return storage.InvalidWriteInputError(tk, openfgav1.TupleOperation_TUPLE_OPERATION_WRITE)
				}
			}
			return storage.ErrCollision
		}
	}

	return fmt.Errorf("sql error: %w", err)
}

// SQLite will return an SQLITE_BUSY error when the database is locked rather than waiting for the lock.
// This function retries the operation up to maxRetries times before returning the error.
func busyRetry(fn func() error) error {
	const maxRetries = 10
	for retries := 0; ; retries++ {
		err := fn()
		if err == nil {
			return nil
		}

		if isBusyError(err) {
			if retries < maxRetries {
				continue
			}

			return fmt.Errorf("sqlite busy error after %d retries: %w", maxRetries, err)
		}

		return err
	}
}

var busyErrors = map[int]struct{}{
	sqlite3.SQLITE_BUSY_RECOVERY:      {},
	sqlite3.SQLITE_BUSY_SNAPSHOT:      {},
	sqlite3.SQLITE_BUSY_TIMEOUT:       {},
	sqlite3.SQLITE_BUSY:               {},
	sqlite3.SQLITE_LOCKED_SHAREDCACHE: {},
	sqlite3.SQLITE_LOCKED:             {},
}

func isBusyError(err error) bool {
	var sqliteErr *sqlite.Error
	if !errors.As(err, &sqliteErr) {
		return false
	}

	_, ok := busyErrors[sqliteErr.Code()]
	return ok
}
