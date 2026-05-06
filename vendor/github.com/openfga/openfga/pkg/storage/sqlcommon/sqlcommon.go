package sqlcommon

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/oklog/ulid/v2"
	"github.com/pressly/goose/v3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/build"
	"github.com/openfga/openfga/pkg/encoder"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
)

var tracer = otel.Tracer("pkg/storage/sqlcommon")

// Config defines the configuration parameters
// for setting up and managing a sql connection.
type Config struct {
	SecondaryURI           string
	Username               string
	Password               string
	SecondaryUsername      string
	SecondaryPassword      string
	Logger                 logger.Logger
	MaxTuplesPerWriteField int
	MaxTypesPerModelField  int

	MaxOpenConns    int
	MinOpenConns    int
	MaxIdleConns    int
	MinIdleConns    int
	ConnMaxIdleTime time.Duration
	ConnMaxLifetime time.Duration

	ExportMetrics bool
}

// DatastoreOption defines a function type
// used for configuring a Config object.
type DatastoreOption func(*Config)

// WithSecondaryURI returns a DatastoreOption that sets the secondary URI in the Config.
func WithSecondaryURI(uri string) DatastoreOption {
	return func(config *Config) {
		config.SecondaryURI = uri
	}
}

// WithUsername returns a DatastoreOption that sets the username in the Config.
func WithUsername(username string) DatastoreOption {
	return func(config *Config) {
		config.Username = username
	}
}

// WithPassword returns a DatastoreOption that sets the password in the Config.
func WithPassword(password string) DatastoreOption {
	return func(config *Config) {
		config.Password = password
	}
}

// WithSecondaryUsername returns a DatastoreOption that sets the secondary username in the Config.
func WithSecondaryUsername(username string) DatastoreOption {
	return func(config *Config) {
		config.SecondaryUsername = username
	}
}

// WithSecondaryPassword returns a DatastoreOption that sets the secondary password in the Config.
func WithSecondaryPassword(password string) DatastoreOption {
	return func(config *Config) {
		config.SecondaryPassword = password
	}
}

// WithLogger returns a DatastoreOption that sets the Logger in the Config.
func WithLogger(l logger.Logger) DatastoreOption {
	return func(cfg *Config) {
		cfg.Logger = l
	}
}

// WithMaxTuplesPerWrite returns a DatastoreOption that sets
// the maximum number of tuples per write in the Config.
func WithMaxTuplesPerWrite(maxTuples int) DatastoreOption {
	return func(cfg *Config) {
		cfg.MaxTuplesPerWriteField = maxTuples
	}
}

// WithMaxTypesPerAuthorizationModel returns a DatastoreOption that sets
// the maximum number of types per authorization model in the Config.
func WithMaxTypesPerAuthorizationModel(maxTypes int) DatastoreOption {
	return func(cfg *Config) {
		cfg.MaxTypesPerModelField = maxTypes
	}
}

// WithMaxOpenConns returns a DatastoreOption that sets the
// maximum number of open connections in the Config.
func WithMaxOpenConns(c int) DatastoreOption {
	return func(cfg *Config) {
		cfg.MaxOpenConns = c
	}
}

// WithMinOpenConns returns a DatastoreOption that sets the
// minimum number of open connections in the Config.
// This is only used by some SQL drivers (e.g., pgxpool that is used
// in PostgresSQL).
func WithMinOpenConns(c int) DatastoreOption {
	return func(cfg *Config) {
		cfg.MinOpenConns = c
	}
}

// WithMaxIdleConns returns a DatastoreOption that sets the
// maximum number of idle connections in the Config.
func WithMaxIdleConns(c int) DatastoreOption {
	return func(cfg *Config) {
		cfg.MaxIdleConns = c
	}
}

// WithMinIdleConns returns a DatastoreOption that sets the
// minimum number of idle connections in the Config.
// This is only used by some SQL drivers (e.g., pgxpool that is used
// in PostgresSQL).
func WithMinIdleConns(c int) DatastoreOption {
	return func(cfg *Config) {
		cfg.MinIdleConns = c
	}
}

