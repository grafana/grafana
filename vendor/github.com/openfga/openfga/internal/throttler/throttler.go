//go:generate mockgen -source throttler.go -destination ../mocks/mock_throttler.go -package mocks

package throttler

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/openfga/openfga/internal/build"
	"github.com/openfga/openfga/pkg/telemetry"
)

var (
	throttlingDelayMsHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace:                       build.ProjectName,
		Name:                            "throttling_delay_ms",
		Help:                            "Time spent waiting for dispatch throttling resolver",
		Buckets:                         []float64{1, 3, 5, 10, 25, 50, 100, 1000, 5000}, // Milliseconds. Upper bound is config.UpstreamTimeout.
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  100,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"grpc_service", "grpc_method", "throttler_name"})
)

type Throttler interface {
	Close()
	Throttle(context.Context)
}

type noopThrottler struct{}

var _ Throttler = (*noopThrottler)(nil)

func (r *noopThrottler) Throttle(ctx context.Context) {
}

func (r *noopThrottler) Close() {
}

func NewNoopThrottler() Throttler { return &noopThrottler{} }

// constantRateThrottler implements a throttling mechanism that can be used to control the rate of recursive resource consumption.
// Throttling will release the goroutines from the throttlingQueue based on the configured ticker.
type constantRateThrottler struct {
	name            string
	ticker          *time.Ticker
	throttlingQueue chan struct{}
	done            chan struct{}
}

// NewConstantRateThrottler constructs a constantRateThrottler which can be used to control the rate of recursive resource consumption.
func NewConstantRateThrottler(frequency time.Duration, metricLabel string) Throttler {
	return newConstantRateThrottler(frequency, metricLabel)
}

// Returns a constantRateThrottler instead of Throttler for testing purpose to be used internally.
func newConstantRateThrottler(frequency time.Duration, throttlerName string) *constantRateThrottler {
	constantRateThrottler := &constantRateThrottler{
		name:            throttlerName,
		ticker:          time.NewTicker(frequency),
		throttlingQueue: make(chan struct{}),
		done:            make(chan struct{}),
	}
	go constantRateThrottler.runTicker()
	return constantRateThrottler
}

func (r *constantRateThrottler) nonBlockingSend(signalChan chan struct{}) {
	select {
	case signalChan <- struct{}{}:
		// message sent
	default:
		// message dropped
	}
}

func (r *constantRateThrottler) runTicker() {
	for {
		select {
		case <-r.done:
			return
		case <-r.ticker.C:
			r.nonBlockingSend(r.throttlingQueue)
		}
	}
}

func (r *constantRateThrottler) Close() {
	r.done <- struct{}{}
	r.ticker.Stop()
	close(r.done)
	close(r.throttlingQueue)
}

// Throttle provides a synchronous blocking mechanism that will block if the currentNumDispatch exceeds the configured dispatch threshold.
// It will block until a value is produced on the underlying throttling queue channel,
// which is produced by periodically sending a value on the channel based on the configured ticker frequency.
func (r *constantRateThrottler) Throttle(ctx context.Context) {
	start := time.Now()
	select {
	case <-ctx.Done():
	case <-r.throttlingQueue:
	}
	end := time.Now()
	timeWaiting := end.Sub(start).Milliseconds()

	rpcInfo := telemetry.RPCInfoFromContext(ctx)
	throttlingDelayMsHistogram.WithLabelValues(
		rpcInfo.Service,
		rpcInfo.Method,
		r.name,
	).Observe(float64(timeWaiting))
}
