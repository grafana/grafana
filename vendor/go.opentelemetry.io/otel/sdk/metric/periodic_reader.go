// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/internal/global"
	"go.opentelemetry.io/otel/sdk/metric/internal/observ"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
)

// Default periodic reader timing.
const (
	defaultTimeout  = time.Millisecond * 30000
	defaultInterval = time.Millisecond * 60000
)

// periodicReaderConfig contains configuration options for a PeriodicReader.
type periodicReaderConfig struct {
	interval  time.Duration
	timeout   time.Duration
	producers []Producer
}

// newPeriodicReaderConfig returns a periodicReaderConfig configured with
// options.
func newPeriodicReaderConfig(options []PeriodicReaderOption) periodicReaderConfig {
	c := periodicReaderConfig{
		interval: envDuration(envInterval, defaultInterval),
		timeout:  envDuration(envTimeout, defaultTimeout),
	}
	for _, o := range options {
		c = o.applyPeriodic(c)
	}
	return c
}

// PeriodicReaderOption applies a configuration option value to a PeriodicReader.
type PeriodicReaderOption interface {
	applyPeriodic(periodicReaderConfig) periodicReaderConfig
}

// periodicReaderOptionFunc applies a set of options to a periodicReaderConfig.
type periodicReaderOptionFunc func(periodicReaderConfig) periodicReaderConfig

// applyPeriodic returns a periodicReaderConfig with option(s) applied.
func (o periodicReaderOptionFunc) applyPeriodic(conf periodicReaderConfig) periodicReaderConfig {
	return o(conf)
}

// WithTimeout configures the time a PeriodicReader waits for an export to
// complete before canceling it. This includes an export which occurs as part
// of Shutdown or ForceFlush if the user passed context does not have a
// deadline. If the user passed context does have a deadline, it will be used
// instead.
//
// This option overrides any value set for the
// OTEL_METRIC_EXPORT_TIMEOUT environment variable.
//
// If this option is not used or d is less than or equal to zero, 30 seconds
// is used as the default.
func WithTimeout(d time.Duration) PeriodicReaderOption {
	return periodicReaderOptionFunc(func(conf periodicReaderConfig) periodicReaderConfig {
		if d <= 0 {
			return conf
		}
		conf.timeout = d
		return conf
	})
}

// WithInterval configures the intervening time between exports for a
// PeriodicReader.
//
// This option overrides any value set for the
// OTEL_METRIC_EXPORT_INTERVAL environment variable.
//
// If this option is not used or d is less than or equal to zero, 60 seconds
// is used as the default.
func WithInterval(d time.Duration) PeriodicReaderOption {
	return periodicReaderOptionFunc(func(conf periodicReaderConfig) periodicReaderConfig {
		if d <= 0 {
			return conf
		}
		conf.interval = d
		return conf
	})
}

// NewPeriodicReader returns a Reader that collects and exports metric data to
// the exporter at a defined interval. By default, the returned Reader will
// collect and export data every 60 seconds, and will cancel any attempts that
// exceed 30 seconds, collect and export combined. The collect and export time
// are not counted towards the interval between attempts.
//
// The Collect method of the returned Reader continues to gather and return
// metric data to the user. It will not automatically send that data to the
// exporter. That is left to the user to accomplish.
func NewPeriodicReader(exporter Exporter, options ...PeriodicReaderOption) *PeriodicReader {
	conf := newPeriodicReaderConfig(options)
	ctx, cancel := context.WithCancel(context.Background())
	r := &PeriodicReader{
		interval: conf.interval,
		timeout:  conf.timeout,
		exporter: exporter,
		flushCh:  make(chan chan error),
		cancel:   cancel,
		done:     make(chan struct{}),
		rmPool: sync.Pool{
			New: func() any {
				return &metricdata.ResourceMetrics{}
			},
		},
	}
	r.externalProducers.Store(conf.producers)

	go func() {
		defer func() { close(r.done) }()
		r.run(ctx, conf.interval)
	}()

	var err error
	r.inst, err = observ.NewInstrumentation(
		semconv.OTelComponentTypePeriodicMetricReader.Value.AsString(),
		nextPeriodicReaderID(),
	)
	if err != nil {
		otel.Handle(err)
	}

	return r
}