// WithConnMaxIdleTime returns a DatastoreOption that sets
// the maximum idle time for a connection in the Config.
func WithConnMaxIdleTime(d time.Duration) DatastoreOption {
	return func(cfg *Config) {
		cfg.ConnMaxIdleTime = d
	}
}

// WithConnMaxLifetime returns a DatastoreOption that sets
// the maximum lifetime for a connection in the Config.
func WithConnMaxLifetime(d time.Duration) DatastoreOption {
	return func(cfg *Config) {
		cfg.ConnMaxLifetime = d
	}
}

// WithMetrics returns a DatastoreOption that
// enables the export of metrics in the Config.
func WithMetrics() DatastoreOption {
	return func(cfg *Config) {
		cfg.ExportMetrics = true
	}
}

// NewConfig creates a new Config instance with default values
// and applies any provided DatastoreOption modifications.
func NewConfig(opts ...DatastoreOption) *Config {
	cfg := &Config{}

	for _, opt := range opts {
		opt(cfg)
	}

	if cfg.Logger == nil {
		cfg.Logger = logger.NewNoopLogger()
	}

	if cfg.MaxTuplesPerWriteField == 0 {
		cfg.MaxTuplesPerWriteField = storage.DefaultMaxTuplesPerWrite
	}

	if cfg.MaxTypesPerModelField == 0 {
		cfg.MaxTypesPerModelField = storage.DefaultMaxTypesPerAuthorizationModel
	}

	return cfg
}

// ContToken represents a continuation token structure used in pagination.
type ContToken struct {
	Ulid       string `json:"ulid"`
	ObjectType string `json:"ObjectType"`
}

// NewContToken creates a new instance of ContToken
// with the provided ULID and object type.
func NewContToken(ulid, objectType string) *ContToken {
	return &ContToken{
		Ulid:       ulid,
		ObjectType: objectType,
	}
}

// MarshallContToken takes a ContToken struct and attempts to marshal it into a string.

func NewSQLContinuationTokenSerializer() encoder.ContinuationTokenSerializer {
	return &SQLContinuationTokenSerializer{}
}

type SQLContinuationTokenSerializer struct{}

func (s *SQLContinuationTokenSerializer) Serialize(ulid string, objType string) ([]byte, error) {
	if ulid == "" {
		return nil, errors.New("empty ulid provided for continuation token")
	}
	return json.Marshal(NewContToken(ulid, objType))
}

func (s *SQLContinuationTokenSerializer) Deserialize(continuationToken string) (ulid string, objType string, err error) {
	var token ContToken
	if err := json.Unmarshal([]byte(continuationToken), &token); err != nil {
		return "", "", storage.ErrInvalidContinuationToken
	}
	return token.Ulid, token.ObjectType, nil
}

// SQLIteratorRowGetter is an interface for retrieving rows from a SQL query.
// Implementations should provide the GetRows method, which executes a query
// and returns a Rows object for iteration.
//
// GetRows executes the query and returns the resulting Rows or an error.
type SQLIteratorRowGetter interface {
	GetRows(context.Context) (Rows, error)
}

type SBIteratorQuery struct {
	sb sq.SelectBuilder
}

func NewSBIteratorQuery(sb sq.SelectBuilder) *SBIteratorQuery {
	return &SBIteratorQuery{sb: sb}
}

func (q *SBIteratorQuery) GetRows(ctx context.Context) (Rows, error) {
	return q.sb.QueryContext(ctx)
}

// Rows is an interface that abstracts the iteration over SQL query results.
// It provides methods to close the result set, check for errors, advance to the next row,
// and scan the current row's columns into provided destinations.
// It is intended as a subset of *sql.Rows to facilitate compatibility with *pgx.Rows as well.
//
// Methods:
//   - Close(): Closes the rows iterator and releases any resources.
//   - Err(): Returns the error, if any, that was encountered during iteration.
//   - Next(): Advances to the next row, returning true if there is another row available.
//   - Scan(dest ...any): Scans the columns of the current row into the provided destination variables.
type Rows interface {
	Close() error
	Err() error
	Next() bool
	Scan(dest ...any) error
}

