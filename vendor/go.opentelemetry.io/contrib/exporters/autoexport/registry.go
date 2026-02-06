// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package autoexport // import "go.opentelemetry.io/contrib/exporters/autoexport"

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

const otelExporterOTLPProtoEnvKey = "OTEL_EXPORTER_OTLP_PROTOCOL"

// registry maintains a map of exporter names to exporter factories
// func(context.Context) (T, error) that is safe for concurrent use by multiple
// goroutines without additional locking or coordination.
type registry[T any] struct {
	mu    sync.Mutex
	names map[string]func(context.Context) (T, error)
}

var (
	// errUnknownExporterProducer is returned when an unknown exporter name is used in
	// the OTEL_*_EXPORTER or OTEL_METRICS_PRODUCERS environment variables.
	errUnknownExporterProducer = errors.New("unknown exporter or metrics producer")

	// errInvalidOTLPProtocol is returned when an invalid protocol is used in
	// the OTEL_EXPORTER_OTLP_PROTOCOL environment variable.
	errInvalidOTLPProtocol = errors.New("invalid OTLP protocol - should be one of ['grpc', 'http/protobuf']")

	// errDuplicateRegistration is returned when an duplicate registration is detected.
	errDuplicateRegistration = errors.New("duplicate registration")
)

// load returns tries to find the exporter factory with the key and
// then execute the factory, returning the created SpanExporter.
// errUnknownExporterProducer is returned if the registration is missing and the error from
// executing the factory if not nil.
func (r *registry[T]) load(ctx context.Context, key string) (T, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	factory, ok := r.names[key]
	if !ok {
		var zero T
		return zero, errUnknownExporterProducer
	}
	return factory(ctx)
}

// store sets the factory for a key if is not already in the registry. errDuplicateRegistration
// is returned if the registry already contains key.
func (r *registry[T]) store(key string, factory func(context.Context) (T, error)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.names[key]; ok {
		return fmt.Errorf("%w: %q", errDuplicateRegistration, key)
	}
	r.names[key] = factory
	return nil
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
