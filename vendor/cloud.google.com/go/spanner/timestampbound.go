/*
Copyright 2017 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package spanner

import (
	"fmt"
	"time"

	pbd "github.com/golang/protobuf/ptypes/duration"
	pbt "github.com/golang/protobuf/ptypes/timestamp"
	sppb "google.golang.org/genproto/googleapis/spanner/v1"
)

// timestampBoundType specifies the timestamp bound mode.
type timestampBoundType int

const (
	strong           timestampBoundType = iota // strong reads
	exactStaleness                             // read with exact staleness
	maxStaleness                               // read with max staleness
	minReadTimestamp                           // read with min freshness
	readTimestamp                              // read data at exact timestamp
)

// TimestampBound defines how Cloud Spanner will choose a timestamp for a single
// read/query or read-only transaction.
//
// The types of timestamp bound are:
//
//	- Strong (the default).
//	- Bounded staleness.
//	- Exact staleness.
//
// If the Cloud Spanner database to be read is geographically distributed, stale
// read-only transactions can execute more quickly than strong or read-write
// transactions, because they are able to execute far from the leader replica.
//
// Each type of timestamp bound is discussed in detail below.  A TimestampBound
// can be specified when creating transactions, see the documentation of
// spanner.Client for an example.
//
// Strong reads
//
// Strong reads are guaranteed to see the effects of all transactions that have
// committed before the start of the read. Furthermore, all rows yielded by a
// single read are consistent with each other - if any part of the read
// observes a transaction, all parts of the read see the transaction.
//
// Strong reads are not repeatable: two consecutive strong read-only
// transactions might return inconsistent results if there are concurrent
// writes. If consistency across reads is required, the reads should be
// executed within a transaction or at an exact read timestamp.
//
// Use StrongRead() to create a bound of this type.
//
// Exact staleness
//
// These timestamp bounds execute reads at a user-specified timestamp. Reads at
// a timestamp are guaranteed to see a consistent prefix of the global
// transaction history: they observe modifications done by all transactions
// with a commit timestamp less than or equal to the read timestamp, and
// observe none of the modifications done by transactions with a larger commit
// timestamp. They will block until all conflicting transactions that may be
// assigned commit timestamps less than or equal to the read timestamp have
// finished.
//
// The timestamp can either be expressed as an absolute Cloud Spanner commit
// timestamp or a staleness relative to the current time.
//
// These modes do not require a "negotiation phase" to pick a timestamp. As a
// result, they execute slightly faster than the equivalent boundedly stale
// concurrency modes. On the other hand, boundedly stale reads usually return
// fresher results.
//
// Use ReadTimestamp() and ExactStaleness() to create a bound of this type.
//
// Bounded staleness
//
// Bounded staleness modes allow Cloud Spanner to pick the read timestamp, subject to
// a user-provided staleness bound. Cloud Spanner chooses the newest timestamp within
// the staleness bound that allows execution of the reads at the closest
// available replica without blocking.
//
// All rows yielded are consistent with each other -- if any part of the read
// observes a transaction, all parts of the read see the transaction. Boundedly
// stale reads are not repeatable: two stale reads, even if they use the same
// staleness bound, can execute at different timestamps and thus return
// inconsistent results.
//
// Boundedly stale reads execute in two phases: the first phase negotiates a
// timestamp among all replicas needed to serve the read. In the second phase,
// reads are executed at the negotiated timestamp.
//
// As a result of the two phase execution, bounded staleness reads are usually
// a little slower than comparable exact staleness reads. However, they are
// typically able to return fresher results, and are more likely to execute at
// the closest replica.
//
// Because the timestamp negotiation requires up-front knowledge of which rows
// will be read, it can only be used with single-use reads and single-use
// read-only transactions.
//
// Use MinReadTimestamp() and MaxStaleness() to create a bound of this type.
//
// Old read timestamps and garbage collection
//
// Cloud Spanner continuously garbage collects deleted and overwritten data in the
// background to reclaim storage space. This process is known as "version
// GC". By default, version GC reclaims versions after they are four hours
// old. Because of this, Cloud Spanner cannot perform reads at read timestamps more
// than four hours in the past. This restriction also applies to in-progress
// reads and/or SQL queries whose timestamp become too old while
// executing. Reads and SQL queries with too-old read timestamps fail with the
// error ErrorCode.FAILED_PRECONDITION.
type TimestampBound struct {
	mode timestampBoundType
	d    time.Duration
	t    time.Time
}

// StrongRead returns a TimestampBound that will perform reads and queries at a
// timestamp where all previously committed transactions are visible.
func StrongRead() TimestampBound {
	return TimestampBound{mode: strong}
}

// ExactStaleness returns a TimestampBound that will perform reads and queries
// at an exact staleness.
func ExactStaleness(d time.Duration) TimestampBound {
	return TimestampBound{
		mode: exactStaleness,
		d:    d,
	}
}

// MaxStaleness returns a TimestampBound that will perform reads and queries at
// a time chosen to be at most "d" stale.
func MaxStaleness(d time.Duration) TimestampBound {
	return TimestampBound{
		mode: maxStaleness,
		d:    d,
	}
}

// MinReadTimestamp returns a TimestampBound that bound that will perform reads
// and queries at a time chosen to be at least "t".
func MinReadTimestamp(t time.Time) TimestampBound {
	return TimestampBound{
		mode: minReadTimestamp,
		t:    t,
	}
}

// ReadTimestamp returns a TimestampBound that will peform reads and queries at
// the given time.
func ReadTimestamp(t time.Time) TimestampBound {
	return TimestampBound{
		mode: readTimestamp,
		t:    t,
	}
}

// String implements fmt.Stringer.
func (tb TimestampBound) String() string {
	switch tb.mode {
	case strong:
		return fmt.Sprintf("(strong)")
	case exactStaleness:
		return fmt.Sprintf("(exactStaleness: %s)", tb.d)
	case maxStaleness:
		return fmt.Sprintf("(maxStaleness: %s)", tb.d)
	case minReadTimestamp:
		return fmt.Sprintf("(minReadTimestamp: %s)", tb.t)
	case readTimestamp:
		return fmt.Sprintf("(readTimestamp: %s)", tb.t)
	default:
		return fmt.Sprintf("{mode=%v, d=%v, t=%v}", tb.mode, tb.d, tb.t)
	}
}

// durationProto takes a time.Duration and converts it into pdb.Duration for
// calling gRPC APIs.
func durationProto(d time.Duration) *pbd.Duration {
	n := d.Nanoseconds()
	return &pbd.Duration{
		Seconds: n / int64(time.Second),
		Nanos:   int32(n % int64(time.Second)),
	}
}

// timestampProto takes a time.Time and converts it into pbt.Timestamp for calling
// gRPC APIs.
func timestampProto(t time.Time) *pbt.Timestamp {
	return &pbt.Timestamp{
		Seconds: t.Unix(),
		Nanos:   int32(t.Nanosecond()),
	}
}

// buildTransactionOptionsReadOnly converts a spanner.TimestampBound into a sppb.TransactionOptions_ReadOnly
// transaction option, which is then used in transactional reads.
func buildTransactionOptionsReadOnly(tb TimestampBound, returnReadTimestamp bool) *sppb.TransactionOptions_ReadOnly {
	pb := &sppb.TransactionOptions_ReadOnly{
		ReturnReadTimestamp: returnReadTimestamp,
	}
	switch tb.mode {
	case strong:
		pb.TimestampBound = &sppb.TransactionOptions_ReadOnly_Strong{
			Strong: true,
		}
	case exactStaleness:
		pb.TimestampBound = &sppb.TransactionOptions_ReadOnly_ExactStaleness{
			ExactStaleness: durationProto(tb.d),
		}
	case maxStaleness:
		pb.TimestampBound = &sppb.TransactionOptions_ReadOnly_MaxStaleness{
			MaxStaleness: durationProto(tb.d),
		}
	case minReadTimestamp:
		pb.TimestampBound = &sppb.TransactionOptions_ReadOnly_MinReadTimestamp{
			MinReadTimestamp: timestampProto(tb.t),
		}
	case readTimestamp:
		pb.TimestampBound = &sppb.TransactionOptions_ReadOnly_ReadTimestamp{
			ReadTimestamp: timestampProto(tb.t),
		}
	default:
		panic(fmt.Sprintf("buildTransactionOptionsReadOnly(%v,%v)", tb, returnReadTimestamp))
	}
	return pb
}
