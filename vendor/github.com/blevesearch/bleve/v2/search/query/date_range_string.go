//  Copyright (c) 2023 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package query

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
)

// DateRangeStringQuery represents a query for a range of date values.
// Start and End are the range endpoints, as strings.
// Start and End are parsed using DateTimeParser, which is a custom date time parser
// defined in the index mapping. If DateTimeParser is not specified, then the
// top-level config.QueryDateTimeParser is used.
type DateRangeStringQuery struct {
	Start          string `json:"start,omitempty"`
	End            string `json:"end,omitempty"`
	InclusiveStart *bool  `json:"inclusive_start,omitempty"`
	InclusiveEnd   *bool  `json:"inclusive_end,omitempty"`
	FieldVal       string `json:"field,omitempty"`
	BoostVal       *Boost `json:"boost,omitempty"`
	DateTimeParser string `json:"datetime_parser,omitempty"`
}

// NewDateRangeStringQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser field of the query struct,
// which is a custom date time parser defined in the index mapping.
// if DateTimeParser is not specified, then the
// top-level config.QueryDateTimeParser is used.
// Either, but not both endpoints can be nil.
func NewDateRangeStringQuery(start, end string) *DateRangeStringQuery {
	return NewDateRangeStringInclusiveQuery(start, end, nil, nil)
}

// NewDateRangeStringInclusiveQuery creates a new Query for ranges
// of date values.
// Date strings are parsed using the DateTimeParser field of the query struct,
// which is a custom date time parser defined in the index mapping.
// if DateTimeParser is not specified, then the
// top-level config.QueryDateTimeParser is used.
// Either, but not both endpoints can be nil.
// startInclusive and endInclusive control inclusion of the endpoints.
func NewDateRangeStringInclusiveQuery(start, end string, startInclusive, endInclusive *bool) *DateRangeStringQuery {
	return &DateRangeStringQuery{
		Start:          start,
		End:            end,
		InclusiveStart: startInclusive,
		InclusiveEnd:   endInclusive,
	}
}

func (q *DateRangeStringQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *DateRangeStringQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *DateRangeStringQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *DateRangeStringQuery) Field() string {
	return q.FieldVal
}

func (q *DateRangeStringQuery) SetDateTimeParser(d string) {
	q.DateTimeParser = d
}

func (q *DateRangeStringQuery) DateTimeParserName() string {
	return q.DateTimeParser
}

func (q *DateRangeStringQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	dateTimeParserName := QueryDateTimeParser
	if q.DateTimeParser != "" {
		dateTimeParserName = q.DateTimeParser
	}
	dateTimeParser := m.DateTimeParserNamed(dateTimeParserName)
	if dateTimeParser == nil {
		return nil, fmt.Errorf("no dateTimeParser named '%s' registered", dateTimeParserName)
	}

	var startTime, endTime time.Time
	var err error
	if q.Start != "" {
		startTime, _, err = dateTimeParser.ParseDateTime(q.Start)
		if err != nil {
			return nil, fmt.Errorf("%v, date time parser name: %s", err, dateTimeParserName)
		}
	}
	if q.End != "" {
		endTime, _, err = dateTimeParser.ParseDateTime(q.End)
		if err != nil {
			return nil, fmt.Errorf("%v, date time parser name: %s", err, dateTimeParserName)
		}
	}

	min, max, err := q.parseEndpoints(startTime, endTime)
	if err != nil {
		return nil, err
	}
	return searcher.NewNumericRangeSearcher(ctx, i, min, max, q.InclusiveStart, q.InclusiveEnd, field, q.BoostVal.Value(), options)
}

func (q *DateRangeStringQuery) parseEndpoints(startTime, endTime time.Time) (*float64, *float64, error) {
	min := math.Inf(-1)
	max := math.Inf(1)

	if startTime.IsZero() && endTime.IsZero() {
		return nil, nil, fmt.Errorf("date range query must specify at least one of start/end")
	}

	if !startTime.IsZero() {
		if !isDateTimeWithinRange(startTime) {
			// overflow
			return nil, nil, fmt.Errorf("invalid/unsupported date range, start: %v", q.Start)
		}
		startInt64 := startTime.UnixNano()
		min = numeric.Int64ToFloat64(startInt64)
	}
	if !endTime.IsZero() {
		if !isDateTimeWithinRange(endTime) {
			// overflow
			return nil, nil, fmt.Errorf("invalid/unsupported date range, end: %v", q.End)
		}
		endInt64 := endTime.UnixNano()
		max = numeric.Int64ToFloat64(endInt64)
	}

	return &min, &max, nil
}

func (q *DateRangeStringQuery) Validate() error {
	// either start or end must be specified
	if q.Start == "" && q.End == "" {
		return fmt.Errorf("date range query must specify at least one of start/end")
	}
	return nil
}

func isDateTimeWithinRange(t time.Time) bool {
	if t.Before(MinRFC3339CompatibleTime) || t.After(MaxRFC3339CompatibleTime) {
		return false
	}
	return true
}
