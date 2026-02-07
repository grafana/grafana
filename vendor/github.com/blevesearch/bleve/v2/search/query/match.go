//  Copyright (c) 2014 Couchbase, Inc.
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

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

type MatchQuery struct {
	Match     string             `json:"match"`
	FieldVal  string             `json:"field,omitempty"`
	Analyzer  string             `json:"analyzer,omitempty"`
	BoostVal  *Boost             `json:"boost,omitempty"`
	Prefix    int                `json:"prefix_length"`
	Fuzziness int                `json:"fuzziness"`
	Operator  MatchQueryOperator `json:"operator,omitempty"`
	autoFuzzy bool
}

type MatchQueryOperator int

const (
	// Document must satisfy AT LEAST ONE of term searches.
	MatchQueryOperatorOr = MatchQueryOperator(0)
	// Document must satisfy ALL of term searches.
	MatchQueryOperatorAnd = MatchQueryOperator(1)
)

func (o MatchQueryOperator) MarshalJSON() ([]byte, error) {
	switch o {
	case MatchQueryOperatorOr:
		return util.MarshalJSON("or")
	case MatchQueryOperatorAnd:
		return util.MarshalJSON("and")
	default:
		return nil, fmt.Errorf("cannot marshal match operator %d to JSON", o)
	}
}

func (o *MatchQueryOperator) UnmarshalJSON(data []byte) error {
	var operatorString string
	err := util.UnmarshalJSON(data, &operatorString)
	if err != nil {
		return err
	}

	switch operatorString {
	case "or":
		*o = MatchQueryOperatorOr
		return nil
	case "and":
		*o = MatchQueryOperatorAnd
		return nil
	default:
		return fmt.Errorf("cannot unmarshal match operator '%v' from JSON", o)
	}
}

// NewMatchQuery creates a Query for matching text.
// An Analyzer is chosen based on the field.
// Input text is analyzed using this analyzer.
// Token terms resulting from this analysis are
// used to perform term searches.  Result documents
// must satisfy at least one of these term searches.
func NewMatchQuery(match string) *MatchQuery {
	return &MatchQuery{
		Match:    match,
		Operator: MatchQueryOperatorOr,
	}
}

func (q *MatchQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *MatchQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *MatchQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *MatchQuery) Field() string {
	return q.FieldVal
}

func (q *MatchQuery) SetFuzziness(f int) {
	q.Fuzziness = f
}

func (q *MatchQuery) SetAutoFuzziness(auto bool) {
	q.autoFuzzy = auto
}

func (q *MatchQuery) SetPrefix(p int) {
	q.Prefix = p
}

func (q *MatchQuery) SetOperator(operator MatchQueryOperator) {
	q.Operator = operator
}

func (q *MatchQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {

	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	analyzerName := ""
	if q.Analyzer != "" {
		analyzerName = q.Analyzer
	} else {
		analyzerName = m.AnalyzerNameForPath(field)
	}
	analyzer := m.AnalyzerNamed(analyzerName)

	if analyzer == nil {
		return nil, fmt.Errorf("no analyzer named '%s' registered", q.Analyzer)
	}

	tokens := analyzer.Analyze([]byte(q.Match))
	if len(tokens) > 0 {

		tqs := make([]Query, len(tokens))
		if q.Fuzziness != 0 || q.autoFuzzy {
			for i, token := range tokens {
				query := NewFuzzyQuery(string(token.Term))
				if q.autoFuzzy {
					query.SetAutoFuzziness(true)
				} else {
					query.SetFuzziness(q.Fuzziness)
				}
				query.SetPrefix(q.Prefix)
				query.SetField(field)
				query.SetBoost(q.BoostVal.Value())
				tqs[i] = query
			}
		} else {
			for i, token := range tokens {
				tq := NewTermQuery(string(token.Term))
				tq.SetField(field)
				tq.SetBoost(q.BoostVal.Value())
				tqs[i] = tq
			}
		}

		switch q.Operator {
		case MatchQueryOperatorOr:
			shouldQuery := NewDisjunctionQuery(tqs)
			shouldQuery.SetMin(1)
			shouldQuery.SetBoost(q.BoostVal.Value())
			return shouldQuery.Searcher(ctx, i, m, options)

		case MatchQueryOperatorAnd:
			mustQuery := NewConjunctionQuery(tqs)
			mustQuery.SetBoost(q.BoostVal.Value())
			return mustQuery.Searcher(ctx, i, m, options)

		default:
			return nil, fmt.Errorf("unhandled operator %d", q.Operator)
		}
	}
	noneQuery := NewMatchNoneQuery()
	return noneQuery.Searcher(ctx, i, m, options)
}

func (q *MatchQuery) UnmarshalJSON(data []byte) error {
	type Alias MatchQuery
	aux := &struct {
		Fuzziness interface{} `json:"fuzziness"`
		*Alias
	}{
		Alias: (*Alias)(q),
	}
	if err := util.UnmarshalJSON(data, &aux); err != nil {
		return err
	}
	switch v := aux.Fuzziness.(type) {
	case float64:
		q.Fuzziness = int(v)
	case string:
		if v == "auto" {
			q.autoFuzzy = true
		}
	}
	return nil
}

func (f *MatchQuery) MarshalJSON() ([]byte, error) {
	var fuzzyValue interface{}
	if f.autoFuzzy {
		fuzzyValue = "auto"
	} else {
		fuzzyValue = f.Fuzziness
	}
	type match struct {
		Match     string             `json:"match"`
		FieldVal  string             `json:"field,omitempty"`
		Analyzer  string             `json:"analyzer,omitempty"`
		BoostVal  *Boost             `json:"boost,omitempty"`
		Prefix    int                `json:"prefix_length"`
		Fuzziness interface{}        `json:"fuzziness"`
		Operator  MatchQueryOperator `json:"operator,omitempty"`
	}
	aux := match{
		Match:     f.Match,
		FieldVal:  f.FieldVal,
		Analyzer:  f.Analyzer,
		BoostVal:  f.BoostVal,
		Prefix:    f.Prefix,
		Fuzziness: fuzzyValue,
		Operator:  f.Operator,
	}
	return util.MarshalJSON(aux)
}
