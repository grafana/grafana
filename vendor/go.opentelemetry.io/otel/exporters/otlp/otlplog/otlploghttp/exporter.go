// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlploghttp // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"

import (
	"context"
	"sync/atomic"

	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp/internal/transform"
	"go.opentelemetry.io/otel/sdk/log"
)

// Exporter is a OpenTelemetry log Exporter. It transports log data encoded as
// OTLP protobufs using HTTP.
// Exporter must be created with [New].
type Exporter struct {
	client  atomic.Pointer[client]
	stopped atomic.Bool
}

// Compile-time check Exporter implements [log.Exporter].
var _ log.Exporter = (*Exporter)(nil)

// New returns a new [Exporter].
//
// It is recommended to use it with a [BatchProcessor]
// or other processor exporting records asynchronously.
func New(_ context.Context, options ...Option) (*Exporter, error) {
	cfg := newConfig(options)
	c, err := newHTTPClient(cfg)
	if err != nil {
		return nil, err
	}
	return newExporter(c, cfg)
}

func newExporter(c *client, _ config) (*Exporter, error) {
	e := &Exporter{}
	e.client.Store(c)
	return e, nil
}

// Used for testing.
var transformResourceLogs = transform.ResourceLogs

// Export transforms and transmits log records to an OTLP receiver.
func (e *Exporter) Export(ctx context.Context, records []log.Record) error {
	if e.stopped.Load() {
		return nil
	}
	otlp := transformResourceLogs(records)
	if otlp == nil {
		return nil
	}
	return e.client.Load().UploadLogs(ctx, otlp)
}

// Shutdown shuts down the Exporter. Calls to Export or ForceFlush will perform
// no operation after this is called.
func (e *Exporter) Shutdown(ctx context.Context) error {
	if e.stopped.Swap(true) {
		return nil
	}

	e.client.Store(newNoopClient())
	return nil
}

// ForceFlush does nothing. The Exporter holds no state.
func (e *Exporter) ForceFlush(ctx context.Context) error {
	return nil
}
