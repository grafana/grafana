package httpclient

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	endpointctx "github.com/grafana/grafana-plugin-sdk-go/backend/internal/endpointctx"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const kb = 1024
const mb = kb * kb
const gb = mb * kb

var (
	datasourceRequestCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "plugins",
			Name:      "datasource_request_total",
			Help:      "A counter for outgoing requests for an external data source",
		},
		[]string{"datasource_type", "code", "method", "secure_socks_ds_proxy_enabled", "endpoint"},
	)

	datasourceRequestHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "plugins",
			Name:      "datasource_request_duration_seconds",
			Help:      "histogram of durations of outgoing external data source requests sent from Grafana",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
		}, []string{"datasource_type", "code", "method", "secure_socks_ds_proxy_enabled", "endpoint"},
	)

	datasourceResponseHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "plugins",
			Name:      "datasource_response_size_bytes",
			Help:      "histogram of external data source response sizes returned to Grafana",
			Buckets: []float64{128, 256, 512, 1 * kb, 2 * kb, 4 * kb, 8 * kb, 16 * kb, 32 * kb, 64 * kb, 128 * kb, 256 * kb, 512 * kb, 1 * mb,
				2 * mb, 4 * mb, 8 * mb, 16 * mb, 32 * mb, 64 * mb, 128 * mb, 256 * mb, 512 * mb, 1 * gb,
				2 * gb, 4 * gb, 8 * gb},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"datasource_type", "secure_socks_ds_proxy_enabled", "endpoint"},
	)

	datasourceResponseGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "plugins",
			Name:      "datasource_response_size",
			Help:      "gauge of data source response sizes returned to Grafana in bytes",
		}, []string{"datasource_type", "secure_socks_ds_proxy_enabled", "endpoint"},
	)

	datasourceRequestsInFlight = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "plugins",
			Name:      "datasource_request_in_flight",
			Help:      "A gauge of outgoing external data source requests currently being sent by Grafana",
		},
		[]string{"datasource_type", "secure_socks_ds_proxy_enabled", "endpoint"},
	)
)

// sanitizeLabelName removes all invalid chars from the label name.
// If the label name is empty or contains only invalid chars, it
// will return an error.
func sanitizeLabelName(name string) (string, error) {
	if len(name) == 0 {
		return "", errors.New("label name cannot be empty")
	}

	out := strings.Builder{}
	for i, b := range name {
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_' || (b >= '0' && b <= '9' && i > 0) {
			out.WriteRune(b)
		} else if b == ' ' {
			out.WriteRune('_')
		}
	}

	if out.Len() == 0 {
		return "", fmt.Errorf("label name only contains invalid chars: %q", name)
	}

	return out.String(), nil
}

const DataSourceMetricsMiddlewareName = "datasource_metrics"

var executeMiddlewareFunc = executeMiddleware

func DataSourceMetricsMiddleware() Middleware {
	return NamedMiddlewareFunc(DataSourceMetricsMiddlewareName, func(opts Options, next http.RoundTripper) http.RoundTripper {
		if opts.Labels == nil {
			return next
		}

		datasourceType, exists := opts.Labels["datasource_type"]
		if !exists {
			return next
		}
		datasourceLabelType, err := sanitizeLabelName(datasourceType)
		// if the datasource type cannot be turned into a prometheus
		// label we will skip instrumenting these metrics.
		if err != nil {
			log.DefaultLogger.Error("failed to sanitize datasource type", "error", err)
			return next
		}

		return executeMiddlewareFunc(next, datasourceLabelType, strconv.FormatBool(opts.ProxyOptions != nil && opts.ProxyOptions.Enabled))
	})
}

func executeMiddleware(next http.RoundTripper, datasourceType string, secureSocksProxyEnabled string) http.RoundTripper {
	return RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
		ctx := r.Context()
		endpoint := ""
		if ep := ctx.Value(endpointctx.EndpointCtxKey); ep != nil {
			endpoint = fmt.Sprintf("%v", ep)
		}
		labels := prometheus.Labels{
			"datasource_type":               datasourceType,
			"secure_socks_ds_proxy_enabled": secureSocksProxyEnabled,
			"endpoint":                      endpoint,
		}
		requestCounter := datasourceRequestCounter.MustCurryWith(labels)
		requestHistogram := datasourceRequestHistogram.MustCurryWith(labels)
		requestInFlight := datasourceRequestsInFlight.With(labels)
		responseSizeHistogram := datasourceResponseHistogram.With(labels)
		responseSizeGauge := datasourceResponseGauge.With(labels)

		res, err := promhttp.InstrumentRoundTripperDuration(requestHistogram,
			promhttp.InstrumentRoundTripperCounter(requestCounter,
				promhttp.InstrumentRoundTripperInFlight(requestInFlight, next))).
			RoundTrip(r)
		if err != nil {
			return nil, err
		}

		if res != nil && res.StatusCode != http.StatusSwitchingProtocols {
			res.Body = CountBytesReader(res.Body, func(bytesRead int64) {
				responseSizeHistogram.Observe(float64(bytesRead))
				responseSizeGauge.Set(float64(bytesRead))
			})
		}

		return res, nil
	})
}
