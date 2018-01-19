// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package firestore

import (
	"errors"

	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"

	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
)

// Transaction represents a Firestore transaction.
type Transaction struct {
	c              *Client
	ctx            context.Context
	id             []byte
	writes         []*pb.Write
	maxAttempts    int
	readOnly       bool
	readAfterWrite bool
}

// A TransactionOption is an option passed to Client.Transaction.
type TransactionOption interface {
	config(t *Transaction)
}

// MaxAttempts is a TransactionOption that configures the maximum number of times to
// try a transaction. In defaults to DefaultTransactionMaxAttempts.
func MaxAttempts(n int) maxAttempts { return maxAttempts(n) }

type maxAttempts int

func (m maxAttempts) config(t *Transaction) { t.maxAttempts = int(m) }

// DefaultTransactionMaxAttempts is the default number of times to attempt a transaction.
const DefaultTransactionMaxAttempts = 5

// ReadOnly is a TransactionOption that makes the transaction read-only. Read-only
// transactions cannot issue write operations, but are more efficient.
var ReadOnly = ro{}

type ro struct{}

func (ro) config(t *Transaction) { t.readOnly = true }

var (
	// ErrConcurrentTransaction is returned when a transaction is rolled back due
	// to a conflict with a concurrent transaction.
	ErrConcurrentTransaction = errors.New("firestore: concurrent transaction")

	// Defined here for testing.
	errReadAfterWrite     = errors.New("firestore: read after write in transaction")
	errWriteReadOnly      = errors.New("firestore: write in read-only transaction")
	errNonTransactionalOp = errors.New("firestore: non-transactional operation inside a transaction")
	errNestedTransaction  = errors.New("firestore: nested transaction")
)

type transactionInProgressKey struct{}

func checkTransaction(ctx context.Context) error {
	if ctx.Value(transactionInProgressKey{}) != nil {
		return errNonTransactionalOp
	}
	return nil
}

// RunTransaction runs f in a transaction. f should use the transaction it is given
// for all Firestore operations. For any operation requiring a context, f should use
// the context it is passed, not the first argument to RunTransaction.
//
// f must not call Commit or Rollback on the provided Transaction.
//
// If f returns nil, RunTransaction commits the transaction. If the commit fails due
// to a conflicting transaction, RunTransaction retries f. It gives up and returns
// ErrConcurrentTransaction after a number of attempts that can be configured with
// the MaxAttempts option. If the commit succeeds, RunTransaction returns a nil error.
//
// If f returns non-nil, then the transaction will be rolled back and
// this method will return the same error. The function f is not retried.
//
// Note that when f returns, the transaction is not committed. Calling code
// must not assume that any of f's changes have been committed until
// RunTransaction returns nil.
//
// Since f may be called more than once, f should usually be idempotent – that is, it
// should have the same result when called multiple times.
func (c *Client) RunTransaction(ctx context.Context, f func(context.Context, *Transaction) error, opts ...TransactionOption) error {
	if ctx.Value(transactionInProgressKey{}) != nil {
		return errNestedTransaction
	}
	db := c.path()
	t := &Transaction{
		c:           c,
		ctx:         withResourceHeader(ctx, db),
		maxAttempts: DefaultTransactionMaxAttempts,
	}
	for _, opt := range opts {
		opt.config(t)
	}
	var txOpts *pb.TransactionOptions
	if t.readOnly {
		txOpts = &pb.TransactionOptions{
			Mode: &pb.TransactionOptions_ReadOnly_{&pb.TransactionOptions_ReadOnly{}},
		}
	}
	var backoff gax.Backoff
	// TODO(jba): use other than the standard backoff parameters?
	// TODO(jba): get backoff time from gRPC trailer metadata? See extractRetryDelay in https://code.googlesource.com/gocloud/+/master/spanner/retry.go.
	var err error
	for i := 0; i < t.maxAttempts; i++ {
		var res *pb.BeginTransactionResponse
		res, err = t.c.c.BeginTransaction(t.ctx, &pb.BeginTransactionRequest{
			Database: db,
			Options:  txOpts,
		})
		if err != nil {
			return err
		}
		t.id = res.Transaction
		err = f(context.WithValue(ctx, transactionInProgressKey{}, 1), t)
		// Read after write can only be checked client-side, so we make sure to check
		// even if the user does not.
		if err == nil && t.readAfterWrite {
			err = errReadAfterWrite
		}
		if err != nil {
			t.rollback()
			// Prefer f's returned error to rollback error.
			return err
		}
		_, err = t.c.c.Commit(t.ctx, &pb.CommitRequest{
			Database:    t.c.path(),
			Writes:      t.writes,
			Transaction: t.id,
		})
		// If a read-write transaction returns Aborted, retry.
		// On success or other failures, return here.
		if t.readOnly || grpc.Code(err) != codes.Aborted {
			// According to the Firestore team, we should not roll back here
			// if err != nil. But spanner does.
			// See https://code.googlesource.com/gocloud/+/master/spanner/transaction.go#740.
			return err
		}

		if txOpts == nil {
			// txOpts can only be nil if is the first retry of a read-write transaction.
			// (It is only set here and in the body of "if t.readOnly" above.)
			// Mention the transaction ID in BeginTransaction so the service
			// knows it is a retry.
			txOpts = &pb.TransactionOptions{
				Mode: &pb.TransactionOptions_ReadWrite_{
					&pb.TransactionOptions_ReadWrite{RetryTransaction: t.id},
				},
			}
		}
		// Use exponential backoff to avoid contention with other running
		// transactions.
		if cerr := gax.Sleep(ctx, backoff.Pause()); cerr != nil {
			err = cerr
			break
		}
	}
	// If we run out of retries, return the last error we saw (which should
	// be the Aborted from Commit, or a context error).
	if err != nil {
		t.rollback()
	}
	return err
}

