package http

import (
	"context"
	"crypto/tls"
	"net/http"
	"net/http/httptrace"
	"sync/atomic"
	"time"

	"github.com/aws/smithy-go/metrics"
)

var now = time.Now

// withMetrics instruments an HTTP client and context to collect HTTP metrics.
func withMetrics(parent context.Context, client ClientDo, meter metrics.Meter) (
	context.Context, ClientDo, error,
) {
	// WithClientTrace is an expensive operation - avoid calling it if we're
	// not actually using a metrics sink.
	if _, ok := meter.(metrics.NopMeter); ok {
		return parent, client, nil
	}

	hm, err := newHTTPMetrics(meter)
	if err != nil {
		return nil, nil, err
	}

	ctx := httptrace.WithClientTrace(parent, &httptrace.ClientTrace{
		DNSStart:          hm.DNSStart,
		ConnectStart:      hm.ConnectStart,
		TLSHandshakeStart: hm.TLSHandshakeStart,

		GotConn:              hm.GotConn(parent),
		PutIdleConn:          hm.PutIdleConn(parent),
		ConnectDone:          hm.ConnectDone(parent),
		DNSDone:              hm.DNSDone(parent),
		TLSHandshakeDone:     hm.TLSHandshakeDone(parent),
		GotFirstResponseByte: hm.GotFirstResponseByte(parent),
	})
	return ctx, &timedClientDo{client, hm}, nil
}

type timedClientDo struct {
	ClientDo
	hm *httpMetrics
}

func (c *timedClientDo) Do(r *http.Request) (*http.Response, error) {
	c.hm.doStart.Store(now())
	resp, err := c.ClientDo.Do(r)

	c.hm.DoRequestDuration.Record(r.Context(), c.hm.doStart.Elapsed())
	return resp, err
}

type httpMetrics struct {
	DNSLookupDuration    metrics.Float64Histogram   // client.http.connections.dns_lookup_duration
	ConnectDuration      metrics.Float64Histogram   // client.http.connections.acquire_duration
	TLSHandshakeDuration metrics.Float64Histogram   // client.http.connections.tls_handshake_duration
	ConnectionUsage      metrics.Int64UpDownCounter // client.http.connections.usage

	DoRequestDuration metrics.Float64Histogram // client.http.do_request_duration
	TimeToFirstByte   metrics.Float64Histogram // client.http.time_to_first_byte

	doStart      safeTime
	dnsStart     safeTime
	connectStart safeTime
	tlsStart     safeTime
}

func newHTTPMetrics(meter metrics.Meter) (*httpMetrics, error) {
	hm := &httpMetrics{}

	var err error
	hm.DNSLookupDuration, err = meter.Float64Histogram("client.http.connections.dns_lookup_duration", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "s"
		o.Description = "The time it takes a request to perform DNS lookup."
	})
	if err != nil {
		return nil, err
	}
	hm.ConnectDuration, err = meter.Float64Histogram("client.http.connections.acquire_duration", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "s"
		o.Description = "The time it takes a request to acquire a connection."
	})
	if err != nil {
		return nil, err
	}
	hm.TLSHandshakeDuration, err = meter.Float64Histogram("client.http.connections.tls_handshake_duration", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "s"
		o.Description = "The time it takes an HTTP request to perform the TLS handshake."
	})
	if err != nil {
		return nil, err
	}
	hm.ConnectionUsage, err = meter.Int64UpDownCounter("client.http.connections.usage", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "{connection}"
		o.Description = "Current state of connections pool."
	})
	if err != nil {
		return nil, err
	}
	hm.DoRequestDuration, err = meter.Float64Histogram("client.http.do_request_duration", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "s"
		o.Description = "Time spent performing an entire HTTP transaction."
	})
	if err != nil {
		return nil, err
	}
	hm.TimeToFirstByte, err = meter.Float64Histogram("client.http.time_to_first_byte", func(o *metrics.InstrumentOptions) {
		o.UnitLabel = "s"
		o.Description = "Time from start of transaction to when the first response byte is available."
	})
	if err != nil {
		return nil, err
	}

	return hm, nil
}

func (m *httpMetrics) DNSStart(httptrace.DNSStartInfo) {
	m.dnsStart.Store(now())
}

func (m *httpMetrics) ConnectStart(string, string) {
	m.connectStart.Store(now())
}

func (m *httpMetrics) TLSHandshakeStart() {
	m.tlsStart.Store(now())
}

func (m *httpMetrics) GotConn(ctx context.Context) func(httptrace.GotConnInfo) {
	return func(httptrace.GotConnInfo) {
		m.addConnAcquired(ctx, 1)
	}
}

func (m *httpMetrics) PutIdleConn(ctx context.Context) func(error) {
	return func(error) {
		m.addConnAcquired(ctx, -1)
	}
}

func (m *httpMetrics) DNSDone(ctx context.Context) func(httptrace.DNSDoneInfo) {
	return func(httptrace.DNSDoneInfo) {
		m.DNSLookupDuration.Record(ctx, m.dnsStart.Elapsed())
	}
}

func (m *httpMetrics) ConnectDone(ctx context.Context) func(string, string, error) {
	return func(string, string, error) {
		m.ConnectDuration.Record(ctx, m.connectStart.Elapsed())
	}
}

func (m *httpMetrics) TLSHandshakeDone(ctx context.Context) func(tls.ConnectionState, error) {
	return func(tls.ConnectionState, error) {
		m.TLSHandshakeDuration.Record(ctx, m.tlsStart.Elapsed())
	}
}

func (m *httpMetrics) GotFirstResponseByte(ctx context.Context) func() {
	return func() {
		m.TimeToFirstByte.Record(ctx, m.doStart.Elapsed())
	}
}

func (m *httpMetrics) addConnAcquired(ctx context.Context, incr int64) {
	m.ConnectionUsage.Add(ctx, incr, func(o *metrics.RecordMetricOptions) {
		o.Properties.Set("state", "acquired")
	})
}

// Not used: it is recommended to track acquired vs idle conn, but we can't
// determine when something is truly idle with the current HTTP client hooks
// available to us.
func (m *httpMetrics) addConnIdle(ctx context.Context, incr int64) {
	m.ConnectionUsage.Add(ctx, incr, func(o *metrics.RecordMetricOptions) {
		o.Properties.Set("state", "idle")
	})
}

type safeTime struct {
	atomic.Value // time.Time
}

func (st *safeTime) Store(v time.Time) {
	st.Value.Store(v)
}

func (st *safeTime) Load() time.Time {
	t, _ := st.Value.Load().(time.Time)
	return t
}

func (st *safeTime) Elapsed() float64 {
	end := now()
	elapsed := end.Sub(st.Load())
	return float64(elapsed) / 1e9
}
