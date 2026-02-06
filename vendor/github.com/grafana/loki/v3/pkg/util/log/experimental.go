package log

import (
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/loki/v3/pkg/util/constants"
)

var experimentalFeaturesInUse = promauto.NewCounter(
	prometheus.CounterOpts{
		Namespace: constants.Loki,
		Name:      "experimental_features_in_use_total",
		Help:      "The number of experimental features in use.",
	},
)

// WarnExperimentalUse logs a warning and increments the experimental features metric.
func WarnExperimentalUse(feature string, logger log.Logger) {
	level.Warn(logger).Log("msg", "experimental feature in use", "feature", feature)
	experimentalFeaturesInUse.Inc()
}