// SQLTupleIterator is a struct that implements the storage.TupleIterator
// interface for iterating over tuples fetched from a SQL database.
type SQLTupleIterator struct {
	rows           Rows // GUARDED_BY(mu)
	handleSQLError errorHandlerFn

	// firstRow is used as a temporary storage place if head is called.
	// If firstRow is nil and Head is called, rows.Next() will return the first item and advance
	// the iterator. Thus, we will need to store this first item so that future Head() and Next()
	// will use this item instead. Otherwise, the first item will be lost.
	firstRow *storage.TupleRecord // GUARDED_BY(mu)
	mu       sync.Mutex

	rowGetter SQLIteratorRowGetter
}

// Ensures that SQLTupleIterator implements the TupleIterator interface.
var _ storage.TupleIterator = (*SQLTupleIterator)(nil)

// sqlIteratorColumns required for the SQL tuple iterator scanner.
var sqlIteratorColumns = []string{
	"store",
	"object_type",
	"object_id",
	"relation",
	"_user",
	"condition_name",
	"condition_context",
	"ulid",
	"inserted_at",
}

// SQLIteratorColumns returns the columns used in the SQL tuple iterator.
func SQLIteratorColumns() []string {
	return sqlIteratorColumns
}

// NewSQLTupleIterator returns a SQL tuple iterator.
func NewSQLTupleIterator(rowGetter SQLIteratorRowGetter, errHandler errorHandlerFn) *SQLTupleIterator {
	return &SQLTupleIterator{
		rows:           nil,
		handleSQLError: errHandler,
		firstRow:       nil,
		mu:             sync.Mutex{},
		rowGetter:      rowGetter,
	}
}

func (t *SQLTupleIterator) fetchBuffer(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "sqlcommon.fetchBuffer", trace.WithAttributes())
	defer span.End()
	ctx = context.WithoutCancel(ctx)
	curRows, err := t.rowGetter.GetRows(ctx)
	if err != nil {
		return t.handleSQLError(err)
	}
	t.rows = curRows
	return nil
}

func (t *SQLTupleIterator) next(ctx context.Context) (*storage.TupleRecord, error) {
	t.mu.Lock()

	if t.rows == nil {
		if err := t.fetchBuffer(ctx); err != nil {
			t.mu.Unlock()
			return nil, err
		}
	}

	if t.firstRow != nil {
		// If head was called previously, we don't need to scan / next
		// again as the data is already there and the internal iterator would be advanced via `t.rows.Next()`.
		// Calling t.rows.Next() in this case would lose the first row data.
		//
		// For example, let's say there are 3 items [1,2,3]
		// If we called Head() and t.firstRow is empty, the rows will only be left with [2,3].
		// Thus, we will need to save item [1] in firstRow.  This allows future next() and head() to consume
		// [1] first.
		// If head() was not called, t.firstRow would be nil and we can follow the t.rows.Next() logic below.
		firstRow := t.firstRow
		t.firstRow = nil
		t.mu.Unlock()
		return firstRow, nil
	}

	if !t.rows.Next() {
		err := t.rows.Err()
		t.mu.Unlock()
		if err != nil {
			return nil, t.handleSQLError(err)
		}
		return nil, storage.ErrIteratorDone
	}

	var conditionName sql.NullString
	var conditionContext []byte
	var record storage.TupleRecord
	err := t.rows.Scan(
		&record.Store,
		&record.ObjectType,
		&record.ObjectID,
		&record.Relation,
		&record.User,
		&conditionName,
		&conditionContext,
		&record.Ulid,
		&record.InsertedAt,
	)
	t.mu.Unlock()

	if err != nil {
		return nil, t.handleSQLError(err)
	}

	record.ConditionName = conditionName.String

	if conditionContext != nil {
		var conditionContextStruct structpb.Struct
		if err := proto.Unmarshal(conditionContext, &conditionContextStruct); err != nil {
			return nil, err
		}
		record.ConditionContext = &conditionContextStruct
	}

	return &record, nil
}

