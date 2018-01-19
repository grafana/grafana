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
	"bytes"
	"io"
	"sync/atomic"
	"time"

	log "github.com/golang/glog"
	proto "github.com/golang/protobuf/proto"
	proto3 "github.com/golang/protobuf/ptypes/struct"
	"golang.org/x/net/context"

	"google.golang.org/api/iterator"
	sppb "google.golang.org/genproto/googleapis/spanner/v1"
	"google.golang.org/grpc/codes"
)

// streamingReceiver is the interface for receiving data from a client side
// stream.
type streamingReceiver interface {
	Recv() (*sppb.PartialResultSet, error)
}

// errEarlyReadEnd returns error for read finishes when gRPC stream is still active.
func errEarlyReadEnd() error {
	return spannerErrorf(codes.FailedPrecondition, "read completed with active stream")
}

// stream is the internal fault tolerant method for streaming data from
// Cloud Spanner.
func stream(ctx context.Context, rpc func(ct context.Context, resumeToken []byte) (streamingReceiver, error), setTimestamp func(time.Time), release func(error)) *RowIterator {
	ctx, cancel := context.WithCancel(ctx)
	return &RowIterator{
		streamd:      newResumableStreamDecoder(ctx, rpc),
		rowd:         &partialResultSetDecoder{},
		setTimestamp: setTimestamp,
		release:      release,
		cancel:       cancel,
	}
}

// RowIterator is an iterator over Rows.
type RowIterator struct {
	streamd      *resumableStreamDecoder
	rowd         *partialResultSetDecoder
	setTimestamp func(time.Time)
	release      func(error)
	cancel       func()
	err          error
	rows         []*Row
}

// Next returns the next result. Its second return value is iterator.Done if
// there are no more results. Once Next returns Done, all subsequent calls
// will return Done.
func (r *RowIterator) Next() (*Row, error) {
	if r.err != nil {
		return nil, r.err
	}
	for len(r.rows) == 0 && r.streamd.next() {
		r.rows, r.err = r.rowd.add(r.streamd.get())
		if r.err != nil {
			return nil, r.err
		}
		if !r.rowd.ts.IsZero() && r.setTimestamp != nil {
			r.setTimestamp(r.rowd.ts)
			r.setTimestamp = nil
		}
	}
	if len(r.rows) > 0 {
		row := r.rows[0]
		r.rows = r.rows[1:]
		return row, nil
	}
	if err := r.streamd.lastErr(); err != nil {
		r.err = toSpannerError(err)
	} else if !r.rowd.done() {
		r.err = errEarlyReadEnd()
	} else {
		r.err = iterator.Done
	}
	return nil, r.err
}

// Do calls the provided function once in sequence for each row in the iteration.  If the
// function returns a non-nil error, Do immediately returns that error.
//
// If there are no rows in the iterator, Do will return nil without calling the
// provided function.
//
// Do always calls Stop on the iterator.
func (r *RowIterator) Do(f func(r *Row) error) error {
	defer r.Stop()
	for {
		row, err := r.Next()
		switch err {
		case iterator.Done:
			return nil
		case nil:
			if err = f(row); err != nil {
				return err
			}
		default:
			return err
		}
	}
}

// Stop terminates the iteration. It should be called after every iteration.
func (r *RowIterator) Stop() {
	if r.cancel != nil {
		r.cancel()
	}
	if r.release != nil {
		r.release(r.err)
		if r.err == nil {
			r.err = spannerErrorf(codes.FailedPrecondition, "Next called after Stop")
		}
		r.release = nil

	}
}

// partialResultQueue implements a simple FIFO queue.  The zero value is a
// valid queue.
type partialResultQueue struct {
	q     []*sppb.PartialResultSet
	first int
	last  int
	n     int // number of elements in queue
}

// empty returns if the partialResultQueue is empty.
func (q *partialResultQueue) empty() bool {
	return q.n == 0
}

// errEmptyQueue returns error for dequeuing an empty queue.
func errEmptyQueue() error {
	return spannerErrorf(codes.OutOfRange, "empty partialResultQueue")
}

// peekLast returns the last item in partialResultQueue; if the queue
// is empty, it returns error.
func (q *partialResultQueue) peekLast() (*sppb.PartialResultSet, error) {
	if q.empty() {
		return nil, errEmptyQueue()
	}
	return q.q[(q.last+cap(q.q)-1)%cap(q.q)], nil
}

