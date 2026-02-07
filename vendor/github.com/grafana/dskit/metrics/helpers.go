package metrics

import (
	"errors"
	"fmt"

	dto "github.com/prometheus/client_model/go"
)

// MatchesLabels returns true if m has all the labels in l.
func MatchesLabels(m *dto.Metric, labelNamesAndValues ...string) bool {
	for _, l := range makeLabels(labelNamesAndValues...) {
		found := false
		for _, lp := range m.GetLabel() {
			if l.GetName() != lp.GetName() || l.GetValue() != lp.GetValue() {
				continue
			}

			found = true
			break
		}

		if !found {
			return false
		}
	}

	return true
}

// FindMetricsInFamilyMatchingLabels returns all the metrics in mf that match the labels in labelNamesAndValues.
func FindMetricsInFamilyMatchingLabels(mf *dto.MetricFamily, labelNamesAndValues ...string) []*dto.Metric {
	var result []*dto.Metric
	for _, m := range mf.GetMetric() {
		if MatchesLabels(m, labelNamesAndValues...) {
			result = append(result, m)
		}
	}
	return result
}

// FindHistogramWithNameAndLabels returns the histogram in metrics with name that matches the labels in labelNamesAndValues.
// If no histogram with name is present in metrics, if labelNamesAndValues matches anything other than exactly one metric,
// or if the matching metric is not a histogram, an error is returned.
func FindHistogramWithNameAndLabels(metrics MetricFamilyMap, name string, labelNamesAndValues ...string) (*dto.Histogram, error) {
	metricFamily, ok := metrics[name]
	if !ok {
		return nil, fmt.Errorf("no metric with name '%v' found", name)
	}

	matchingMetrics := FindMetricsInFamilyMatchingLabels(metricFamily, labelNamesAndValues...)

	if len(matchingMetrics) != 1 {
		return nil, fmt.Errorf("wanted exactly one matching metric, but found %v", len(matchingMetrics))
	}

	metric := matchingMetrics[0]

	if metric.Histogram == nil {
		return nil, errors.New("found a single matching metric, but it is not a histogram")
	}

	return metric.Histogram, nil
}