func (t *SQLTupleIterator) head(ctx context.Context) (*storage.TupleRecord, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.rows == nil {
		if err := t.fetchBuffer(ctx); err != nil {
			return nil, err
		}
	}

	if t.firstRow != nil {
		// If head was called previously, we don't need to scan / next
		// again as the data is already there and the internal iterator would be advanced via `t.rows.Next()`.
		// Calling t.rows.Next() in this case would lose the first row data.
		//
		// For example, let's say there are 3 items [1,2,3]
		// If we called Head() and t.firstRow is empty, the rows will only be left with [2,3].
		// Thus, we will need to save item [1] in firstRow.  This allows future next() and head() to return
		// [1] first. Note that for head(), we will not unset t.firstRow.  Therefore, calling head() multiple times
		// will yield the same result.
		// If head() was not called, t.firstRow would be nil, and we can follow the t.rows.Next() logic below.
		return t.firstRow, nil
	}

	if !t.rows.Next() {
		if err := t.rows.Err(); err != nil {
			return nil, t.handleSQLError(err)
		}
		return nil, storage.ErrIteratorDone
	}

	var conditionName sql.NullString
	var conditionContext []byte
	var record storage.TupleRecord
	err := t.rows.Scan(
		&record.Store,
		&record.ObjectType,
		&record.ObjectID,
		&record.Relation,
		&record.User,
		&conditionName,
		&conditionContext,
		&record.Ulid,
		&record.InsertedAt,
	)
	if err != nil {
		return nil, t.handleSQLError(err)
	}

	record.ConditionName = conditionName.String

	if conditionContext != nil {
		var conditionContextStruct structpb.Struct
		if err := proto.Unmarshal(conditionContext, &conditionContextStruct); err != nil {
			return nil, err
		}
		record.ConditionContext = &conditionContextStruct
	}
	t.firstRow = &record

	return &record, nil
}

// ToArray converts the tupleIterator to an []*openfgav1.Tuple and a possibly empty continuation token.
// If the continuation token exists it is the ulid of the last element of the returned array.
func (t *SQLTupleIterator) ToArray(ctx context.Context,
	opts storage.PaginationOptions,
) ([]*openfgav1.Tuple, string, error) {
	var res []*openfgav1.Tuple
	for i := 0; i < opts.PageSize; i++ {
		tupleRecord, err := t.next(ctx)
		if err != nil {
			if errors.Is(err, storage.ErrIteratorDone) {
				return res, "", nil
			}
			return nil, "", err
		}
		res = append(res, tupleRecord.AsTuple())
	}

	// Check if we are at the end of the iterator.
	// If we are then we do not need to return a continuation token.
	// This is why we have LIMIT+1 in the query.
	tupleRecord, err := t.next(ctx)
	if err != nil {
		if errors.Is(err, storage.ErrIteratorDone) {
			return res, "", nil
		}
		return nil, "", err
	}

	return res, tupleRecord.Ulid, nil
}

// Next will return the next available item.
func (t *SQLTupleIterator) Next(ctx context.Context) (*openfgav1.Tuple, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	record, err := t.next(ctx)
	if err != nil {
		return nil, err
	}

	return record.AsTuple(), nil
}

// Head will return the first available item.
func (t *SQLTupleIterator) Head(ctx context.Context) (*openfgav1.Tuple, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	record, err := t.head(ctx)
	if err != nil {
		return nil, err
	}

	return record.AsTuple(), nil
}

// Stop terminates iteration.
func (t *SQLTupleIterator) Stop() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.rows != nil {
		_ = t.rows.Close()
	}
}

// DBInfo encapsulates DB information for use in common method.
type DBInfo struct {
	stbl           sq.StatementBuilderType
	HandleSQLError errorHandlerFn
}

type errorHandlerFn func(error, ...interface{}) error

// NewDBInfo constructs a [DBInfo] object.
func NewDBInfo(stbl sq.StatementBuilderType, errorHandler errorHandlerFn, dialect string) *DBInfo {
	if err := goose.SetDialect(dialect); err != nil {
		panic("failed to set database dialect: " + err.Error())
	}

	return &DBInfo{
		stbl:           stbl,
		HandleSQLError: errorHandler,
	}
}

// TupleLockKey represents the composite key we lock on.
type TupleLockKey struct {
	objectType string
	objectID   string
	relation   string
	user       string
	userType   string
}