// push adds an item to the tail of partialResultQueue.
func (q *partialResultQueue) push(r *sppb.PartialResultSet) {
	if q.q == nil {
		q.q = make([]*sppb.PartialResultSet, 8 /* arbitrary */)
	}
	if q.n == cap(q.q) {
		buf := make([]*sppb.PartialResultSet, cap(q.q)*2)
		for i := 0; i < q.n; i++ {
			buf[i] = q.q[(q.first+i)%cap(q.q)]
		}
		q.q = buf
		q.first = 0
		q.last = q.n
	}
	q.q[q.last] = r
	q.last = (q.last + 1) % cap(q.q)
	q.n++
}

// pop removes an item from the head of partialResultQueue and returns
// it.
func (q *partialResultQueue) pop() *sppb.PartialResultSet {
	if q.n == 0 {
		return nil
	}
	r := q.q[q.first]
	q.q[q.first] = nil
	q.first = (q.first + 1) % cap(q.q)
	q.n--
	return r
}

// clear empties partialResultQueue.
func (q *partialResultQueue) clear() {
	*q = partialResultQueue{}
}

// dump retrieves all items from partialResultQueue and return them in a slice.
// It is used only in tests.
func (q *partialResultQueue) dump() []*sppb.PartialResultSet {
	var dq []*sppb.PartialResultSet
	for i := q.first; len(dq) < q.n; i = (i + 1) % cap(q.q) {
		dq = append(dq, q.q[i])
	}
	return dq
}

// resumableStreamDecoderState encodes resumableStreamDecoder's status.
// See also the comments for resumableStreamDecoder.Next.
type resumableStreamDecoderState int

const (
	unConnected         resumableStreamDecoderState = iota // 0
	queueingRetryable                                      // 1
	queueingUnretryable                                    // 2
	aborted                                                // 3
	finished                                               // 4
)

// resumableStreamDecoder provides a resumable interface for receiving
// sppb.PartialResultSet(s) from a given query wrapped by
// resumableStreamDecoder.rpc().
type resumableStreamDecoder struct {
	// state is the current status of resumableStreamDecoder, see also
	// the comments for resumableStreamDecoder.Next.
	state resumableStreamDecoderState
	// stateWitness when non-nil is called to observe state change,
	// used for testing.
	stateWitness func(resumableStreamDecoderState)
	// ctx is the caller's context, used for cancel/timeout Next().
	ctx context.Context
	// rpc is a factory of streamingReceiver, which might resume
	// a pervious stream from the point encoded in restartToken.
	// rpc is always a wrapper of a Cloud Spanner query which is
	// resumable.
	rpc func(ctx context.Context, restartToken []byte) (streamingReceiver, error)
	// stream is the current RPC streaming receiver.
	stream streamingReceiver
	// q buffers received yet undecoded partial results.
	q partialResultQueue
	// bytesBetweenResumeTokens is the proxy of the byte size of PartialResultSets being queued
	// between two resume tokens. Once bytesBetweenResumeTokens is greater than
	// maxBytesBetweenResumeTokens, resumableStreamDecoder goes into queueingUnretryable state.
	bytesBetweenResumeTokens int32
	// maxBytesBetweenResumeTokens is the max number of bytes that can be buffered
	// between two resume tokens. It is always copied from the global maxBytesBetweenResumeTokens
	// atomically.
	maxBytesBetweenResumeTokens int32
	// np is the next sppb.PartialResultSet ready to be returned
	// to caller of resumableStreamDecoder.Get().
	np *sppb.PartialResultSet
	// resumeToken stores the resume token that resumableStreamDecoder has
	// last revealed to caller.
	resumeToken []byte
	// retryCount is the number of retries that have been carried out so far
	retryCount int
	// err is the last error resumableStreamDecoder has encountered so far.
	err error
	// backoff to compute delays between retries.
	backoff exponentialBackoff
}

// newResumableStreamDecoder creates a new resumeableStreamDecoder instance.
// Parameter rpc should be a function that creates a new stream
// beginning at the restartToken if non-nil.
func newResumableStreamDecoder(ctx context.Context, rpc func(ct context.Context, restartToken []byte) (streamingReceiver, error)) *resumableStreamDecoder {
	return &resumableStreamDecoder{
		ctx: ctx,
		rpc: rpc,
		maxBytesBetweenResumeTokens: atomic.LoadInt32(&maxBytesBetweenResumeTokens),
		backoff:                     defaultBackoff,
	}
}

// changeState fulfills state transition for resumableStateDecoder.
func (d *resumableStreamDecoder) changeState(target resumableStreamDecoderState) {
	if d.state == queueingRetryable && d.state != target {
		// Reset bytesBetweenResumeTokens because it is only meaningful/changed under
		// queueingRetryable state.
		d.bytesBetweenResumeTokens = 0
	}
	d.state = target
	if d.stateWitness != nil {
		d.stateWitness(target)
	}
}