var periodicReaderIDCounter atomic.Int64

// nextPeriodicReaderID returns an identifier for this periodic reader,
// starting with 0 and incrementing by 1 each time it is called.
func nextPeriodicReaderID() int64 {
	return periodicReaderIDCounter.Add(1) - 1
}

// PeriodicReader is a Reader that continuously collects and exports metric
// data at a set interval.
type PeriodicReader struct {
	sdkProducer atomic.Value

	mu                sync.Mutex
	isShutdown        bool
	externalProducers atomic.Value

	interval time.Duration
	timeout  time.Duration
	exporter Exporter
	flushCh  chan chan error

	done         chan struct{}
	cancel       context.CancelFunc
	shutdownOnce sync.Once

	rmPool sync.Pool

	inst *observ.Instrumentation
}

// Compile time check the periodicReader implements Reader and is comparable.
var _ = map[Reader]struct{}{&PeriodicReader{}: {}}

// newTicker allows testing override.
var newTicker = time.NewTicker

// run continuously collects and exports metric data at the specified
// interval. This will run until ctx is canceled or times out.
func (r *PeriodicReader) run(ctx context.Context, interval time.Duration) {
	ticker := newTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			err := r.collectAndExport(ctx)
			if err != nil {
				otel.Handle(err)
			}
		case errCh := <-r.flushCh:
			errCh <- r.collectAndExport(ctx)
			ticker.Reset(interval)
		case <-ctx.Done():
			return
		}
	}
}

// register registers p as the producer of this reader.
func (r *PeriodicReader) register(p sdkProducer) {
	// Only register once. If producer is already set, do nothing.
	if !r.sdkProducer.CompareAndSwap(nil, produceHolder{produce: p.produce}) {
		msg := "did not register periodic reader"
		global.Error(errDuplicateRegister, msg)
	}
}

// temporality reports the Temporality for the instrument kind provided.
func (r *PeriodicReader) temporality(kind InstrumentKind) metricdata.Temporality {
	return r.exporter.Temporality(kind)
}

// aggregation returns what Aggregation to use for kind.
func (r *PeriodicReader) aggregation(
	kind InstrumentKind,
) Aggregation { // nolint:revive  // import-shadow for method scoped by type.
	return r.exporter.Aggregation(kind)
}

// collectAndExport gather all metric data related to the periodicReader r from
// the SDK and exports it with r's exporter.
func (r *PeriodicReader) collectAndExport(ctx context.Context) error {
	ctx, cancel := context.WithTimeoutCause(ctx, r.timeout, errors.New("reader collect and export timeout"))
	defer cancel()

	// TODO (#3047): Use a sync.Pool or persistent pointer instead of allocating rm every Collect.
	rm := r.rmPool.Get().(*metricdata.ResourceMetrics)
	err := r.Collect(ctx, rm)
	if err == nil {
		err = r.export(ctx, rm)
	}
	r.rmPool.Put(rm)
	return err
}

// Collect gathers all metric data related to the Reader from
// the SDK and other Producers and stores the result in rm. The metric
// data is not exported to the configured exporter, it is left to the caller to
// handle that if desired.
//
// Collect will return an error if called after shutdown.
// Collect will return an error if rm is a nil ResourceMetrics.
// Collect will return an error if the context's Done channel is closed.
//
// This method is safe to call concurrently.
func (r *PeriodicReader) Collect(ctx context.Context, rm *metricdata.ResourceMetrics) error {
	if rm == nil {
		return errors.New("periodic reader: *metricdata.ResourceMetrics is nil")
	}
	// TODO (#3047): When collect is updated to accept output as param, pass rm.
	return r.collect(ctx, r.sdkProducer.Load(), rm)
}

