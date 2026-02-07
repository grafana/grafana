// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package log // import "go.opentelemetry.io/otel/sdk/log"

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel"
)

// Exporter handles the delivery of log records to external receivers.
type Exporter interface {
	// Export transmits log records to a receiver.
	//
	// The deadline or cancellation of the passed context must be honored. An
	// appropriate error should be returned in these situations.
	//
	// All retry logic must be contained in this function. The SDK does not
	// implement any retry logic. All errors returned by this function are
	// considered unrecoverable and will be reported to a configured error
	// Handler.
	//
	// Implementations must not retain the records slice.
	//
	// Before modifying a Record, the implementation must use Record.Clone
	// to create a copy that shares no state with the original.
	//
	// Export should never be called concurrently with other Export calls.
	// However, it may be called concurrently with other methods.
	Export(ctx context.Context, records []Record) error

	// Shutdown is called when the SDK shuts down. Any cleanup or release of
	// resources held by the exporter should be done in this call.
	//
	// The deadline or cancellation of the passed context must be honored. An
	// appropriate error should be returned in these situations.
	//
	// After Shutdown is called, calls to Export, Shutdown, or ForceFlush
	// should perform no operation and return nil error.
	//
	// Shutdown may be called concurrently with itself or with other methods.
	Shutdown(ctx context.Context) error

	// ForceFlush exports log records to the configured Exporter that have not yet
	// been exported.
	//
	// The deadline or cancellation of the passed context must be honored. An
	// appropriate error should be returned in these situations.
	//
	// ForceFlush may be called concurrently with itself or with other methods.
	ForceFlush(ctx context.Context) error
}

var defaultNoopExporter = &noopExporter{}

type noopExporter struct{}

func (noopExporter) Export(context.Context, []Record) error { return nil }

func (noopExporter) Shutdown(context.Context) error { return nil }

func (noopExporter) ForceFlush(context.Context) error { return nil }

// chunkExporter wraps an Exporter's Export method so it is called with
// appropriately sized export payloads. Any payload larger than a defined size
// is chunked into smaller payloads and exported sequentially.
type chunkExporter struct {
	Exporter

	// size is the maximum batch size exported.
	size int
}

// newChunkExporter wraps exporter. Calls to the Export will have their records
// payload chunked so they do not exceed size. If size is less than or equal
// to 0, exporter is returned directly.
func newChunkExporter(exporter Exporter, size int) Exporter {
	if size <= 0 {
		return exporter
	}
	return &chunkExporter{Exporter: exporter, size: size}
}

// Export exports records in chunks no larger than c.size.
func (c chunkExporter) Export(ctx context.Context, records []Record) error {
	n := len(records)
	for i, j := 0, min(c.size, n); i < n; i, j = i+c.size, min(j+c.size, n) {
		if err := c.Exporter.Export(ctx, records[i:j]); err != nil {
			return err
		}
	}
	return nil
}

// timeoutExporter wraps an Exporter and ensures any call to Export will have a
// timeout for the context.
type timeoutExporter struct {
	Exporter

	// timeout is the maximum time an export is attempted.
	timeout time.Duration
}

// newTimeoutExporter wraps exporter with an Exporter that limits the context
// lifetime passed to Export to be timeout. If timeout is less than or equal to
// zero, exporter will be returned directly.
func newTimeoutExporter(exp Exporter, timeout time.Duration) Exporter {
	if timeout <= 0 {
		return exp
	}
	return &timeoutExporter{Exporter: exp, timeout: timeout}
}

// Export sets the timeout of ctx before calling the Exporter e wraps.
func (e *timeoutExporter) Export(ctx context.Context, records []Record) error {
	ctx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()
	return e.Exporter.Export(ctx, records)
}

// exportSync exports all data from input using exporter in a spawned
// goroutine. The returned chan will be closed when the spawned goroutine
// completes.
func exportSync(input <-chan exportData, exporter Exporter) (done chan struct{}) {
	done = make(chan struct{})
	go func() {
		defer close(done)
		for data := range input {
			data.DoExport(exporter.Export)
		}
	}()
	return done
}

// exportData is data related to an export.
type exportData struct {
	ctx     context.Context
	records []Record

	// respCh is the channel any error returned from the export will be sent
	// on. If this is nil, and the export error is non-nil, the error will
	// passed to the OTel error handler.
	respCh chan<- error
}