// isNewResumeToken returns if the observed resume token is different from
// the one returned from server last time.
func (d *resumableStreamDecoder) isNewResumeToken(rt []byte) bool {
	if rt == nil {
		return false
	}
	if bytes.Compare(rt, d.resumeToken) == 0 {
		return false
	}
	return true
}

// Next advances to the next available partial result set.  If error or no
// more, returns false, call Err to determine if an error was encountered.
// The following diagram illustrates the state machine of resumableStreamDecoder
// that Next() implements. Note that state transition can be only triggered by
// RPC activities.
/*
        rpc() fails retryable
      +---------+
      |         |    rpc() fails unretryable/ctx timeouts or cancelled
      |         |   +------------------------------------------------+
      |         |   |                                                |
      |         v   |                                                v
      |     +---+---+---+                       +--------+    +------+--+
      +-----+unConnected|                       |finished|    | aborted |<----+
            |           |                       ++-----+-+    +------+--+     |
            +---+----+--+                        ^     ^             ^        |
                |    ^                           |     |             |        |
                |    |                           |     |     recv() fails     |
                |    |                           |     |             |        |
                |    |recv() fails retryable     |     |             |        |
                |    |with valid ctx             |     |             |        |
                |    |                           |     |             |        |
      rpc() succeeds |   +-----------------------+     |             |        |
                |    |   |         recv EOF         recv EOF         |        |
                |    |   |                             |             |        |
                v    |   |     Queue size exceeds      |             |        |
            +---+----+---+----+threshold       +-------+-----------+ |        |
+---------->+                 +--------------->+                   +-+        |
|           |queueingRetryable|                |queueingUnretryable|          |
|           |                 +<---------------+                   |          |
|           +---+----------+--+ pop() returns  +--+----+-----------+          |
|               |          |    resume token      |    ^                      |
|               |          |                      |    |                      |
|               |          |                      |    |                      |
+---------------+          |                      |    |                      |
   recv() succeeds         |                      +----+                      |
                           |                      recv() succeeds             |
                           |                                                  |
                           |                                                  |
                           |                                                  |
                           |                                                  |
                           |                                                  |
                           +--------------------------------------------------+
                                               recv() fails unretryable

*/
var (
	// maxBytesBetweenResumeTokens is the maximum amount of bytes that resumableStreamDecoder
	// in queueingRetryable state can use to queue PartialResultSets before getting
	// into queueingUnretryable state.
	maxBytesBetweenResumeTokens = int32(128 * 1024 * 1024)
)

func (d *resumableStreamDecoder) next() bool {
	for {
		select {
		case <-d.ctx.Done():
			// Do context check here so that even gRPC failed to do
			// so, resumableStreamDecoder can still break the loop
			// as expected.
			d.err = errContextCanceled(d.ctx, d.err)
			d.changeState(aborted)
		default:
		}
		switch d.state {
		case unConnected:
			// If no gRPC stream is available, try to initiate one.
			if d.stream, d.err = d.rpc(d.ctx, d.resumeToken); d.err != nil {
				if isRetryable(d.err) {
					d.doBackOff()
					// Be explicit about state transition, although the
					// state doesn't actually change. State transition
					// will be triggered only by RPC activity, regardless of
					// whether there is an actual state change or not.
					d.changeState(unConnected)
					continue
				}
				d.changeState(aborted)
				continue
			}
			d.resetBackOff()
			d.changeState(queueingRetryable)
			continue
		case queueingRetryable:
			fallthrough
		case queueingUnretryable:
			// Receiving queue is not empty.
			last, err := d.q.peekLast()
			if err != nil {
				// Only the case that receiving queue is empty could cause peekLast to
				// return error and in such case, we should try to receive from stream.
				d.tryRecv()
				continue
			}
			if d.isNewResumeToken(last.ResumeToken) {
				// Got new resume token, return buffered sppb.PartialResultSets to caller.
				d.np = d.q.pop()
				if d.q.empty() {
					d.bytesBetweenResumeTokens = 0
					// The new resume token was just popped out from queue, record it.
					d.resumeToken = d.np.ResumeToken
					d.changeState(queueingRetryable)
				}
				return true
			}
			if d.bytesBetweenResumeTokens >= d.maxBytesBetweenResumeTokens && d.state == queueingRetryable {
				d.changeState(queueingUnretryable)
				continue
			}
			if d.state == queueingUnretryable {
				// When there is no resume token observed,
				// only yield sppb.PartialResultSets to caller under
				// queueingUnretryable state.
				d.np = d.q.pop()
				return true
			}
			// Needs to receive more from gRPC stream till a new resume token
			// is observed.
			d.tryRecv()
			continue
		case aborted:
			// Discard all pending items because none of them
			// should be yield to caller.
			d.q.clear()
			return false
		case finished:
			// If query has finished, check if there are still buffered messages.
			if d.q.empty() {
				// No buffered PartialResultSet.
				return false
			}
			// Although query has finished, there are still buffered PartialResultSets.
			d.np = d.q.pop()
			return true

		default:
			log.Errorf("Unexpected resumableStreamDecoder.state: %v", d.state)
			return false
		}
	}
}

