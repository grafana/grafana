// Copyright 2019 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package exemplar

import "github.com/prometheus/prometheus/model/labels"

// ExemplarMaxLabelSetLength is defined by OpenMetrics: "The combined length of
// the label names and values of an Exemplar's LabelSet MUST NOT exceed 128
// UTF-8 characters."
// https://github.com/prometheus/OpenMetrics/blob/v1.0.0/specification/OpenMetrics.md#exemplars
const ExemplarMaxLabelSetLength = 128

// Exemplar is additional information associated with a time series.
type Exemplar struct {
	Labels labels.Labels `json:"labels"`
	Value  float64       `json:"value"`
	Ts     int64         `json:"timestamp"`
	HasTs  bool
}

type QueryResult struct {
	SeriesLabels labels.Labels `json:"seriesLabels"`
	Exemplars    []Exemplar    `json:"exemplars"`
}

// Equals compares if the exemplar e is the same as e2. Note that if HasTs is false for
// both exemplars then the timestamps will be ignored for the comparison. This can come up
// when an exemplar is exported without it's own timestamp, in which case the scrape timestamp
// is assigned to the Ts field. However we still want to treat the same exemplar, scraped without
// an exported timestamp, as a duplicate of itself for each subsequent scrape.
func (e Exemplar) Equals(e2 Exemplar) bool {
	if !labels.Equal(e.Labels, e2.Labels) {
		return false
	}

	if (e.HasTs || e2.HasTs) && e.Ts != e2.Ts {
		return false
	}

	return e.Value == e2.Value
}

// Compare first timestamps, then values, then labels.
func Compare(a, b Exemplar) int {
	if a.Ts < b.Ts {
		return -1
	} else if a.Ts > b.Ts {
		return 1
	}
	if a.Value < b.Value {
		return -1
	} else if a.Value > b.Value {
		return 1
	}
	return labels.Compare(a.Labels, b.Labels)
}