// collect unwraps p as a produceHolder and returns its produce results.
func (r *PeriodicReader) collect(ctx context.Context, p any, rm *metricdata.ResourceMetrics) error {
	var err error
	if r.inst != nil {
		cp := r.inst.CollectMetrics(ctx)
		defer func() { cp.End(err) }()
	}

	if p == nil {
		err = ErrReaderNotRegistered
		return err
	}

	ph, ok := p.(produceHolder)
	if !ok {
		// The atomic.Value is entirely in the periodicReader's control so
		// this should never happen. In the unforeseen case that this does
		// happen, return an error instead of panicking so a users code does
		// not halt in the processes.
		err = fmt.Errorf("periodic reader: invalid producer: %T", p)
		return err
	}

	err = ph.produce(ctx, rm)
	if err != nil {
		return err
	}
	for _, producer := range r.externalProducers.Load().([]Producer) {
		externalMetrics, e := producer.Produce(ctx)
		if e != nil {
			err = errors.Join(err, e)
		}
		rm.ScopeMetrics = append(rm.ScopeMetrics, externalMetrics...)
	}

	global.Debug("PeriodicReader collection", "Data", rm)

	return err
}

// export exports metric data m using r's exporter.
func (r *PeriodicReader) export(ctx context.Context, m *metricdata.ResourceMetrics) error {
	return r.exporter.Export(ctx, m)
}

// ForceFlush flushes pending telemetry.
//
// This method is safe to call concurrently.
func (r *PeriodicReader) ForceFlush(ctx context.Context) error {
	// Prioritize the ctx timeout if it is set.
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeoutCause(ctx, r.timeout, errors.New("reader force flush timeout"))
		defer cancel()
	}

	errCh := make(chan error, 1)
	select {
	case r.flushCh <- errCh:
		select {
		case err := <-errCh:
			if err != nil {
				return err
			}
			close(errCh)
		case <-ctx.Done():
			return ctx.Err()
		}
	case <-r.done:
		return ErrReaderShutdown
	case <-ctx.Done():
		return ctx.Err()
	}
	return r.exporter.ForceFlush(ctx)
}

// Shutdown flushes pending telemetry and then stops the export pipeline.
//
// This method is safe to call concurrently.
func (r *PeriodicReader) Shutdown(ctx context.Context) error {
	err := ErrReaderShutdown
	r.shutdownOnce.Do(func() {
		// Prioritize the ctx timeout if it is set.
		if _, ok := ctx.Deadline(); !ok {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeoutCause(ctx, r.timeout, errors.New("reader shutdown timeout"))
			defer cancel()
		}

		// Stop the run loop.
		r.cancel()
		<-r.done

		// Any future call to Collect will now return ErrReaderShutdown.
		ph := r.sdkProducer.Swap(produceHolder{
			produce: shutdownProducer{}.produce,
		})

		if ph != nil { // Reader was registered.
			// Flush pending telemetry.
			m := r.rmPool.Get().(*metricdata.ResourceMetrics)
			err = r.collect(ctx, ph, m)
			if err == nil {
				err = r.export(ctx, m)
			}
			r.rmPool.Put(m)
		}

		sErr := r.exporter.Shutdown(ctx)
		if err == nil || errors.Is(err, ErrReaderShutdown) {
			err = sErr
		}

		r.mu.Lock()
		defer r.mu.Unlock()
		r.isShutdown = true
		// release references to Producer(s)
		r.externalProducers.Store([]Producer{})
	})
	return err
}

// MarshalLog returns logging data about the PeriodicReader.
func (r *PeriodicReader) MarshalLog() any {
	r.mu.Lock()
	down := r.isShutdown
	r.mu.Unlock()
	return struct {
		Type       string
		Exporter   Exporter
		Registered bool
		Shutdown   bool
		Interval   time.Duration
		Timeout    time.Duration
	}{
		Type:       "PeriodicReader",
		Exporter:   r.exporter,
		Registered: r.sdkProducer.Load() != nil,
		Shutdown:   down,
		Interval:   r.interval,
		Timeout:    r.timeout,
	}
}