// tryRecv attempts to receive a PartialResultSet from gRPC stream.
func (d *resumableStreamDecoder) tryRecv() {
	var res *sppb.PartialResultSet
	if res, d.err = d.stream.Recv(); d.err != nil {
		if d.err == io.EOF {
			d.err = nil
			d.changeState(finished)
			return
		}
		if isRetryable(d.err) && d.state == queueingRetryable {
			d.err = nil
			// Discard all queue items (none have resume tokens).
			d.q.clear()
			d.stream = nil
			d.changeState(unConnected)
			d.doBackOff()
			return
		}
		d.changeState(aborted)
		return
	}
	d.q.push(res)
	if d.state == queueingRetryable && !d.isNewResumeToken(res.ResumeToken) {
		// adjusting d.bytesBetweenResumeTokens
		d.bytesBetweenResumeTokens += int32(proto.Size(res))
	}
	d.resetBackOff()
	d.changeState(d.state)
}

// resetBackOff clears the internal retry counter of
// resumableStreamDecoder so that the next exponential
// backoff will start at a fresh state.
func (d *resumableStreamDecoder) resetBackOff() {
	d.retryCount = 0
}

// doBackoff does an exponential backoff sleep.
func (d *resumableStreamDecoder) doBackOff() {
	ticker := time.NewTicker(d.backoff.delay(d.retryCount))
	defer ticker.Stop()
	d.retryCount++
	select {
	case <-d.ctx.Done():
	case <-ticker.C:
	}
}

// get returns the most recent PartialResultSet generated by a call to next.
func (d *resumableStreamDecoder) get() *sppb.PartialResultSet {
	return d.np
}

// lastErr returns the last non-EOF error encountered.
func (d *resumableStreamDecoder) lastErr() error {
	return d.err
}

// partialResultSetDecoder assembles PartialResultSet(s) into Cloud Spanner
// Rows.
type partialResultSetDecoder struct {
	row     Row
	tx      *sppb.Transaction
	chunked bool      // if true, next value should be merged with last values entry.
	ts      time.Time // read timestamp
}

// yield checks we have a complete row, and if so returns it.  A row is not
// complete if it doesn't have enough columns, or if this is a chunked response
// and there are no further values to process.
func (p *partialResultSetDecoder) yield(chunked, last bool) *Row {
	if len(p.row.vals) == len(p.row.fields) && (!chunked || !last) {
		// When partialResultSetDecoder gets enough number of
		// Column values, There are two cases that a new Row
		// should be yield:
		//   1. The incoming PartialResultSet is not chunked;
		//   2. The incoming PartialResultSet is chunked, but the
		//      proto3.Value being merged is not the last one in
		//      the PartialResultSet.
		//
		// Use a fresh Row to simplify clients that want to use yielded results
		// after the next row is retrieved. Note that fields is never changed
		// so it doesn't need to be copied.
		fresh := Row{
			fields: p.row.fields,
			vals:   make([]*proto3.Value, len(p.row.vals)),
		}
		copy(fresh.vals, p.row.vals)
		p.row.vals = p.row.vals[:0] // empty and reuse slice
		return &fresh
	}
	return nil
}

// yieldTx returns transaction information via caller supplied callback.
func errChunkedEmptyRow() error {
	return spannerErrorf(codes.FailedPrecondition, "got invalid chunked PartialResultSet with empty Row")
}