// DoExport calls exportFn with the data contained in e. The error response
// will be returned on e's respCh if not nil. The error will be handled by the
// default OTel error handle if it is not nil and respCh is nil or full.
func (e exportData) DoExport(exportFn func(context.Context, []Record) error) {
	if len(e.records) == 0 {
		e.respond(nil)
		return
	}

	e.respond(exportFn(e.ctx, e.records))
}

func (e exportData) respond(err error) {
	select {
	case e.respCh <- err:
	default:
		// e.respCh is nil or busy, default to otel.Handler.
		if err != nil {
			otel.Handle(err)
		}
	}
}

// bufferExporter provides asynchronous and synchronous export functionality by
// buffering export requests.
type bufferExporter struct {
	Exporter

	input   chan exportData
	inputMu sync.Mutex

	done    chan struct{}
	stopped atomic.Bool
}

// newBufferExporter returns a new bufferExporter that wraps exporter. The
// returned bufferExporter will buffer at most size number of export requests.
// If size is less than 1, 1 will be used.
func newBufferExporter(exporter Exporter, size int) *bufferExporter {
	if size < 1 {
		size = 1
	}
	input := make(chan exportData, size)
	return &bufferExporter{
		Exporter: exporter,

		input: input,
		done:  exportSync(input, exporter),
	}
}

func (e *bufferExporter) Ready() bool {
	return len(e.input) != cap(e.input)
}

var errStopped = errors.New("exporter stopped")

func (e *bufferExporter) enqueue(ctx context.Context, records []Record, rCh chan<- error) error {
	data := exportData{ctx, records, rCh}

	e.inputMu.Lock()
	defer e.inputMu.Unlock()

	// Check stopped before enqueueing now that e.inputMu is held. This
	// prevents sends on a closed chan when Shutdown is called concurrently.
	if e.stopped.Load() {
		return errStopped
	}

	select {
	case e.input <- data:
	case <-ctx.Done():
		return ctx.Err()
	}
	return nil
}

// EnqueueExport enqueues an export of records in the context of ctx to be
// performed asynchronously. This will return true if the records are
// successfully enqueued (or the bufferExporter is shut down), false otherwise.
//
// The passed records are held after this call returns.
func (e *bufferExporter) EnqueueExport(records []Record) bool {
	if len(records) == 0 {
		// Nothing to enqueue, do not waste input space.
		return true
	}

	data := exportData{ctx: context.Background(), records: records}

	e.inputMu.Lock()
	defer e.inputMu.Unlock()

	// Check stopped before enqueueing now that e.inputMu is held. This
	// prevents sends on a closed chan when Shutdown is called concurrently.
	if e.stopped.Load() {
		return true
	}

	select {
	case e.input <- data:
		return true
	default:
		return false
	}
}

// Export synchronously exports records in the context of ctx. This will not
// return until the export has been completed.
func (e *bufferExporter) Export(ctx context.Context, records []Record) error {
	if len(records) == 0 {
		return nil
	}

	resp := make(chan error, 1)
	err := e.enqueue(ctx, records, resp)
	if err != nil {
		if errors.Is(err, errStopped) {
			return nil
		}
		return fmt.Errorf("%w: dropping %d records", err, len(records))
	}

	select {
	case err := <-resp:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ForceFlush flushes buffered exports. Any existing exports that is buffered
// is flushed before this returns.
func (e *bufferExporter) ForceFlush(ctx context.Context) error {
	resp := make(chan error, 1)
	err := e.enqueue(ctx, nil, resp)
	if err != nil {
		if errors.Is(err, errStopped) {
			return nil
		}
		return err
	}

	select {
	case <-resp:
	case <-ctx.Done():
		return ctx.Err()
	}
	return e.Exporter.ForceFlush(ctx)
}

// Shutdown shuts down e.
//
// Any buffered exports are flushed before this returns.
//
// All calls to EnqueueExport or Exporter will return nil without any export
// after this is called.
func (e *bufferExporter) Shutdown(ctx context.Context) error {
	if e.stopped.Swap(true) {
		return nil
	}
	e.inputMu.Lock()
	defer e.inputMu.Unlock()

	// No more sends will be made.
	close(e.input)
	select {
	case <-e.done:
	case <-ctx.Done():
		return errors.Join(ctx.Err(), e.Exporter.Shutdown(ctx))
	}
	return e.Exporter.Shutdown(ctx)
}
