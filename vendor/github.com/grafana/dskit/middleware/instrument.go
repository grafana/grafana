// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/instrument.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/felixge/httpsnoop"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/instrument"
)

// BodySizeBuckets defines buckets for request/response body sizes.
var BodySizeBuckets = prometheus.ExponentialBuckets(4, 4, 15)

// RouteMatcher matches routes
type RouteMatcher interface {
	Match(*http.Request, *mux.RouteMatch) bool
}

type PerTenantConfig struct {
	TenantID          string
	DurationHistogram bool
	TotalCounter      bool
}

// PerTenantCallback is a function that returns a per-tenant metrics config for a given request. If the function returns a non-nil config, the request will be instrumented with per-tenant metrics.
type PerTenantCallback func(context.Context) *PerTenantConfig

func (f PerTenantCallback) shouldInstrument(ctx context.Context) (*PerTenantConfig, bool) {
	if f == nil {
		return nil, false
	}
	cfg := f(ctx)
	if cfg == nil || cfg.TenantID == "" {
		return nil, false
	}
	return cfg, true
}

// Instrument is a Middleware which records timings for every HTTP request
type Instrument struct {
	Duration          *prometheus.HistogramVec
	PerTenantDuration *prometheus.HistogramVec
	PerTenantTotal    *prometheus.CounterVec
	PerTenantCallback PerTenantCallback
	RequestBodySize   *prometheus.HistogramVec
	ResponseBodySize  *prometheus.HistogramVec
	InflightRequests  *prometheus.GaugeVec
	LatencyCutoff     time.Duration
	ThroughputUnit    string
	RequestThroughput *prometheus.HistogramVec
}

// IsWSHandshakeRequest returns true if the given request is a websocket handshake request.
func IsWSHandshakeRequest(req *http.Request) bool {
	if strings.ToLower(req.Header.Get("Upgrade")) == "websocket" {
		// Connection header values can be of form "foo, bar, ..."
		parts := strings.Split(strings.ToLower(req.Header.Get("Connection")), ",")
		for _, part := range parts {
			if strings.TrimSpace(part) == "upgrade" {
				return true
			}
		}
	}
	return false
}

// Wrap implements middleware.Interface
func (i Instrument) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		route := i.getRouteName(r)
		inflight := i.InflightRequests.WithLabelValues(r.Method, route)
		inflight.Inc()
		defer inflight.Dec()

		origBody := r.Body
		defer func() {
			// No need to leak our Body wrapper beyond the scope of this handler.
			r.Body = origBody
		}()

		rBody := &reqBody{b: origBody}
		r.Body = rBody

		isWS := strconv.FormatBool(IsWSHandshakeRequest(r))

		respMetrics := httpsnoop.CaptureMetricsFn(w, func(ww http.ResponseWriter) {
			next.ServeHTTP(ww, r)
		})

		i.RequestBodySize.WithLabelValues(r.Method, route).Observe(float64(rBody.read))
		i.ResponseBodySize.WithLabelValues(r.Method, route).Observe(float64(respMetrics.Written))

		labelValues := []string{
			r.Method,
			route,
			strconv.Itoa(respMetrics.Code),
			isWS,
			"", // this is a placeholder for the tenant ID
		}
		labelValues = labelValues[:len(labelValues)-1]
		instrument.ObserveWithExemplar(r.Context(), i.Duration.WithLabelValues(labelValues...), respMetrics.Duration.Seconds())
		if cfg, ok := i.PerTenantCallback.shouldInstrument(r.Context()); ok {
			labelValues = append(labelValues, cfg.TenantID)
			if cfg.DurationHistogram {
				instrument.ObserveWithExemplar(r.Context(), i.PerTenantDuration.WithLabelValues(labelValues...), respMetrics.Duration.Seconds())
			}
			if cfg.TotalCounter {
				i.PerTenantTotal.WithLabelValues(labelValues...).Inc()
			}
		}
		if i.LatencyCutoff > 0 && respMetrics.Duration > i.LatencyCutoff {
			volume, err := extractValueFromMultiValueHeader(w.Header().Get("Server-Timing"), i.ThroughputUnit, "val")
			if err == nil {
				instrument.ObserveWithExemplar(r.Context(), i.RequestThroughput.WithLabelValues(r.Method, route), volume/respMetrics.Duration.Seconds())
			}
		}
	})
}

// Extracts a single value from a multi-value header, e.g. "name0;key0=0.0;key1=1.1, name1;key0=1.1"
func extractValueFromMultiValueHeader(h, name string, key string) (float64, error) {
	parts := strings.Split(h, ", ")
	if len(parts) == 0 {
		return 0, fmt.Errorf("not a multi-value header")
	}
	for _, part := range parts {
		if part, found := strings.CutPrefix(part, name); found {
			for _, spart := range strings.Split(part, ";") {
				if !strings.HasPrefix(spart, key) {
					continue
				}
				var value float64
				_, err := fmt.Sscanf(spart, key+"=%f", &value)
				if err != nil {
					return 0, fmt.Errorf("failed to parse value from header: %w", err)
				}
				return value, nil
			}
		}

	}
	return 0, fmt.Errorf("desired name not found in header")
}

// Return a name identifier for ths request.  There are three options:
//  1. The request matches a gorilla mux route, with a name.  Use that.
//  2. The request matches an unamed gorilla mux router.  Munge the path
//     template such that templates like '/api/{org}/foo' come out as
//     'api_org_foo'.
//  3. The request doesn't match a mux route. Return "other"
//
// We do all this as we do not wish to emit high cardinality labels to
// prometheus.
func (i Instrument) getRouteName(r *http.Request) string {
	route := ExtractRouteName(r.Context())
	if route == "" {
		route = "other"
	}

	return route
}

type reqBody struct {
	b    io.ReadCloser
	read int64
}

func (w *reqBody) Read(p []byte) (int, error) {
	n, err := w.b.Read(p)
	if n > 0 {
		w.read += int64(n)
	}
	return n, err
}

func (w *reqBody) Close() error {
	return w.b.Close()
}