// add tries to merge a new PartialResultSet into buffered Row. It returns
// any rows that have been completed as a result.
func (p *partialResultSetDecoder) add(r *sppb.PartialResultSet) ([]*Row, error) {
	var rows []*Row
	if r.Metadata != nil {
		// Metadata should only be returned in the first result.
		if p.row.fields == nil {
			p.row.fields = r.Metadata.RowType.Fields
		}
		if p.tx == nil && r.Metadata.Transaction != nil {
			p.tx = r.Metadata.Transaction
			if p.tx.ReadTimestamp != nil {
				p.ts = time.Unix(p.tx.ReadTimestamp.Seconds, int64(p.tx.ReadTimestamp.Nanos))
			}
		}
	}
	if len(r.Values) == 0 {
		return nil, nil
	}
	if p.chunked {
		p.chunked = false
		// Try to merge first value in r.Values into
		// uncompleted row.
		last := len(p.row.vals) - 1
		if last < 0 { // sanity check
			return nil, errChunkedEmptyRow()
		}
		var err error
		// If p is chunked, then we should always try to merge p.last with r.first.
		if p.row.vals[last], err = p.merge(p.row.vals[last], r.Values[0]); err != nil {
			return nil, err
		}
		r.Values = r.Values[1:]
		// Merge is done, try to yield a complete Row.
		if row := p.yield(r.ChunkedValue, len(r.Values) == 0); row != nil {
			rows = append(rows, row)
		}
	}
	for i, v := range r.Values {
		// The rest values in r can be appened into p directly.
		p.row.vals = append(p.row.vals, v)
		// Again, check to see if a complete Row can be yielded because of
		// the newly added value.
		if row := p.yield(r.ChunkedValue, i == len(r.Values)-1); row != nil {
			rows = append(rows, row)
		}
	}
	if r.ChunkedValue {
		// After dealing with all values in r, if r is chunked then p must
		// be also chunked.
		p.chunked = true
	}
	return rows, nil
}

// isMergeable returns if a protobuf Value can be potentially merged with
// other protobuf Values.
func (p *partialResultSetDecoder) isMergeable(a *proto3.Value) bool {
	switch a.Kind.(type) {
	case *proto3.Value_StringValue:
		return true
	case *proto3.Value_ListValue:
		return true
	default:
		return false
	}
}

// errIncompatibleMergeTypes returns error for incompatible protobuf types
// that cannot be merged by partialResultSetDecoder.
func errIncompatibleMergeTypes(a, b *proto3.Value) error {
	return spannerErrorf(codes.FailedPrecondition, "incompatible type in chunked PartialResultSet. expected (%T), got (%T)", a.Kind, b.Kind)
}

// errUnsupportedMergeType returns error for protobuf type that cannot be
// merged to other protobufs.
func errUnsupportedMergeType(a *proto3.Value) error {
	return spannerErrorf(codes.FailedPrecondition, "unsupported type merge (%T)", a.Kind)
}

// merge tries to combine two protobuf Values if possible.
func (p *partialResultSetDecoder) merge(a, b *proto3.Value) (*proto3.Value, error) {
	var err error
	typeErr := errIncompatibleMergeTypes(a, b)
	switch t := a.Kind.(type) {
	case *proto3.Value_StringValue:
		s, ok := b.Kind.(*proto3.Value_StringValue)
		if !ok {
			return nil, typeErr
		}
		return &proto3.Value{
			Kind: &proto3.Value_StringValue{StringValue: t.StringValue + s.StringValue},
		}, nil
	case *proto3.Value_ListValue:
		l, ok := b.Kind.(*proto3.Value_ListValue)
		if !ok {
			return nil, typeErr
		}
		if l.ListValue == nil || len(l.ListValue.Values) <= 0 {
			// b is an empty list, just return a.
			return a, nil
		}
		if t.ListValue == nil || len(t.ListValue.Values) <= 0 {
			// a is an empty list, just return b.
			return b, nil
		}
		if la := len(t.ListValue.Values) - 1; p.isMergeable(t.ListValue.Values[la]) {
			// When the last item in a is of type String,
			// List or Struct(encoded into List by Cloud Spanner),
			// try to Merge last item in a and first item in b.
			t.ListValue.Values[la], err = p.merge(t.ListValue.Values[la], l.ListValue.Values[0])
			if err != nil {
				return nil, err
			}
			l.ListValue.Values = l.ListValue.Values[1:]
		}
		return &proto3.Value{
			Kind: &proto3.Value_ListValue{
				ListValue: &proto3.ListValue{
					Values: append(t.ListValue.Values, l.ListValue.Values...),
				},
			},
		}, nil
	default:
		return nil, errUnsupportedMergeType(a)
	}

}

// Done returns if partialResultSetDecoder has already done with all buffered
// values.
func (p *partialResultSetDecoder) done() bool {
	// There is no explicit end of stream marker, but ending part way
	// through a row is obviously bad, or ending with the last column still
	// awaiting completion.
	return len(p.row.vals) == 0 && !p.chunked
}
