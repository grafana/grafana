// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A boosting query can be used to effectively
// demote results that match a given query.
// For more details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-boosting-query.html
type BoostingQuery struct {
	Query
	positiveClause Query
	negativeClause Query
	negativeBoost  *float64
	boost          *float64
}

// Creates a new boosting query.
func NewBoostingQuery() *BoostingQuery {
	return &BoostingQuery{}
}

func (q *BoostingQuery) Positive(positive Query) *BoostingQuery {
	q.positiveClause = positive
	return q
}

func (q *BoostingQuery) Negative(negative Query) *BoostingQuery {
	q.negativeClause = negative
	return q
}

func (q *BoostingQuery) NegativeBoost(negativeBoost float64) *BoostingQuery {
	q.negativeBoost = &negativeBoost
	return q
}

func (q *BoostingQuery) Boost(boost float64) *BoostingQuery {
	q.boost = &boost
	return q
}

// Creates the query source for the boosting query.
func (q *BoostingQuery) Source() (interface{}, error) {
	// {
	//     "boosting" : {
	//         "positive" : {
	//             "term" : {
	//                 "field1" : "value1"
	//             }
	//         },
	//         "negative" : {
	//             "term" : {
	//                 "field2" : "value2"
	//             }
	//         },
	//         "negative_boost" : 0.2
	//     }
	// }

	query := make(map[string]interface{})

	boostingClause := make(map[string]interface{})
	query["boosting"] = boostingClause

	// Negative and positive clause as well as negative boost
	// are mandatory in the Java client.

	// positive
	if q.positiveClause != nil {
		src, err := q.positiveClause.Source()
		if err != nil {
			return nil, err
		}
		boostingClause["positive"] = src
	}

	// negative
	if q.negativeClause != nil {
		src, err := q.negativeClause.Source()
		if err != nil {
			return nil, err
		}
		boostingClause["negative"] = src
	}

	if q.negativeBoost != nil {
		boostingClause["negative_boost"] = *q.negativeBoost
	}

	if q.boost != nil {
		boostingClause["boost"] = *q.boost
	}

	return query, nil
}
