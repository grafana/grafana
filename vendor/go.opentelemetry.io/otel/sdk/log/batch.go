// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package log // import "go.opentelemetry.io/otel/sdk/log"

import (
	"context"
	"errors"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel/internal/global"
)

const (
	dfltMaxQSize        = 2048
	dfltExpInterval     = time.Second
	dfltExpTimeout      = 30 * time.Second
	dfltExpMaxBatchSize = 512
	dfltExpBufferSize   = 1

	envarMaxQSize        = "OTEL_BLRP_MAX_QUEUE_SIZE"
	envarExpInterval     = "OTEL_BLRP_SCHEDULE_DELAY"
	envarExpTimeout      = "OTEL_BLRP_EXPORT_TIMEOUT"
	envarExpMaxBatchSize = "OTEL_BLRP_MAX_EXPORT_BATCH_SIZE"
)

// Compile-time check BatchProcessor implements Processor.
var _ Processor = (*BatchProcessor)(nil)

// BatchProcessor is a processor that exports batches of log records.
//
// Use [NewBatchProcessor] to create a BatchProcessor. An empty BatchProcessor
// is shut down by default, no records will be batched or exported.
type BatchProcessor struct {
	// The BatchProcessor is designed to provide the highest throughput of
	// log records possible while being compatible with OpenTelemetry. The
	// entry point of log records is the OnEmit method. This method is designed
	// to receive records as fast as possible while still honoring shutdown
	// commands. All records received are enqueued to queue.
	//
	// In order to block OnEmit as little as possible, a separate "poll"
	// goroutine is spawned at the creation of a BatchProcessor. This
	// goroutine is responsible for batching the queue at regular polled
	// intervals, or when it is directly signaled to.
	//
	// To keep the polling goroutine from backing up, all batches it makes are
	// exported with a bufferedExporter. This exporter allows the poll
	// goroutine to enqueue an export payload that will be handled in a
	// separate goroutine dedicated to the export. This asynchronous behavior
	// allows the poll goroutine to maintain accurate interval polling.
	//
	//   ___BatchProcessor____     __Poll Goroutine__     __Export Goroutine__
	// ||                     || ||                  || ||                    ||
	// ||          ********** || ||                  || ||     **********     ||
	// || Records=>* OnEmit * || ||   | - ticker     || ||     * export *     ||
	// ||          ********** || ||   | - trigger    || ||     **********     ||
	// ||             ||      || ||   |              || ||         ||         ||
	// ||             ||      || ||   |              || ||         ||         ||
	// ||   __________\/___   || ||   |***********   || ||   ______/\_______  ||
	// ||  (____queue______)>=||=||===|*  batch  *===||=||=>[_export_buffer_] ||
	// ||                     || ||   |***********   || ||                    ||
	// ||_____________________|| ||__________________|| ||____________________||
	//
	//
	// The "release valve" in this processing is the record queue. This queue
	// is a ring buffer. It will overwrite the oldest records first when writes
	// to OnEmit are made faster than the queue can be flushed. If batches
	// cannot be flushed to the export buffer, the records will remain in the
	// queue.

	// exporter is the bufferedExporter all batches are exported with.
	exporter *bufferExporter

	// q is the active queue of records that have not yet been exported.
	q *queue
	// batchSize is the minimum number of records needed before an export is
	// triggered (unless the interval expires).
	batchSize int

	// pollTrigger triggers the poll goroutine to flush a batch from the queue.
	// This is sent to when it is known that the queue contains at least one
	// complete batch.
	//
	// When a send is made to the channel, the poll loop will be reset after
	// the flush. If there is still enough records in the queue for another
	// batch the reset of the poll loop will automatically re-trigger itself.
	// There is no need for the original sender to monitor and resend.
	pollTrigger chan struct{}
	// pollKill kills the poll goroutine. This is only expected to be closed
	// once by the Shutdown method.
	pollKill chan struct{}
	// pollDone signals the poll goroutine has completed.
	pollDone chan struct{}

	// stopped holds the stopped state of the BatchProcessor.
	stopped atomic.Bool

	noCmp [0]func() //nolint: unused  // This is indeed used.
}

