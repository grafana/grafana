package log

import (
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var experimentalFeaturesInUse = promauto.NewCounter(
	prometheus.CounterOpts{
		Namespace: "tempo",
		Name:      "experimental_features_in_use_total",
		Help:      "The number of experimental features in use.",
	},
)

// WarnExperimentalUse logs a warning and increments the experimental features metric.
func WarnExperimentalUse(feature string) {
	level.Warn(Logger).Log("msg", "experimental feature in use", "feature", feature)
	experimentalFeaturesInUse.Inc()
}