// MakeTupleLockKeys flattens Deletes+writes into a deduped, sorted slice to ensure stable lock order.
func MakeTupleLockKeys(deletes storage.Deletes, writes storage.Writes) []TupleLockKey {
	keys := make([]TupleLockKey, 0, len(deletes)+len(writes))

	seen := make(map[string]struct{}, cap(keys))
	add := func(tk *openfgav1.TupleKey) {
		ot, oid := tupleUtils.SplitObject(tk.GetObject())
		k := TupleLockKey{
			objectType: ot,
			objectID:   oid,
			relation:   tk.GetRelation(),
			user:       tk.GetUser(),
			userType:   string(tupleUtils.GetUserTypeFromUser(tk.GetUser())),
		}
		s := strings.Join([]string{
			k.objectType,
			k.objectID,
			k.relation,
			k.user,
			k.userType,
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
		if a.user != b.user {
			return a.user < b.user
		}
		return a.userType < b.userType
	})

	return keys
}

// BuildRowConstructorIN builds "((?,?,?,?,?),(?,?,?,?,?),...)" and arg list for row-constructor IN.
func BuildRowConstructorIN(keys []TupleLockKey) (string, []interface{}) {
	if len(keys) == 0 {
		return "", nil
	}
	var sb strings.Builder
	args := make([]interface{}, 0, len(keys)*5)
	sb.WriteByte('(')
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString("(?,?,?,?,?)")
		args = append(args, k.objectType, k.objectID, k.relation, k.user, k.userType)
	}
	sb.WriteByte(')')
	return sb.String(), args
}