// NewBatchProcessor decorates the provided exporter
// so that the log records are batched before exporting.
//
// All of the exporter's methods are called synchronously.
func NewBatchProcessor(exporter Exporter, opts ...BatchProcessorOption) *BatchProcessor {
	cfg := newBatchConfig(opts)
	if exporter == nil {
		// Do not panic on nil export.
		exporter = defaultNoopExporter
	}
	// Order is important here. Wrap the timeoutExporter with the chunkExporter
	// to ensure each export completes in timeout (instead of all chunked
	// exports).
	exporter = newTimeoutExporter(exporter, cfg.expTimeout.Value)
	// Use a chunkExporter to ensure ForceFlush and Shutdown calls are batched
	// appropriately on export.
	exporter = newChunkExporter(exporter, cfg.expMaxBatchSize.Value)

	b := &BatchProcessor{
		exporter: newBufferExporter(exporter, cfg.expBufferSize.Value),

		q:           newQueue(cfg.maxQSize.Value),
		batchSize:   cfg.expMaxBatchSize.Value,
		pollTrigger: make(chan struct{}, 1),
		pollKill:    make(chan struct{}),
	}
	b.pollDone = b.poll(cfg.expInterval.Value)
	return b
}

// poll spawns a goroutine to handle interval polling and batch exporting. The
// returned done chan is closed when the spawned goroutine completes.
func (b *BatchProcessor) poll(interval time.Duration) (done chan struct{}) {
	done = make(chan struct{})

	ticker := time.NewTicker(interval)
	// TODO: investigate using a sync.Pool instead of cloning.
	buf := make([]Record, b.batchSize)
	go func() {
		defer close(done)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
			case <-b.pollTrigger:
				ticker.Reset(interval)
			case <-b.pollKill:
				return
			}

			if d := b.q.Dropped(); d > 0 {
				global.Warn("dropped log records", "dropped", d)
			}

			var qLen int
			// Don't copy data from queue unless exporter can accept more, it is very expensive.
			if b.exporter.Ready() {
				qLen = b.q.TryDequeue(buf, func(r []Record) bool {
					ok := b.exporter.EnqueueExport(r)
					if ok {
						buf = slices.Clone(buf)
					}
					return ok
				})
			} else {
				qLen = b.q.Len()
			}

			if qLen >= b.batchSize {
				// There is another full batch ready. Immediately trigger
				// another export attempt.
				select {
				case b.pollTrigger <- struct{}{}:
				default:
					// Another flush signal already received.
				}
			}
		}
	}()
	return done
}

// OnEmit batches provided log record.
func (b *BatchProcessor) OnEmit(_ context.Context, r *Record) error {
	if b.stopped.Load() || b.q == nil {
		return nil
	}
	// The record is cloned so that changes done by subsequent processors
	// are not going to lead to a data race.
	if n := b.q.Enqueue(r.Clone()); n >= b.batchSize {
		select {
		case b.pollTrigger <- struct{}{}:
		default:
			// Flush chan full. The poll goroutine will handle this by
			// re-sending any trigger until the queue has less than batchSize
			// records.
		}
	}
	return nil
}

// Shutdown flushes queued log records and shuts down the decorated exporter.
func (b *BatchProcessor) Shutdown(ctx context.Context) error {
	if b.stopped.Swap(true) || b.q == nil {
		return nil
	}

	// Stop the poll goroutine.
	close(b.pollKill)
	select {
	case <-b.pollDone:
	case <-ctx.Done():
		// Out of time.
		return errors.Join(ctx.Err(), b.exporter.Shutdown(ctx))
	}

	// Flush remaining queued before exporter shutdown.
	err := b.exporter.Export(ctx, b.q.Flush())
	return errors.Join(err, b.exporter.Shutdown(ctx))
}

var errPartialFlush = errors.New("partial flush: export buffer full")

