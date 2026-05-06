package e2e

import (
	"math"

	io_prometheus_client "github.com/prometheus/client_model/go"
)

func getMetricValue(m *io_prometheus_client.Metric) float64 {
	if m.GetGauge() != nil {
		return m.GetGauge().GetValue()
	} else if m.GetCounter() != nil {
		return m.GetCounter().GetValue()
	} else if m.GetHistogram() != nil {
		return m.GetHistogram().GetSampleSum()
	} else if m.GetSummary() != nil {
		return m.GetSummary().GetSampleSum()
	} else {
		return 0
	}
}

func getMetricCount(m *io_prometheus_client.Metric) float64 {
	if m.GetHistogram() != nil {
		return float64(m.GetHistogram().GetSampleCount())
	} else if m.GetSummary() != nil {
		return float64(m.GetSummary().GetSampleCount())
	} else {
		return 0
	}
}

func getValues(metrics []*io_prometheus_client.Metric, opts MetricsOptions) []float64 {
	values := make([]float64, 0, len(metrics))
	for _, m := range metrics {
		values = append(values, opts.GetValue(m))
	}
	return values
}

func filterMetrics(metrics []*io_prometheus_client.Metric, opts MetricsOptions) []*io_prometheus_client.Metric {
	// If no label matcher is configured, then no filtering should be done.
	if len(opts.LabelMatchers) == 0 {
		return metrics
	}
	if len(metrics) == 0 {
		return metrics
	}

	filtered := make([]*io_prometheus_client.Metric, 0, len(metrics))

	for _, m := range metrics {
		metricLabels := map[string]string{}
		for _, lp := range m.GetLabel() {
			metricLabels[lp.GetName()] = lp.GetValue()
		}

		matches := true
		for _, matcher := range opts.LabelMatchers {
			if !matcher.Matches(metricLabels[matcher.Name]) {
				matches = false
				break
			}
		}

		if !matches {
			continue
		}

		filtered = append(filtered, m)
	}

	return filtered
}

func SumValues(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum
}

func EqualsSingle(expected float64) func(float64) bool {
	return func(v float64) bool {
		return v == expected || (math.IsNaN(v) && math.IsNaN(expected))
	}
}

// Equals is an isExpected function for WaitSumMetrics that returns true if given single sum is equals to given value.
func Equals(value float64) func(sums ...float64) bool {
	return func(sums ...float64) bool {
		if len(sums) != 1 {
			panic("equals: expected one value")
		}
		return sums[0] == value || math.IsNaN(sums[0]) && math.IsNaN(value)
	}
}

// Greater is an isExpected function for WaitSumMetrics that returns true if given single sum is greater than given value.
func Greater(value float64) func(sums ...float64) bool {
	return func(sums ...float64) bool {
		if len(sums) != 1 {
			panic("greater: expected one value")
		}
		return sums[0] > value
	}
}

// GreaterOrEqual is an isExpected function for WaitSumMetrics that returns true if given single sum is greater or equal than given value.
func GreaterOrEqual(value float64) func(sums ...float64) bool {
	return func(sums ...float64) bool {
		if len(sums) != 1 {
			panic("greater: expected one value")
		}
		return sums[0] >= value
	}
}

// Less is an isExpected function for WaitSumMetrics that returns true if given single sum is less than given value.
func Less(value float64) func(sums ...float64) bool {
	return func(sums ...float64) bool {
		if len(sums) != 1 {
			panic("less: expected one value")
		}
		return sums[0] < value
	}
}

// EqualsAmongTwo is an isExpected function for WaitSumMetrics that returns true if first sum is equal to the second.
// NOTE: Be careful on scrapes in between of process that changes two metrics. Those are
// usually not atomic.
func EqualsAmongTwo(sums ...float64) bool {
	if len(sums) != 2 {
		panic("equalsAmongTwo: expected two values")
	}
	return sums[0] == sums[1]
}

// GreaterAmongTwo is an isExpected function for WaitSumMetrics that returns true if first sum is greater than second.
// NOTE: Be careful on scrapes in between of process that changes two metrics. Those are
// usually not atomic.
func GreaterAmongTwo(sums ...float64) bool {
	if len(sums) != 2 {
		panic("greaterAmongTwo: expected two values")
	}
	return sums[0] > sums[1]
}

// LessAmongTwo is an isExpected function for WaitSumMetrics that returns true if first sum is smaller than second.
// NOTE: Be careful on scrapes in between of process that changes two metrics. Those are
// usually not atomic.
func LessAmongTwo(sums ...float64) bool {
	if len(sums) != 2 {
		panic("lessAmongTwo: expected two values")
	}
	return sums[0] < sums[1]
}
