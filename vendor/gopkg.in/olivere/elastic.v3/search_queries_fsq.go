// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FunctionScoreQuery allows you to modify the score of documents that
// are retrieved by a query. This can be useful if, for example,
// a score function is computationally expensive and it is sufficient
// to compute the score on a filtered set of documents.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-function-score-query.html
type FunctionScoreQuery struct {
	query      Query
	filter     Query
	boost      *float64
	maxBoost   *float64
	scoreMode  string
	boostMode  string
	filters    []Query
	scoreFuncs []ScoreFunction
	minScore   *float64
	weight     *float64
}

// NewFunctionScoreQuery creates and initializes a new function score query.
func NewFunctionScoreQuery() *FunctionScoreQuery {
	return &FunctionScoreQuery{
		filters:    make([]Query, 0),
		scoreFuncs: make([]ScoreFunction, 0),
	}
}

// Query sets the query for the function score query.
func (q *FunctionScoreQuery) Query(query Query) *FunctionScoreQuery {
	q.query = query
	q.filter = nil
	return q
}

// Filter sets the filter for the function score query.
func (q *FunctionScoreQuery) Filter(filter Query) *FunctionScoreQuery {
	q.query = nil
	q.filter = filter
	return q
}

// Add adds a score function that will execute on all the documents
// matching the filter.
func (q *FunctionScoreQuery) Add(filter Query, scoreFunc ScoreFunction) *FunctionScoreQuery {
	q.filters = append(q.filters, filter)
	q.scoreFuncs = append(q.scoreFuncs, scoreFunc)
	return q
}

// AddScoreFunc adds a score function that will execute the function on all documents.
func (q *FunctionScoreQuery) AddScoreFunc(scoreFunc ScoreFunction) *FunctionScoreQuery {
	q.filters = append(q.filters, nil)
	q.scoreFuncs = append(q.scoreFuncs, scoreFunc)
	return q
}

// ScoreMode defines how results of individual score functions will be aggregated.
// Can be first, avg, max, sum, min, or multiply.
func (q *FunctionScoreQuery) ScoreMode(scoreMode string) *FunctionScoreQuery {
	q.scoreMode = scoreMode
	return q
}

// BoostMode defines how the combined result of score functions will
// influence the final score together with the sub query score.
func (q *FunctionScoreQuery) BoostMode(boostMode string) *FunctionScoreQuery {
	q.boostMode = boostMode
	return q
}

// MaxBoost is the maximum boost that will be applied by function score.
func (q *FunctionScoreQuery) MaxBoost(maxBoost float64) *FunctionScoreQuery {
	q.maxBoost = &maxBoost
	return q
}

// Boost sets the boost for this query. Documents matching this query will
// (in addition to the normal weightings) have their score multiplied by the
// boost provided.
func (q *FunctionScoreQuery) Boost(boost float64) *FunctionScoreQuery {
	q.boost = &boost
	return q
}

// MinScore sets the minimum score.
func (q *FunctionScoreQuery) MinScore(minScore float64) *FunctionScoreQuery {
	q.minScore = &minScore
	return q
}

// Source returns JSON for the function score query.
func (q *FunctionScoreQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["function_score"] = query

	if q.query != nil {
		src, err := q.query.Source()
		if err != nil {
			return nil, err
		}
		query["query"] = src
	} else if q.filter != nil {
		src, err := q.filter.Source()
		if err != nil {
			return nil, err
		}
		query["filter"] = src
	}

	if len(q.filters) == 1 && q.filters[0] == nil {
		// Weight needs to be serialized on this level.
		if weight := q.scoreFuncs[0].GetWeight(); weight != nil {
			query["weight"] = weight
		}
		// Serialize the score function
		src, err := q.scoreFuncs[0].Source()
		if err != nil {
			return nil, err
		}
		query[q.scoreFuncs[0].Name()] = src
	} else {
		funcs := make([]interface{}, len(q.filters))
		for i, filter := range q.filters {
			hsh := make(map[string]interface{})
			if filter != nil {
				src, err := filter.Source()
				if err != nil {
					return nil, err
				}
				hsh["filter"] = src
			}
			// Weight needs to be serialized on this level.
			if weight := q.scoreFuncs[i].GetWeight(); weight != nil {
				hsh["weight"] = weight
			}
			// Serialize the score function
			src, err := q.scoreFuncs[i].Source()
			if err != nil {
				return nil, err
			}
			hsh[q.scoreFuncs[i].Name()] = src
			funcs[i] = hsh
		}
		query["functions"] = funcs
	}

	if q.scoreMode != "" {
		query["score_mode"] = q.scoreMode
	}
	if q.boostMode != "" {
		query["boost_mode"] = q.boostMode
	}
	if q.maxBoost != nil {
		query["max_boost"] = *q.maxBoost
	}
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.minScore != nil {
		query["min_score"] = *q.minScore
	}

	return source, nil
}