// Used for testing.
var ctxErr = func(ctx context.Context) error {
	return ctx.Err()
}

// ForceFlush flushes queued log records and flushes the decorated exporter.
func (b *BatchProcessor) ForceFlush(ctx context.Context) error {
	if b.stopped.Load() || b.q == nil {
		return nil
	}

	buf := make([]Record, b.q.cap)
	notFlushed := func() bool {
		var flushed bool
		_ = b.q.TryDequeue(buf, func(r []Record) bool {
			flushed = b.exporter.EnqueueExport(r)
			return flushed
		})
		return !flushed
	}
	var err error
	// For as long as ctx allows, try to make a single flush of the queue.
	for notFlushed() {
		// Use ctxErr instead of calling ctx.Err directly so we can test
		// the partial error return.
		if e := ctxErr(ctx); e != nil {
			err = errors.Join(e, errPartialFlush)
			break
		}
	}
	return errors.Join(err, b.exporter.ForceFlush(ctx))
}

// queue holds a queue of logging records.
//
// When the queue becomes full, the oldest records in the queue are
// overwritten.
type queue struct {
	sync.Mutex

	dropped     atomic.Uint64
	cap, len    int
	read, write *ring
}

func newQueue(size int) *queue {
	r := newRing(size)
	return &queue{
		cap:   size,
		read:  r,
		write: r,
	}
}

func (q *queue) Len() int {
	q.Lock()
	defer q.Unlock()

	return q.len
}

// Dropped returns the number of Records dropped during enqueueing since the
// last time Dropped was called.
func (q *queue) Dropped() uint64 {
	return q.dropped.Swap(0)
}

// Enqueue adds r to the queue. The queue size, including the addition of r, is
// returned.
//
// If enqueueing r will exceed the capacity of q, the oldest Record held in q
// will be dropped and r retained.
func (q *queue) Enqueue(r Record) int {
	q.Lock()
	defer q.Unlock()

	q.write.Value = r
	q.write = q.write.Next()

	q.len++
	if q.len > q.cap {
		// Overflow. Advance read to be the new "oldest".
		q.len = q.cap
		q.read = q.read.Next()
		q.dropped.Add(1)
	}
	return q.len
}

// TryDequeue attempts to dequeue up to len(buf) Records. The available Records
// will be assigned into buf and passed to write. If write fails, returning
// false, the Records will not be removed from the queue. If write succeeds,
// returning true, the dequeued Records are removed from the queue. The number
// of Records remaining in the queue are returned.
//
// When write is called the lock of q is held. The write function must not call
// other methods of this q that acquire the lock.
func (q *queue) TryDequeue(buf []Record, write func([]Record) bool) int {
	q.Lock()
	defer q.Unlock()

	origRead := q.read

	n := min(len(buf), q.len)
	for i := 0; i < n; i++ {
		buf[i] = q.read.Value
		q.read = q.read.Next()
	}

	if write(buf[:n]) {
		q.len -= n
	} else {
		q.read = origRead
	}
	return q.len
}

// Flush returns all the Records held in the queue and resets it to be
// empty.
func (q *queue) Flush() []Record {
	q.Lock()
	defer q.Unlock()

	out := make([]Record, q.len)
	for i := range out {
		out[i] = q.read.Value
		q.read = q.read.Next()
	}
	q.len = 0

	return out
}

type batchConfig struct {
	maxQSize        setting[int]
	expInterval     setting[time.Duration]
	expTimeout      setting[time.Duration]
	expMaxBatchSize setting[int]
	expBufferSize   setting[int]
}

