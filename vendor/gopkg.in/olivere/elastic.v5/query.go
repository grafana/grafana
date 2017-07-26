// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Query represents the generic query interface. A query's sole purpose
// is to return the source of the query as a JSON-serializable object.
// Returning map[string]interface{} is the norm for queries.
type Query interface {
	// Source returns the JSON-serializable query request.
	Source() (interface{}, error)
}
