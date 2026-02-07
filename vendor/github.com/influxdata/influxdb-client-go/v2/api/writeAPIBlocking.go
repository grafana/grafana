// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import (
	"context"
	"strings"
	"sync"
	"sync/atomic"

	http2 "github.com/influxdata/influxdb-client-go/v2/api/http"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
	iwrite "github.com/influxdata/influxdb-client-go/v2/internal/write"
)

// WriteAPIBlocking offers blocking methods for writing time series data synchronously into an InfluxDB server.
// It doesn't implicitly create batches of points by default. Batches are created from array of points/records.
//
// Implicit batching is enabled with EnableBatching(). In this mode, each call to WritePoint or WriteRecord adds a line
// to internal buffer. If length of the buffer is equal to the batch-size (set in write.Options), the buffer is sent to the server
// and the result of the operation is returned.
// When a point is written to the buffer, nil error is always returned.
// Flush() can be used to trigger sending of batch when it doesn't have the batch-size.
//
// Synchronous writing is intended to use for writing less frequent data, such as a weather sensing, or if there is a need to have explicit control of failed batches.

//
// WriteAPIBlocking can be used concurrently.
// When using multiple goroutines for writing, use a single WriteAPIBlocking instance in all goroutines.
type WriteAPIBlocking interface {
	// WriteRecord writes line protocol record(s) into bucket.
	// WriteRecord writes lines without implicit batching by default, batch is created from given number of records.
	// Automatic batching can be enabled by EnableBatching()
	// Individual arguments can also be batches (multiple records separated by newline).
	// Non-blocking alternative is available in the WriteAPI interface
	WriteRecord(ctx context.Context, line ...string) error
	// WritePoint data point into bucket.
	// WriteRecord writes points without implicit batching by default, batch is created from given number of points.
	// Automatic batching can be enabled by EnableBatching().
	// Non-blocking alternative is available in the WriteAPI interface
	WritePoint(ctx context.Context, point ...*write.Point) error
	// EnableBatching turns on implicit batching
	// Batch size is controlled via write.Options
	EnableBatching()
	// Flush forces write of buffer if batching is enabled, even buffer doesn't have the batch-size.
	Flush(ctx context.Context) error
}

// writeAPIBlocking implements WriteAPIBlocking interface
type writeAPIBlocking struct {
	service      *iwrite.Service
	writeOptions *write.Options
	// more appropriate Bool type from sync/atomic cannot be used because it is available since go 1.19
	batching int32
	batch    []string
	mu       sync.Mutex
}

// NewWriteAPIBlocking creates new instance of blocking write client for writing data to bucket belonging to org
func NewWriteAPIBlocking(org string, bucket string, service http2.Service, writeOptions *write.Options) WriteAPIBlocking {
	return &writeAPIBlocking{service: iwrite.NewService(org, bucket, service, writeOptions), writeOptions: writeOptions}
}

// NewWriteAPIBlockingWithBatching creates new instance of blocking write client for writing data to bucket belonging to org with batching enabled
func NewWriteAPIBlockingWithBatching(org string, bucket string, service http2.Service, writeOptions *write.Options) WriteAPIBlocking {
	api := &writeAPIBlocking{service: iwrite.NewService(org, bucket, service, writeOptions), writeOptions: writeOptions}
	api.EnableBatching()
	return api
}

func (w *writeAPIBlocking) EnableBatching() {
	if atomic.LoadInt32(&w.batching) == 0 {
		w.mu.Lock()
		w.batching = 1
		w.batch = make([]string, 0, w.writeOptions.BatchSize())
		w.mu.Unlock()
	}
}

func (w *writeAPIBlocking) write(ctx context.Context, line string) error {
	if atomic.LoadInt32(&w.batching) > 0 {
		w.mu.Lock()
		defer w.mu.Unlock()
		w.batch = append(w.batch, line)
		if len(w.batch) == int(w.writeOptions.BatchSize()) {
			return w.flush(ctx)
		}
		return nil
	}
	err := w.service.WriteBatch(ctx, iwrite.NewBatch(line, w.writeOptions.MaxRetryTime()))
	if err != nil {
		return err
	}
	return nil
}

func (w *writeAPIBlocking) WriteRecord(ctx context.Context, line ...string) error {
	if len(line) == 0 {
		return nil
	}
	return w.write(ctx, strings.Join(line, "\n"))
}

func (w *writeAPIBlocking) WritePoint(ctx context.Context, point ...*write.Point) error {
	line, err := w.service.EncodePoints(point...)
	if err != nil {
		return err
	}
	return w.write(ctx, line)
}

// flush is unsychronized helper for creating and sending batch
// Must be called from synchronized block
func (w *writeAPIBlocking) flush(ctx context.Context) error {
	if len(w.batch) > 0 {
		body := strings.Join(w.batch, "\n")
		w.batch = w.batch[:0]
		b := iwrite.NewBatch(body, w.writeOptions.MaxRetryTime())
		if err:= w.service.WriteBatch(ctx, b); err != nil {
			return err
		}
	}
	return nil
}

func (w *writeAPIBlocking) Flush(ctx context.Context) error {
	if atomic.LoadInt32(&w.batching) > 0 {
		w.mu.Lock()
		defer w.mu.Unlock()
		return w.flush(ctx)
	}
	return nil
}
