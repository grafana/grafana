package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"sync"

	sq "github.com/Masterminds/squirrel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/storage"
)

type errorHandlerFn func(error, ...interface{}) error

// SQLTupleIterator is a struct that implements the storage.TupleIterator
// interface for iterating over tuples fetched from a SQL database.
type SQLTupleIterator struct {
	rows           *sql.Rows // GUARDED_BY(mu)
	sb             sq.SelectBuilder
	handleSQLError errorHandlerFn
	// firstRow is used as a temporary storage place if head is called.
	// If firstRow is nil and Head is called, rows.Next() will return the first item and advance
	// the iterator. Thus, we will need to store this first item so that future Head() and Next()
	// will use this item instead. Otherwise, the first item will be lost.
	firstRow *storage.TupleRecord // GUARDED_BY(mu)
	mu       sync.Mutex
}

// Ensures that SQLTupleIterator implements the TupleIterator interface.
var _ storage.TupleIterator = (*SQLTupleIterator)(nil)

// NewSQLTupleIterator returns a SQL tuple iterator.
func NewSQLTupleIterator(sb sq.SelectBuilder, errHandler errorHandlerFn) *SQLTupleIterator {
	return &SQLTupleIterator{
		sb:             sb,
		rows:           nil,
		handleSQLError: errHandler,
		firstRow:       nil,
		mu:             sync.Mutex{},
	}
}

func (t *SQLTupleIterator) fetchBuffer(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "sqlite.fetchBuffer", trace.WithAttributes())
	defer span.End()
	ctx = context.WithoutCancel(ctx)
	rows, err := t.sb.QueryContext(ctx)
	if err != nil {
		return t.handleSQLError(err)
	}
	t.rows = rows
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
		&record.UserObjectType,
		&record.UserObjectID,
		&record.UserRelation,
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
		&record.UserObjectType,
		&record.UserObjectID,
		&record.UserRelation,
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
func (t *SQLTupleIterator) ToArray(
	ctx context.Context,
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
