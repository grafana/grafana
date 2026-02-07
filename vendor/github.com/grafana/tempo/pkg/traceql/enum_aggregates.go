package traceql

import "fmt"

type AggregateOp int

const (
	aggregateCount AggregateOp = iota
	aggregateMax
	aggregateMin
	aggregateSum
	aggregateAvg
)

func (a AggregateOp) String() string {
	switch a {
	case aggregateCount:
		return "count"
	case aggregateMax:
		return "max"
	case aggregateMin:
		return "min"
	case aggregateSum:
		return "sum"
	case aggregateAvg:
		return "avg"
	}

	return fmt.Sprintf("aggregate(%d)", a)
}

// AggregateMode is the different flavors of metrics queries
// as executed in different places.
type AggregateMode int

const (
	// AggregateModeRaw is the version that runs directly on spans.
	// It yields the first level of raw time series.
	AggregateModeRaw = iota

	// AggregateModeSum is the version that performs the next stages
	// after raw. This is how to combine results from multiple jobs or pods, but still not
	// the final results. For example rate/count are simple addition, min/max compute
	// another level of min/maxing.
	AggregateModeSum

	// AggregateModeFinal is the version that must run in a single place and cannot be
	// subdivided. This includes the computation of quantiles, averages, etc.
	AggregateModeFinal
)

type MetricsAggregateOp int

const (
	metricsAggregateRate MetricsAggregateOp = iota
	metricsAggregateCountOverTime
	metricsAggregateMinOverTime
	metricsAggregateMaxOverTime
	metricsAggregateAvgOverTime
	metricsAggregateSumOverTime
	metricsAggregateQuantileOverTime
	metricsAggregateHistogramOverTime
)

func (a MetricsAggregateOp) String() string {
	switch a {
	case metricsAggregateRate:
		return "rate"
	case metricsAggregateCountOverTime:
		return "count_over_time"
	case metricsAggregateMinOverTime:
		return "min_over_time"
	case metricsAggregateMaxOverTime:
		return "max_over_time"
	case metricsAggregateAvgOverTime:
		return "avg_over_time"
	case metricsAggregateSumOverTime:
		return "sum_over_time"
	case metricsAggregateQuantileOverTime:
		return "quantile_over_time"
	case metricsAggregateHistogramOverTime:
		return "histogram_over_time"
	}

	return fmt.Sprintf("aggregate(%d)", a)
}
