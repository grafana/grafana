// Copyright 2012-present Oliver Eilhard, John Stanford. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "encoding/json"

// RawStringQuery can be used to treat a string representation of an ES query
// as a Query.  Example usage:
//    q := RawStringQuery("{\"match_all\":{}}")
//    db.Search().Query(q).From(1).Size(100).Do()
type RawStringQuery string

// NewRawStringQuery ininitializes a new RawStringQuery.
// It is the same as RawStringQuery(q).
func NewRawStringQuery(q string) RawStringQuery {
	return RawStringQuery(q)
}

// Source returns the JSON encoded body
func (q RawStringQuery) Source() (interface{}, error) {
	var f interface{}
	err := json.Unmarshal([]byte(q), &f)
	return f, err
}