// selectExistingRowsForWrite selects existing rows for the given keys and locks them FOR UPDATE.
// The existing rows are added to the existing map.
func selectExistingRowsForWrite(ctx context.Context, dbInfo *DBInfo, store string, keys []TupleLockKey, txn *sql.Tx, existing map[string]*openfgav1.Tuple) error {
	inExpr, args := BuildRowConstructorIN(keys)

	selectBuilder := dbInfo.stbl.
		Select(SQLIteratorColumns()...).
		From("tuple").
		Where(sq.Eq{"store": store}).
		// Row-constructor IN on full composite key for precise point locks.
		Where(sq.Expr("(object_type, object_id, relation, _user, user_type) IN "+inExpr, args...)).
		Suffix("FOR UPDATE").
		RunWith(txn) // make sure to run in the same transaction

	iter := NewSQLTupleIterator(NewSBIteratorQuery(selectBuilder), dbInfo.HandleSQLError)
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

// GetDeleteWriteChangelogItems constructs the delete conditions, write items, and changelog items.
func GetDeleteWriteChangelogItems(
	store string,
	existing map[string]*openfgav1.Tuple,
	writeData WriteData) (sq.Or, [][]interface{}, [][]interface{}, error) {
	changeLogItems := make([][]interface{}, 0, len(writeData.Deletes)+len(writeData.Writes))

	// ensures increasingly unique values within a single thread
	entropy := ulid.DefaultEntropy()

	deleteConditions := sq.Or{}

	// 1. For Deletes
	// a. If on_missing: error ( default behavior ):
	// - Execute DELETEs as a single statement.
	//   On conflict ( row count != delete count ) - rollback & return an error
	// b. If on_missing: ignore use the result from Step 3.a.
	// - Based on the results from step 3.a, which identified and locked existing rows,
	//   the system will generate DELETE tuple and INSERT changelog statements only for those specific tuples
	// - For rows that don’t exist in DB - ignore, no-op
	// - Execute DELETEs as a single statement.
	//   On conflict ( row count != delete count ) - rollback & return a HTTP 409 Conflict error
	for _, tk := range writeData.Deletes {
		if _, ok := existing[tupleUtils.TupleKeyToString(tk)]; !ok {
			// If the tuple does not exist, we can not delete it.
			switch writeData.Opts.OnMissingDelete {
			case storage.OnMissingDeleteIgnore:
				continue
			case storage.OnMissingDeleteError:
				fallthrough
			default:
				return nil, nil, nil, storage.InvalidWriteInputError(
					tk,
					openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
				)
			}
		}

		id := ulid.MustNew(ulid.Timestamp(writeData.Now), entropy).String()
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())

		deleteConditions = append(deleteConditions, sq.Eq{
			"object_type": objectType,
			"object_id":   objectID,
			"relation":    tk.GetRelation(),
			"_user":       tk.GetUser(),
			"user_type":   tupleUtils.GetUserTypeFromUser(tk.GetUser()),
		})

		changeLogItems = append(changeLogItems, []interface{}{
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			tk.GetUser(),
			"",
			nil, // Redact condition info for Deletes since we only need the base triplet (object, relation, user).
			openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
			id,
			sq.Expr("NOW()"),
		})
	}

	writeItems := make([][]interface{}, 0, len(writeData.Writes))

	// 2. For writes
	// a. If on_duplicate: error ( default behavior )
	// - Execute INSERTs as a single statement.
	//   On duplicate insert we’d get a CONSTRAINT VIOLATION error, return 400 Bad Request
	// b. If on_duplicate: ignore
	// - Based on the results from step 3.a, which identified and locked existing rows, the system will compare values to the ones we’re trying to insert
	// - On conflict ( values not identical ) - return an error 409 Conflict
	// - For rows that DO NOT exist in DB - create both INSERT tuple & INSERT changelog statements
	// c. Execute INSERTs as a single statement
	//   On error, return 409 Conflict
	for _, tk := range writeData.Writes {
		if existingTuple, ok := existing[tupleUtils.TupleKeyToString(tk)]; ok {
			// If the tuple exists, we can not write it.
			switch writeData.Opts.OnDuplicateInsert {
			case storage.OnDuplicateInsertIgnore:
				// If the tuple exists and the condition is the same, we can ignore it.
				// We need to use its serialized text instead of reflect.DeepEqual to avoid comparing internal values.
				if proto.Equal(existingTuple.GetKey().GetCondition(), tk.GetCondition()) {
					continue
				}
				// If tuple conditions are different, we throw an error.
				return nil, nil, nil, storage.TupleConditionConflictError(tk)
			case storage.OnDuplicateInsertError:
				fallthrough
			default:
				return nil, nil, nil, storage.InvalidWriteInputError(
					tk,
					openfgav1.TupleOperation_TUPLE_OPERATION_WRITE,
				)
			}
		}

		id := ulid.MustNew(ulid.Timestamp(writeData.Now), entropy).String()
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())

		conditionName, conditionContext, err := MarshalRelationshipCondition(tk.GetCondition())
		if err != nil {
			return nil, nil, nil, err
		}

		writeItems = append(writeItems, []interface{}{
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			tk.GetUser(),
			tupleUtils.GetUserTypeFromUser(tk.GetUser()),
			conditionName,
			conditionContext,
			id,
			sq.Expr("NOW()"),
		})

		changeLogItems = append(changeLogItems, []interface{}{
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			tk.GetUser(),
			conditionName,
			conditionContext,
			openfgav1.TupleOperation_TUPLE_OPERATION_WRITE,
			id,
			sq.Expr("NOW()"),
		})
	}
	return deleteConditions, writeItems, changeLogItems, nil
}

type WriteData struct {
	Deletes storage.Deletes
	Writes  storage.Writes
	Opts    storage.TupleWriteOptions
	Now     time.Time
}

