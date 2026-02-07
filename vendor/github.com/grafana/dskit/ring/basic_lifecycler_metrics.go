package ring

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BasicLifecyclerMetrics struct {
	heartbeats  prometheus.Counter
	tokensOwned prometheus.Gauge
	tokensToOwn prometheus.Gauge
}

func NewBasicLifecyclerMetrics(ringName string, reg prometheus.Registerer) *BasicLifecyclerMetrics {
	return &BasicLifecyclerMetrics{
		heartbeats: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name:        "ring_member_heartbeats_total",
			Help:        "The total number of heartbeats sent.",
			ConstLabels: prometheus.Labels{"name": ringName},
		}),
		tokensOwned: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name:        "ring_member_tokens_owned",
			Help:        "The number of tokens owned in the ring.",
			ConstLabels: prometheus.Labels{"name": ringName},
		}),
		tokensToOwn: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name:        "ring_member_tokens_to_own",
			Help:        "The number of tokens to own in the ring.",
			ConstLabels: prometheus.Labels{"name": ringName},
		}),
	}
}
