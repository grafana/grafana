package storagewrappers

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/build"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/storagewrappers/storagewrappersutil"
)

const timeWaitingAttribute = "datastore_time_waiting"
const concurrentTimeWaitingThreshold = 1 * time.Millisecond

type StorageInstrumentation interface {
	GetMetadata() Metadata
}

type Metadata struct {
	DatastoreQueryCount uint32
	DatastoreItemCount  uint64
	WasThrottled        bool
}

type countingTupleIterator struct {
	storage.TupleIterator
	counter *atomic.Uint64
}

func (itr *countingTupleIterator) Next(ctx context.Context) (*openfgav1.Tuple, error) {
	i, err := itr.TupleIterator.Next(ctx)
	if err != nil {
		return i, err
	}
	itr.counter.Add(1)
	return i, nil
}

var (
	_ storage.RelationshipTupleReader = (*BoundedTupleReader)(nil)
	_ StorageInstrumentation          = (*BoundedTupleReader)(nil)
	_ storage.TupleIterator           = (*countingTupleIterator)(nil)

	concurrentReadDelayMsHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace:                       build.ProjectName,
		Name:                            "datastore_bounded_read_delay_ms",
		Help:                            "Time spent waiting for any relevant Tuple read calls to the datastore",
		Buckets:                         []float64{1, 3, 5, 10, 25, 50, 100, 1000, 5000}, // Milliseconds. Upper bound is config.UpstreamTimeout.
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  100,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"operation", "method"})

	throttledReadDelayMsHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace:                       build.ProjectName,
		Name:                            "datastore_throttled_read_delay_ms",
		Help:                            "Time spent waiting for any relevant Tuple read calls to the datastore",
		Buckets:                         []float64{1, 3, 5, 10, 25, 50, 100, 1000, 5000}, // Milliseconds. Upper bound is config.UpstreamTimeout.
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  100,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"operation", "method"})
)

type BoundedTupleReader struct {
	storage.RelationshipTupleReader
	limiter    chan struct{} // bound concurrency
	countReads atomic.Uint32
	countItems atomic.Uint64
	method     string

	throttlingEnabled bool
	threshold         int
	throttleTime      time.Duration
	throttled         atomic.Bool
}

// NewBoundedTupleReader returns a wrapper over a datastore that makes sure that there are, at most,
// "concurrency" concurrent calls to Read, ReadUserTuple and ReadUsersetTuples.
// Consumers can then rest assured that one client will not hoard all the database connections available.
func NewBoundedTupleReader(wrapped storage.RelationshipTupleReader, op *Operation) *BoundedTupleReader {
	return &BoundedTupleReader{
		RelationshipTupleReader: wrapped,
		limiter:                 make(chan struct{}, op.Concurrency),
		countReads:              atomic.Uint32{},

		method:            string(op.Method),
		throttlingEnabled: op.ThrottlingEnabled,
		threshold:         op.ThrottleThreshold,
		throttleTime:      op.ThrottleDuration,
	}
}

func (b *BoundedTupleReader) GetMetadata() Metadata {
	return Metadata{
		DatastoreQueryCount: b.countReads.Load(),
		DatastoreItemCount:  b.countItems.Load(),
		WasThrottled:        b.throttled.Load(),
	}
}

// ReadUserTuple tries to return one tuple that matches the provided key exactly.
func (b *BoundedTupleReader) ReadUserTuple(
	ctx context.Context,
	store string,
	filter storage.ReadUserTupleFilter,
	options storage.ReadUserTupleOptions,
) (*openfgav1.Tuple, error) {
	err := b.bound(ctx, storagewrappersutil.OperationReadUserTuple)
	if err != nil {
		return nil, err
	}

	defer b.done()
	t, err := b.RelationshipTupleReader.ReadUserTuple(ctx, store, filter, options)
	if t == nil || err != nil {
		return t, err
	}
	b.countItems.Add(1)
	return t, nil
}

// Read the set of tuples associated with `store` and `TupleKey`, which may be nil or partially filled.
func (b *BoundedTupleReader) Read(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadOptions) (storage.TupleIterator, error) {
	err := b.bound(ctx, storagewrappersutil.OperationRead)
	if err != nil {
		return nil, err
	}

	defer b.done()
	itr, err := b.RelationshipTupleReader.Read(ctx, store, filter, options)
	if itr == nil || err != nil {
		return itr, err
	}
	return &countingTupleIterator{itr, &b.countItems}, nil
}

// ReadUsersetTuples returns all userset tuples for a specified object and relation.
func (b *BoundedTupleReader) ReadUsersetTuples(
	ctx context.Context,
	store string,
	filter storage.ReadUsersetTuplesFilter,
	options storage.ReadUsersetTuplesOptions,
) (storage.TupleIterator, error) {
	err := b.bound(ctx, storagewrappersutil.OperationReadUsersetTuples)
	if err != nil {
		return nil, err
	}

	defer b.done()
	itr, err := b.RelationshipTupleReader.ReadUsersetTuples(ctx, store, filter, options)
	if itr == nil || err != nil {
		return itr, err
	}
	return &countingTupleIterator{itr, &b.countItems}, nil
}

// ReadStartingWithUser performs a reverse read of relationship tuples starting at one or
// more user(s) or userset(s) and filtered by object type and relation.
func (b *BoundedTupleReader) ReadStartingWithUser(
	ctx context.Context,
	store string,
	filter storage.ReadStartingWithUserFilter,
	options storage.ReadStartingWithUserOptions,
) (storage.TupleIterator, error) {
	err := b.bound(ctx, storagewrappersutil.OperationReadStartingWithUser)
	if err != nil {
		return nil, err
	}

	defer b.done()

	itr, err := b.RelationshipTupleReader.ReadStartingWithUser(ctx, store, filter, options)
	if itr == nil || err != nil {
		return itr, err
	}
	return &countingTupleIterator{itr, &b.countItems}, nil
}

func (b *BoundedTupleReader) instrument(ctx context.Context, op string, d time.Duration, vec *prometheus.HistogramVec) {
	vec.WithLabelValues(op, b.method).Observe(float64(d))

	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.Int64(timeWaitingAttribute, d.Milliseconds()))
}

// bound will only allow the request to have a maximum number of concurrent access to the downstream datastore.
// After a threshold of accesses has been granted, an artificial amount of latency will be added to the access.
func (b *BoundedTupleReader) bound(ctx context.Context, op string) error {
	startTime := time.Now()
	if err := b.waitForLimiter(ctx); err != nil {
		return err
	}

	if c := time.Since(startTime); c > concurrentTimeWaitingThreshold {
		b.instrument(ctx, op, c, concurrentReadDelayMsHistogram)
	}

	reads := b.increaseReads()

	if b.throttlingEnabled && b.threshold > 0 && reads > b.threshold {
		b.throttled.Store(true)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(b.throttleTime):
			break
		}
		b.instrument(ctx, op, time.Since(startTime), throttledReadDelayMsHistogram)
	}
	return nil
}

// waitForLimiter respects context errors and returns an error only if it couldn't send an item to the channel.
func (b *BoundedTupleReader) waitForLimiter(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case b.limiter <- struct{}{}:
		break
	}
	return nil
}

func (b *BoundedTupleReader) done() {
	select {
	case <-b.limiter:
	default:
	}
}

func (b *BoundedTupleReader) increaseReads() int {
	return int(b.countReads.Add(1))
}