// Write provides the common method for writing to database across sql storage.
func Write(
	ctx context.Context,
	dbInfo *DBInfo,
	db *sql.DB,
	store string,
	writeData WriteData,
) error {
	// 1. Begin Transaction ( Isolation Level = READ COMMITTED )
	txn, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return dbInfo.HandleSQLError(err)
	}
	defer func() { _ = txn.Rollback() }()

	// 2. Compile a SELECT … FOR UPDATE statement to read the tuples for writes and lock tuples for Deletes
	// Build a deduped, sorted list of keys to lock.
	lockKeys := MakeTupleLockKeys(writeData.Deletes, writeData.Writes)
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

		if err := selectExistingRowsForWrite(ctx, dbInfo, store, keys, txn, existing); err != nil {
			return err
		}
	}

	// 4. Construct the deleteConditions, write and changelog items to be written
	deleteConditions, writeItems, changeLogItems, err := GetDeleteWriteChangelogItems(store, existing, writeData)
	if err != nil {
		return err
	}

	for start, totalDeletes := 0, len(deleteConditions); start < totalDeletes; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalDeletes {
			end = totalDeletes
		}

		deleteConditionsBatch := deleteConditions[start:end]

		res, err := dbInfo.stbl.Delete("tuple").Where(sq.Eq{"store": store}).
			Where(deleteConditionsBatch).
			RunWith(txn). // Part of a txn.
			ExecContext(ctx)
		if err != nil {
			return dbInfo.HandleSQLError(err)
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return dbInfo.HandleSQLError(err)
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

		insertBuilder := dbInfo.stbl.
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

		_, err = insertBuilder.
			RunWith(txn). // Part of a txn.
			ExecContext(ctx)
		if err != nil {
			dberr := dbInfo.HandleSQLError(err)
			if errors.Is(dberr, storage.ErrCollision) {
				// ErrCollision is returned on duplicate write (constraint violation), meaning we hit a race condition - someone else inserted the same row(s).
				return storage.ErrWriteConflictOnInsert
			}
			return dberr
		}
	}

	// 5. Execute INSERT changelog statements
	for start, totalItems := 0, len(changeLogItems); start < totalItems; start += storage.DefaultMaxTuplesPerWrite {
		end := start + storage.DefaultMaxTuplesPerWrite
		if end > totalItems {
			end = totalItems
		}

		changeLogBatch := changeLogItems[start:end]

		changelogBuilder := dbInfo.stbl.
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

		_, err = changelogBuilder.RunWith(txn).ExecContext(ctx) // Part of a txn.
		if err != nil {
			return dbInfo.HandleSQLError(err)
		}
	}

	// 6. Commit Transaction
	if err := txn.Commit(); err != nil {
		return dbInfo.HandleSQLError(err)
	}

	return nil
}

// WriteAuthorizationModel writes an authorization model for the given store in one row.
func WriteAuthorizationModel(
	ctx context.Context,
	dbInfo *DBInfo,
	store string,
	model *openfgav1.AuthorizationModel,
) error {
	schemaVersion := model.GetSchemaVersion()
	typeDefinitions := model.GetTypeDefinitions()

	if len(typeDefinitions) < 1 {
		return nil
	}

	pbdata, err := proto.Marshal(model)
	if err != nil {
		return err
	}

	_, err = dbInfo.stbl.
		Insert("authorization_model").
		Columns("store", "authorization_model_id", "schema_version", "type", "type_definition", "serialized_protobuf").
		Values(store, model.GetId(), schemaVersion, "", nil, pbdata).
		ExecContext(ctx)
	if err != nil {
		return dbInfo.HandleSQLError(err)
	}

	return nil
}

