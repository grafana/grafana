// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package stats

import (
	"math"

	"github.com/dolthub/go-mysql-server/sql"
)

func Empty(s sql.Statistic) bool {
	return s == nil || len(s.Histogram()) == 0
}

func InterpolateNewCounts(from, to sql.Statistic) sql.Statistic {
	if Empty(from) {
		return to
	} else if Empty(from) {
		return to
	}
	if from.Qualifier().String() == to.Qualifier().String() {
		return to
	}

	if to.DistinctCount() < from.DistinctCount() {
		// invalid use of interpolate
		return to
	}

	filterSelectivity := float64(to.DistinctCount()) / float64(from.DistinctCount())

	newHist := make([]sql.HistogramBucket, len(from.Histogram()))
	for i, h := range from.Histogram() {
		newMcvs := make([]uint64, len(h.McvCounts()))
		for i, cnt := range h.McvCounts() {
			newMcvs[i] = uint64(math.Max(1, float64(cnt)*filterSelectivity))
		}
		newHist[i] = NewHistogramBucket(
			uint64(math.Max(1, float64(h.RowCount())*filterSelectivity)),
			uint64(math.Max(1, float64(h.DistinctCount())*filterSelectivity)),
			uint64(math.Max(1, float64(h.NullCount())*filterSelectivity)),
			uint64(math.Max(1, float64(h.BoundCount())*filterSelectivity)),
			h.UpperBound(),
			h.McvCounts(),
			h.Mcvs())
	}
	return UpdateCounts(NewStatistic(0, 0, 0, from.AvgSize(), from.CreatedAt(), from.Qualifier(), from.Columns(), from.Types(), newHist, from.IndexClass(), from.LowerBound()))
}
