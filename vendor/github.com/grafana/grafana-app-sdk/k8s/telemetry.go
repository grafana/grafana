package k8s

import (
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracer    trace.Tracer
	tracerMux sync.RWMutex
)

// SetTracer sets the tracer used for generating spans for this package
func SetTracer(t trace.Tracer) {
	tracerMux.Lock()
	defer tracerMux.Unlock()
	tracer = t
}

// GetTracer returns the trace.Tracer set by SetTracer, or a tracer generated from
// otel.GetTracerProvider().Tracer("k8s") if none has been set.
func GetTracer() trace.Tracer {
	tracerMux.RLock()
	defer tracerMux.RUnlock()
	if tracer == nil {
		tracer = otel.GetTracerProvider().Tracer("k8s")
	}
	return tracer
}
