// Package metrics provides various metric and telemetry definitions for OpenFGA Conditions.
package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/openfga/openfga/internal/build"
	"github.com/openfga/openfga/internal/utils"
	"github.com/openfga/openfga/pkg/server/config"
)

// Metrics provides access to Condition metrics.
var Metrics *ConditionMetrics

func init() {
	m := &ConditionMetrics{
		compilationTime: promauto.NewHistogram(prometheus.HistogramOpts{
			Namespace: build.ProjectName,
			Name:      "condition_compilation_duration_ms",
			Help:      "A histogram measuring the compilation time (in milliseconds) of a Condition.",
			Buckets:   []float64{1, 5, 15, 50, 100, 250, 500, 1000},
		}),

		evaluationTime: promauto.NewHistogram(prometheus.HistogramOpts{
			Namespace: build.ProjectName,
			Name:      "condition_evaluation_duration_ms",
			Help:      "A histogram measuring the evaluation time (in milliseconds) of a Condition.",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 5, 15, 50, 100, 250, 500},
		}),

		evaluationCost: promauto.NewHistogram(prometheus.HistogramOpts{
			Namespace:                       build.ProjectName,
			Name:                            "condition_evaluation_cost",
			Help:                            "A histogram of the CEL evaluation cost of a Condition in a Relationship Tuple",
			Buckets:                         utils.LinearBuckets(0, config.DefaultMaxConditionEvaluationCost, 10),
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  config.DefaultMaxConditionEvaluationCost,
			NativeHistogramMinResetDuration: time.Hour,
		}),
	}

	Metrics = m
}

type ConditionMetrics struct {
	compilationTime prometheus.Histogram
	evaluationTime  prometheus.Histogram
	evaluationCost  prometheus.Histogram
}

// ObserveCompilationDuration records the duration (in milliseconds) that Condition compilation took.
func (m *ConditionMetrics) ObserveCompilationDuration(elapsed time.Duration) {
	m.compilationTime.Observe(float64(elapsed.Milliseconds()))
}

// ObserveEvaluationDuration records the duration (in milliseconds) that Condition evaluation took.
func (m *ConditionMetrics) ObserveEvaluationDuration(elapsed time.Duration) {
	m.evaluationTime.Observe(float64(elapsed.Milliseconds()))
}

// ObserveEvaluationCost records the CEL evaluation cost the Condition required to resolve the expression.
func (m *ConditionMetrics) ObserveEvaluationCost(cost uint64) {
	m.evaluationCost.Observe(float64(cost))
}
