// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"encoding/json"
)

// Aggregations can be seen as a unit-of-work that build
// analytic information over a set of documents. It is
// (in many senses) the follow-up of facets in Elasticsearch.
// For more details about aggregations, visit:
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations.html
type Aggregation interface {
	// Source returns a JSON-serializable aggregation that is a fragment
	// of the request sent to Elasticsearch.
	Source() (interface{}, error)
}

// Aggregations is a list of aggregations that are part of a search result.
type Aggregations map[string]*json.RawMessage

// Min returns min aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-min-aggregation.html
func (a Aggregations) Min(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Max returns max aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-max-aggregation.html
func (a Aggregations) Max(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Sum returns sum aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-sum-aggregation.html
func (a Aggregations) Sum(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Avg returns average aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-avg-aggregation.html
func (a Aggregations) Avg(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// ValueCount returns value-count aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-valuecount-aggregation.html
func (a Aggregations) ValueCount(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Cardinality returns cardinality aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-cardinality-aggregation.html
func (a Aggregations) Cardinality(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Stats returns stats aggregation results.
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-stats-aggregation.html
func (a Aggregations) Stats(name string) (*AggregationStatsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationStatsMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// ExtendedStats returns extended stats aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-extendedstats-aggregation.html
func (a Aggregations) ExtendedStats(name string) (*AggregationExtendedStatsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationExtendedStatsMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// MatrixStats returns matrix stats aggregation results.
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-matrix-stats-aggregation.html
func (a Aggregations) MatrixStats(name string) (*AggregationMatrixStats, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationMatrixStats)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Percentiles returns percentiles results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-percentile-aggregation.html
func (a Aggregations) Percentiles(name string) (*AggregationPercentilesMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPercentilesMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// PercentileRanks returns percentile ranks results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-percentile-rank-aggregation.html
func (a Aggregations) PercentileRanks(name string) (*AggregationPercentilesMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPercentilesMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// TopHits returns top-hits aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-top-hits-aggregation.html
func (a Aggregations) TopHits(name string) (*AggregationTopHitsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationTopHitsMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Global returns global results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-global-aggregation.html
func (a Aggregations) Global(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Filter returns filter results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-filter-aggregation.html
func (a Aggregations) Filter(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Filters returns filters results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-filters-aggregation.html
func (a Aggregations) Filters(name string) (*AggregationBucketFilters, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketFilters)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Missing returns missing results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-missing-aggregation.html
func (a Aggregations) Missing(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Nested returns nested results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-nested-aggregation.html
func (a Aggregations) Nested(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// ReverseNested returns reverse-nested results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-reverse-nested-aggregation.html
func (a Aggregations) ReverseNested(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Children returns children results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-children-aggregation.html
func (a Aggregations) Children(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Terms returns terms aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-terms-aggregation.html
func (a Aggregations) Terms(name string) (*AggregationBucketKeyItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketKeyItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// SignificantTerms returns significant terms aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-significantterms-aggregation.html
func (a Aggregations) SignificantTerms(name string) (*AggregationBucketSignificantTerms, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketSignificantTerms)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Sampler returns sampler aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-sampler-aggregation.html
func (a Aggregations) Sampler(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Range returns range aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-range-aggregation.html
func (a Aggregations) Range(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// KeyedRange returns keyed range aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-range-aggregation.html.
func (a Aggregations) KeyedRange(name string) (*AggregationBucketKeyedRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketKeyedRangeItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// DateRange returns date range aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-daterange-aggregation.html
func (a Aggregations) DateRange(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// IPv4Range returns IPv4 range aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-iprange-aggregation.html
func (a Aggregations) IPv4Range(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Histogram returns histogram aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-histogram-aggregation.html
func (a Aggregations) Histogram(name string) (*AggregationBucketHistogramItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketHistogramItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// DateHistogram returns date histogram aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-datehistogram-aggregation.html
func (a Aggregations) DateHistogram(name string) (*AggregationBucketHistogramItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketHistogramItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// GeoBounds returns geo-bounds aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-geobounds-aggregation.html
func (a Aggregations) GeoBounds(name string) (*AggregationGeoBoundsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationGeoBoundsMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// GeoHash returns geo-hash aggregation results.
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-geohashgrid-aggregation.html
func (a Aggregations) GeoHash(name string) (*AggregationBucketKeyItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketKeyItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// GeoDistance returns geo distance aggregation results.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-geodistance-aggregation.html
func (a Aggregations) GeoDistance(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// AvgBucket returns average bucket pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-avg-bucket-aggregation.html
func (a Aggregations) AvgBucket(name string) (*AggregationPipelineSimpleValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineSimpleValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// SumBucket returns sum bucket pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-sum-bucket-aggregation.html
func (a Aggregations) SumBucket(name string) (*AggregationPipelineSimpleValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineSimpleValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// StatsBucket returns stats bucket pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-stats-bucket-aggregation.html
func (a Aggregations) StatsBucket(name string) (*AggregationPipelineStatsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineStatsMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// PercentilesBucket returns stats bucket pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-percentiles-bucket-aggregation.html
func (a Aggregations) PercentilesBucket(name string) (*AggregationPipelinePercentilesMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelinePercentilesMetric)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// MaxBucket returns maximum bucket pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-max-bucket-aggregation.html
func (a Aggregations) MaxBucket(name string) (*AggregationPipelineBucketMetricValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineBucketMetricValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// MinBucket returns minimum bucket pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-min-bucket-aggregation.html
func (a Aggregations) MinBucket(name string) (*AggregationPipelineBucketMetricValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineBucketMetricValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// MovAvg returns moving average pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-movavg-aggregation.html
func (a Aggregations) MovAvg(name string) (*AggregationPipelineSimpleValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineSimpleValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Derivative returns derivative pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-derivative-aggregation.html
func (a Aggregations) Derivative(name string) (*AggregationPipelineDerivative, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineDerivative)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// CumulativeSum returns a cumulative sum pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-cumulative-sum-aggregation.html
func (a Aggregations) CumulativeSum(name string) (*AggregationPipelineSimpleValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineSimpleValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// BucketScript returns bucket script pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-bucket-script-aggregation.html
func (a Aggregations) BucketScript(name string) (*AggregationPipelineSimpleValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineSimpleValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// SerialDiff returns serial differencing pipeline aggregation results.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-serialdiff-aggregation.html
func (a Aggregations) SerialDiff(name string) (*AggregationPipelineSimpleValue, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPipelineSimpleValue)
		if raw == nil {
			return agg, true
		}
		if err := json.Unmarshal(*raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// -- Single value metric --

// AggregationValueMetric is a single-value metric, returned e.g. by a
// Min or Max aggregation.
type AggregationValueMetric struct {
	Aggregations

	Value *float64               //`json:"value"`
	Meta  map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationValueMetric structure.
func (a *AggregationValueMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["value"]; ok && v != nil {
		json.Unmarshal(*v, &a.Value)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Stats metric --

// AggregationStatsMetric is a multi-value metric, returned by a Stats aggregation.
type AggregationStatsMetric struct {
	Aggregations

	Count int64                  // `json:"count"`
	Min   *float64               //`json:"min,omitempty"`
	Max   *float64               //`json:"max,omitempty"`
	Avg   *float64               //`json:"avg,omitempty"`
	Sum   *float64               //`json:"sum,omitempty"`
	Meta  map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationStatsMetric structure.
func (a *AggregationStatsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["count"]; ok && v != nil {
		json.Unmarshal(*v, &a.Count)
	}
	if v, ok := aggs["min"]; ok && v != nil {
		json.Unmarshal(*v, &a.Min)
	}
	if v, ok := aggs["max"]; ok && v != nil {
		json.Unmarshal(*v, &a.Max)
	}
	if v, ok := aggs["avg"]; ok && v != nil {
		json.Unmarshal(*v, &a.Avg)
	}
	if v, ok := aggs["sum"]; ok && v != nil {
		json.Unmarshal(*v, &a.Sum)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Extended stats metric --

// AggregationExtendedStatsMetric is a multi-value metric, returned by an ExtendedStats aggregation.
type AggregationExtendedStatsMetric struct {
	Aggregations

	Count        int64                  // `json:"count"`
	Min          *float64               //`json:"min,omitempty"`
	Max          *float64               //`json:"max,omitempty"`
	Avg          *float64               //`json:"avg,omitempty"`
	Sum          *float64               //`json:"sum,omitempty"`
	SumOfSquares *float64               //`json:"sum_of_squares,omitempty"`
	Variance     *float64               //`json:"variance,omitempty"`
	StdDeviation *float64               //`json:"std_deviation,omitempty"`
	Meta         map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationExtendedStatsMetric structure.
func (a *AggregationExtendedStatsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["count"]; ok && v != nil {
		json.Unmarshal(*v, &a.Count)
	}
	if v, ok := aggs["min"]; ok && v != nil {
		json.Unmarshal(*v, &a.Min)
	}
	if v, ok := aggs["max"]; ok && v != nil {
		json.Unmarshal(*v, &a.Max)
	}
	if v, ok := aggs["avg"]; ok && v != nil {
		json.Unmarshal(*v, &a.Avg)
	}
	if v, ok := aggs["sum"]; ok && v != nil {
		json.Unmarshal(*v, &a.Sum)
	}
	if v, ok := aggs["sum_of_squares"]; ok && v != nil {
		json.Unmarshal(*v, &a.SumOfSquares)
	}
	if v, ok := aggs["variance"]; ok && v != nil {
		json.Unmarshal(*v, &a.Variance)
	}
	if v, ok := aggs["std_deviation"]; ok && v != nil {
		json.Unmarshal(*v, &a.StdDeviation)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Matrix Stats --

// AggregationMatrixStats is returned by a MatrixStats aggregation.
type AggregationMatrixStats struct {
	Aggregations

	Fields []*AggregationMatrixStatsField // `json:"field,omitempty"`
	Meta   map[string]interface{}         // `json:"meta,omitempty"`
}

// AggregationMatrixStatsField represents running stats of a single field
// returned from MatrixStats aggregation.
type AggregationMatrixStatsField struct {
	Name        string             `json:"name"`
	Count       int64              `json:"count"`
	Mean        float64            `json:"mean,omitempty"`
	Variance    float64            `json:"variance,omitempty"`
	Skewness    float64            `json:"skewness,omitempty"`
	Kurtosis    float64            `json:"kurtosis,omitempty"`
	Covariance  map[string]float64 `json:"covariance,omitempty"`
	Correlation map[string]float64 `json:"correlation,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationMatrixStats structure.
func (a *AggregationMatrixStats) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["fields"]; ok && v != nil {
		// RunningStats for every field
		json.Unmarshal(*v, &a.Fields)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Percentiles metric --

// AggregationPercentilesMetric is a multi-value metric, returned by a Percentiles aggregation.
type AggregationPercentilesMetric struct {
	Aggregations

	Values map[string]float64     // `json:"values"`
	Meta   map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPercentilesMetric structure.
func (a *AggregationPercentilesMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["values"]; ok && v != nil {
		json.Unmarshal(*v, &a.Values)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Top-hits metric --

// AggregationTopHitsMetric is a metric returned by a TopHits aggregation.
type AggregationTopHitsMetric struct {
	Aggregations

	Hits *SearchHits            //`json:"hits"`
	Meta map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationTopHitsMetric structure.
func (a *AggregationTopHitsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs
	a.Hits = new(SearchHits)
	if v, ok := aggs["hits"]; ok && v != nil {
		json.Unmarshal(*v, &a.Hits)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	return nil
}

// -- Geo-bounds metric --

// AggregationGeoBoundsMetric is a metric as returned by a GeoBounds aggregation.
type AggregationGeoBoundsMetric struct {
	Aggregations

	Bounds struct {
		TopLeft struct {
			Latitude  float64 `json:"lat"`
			Longitude float64 `json:"lon"`
		} `json:"top_left"`
		BottomRight struct {
			Latitude  float64 `json:"lat"`
			Longitude float64 `json:"lon"`
		} `json:"bottom_right"`
	} `json:"bounds"`

	Meta map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationGeoBoundsMetric structure.
func (a *AggregationGeoBoundsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["bounds"]; ok && v != nil {
		json.Unmarshal(*v, &a.Bounds)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Single bucket --

// AggregationSingleBucket is a single bucket, returned e.g. via an aggregation of type Global.
type AggregationSingleBucket struct {
	Aggregations

	DocCount int64                  // `json:"doc_count"`
	Meta     map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationSingleBucket structure.
func (a *AggregationSingleBucket) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Bucket range items --

// AggregationBucketRangeItems is a bucket aggregation that is e.g. returned
// with a range aggregation.
type AggregationBucketRangeItems struct {
	Aggregations

	DocCountErrorUpperBound int64                         //`json:"doc_count_error_upper_bound"`
	SumOfOtherDocCount      int64                         //`json:"sum_other_doc_count"`
	Buckets                 []*AggregationBucketRangeItem //`json:"buckets"`
	Meta                    map[string]interface{}        // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketRangeItems structure.
func (a *AggregationBucketRangeItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["doc_count_error_upper_bound"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCountErrorUpperBound)
	}
	if v, ok := aggs["sum_other_doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.SumOfOtherDocCount)
	}
	if v, ok := aggs["buckets"]; ok && v != nil {
		json.Unmarshal(*v, &a.Buckets)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// AggregationBucketKeyedRangeItems is a bucket aggregation that is e.g. returned
// with a keyed range aggregation.
type AggregationBucketKeyedRangeItems struct {
	Aggregations

	DocCountErrorUpperBound int64                                  //`json:"doc_count_error_upper_bound"`
	SumOfOtherDocCount      int64                                  //`json:"sum_other_doc_count"`
	Buckets                 map[string]*AggregationBucketRangeItem //`json:"buckets"`
	Meta                    map[string]interface{}                 // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketRangeItems structure.
func (a *AggregationBucketKeyedRangeItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["doc_count_error_upper_bound"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCountErrorUpperBound)
	}
	if v, ok := aggs["sum_other_doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.SumOfOtherDocCount)
	}
	if v, ok := aggs["buckets"]; ok && v != nil {
		json.Unmarshal(*v, &a.Buckets)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// AggregationBucketRangeItem is a single bucket of an AggregationBucketRangeItems structure.
type AggregationBucketRangeItem struct {
	Aggregations

	Key          string   //`json:"key"`
	DocCount     int64    //`json:"doc_count"`
	From         *float64 //`json:"from"`
	FromAsString string   //`json:"from_as_string"`
	To           *float64 //`json:"to"`
	ToAsString   string   //`json:"to_as_string"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketRangeItem structure.
func (a *AggregationBucketRangeItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["key"]; ok && v != nil {
		json.Unmarshal(*v, &a.Key)
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	if v, ok := aggs["from"]; ok && v != nil {
		json.Unmarshal(*v, &a.From)
	}
	if v, ok := aggs["from_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.FromAsString)
	}
	if v, ok := aggs["to"]; ok && v != nil {
		json.Unmarshal(*v, &a.To)
	}
	if v, ok := aggs["to_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.ToAsString)
	}
	a.Aggregations = aggs
	return nil
}

// -- Bucket key items --

// AggregationBucketKeyItems is a bucket aggregation that is e.g. returned
// with a terms aggregation.
type AggregationBucketKeyItems struct {
	Aggregations

	DocCountErrorUpperBound int64                       //`json:"doc_count_error_upper_bound"`
	SumOfOtherDocCount      int64                       //`json:"sum_other_doc_count"`
	Buckets                 []*AggregationBucketKeyItem //`json:"buckets"`
	Meta                    map[string]interface{}      // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketKeyItems structure.
func (a *AggregationBucketKeyItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["doc_count_error_upper_bound"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCountErrorUpperBound)
	}
	if v, ok := aggs["sum_other_doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.SumOfOtherDocCount)
	}
	if v, ok := aggs["buckets"]; ok && v != nil {
		json.Unmarshal(*v, &a.Buckets)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// AggregationBucketKeyItem is a single bucket of an AggregationBucketKeyItems structure.
type AggregationBucketKeyItem struct {
	Aggregations

	Key         interface{} //`json:"key"`
	KeyAsString *string     //`json:"key_as_string"`
	KeyNumber   json.Number
	DocCount    int64 //`json:"doc_count"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketKeyItem structure.
func (a *AggregationBucketKeyItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	if err := dec.Decode(&aggs); err != nil {
		return err
	}
	if v, ok := aggs["key"]; ok && v != nil {
		json.Unmarshal(*v, &a.Key)
		json.Unmarshal(*v, &a.KeyNumber)
	}
	if v, ok := aggs["key_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.KeyAsString)
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	a.Aggregations = aggs
	return nil
}

// -- Bucket types for significant terms --

// AggregationBucketSignificantTerms is a bucket aggregation returned
// with a significant terms aggregation.
type AggregationBucketSignificantTerms struct {
	Aggregations

	DocCount int64                               //`json:"doc_count"`
	Buckets  []*AggregationBucketSignificantTerm //`json:"buckets"`
	Meta     map[string]interface{}              // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketSignificantTerms structure.
func (a *AggregationBucketSignificantTerms) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	if v, ok := aggs["buckets"]; ok && v != nil {
		json.Unmarshal(*v, &a.Buckets)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// AggregationBucketSignificantTerm is a single bucket of an AggregationBucketSignificantTerms structure.
type AggregationBucketSignificantTerm struct {
	Aggregations

	Key      string  //`json:"key"`
	DocCount int64   //`json:"doc_count"`
	BgCount  int64   //`json:"bg_count"`
	Score    float64 //`json:"score"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketSignificantTerm structure.
func (a *AggregationBucketSignificantTerm) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["key"]; ok && v != nil {
		json.Unmarshal(*v, &a.Key)
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	if v, ok := aggs["bg_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.BgCount)
	}
	if v, ok := aggs["score"]; ok && v != nil {
		json.Unmarshal(*v, &a.Score)
	}
	a.Aggregations = aggs
	return nil
}

// -- Bucket filters --

// AggregationBucketFilters is a multi-bucket aggregation that is returned
// with a filters aggregation.
type AggregationBucketFilters struct {
	Aggregations

	Buckets      []*AggregationBucketKeyItem          //`json:"buckets"`
	NamedBuckets map[string]*AggregationBucketKeyItem //`json:"buckets"`
	Meta         map[string]interface{}               // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketFilters structure.
func (a *AggregationBucketFilters) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["buckets"]; ok && v != nil {
		json.Unmarshal(*v, &a.Buckets)
		json.Unmarshal(*v, &a.NamedBuckets)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Bucket histogram items --

// AggregationBucketHistogramItems is a bucket aggregation that is returned
// with a date histogram aggregation.
type AggregationBucketHistogramItems struct {
	Aggregations

	Buckets []*AggregationBucketHistogramItem //`json:"buckets"`
	Meta    map[string]interface{}            // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketHistogramItems structure.
func (a *AggregationBucketHistogramItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["buckets"]; ok && v != nil {
		json.Unmarshal(*v, &a.Buckets)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// AggregationBucketHistogramItem is a single bucket of an AggregationBucketHistogramItems structure.
type AggregationBucketHistogramItem struct {
	Aggregations

	Key         float64 //`json:"key"`
	KeyAsString *string //`json:"key_as_string"`
	DocCount    int64   //`json:"doc_count"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketHistogramItem structure.
func (a *AggregationBucketHistogramItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["key"]; ok && v != nil {
		json.Unmarshal(*v, &a.Key)
	}
	if v, ok := aggs["key_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.KeyAsString)
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	a.Aggregations = aggs
	return nil
}

// -- Pipeline simple value --

// AggregationPipelineSimpleValue is a simple value, returned e.g. by a
// MovAvg aggregation.
type AggregationPipelineSimpleValue struct {
	Aggregations

	Value         *float64               // `json:"value"`
	ValueAsString string                 // `json:"value_as_string"`
	Meta          map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPipelineSimpleValue structure.
func (a *AggregationPipelineSimpleValue) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["value"]; ok && v != nil {
		json.Unmarshal(*v, &a.Value)
	}
	if v, ok := aggs["value_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.ValueAsString)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Pipeline simple value --

// AggregationPipelineBucketMetricValue is a value returned e.g. by a
// MaxBucket aggregation.
type AggregationPipelineBucketMetricValue struct {
	Aggregations

	Keys          []interface{}          // `json:"keys"`
	Value         *float64               // `json:"value"`
	ValueAsString string                 // `json:"value_as_string"`
	Meta          map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPipelineBucketMetricValue structure.
func (a *AggregationPipelineBucketMetricValue) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["keys"]; ok && v != nil {
		json.Unmarshal(*v, &a.Keys)
	}
	if v, ok := aggs["value"]; ok && v != nil {
		json.Unmarshal(*v, &a.Value)
	}
	if v, ok := aggs["value_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.ValueAsString)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Pipeline derivative --

// AggregationPipelineDerivative is the value returned by a
// Derivative aggregation.
type AggregationPipelineDerivative struct {
	Aggregations

	Value                   *float64               // `json:"value"`
	ValueAsString           string                 // `json:"value_as_string"`
	NormalizedValue         *float64               // `json:"normalized_value"`
	NormalizedValueAsString string                 // `json:"normalized_value_as_string"`
	Meta                    map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPipelineDerivative structure.
func (a *AggregationPipelineDerivative) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["value"]; ok && v != nil {
		json.Unmarshal(*v, &a.Value)
	}
	if v, ok := aggs["value_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.ValueAsString)
	}
	if v, ok := aggs["normalized_value"]; ok && v != nil {
		json.Unmarshal(*v, &a.NormalizedValue)
	}
	if v, ok := aggs["normalized_value_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.NormalizedValueAsString)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Pipeline stats metric --

// AggregationPipelineStatsMetric is a simple value, returned e.g. by a
// MovAvg aggregation.
type AggregationPipelineStatsMetric struct {
	Aggregations

	Count         int64    // `json:"count"`
	CountAsString string   // `json:"count_as_string"`
	Min           *float64 // `json:"min"`
	MinAsString   string   // `json:"min_as_string"`
	Max           *float64 // `json:"max"`
	MaxAsString   string   // `json:"max_as_string"`
	Avg           *float64 // `json:"avg"`
	AvgAsString   string   // `json:"avg_as_string"`
	Sum           *float64 // `json:"sum"`
	SumAsString   string   // `json:"sum_as_string"`

	Meta map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPipelineStatsMetric structure.
func (a *AggregationPipelineStatsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["count"]; ok && v != nil {
		json.Unmarshal(*v, &a.Count)
	}
	if v, ok := aggs["count_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.CountAsString)
	}
	if v, ok := aggs["min"]; ok && v != nil {
		json.Unmarshal(*v, &a.Min)
	}
	if v, ok := aggs["min_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.MinAsString)
	}
	if v, ok := aggs["max"]; ok && v != nil {
		json.Unmarshal(*v, &a.Max)
	}
	if v, ok := aggs["max_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.MaxAsString)
	}
	if v, ok := aggs["avg"]; ok && v != nil {
		json.Unmarshal(*v, &a.Avg)
	}
	if v, ok := aggs["avg_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.AvgAsString)
	}
	if v, ok := aggs["sum"]; ok && v != nil {
		json.Unmarshal(*v, &a.Sum)
	}
	if v, ok := aggs["sum_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.SumAsString)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}

// -- Pipeline percentiles

// AggregationPipelinePercentilesMetric is the value returned by a pipeline
// percentiles Metric aggregation
type AggregationPipelinePercentilesMetric struct {
	Aggregations

	Values map[string]float64     // `json:"values"`
	Meta   map[string]interface{} // `json:"meta,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPipelinePercentilesMetric structure.
func (a *AggregationPipelinePercentilesMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["values"]; ok && v != nil {
		json.Unmarshal(*v, &a.Values)
	}
	if v, ok := aggs["meta"]; ok && v != nil {
		json.Unmarshal(*v, &a.Meta)
	}
	a.Aggregations = aggs
	return nil
}
