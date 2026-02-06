package retry

import (
	"context"

	"github.com/aws/smithy-go/metrics"
	"github.com/aws/smithy-go/middleware"
)

type attemptMetrics struct {
	Attempts metrics.Int64Counter
	Errors   metrics.Int64Counter

	AttemptDuration metrics.Float64Histogram
}

func newAttemptMetrics(meter metrics.Meter) (*attemptMetrics, error) {
	m := &attemptMetrics{}
	var err error

	m.Attempts, err = meter.Int64Counter("client.call.attempts", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "{attempt}"
		o.Description = "The number of attempts for an individual operation"
	})
	if err != nil {
		return nil, err
	}
	m.Errors, err = meter.Int64Counter("client.call.errors", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "{error}"
		o.Description = "The number of errors for an operation"
	})
	if err != nil {
		return nil, err
	}
	m.AttemptDuration, err = meter.Float64Histogram("client.call.attempt_duration", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "s"
		o.Description = "The time it takes to connect to the service, send the request, and get back HTTP status code and headers (including time queued waiting to be sent)"
	})
	if err != nil {
		return nil, err
	}

	return m, nil
}

func withOperationMetadata(ctx context.Context) metrics.RecordMetricOption {
	return func(o *metrics.RecordMetricOptions) {
		o.Properties.Set("rpc.service", middleware.GetServiceID(ctx))
		o.Properties.Set("rpc.method", middleware.GetOperationName(ctx))
	}
}
