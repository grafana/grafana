// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

type Rescorer interface {
	Name() string
	Source() (interface{}, error)
}

// -- Query Rescorer --

type QueryRescorer struct {
	query              Query
	rescoreQueryWeight *float64
	queryWeight        *float64
	scoreMode          string
}

func NewQueryRescorer(query Query) *QueryRescorer {
	return &QueryRescorer{
		query: query,
	}
}

func (r *QueryRescorer) Name() string {
	return "query"
}

func (r *QueryRescorer) RescoreQueryWeight(rescoreQueryWeight float64) *QueryRescorer {
	r.rescoreQueryWeight = &rescoreQueryWeight
	return r
}

func (r *QueryRescorer) QueryWeight(queryWeight float64) *QueryRescorer {
	r.queryWeight = &queryWeight
	return r
}

func (r *QueryRescorer) ScoreMode(scoreMode string) *QueryRescorer {
	r.scoreMode = scoreMode
	return r
}

func (r *QueryRescorer) Source() (interface{}, error) {
	rescoreQuery, err := r.query.Source()
	if err != nil {
		return nil, err
	}

	source := make(map[string]interface{})
	source["rescore_query"] = rescoreQuery
	if r.queryWeight != nil {
		source["query_weight"] = *r.queryWeight
	}
	if r.rescoreQueryWeight != nil {
		source["rescore_query_weight"] = *r.rescoreQueryWeight
	}
	if r.scoreMode != "" {
		source["score_mode"] = r.scoreMode
	}
	return source, nil
}
