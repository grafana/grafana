// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package log // import "go.opentelemetry.io/otel/sdk/log"

import (
	"context"
	"sync"
)

// Compile-time check SimpleProcessor implements Processor.
var _ Processor = (*SimpleProcessor)(nil)

// SimpleProcessor is an processor that synchronously exports log records.
//
// Use [NewSimpleProcessor] to create a SimpleProcessor.
type SimpleProcessor struct {
	mu       sync.Mutex
	exporter Exporter

	noCmp [0]func() //nolint: unused  // This is indeed used.
}

// NewSimpleProcessor is a simple Processor adapter.
//
// This Processor is not recommended for production use due to its synchronous
// nature, which makes it suitable for testing, debugging, or demonstrating
// other features, but can lead to slow performance and high computational
// overhead. For production environments, it is recommended to use
// [NewBatchProcessor] instead. However, there may be exceptions where certain
// [Exporter] implementations perform better with this Processor.
func NewSimpleProcessor(exporter Exporter, _ ...SimpleProcessorOption) *SimpleProcessor {
	return &SimpleProcessor{exporter: exporter}
}

var simpleProcRecordsPool = sync.Pool{
	New: func() any {
		records := make([]Record, 1)
		return &records
	},
}

// OnEmit batches provided log record.
func (s *SimpleProcessor) OnEmit(ctx context.Context, r *Record) error {
	if s.exporter == nil {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	records := simpleProcRecordsPool.Get().(*[]Record)
	(*records)[0] = *r
	defer func() {
		simpleProcRecordsPool.Put(records)
	}()

	return s.exporter.Export(ctx, *records)
}

// Shutdown shuts down the exporter.
func (s *SimpleProcessor) Shutdown(ctx context.Context) error {
	if s.exporter == nil {
		return nil
	}

	return s.exporter.Shutdown(ctx)
}

// ForceFlush flushes the exporter.
func (s *SimpleProcessor) ForceFlush(ctx context.Context) error {
	if s.exporter == nil {
		return nil
	}

	return s.exporter.ForceFlush(ctx)
}

// SimpleProcessorOption applies a configuration to a [SimpleProcessor].
type SimpleProcessorOption interface {
	apply()
}
