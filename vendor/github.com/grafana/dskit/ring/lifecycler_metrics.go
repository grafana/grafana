package ring

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type LifecyclerMetrics struct {
	consulHeartbeats prometheus.Counter
	shutdownDuration *prometheus.HistogramVec
	readonly         prometheus.Gauge
}

func NewLifecyclerMetrics(ringName string, reg prometheus.Registerer) *LifecyclerMetrics {
	return &LifecyclerMetrics{
		consulHeartbeats: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name:        "member_consul_heartbeats_total",
			Help:        "The total number of heartbeats sent to consul.",
			ConstLabels: prometheus.Labels{"name": ringName},
		}),
		shutdownDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:        "shutdown_duration_seconds",
			Help:        "Duration (in seconds) of shutdown procedure (ie transfer or flush).",
			Buckets:     prometheus.ExponentialBuckets(10, 2, 8), // Biggest bucket is 10*2^(9-1) = 2560, or 42 mins.
			ConstLabels: prometheus.Labels{"name": ringName},
		}, []string{"op", "status"}),
		readonly: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name:        "lifecycler_read_only",
			Help:        "Set to 1 if this lifecycler's instance entry is in read-only state.",
			ConstLabels: prometheus.Labels{"name": ringName},
		}),
	}

}