// ConstructAuthorizationModelFromSQLRows tries first to read and return a model that was written in one row (the new format).
// If it can't find one, it will then look for a model that was written across multiple rows (the old format).
func ConstructAuthorizationModelFromSQLRows(rows Rows) (*openfgav1.AuthorizationModel, error) {
	var modelID string
	var schemaVersion string
	var typeDefs []*openfgav1.TypeDefinition
	if rows.Next() {
		var typeName string
		var marshalledTypeDef []byte
		var marshalledModel []byte
		err := rows.Scan(&modelID, &schemaVersion, &typeName, &marshalledTypeDef, &marshalledModel)
		if err != nil {
			return nil, err
		}

		if len(marshalledModel) > 0 {
			// Prefer building an authorization model from the first row that has it available.
			var model openfgav1.AuthorizationModel
			if err := proto.Unmarshal(marshalledModel, &model); err != nil {
				return nil, err
			}

			return &model, nil
		}

		var typeDef openfgav1.TypeDefinition
		if err := proto.Unmarshal(marshalledTypeDef, &typeDef); err != nil {
			return nil, err
		}

		typeDefs = append(typeDefs, &typeDef)
	}

	for rows.Next() {
		var scannedModelID string
		var typeName string
		var marshalledTypeDef []byte
		var marshalledModel []byte
		err := rows.Scan(&scannedModelID, &schemaVersion, &typeName, &marshalledTypeDef, &marshalledModel)
		if err != nil {
			return nil, err
		}
		if scannedModelID != modelID {
			break
		}

		var typeDef openfgav1.TypeDefinition
		if err := proto.Unmarshal(marshalledTypeDef, &typeDef); err != nil {
			return nil, err
		}

		typeDefs = append(typeDefs, &typeDef)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(typeDefs) == 0 {
		return nil, storage.ErrNotFound
	}

	return &openfgav1.AuthorizationModel{
		SchemaVersion:   schemaVersion,
		Id:              modelID,
		TypeDefinitions: typeDefs,
		// Conditions don't exist in the old data format
	}, nil
}

// FindLatestAuthorizationModel reads the latest authorization model corresponding to the store.
func FindLatestAuthorizationModel(
	ctx context.Context,
	dbInfo *DBInfo,
	store string,
) (*openfgav1.AuthorizationModel, error) {
	rows, err := dbInfo.stbl.
		Select("authorization_model_id", "schema_version", "type", "type_definition", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{"store": store}).
		OrderBy("authorization_model_id desc").
		QueryContext(ctx)
	if err != nil {
		return nil, dbInfo.HandleSQLError(err)
	}
	defer rows.Close()
	ret, err := ConstructAuthorizationModelFromSQLRows(rows)
	if err != nil {
		return nil, dbInfo.HandleSQLError(err)
	}

	return ret, nil
}

// ReadAuthorizationModel reads the model corresponding to store and model ID.
func ReadAuthorizationModel(
	ctx context.Context,
	dbInfo *DBInfo,
	store, modelID string,
) (*openfgav1.AuthorizationModel, error) {
	rows, err := dbInfo.stbl.
		Select("authorization_model_id", "schema_version", "type", "type_definition", "serialized_protobuf").
		From("authorization_model").
		Where(sq.Eq{
			"store":                  store,
			"authorization_model_id": modelID,
		}).
		QueryContext(ctx)
	if err != nil {
		return nil, dbInfo.HandleSQLError(err)
	}
	defer rows.Close()
	ret, err := ConstructAuthorizationModelFromSQLRows(rows)
	if err != nil {
		return nil, dbInfo.HandleSQLError(err)
	}

	return ret, nil
}

// IsVersionReady checks if the database schema revision is at least the minimum supported revision.
// The passed in context should have a timeout.
func IsVersionReady(ctx context.Context, skipVersionCheck bool, db *sql.DB) (storage.ReadinessStatus, error) {
	if skipVersionCheck {
		return storage.ReadinessStatus{
			IsReady: true,
		}, nil
	}

	revision, err := goose.GetDBVersionContext(ctx, db)
	if err != nil {
		return storage.ReadinessStatus{}, err
	}

	if revision < build.MinimumSupportedDatastoreSchemaRevision {
		return storage.ReadinessStatus{
			Message: "datastore requires migrations: at revision '" +
				strconv.FormatInt(revision, 10) +
				"', but requires '" +
				strconv.FormatInt(build.MinimumSupportedDatastoreSchemaRevision, 10) +
				"'. Run 'openfga migrate'.",
			IsReady: false,
		}, nil
	}
	return storage.ReadinessStatus{
		IsReady: true,
	}, nil
}

// IsReady returns true if connection to datastore is successful AND
// (the datastore has the latest migration applied OR skipVersionCheck).
func IsReady(ctx context.Context, skipVersionCheck bool, db *sql.DB) (storage.ReadinessStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	// do ping first to ensure we have better error message
	// if error is due to connection issue.
	if pingErr := db.PingContext(ctx); pingErr != nil {
		return storage.ReadinessStatus{}, pingErr
	}
	return IsVersionReady(ctx, skipVersionCheck, db)
}

func AddFromUlid(sb sq.SelectBuilder, fromUlid string, sortDescending bool) sq.SelectBuilder {
	if sortDescending {
		return sb.Where(sq.Lt{"ulid": fromUlid})
	}
	return sb.Where(sq.Gt{"ulid": fromUlid})
}