func (t *Transaction) rollback() {
	_ = t.c.c.Rollback(t.ctx, &pb.RollbackRequest{
		Database:    t.c.path(),
		Transaction: t.id,
	})
	// Ignore the rollback error.
	// TODO(jba): Log it?
	// Note: Rollback is idempotent so it will be retried by the gapic layer.
}

// Get gets the document in the context of the transaction.
func (t *Transaction) Get(dr *DocumentRef) (*DocumentSnapshot, error) {
	if len(t.writes) > 0 {
		t.readAfterWrite = true
		return nil, errReadAfterWrite
	}
	docProto, err := t.c.c.GetDocument(t.ctx, &pb.GetDocumentRequest{
		Name:                dr.Path,
		ConsistencySelector: &pb.GetDocumentRequest_Transaction{t.id},
	})
	if err != nil {
		return nil, err
	}
	return newDocumentSnapshot(dr, docProto, t.c)
}

// A Queryer is a Query or a CollectionRef. CollectionRefs act as queries whose
// results are all the documents in the collection.
type Queryer interface {
	query() *Query
}

// Documents returns a DocumentIterator based on given Query or CollectionRef. The
// results will be in the context of the transaction.
func (t *Transaction) Documents(q Queryer) *DocumentIterator {
	if len(t.writes) > 0 {
		t.readAfterWrite = true
		return &DocumentIterator{err: errReadAfterWrite}
	}
	return &DocumentIterator{
		ctx: t.ctx,
		q:   q.query(),
		tid: t.id,
	}
}

// Create adds a Create operation to the Transaction.
// See DocumentRef.Create for details.
func (t *Transaction) Create(dr *DocumentRef, data interface{}) error {
	return t.addWrites(dr.newCreateWrites(data))
}

// Set adds a Set operation to the Transaction.
// See DocumentRef.Set for details.
func (t *Transaction) Set(dr *DocumentRef, data interface{}, opts ...SetOption) error {
	return t.addWrites(dr.newSetWrites(data, opts))
}

// Delete adds a Delete operation to the Transaction.
// See DocumentRef.Delete for details.
func (t *Transaction) Delete(dr *DocumentRef, opts ...Precondition) error {
	return t.addWrites(dr.newDeleteWrites(opts))
}

// Update adds a new Update operation to the Transaction.
// See DocumentRef.Update for details.
func (t *Transaction) Update(dr *DocumentRef, data []Update, opts ...Precondition) error {
	return t.addWrites(dr.newUpdatePathWrites(data, opts))
}

func (t *Transaction) addWrites(ws []*pb.Write, err error) error {
	if t.readOnly {
		return errWriteReadOnly
	}
	if err != nil {
		return err
	}
	t.writes = append(t.writes, ws...)
	return nil
}
