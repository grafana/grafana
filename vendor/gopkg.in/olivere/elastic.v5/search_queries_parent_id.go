// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// ParentIdQuery can be used to find child documents which belong to a
// particular parent. Given the following mapping definition.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-parent-id-query.html
type ParentIdQuery struct {
	typ            string
	id             string
	ignoreUnmapped *bool
	boost          *float64
	queryName      string
	innerHit       *InnerHit
}

// NewParentIdQuery creates and initializes a new parent_id query.
func NewParentIdQuery(typ, id string) *ParentIdQuery {
	return &ParentIdQuery{
		typ: typ,
		id:  id,
	}
}

// Type sets the parent type.
func (q *ParentIdQuery) Type(typ string) *ParentIdQuery {
	q.typ = typ
	return q
}

// Id sets the id.
func (q *ParentIdQuery) Id(id string) *ParentIdQuery {
	q.id = id
	return q
}

// IgnoreUnmapped specifies whether unmapped types should be ignored.
// If set to false, the query failes when an unmapped type is found.
func (q *ParentIdQuery) IgnoreUnmapped(ignore bool) *ParentIdQuery {
	q.ignoreUnmapped = &ignore
	return q
}

// Boost sets the boost for this query.
func (q *ParentIdQuery) Boost(boost float64) *ParentIdQuery {
	q.boost = &boost
	return q
}

// QueryName specifies the query name for the filter that can be used when
// searching for matched filters per hit.
func (q *ParentIdQuery) QueryName(queryName string) *ParentIdQuery {
	q.queryName = queryName
	return q
}

// InnerHit sets the inner hit definition in the scope of this query and
// reusing the defined type and query.
func (q *ParentIdQuery) InnerHit(innerHit *InnerHit) *ParentIdQuery {
	q.innerHit = innerHit
	return q
}

// Source returns JSON for the parent_id query.
func (q *ParentIdQuery) Source() (interface{}, error) {
	// {
	//   "parent_id" : {
	//       "type" : "blog",
	//       "id" : "1"
	//   }
	// }
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["parent_id"] = query

	query["type"] = q.typ
	query["id"] = q.id
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.ignoreUnmapped != nil {
		query["ignore_unmapped"] = *q.ignoreUnmapped
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}
	if q.innerHit != nil {
		src, err := q.innerHit.Source()
		if err != nil {
			return nil, err
		}
		query["inner_hits"] = src
	}
	return source, nil
}