func newBatchConfig(options []BatchProcessorOption) batchConfig {
	var c batchConfig
	for _, o := range options {
		c = o.apply(c)
	}

	c.maxQSize = c.maxQSize.Resolve(
		clearLessThanOne[int](),
		getenv[int](envarMaxQSize),
		clearLessThanOne[int](),
		fallback[int](dfltMaxQSize),
	)
	c.expInterval = c.expInterval.Resolve(
		clearLessThanOne[time.Duration](),
		getenv[time.Duration](envarExpInterval),
		clearLessThanOne[time.Duration](),
		fallback[time.Duration](dfltExpInterval),
	)
	c.expTimeout = c.expTimeout.Resolve(
		clearLessThanOne[time.Duration](),
		getenv[time.Duration](envarExpTimeout),
		clearLessThanOne[time.Duration](),
		fallback[time.Duration](dfltExpTimeout),
	)
	c.expMaxBatchSize = c.expMaxBatchSize.Resolve(
		clearLessThanOne[int](),
		getenv[int](envarExpMaxBatchSize),
		clearLessThanOne[int](),
		clampMax[int](c.maxQSize.Value),
		fallback[int](dfltExpMaxBatchSize),
	)
	c.expBufferSize = c.expBufferSize.Resolve(
		clearLessThanOne[int](),
		fallback[int](dfltExpBufferSize),
	)

	return c
}

// BatchProcessorOption applies a configuration to a [BatchProcessor].
type BatchProcessorOption interface {
	apply(batchConfig) batchConfig
}

type batchOptionFunc func(batchConfig) batchConfig

func (fn batchOptionFunc) apply(c batchConfig) batchConfig {
	return fn(c)
}

// WithMaxQueueSize sets the maximum queue size used by the Batcher.
// After the size is reached log records are dropped.
//
// If the OTEL_BLRP_MAX_QUEUE_SIZE environment variable is set,
// and this option is not passed, that variable value will be used.
//
// By default, if an environment variable is not set, and this option is not
// passed, 2048 will be used.
// The default value is also used when the provided value is less than one.
func WithMaxQueueSize(size int) BatchProcessorOption {
	return batchOptionFunc(func(cfg batchConfig) batchConfig {
		cfg.maxQSize = newSetting(size)
		return cfg
	})
}

// WithExportInterval sets the maximum duration between batched exports.
//
// If the OTEL_BLRP_SCHEDULE_DELAY environment variable is set,
// and this option is not passed, that variable value will be used.
//
// By default, if an environment variable is not set, and this option is not
// passed, 1s will be used.
// The default value is also used when the provided value is less than one.
func WithExportInterval(d time.Duration) BatchProcessorOption {
	return batchOptionFunc(func(cfg batchConfig) batchConfig {
		cfg.expInterval = newSetting(d)
		return cfg
	})
}

// WithExportTimeout sets the duration after which a batched export is canceled.
//
// If the OTEL_BLRP_EXPORT_TIMEOUT environment variable is set,
// and this option is not passed, that variable value will be used.
//
// By default, if an environment variable is not set, and this option is not
// passed, 30s will be used.
// The default value is also used when the provided value is less than one.
func WithExportTimeout(d time.Duration) BatchProcessorOption {
	return batchOptionFunc(func(cfg batchConfig) batchConfig {
		cfg.expTimeout = newSetting(d)
		return cfg
	})
}

// WithExportMaxBatchSize sets the maximum batch size of every export.
// A batch will be split into multiple exports to not exceed this size.
//
// If the OTEL_BLRP_MAX_EXPORT_BATCH_SIZE environment variable is set,
// and this option is not passed, that variable value will be used.
//
// By default, if an environment variable is not set, and this option is not
// passed, 512 will be used.
// The default value is also used when the provided value is less than one.
func WithExportMaxBatchSize(size int) BatchProcessorOption {
	return batchOptionFunc(func(cfg batchConfig) batchConfig {
		cfg.expMaxBatchSize = newSetting(size)
		return cfg
	})
}

// WithExportBufferSize sets the batch buffer size.
// Batches will be temporarily kept in a memory buffer until they are exported.
//
// By default, a value of 1 will be used.
// The default value is also used when the provided value is less than one.
func WithExportBufferSize(size int) BatchProcessorOption {
	return batchOptionFunc(func(cfg batchConfig) batchConfig {
		cfg.expBufferSize = newSetting(size)
		return cfg
	})
}
