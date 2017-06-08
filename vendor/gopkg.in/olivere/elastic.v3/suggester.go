// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Represents the generic suggester interface.
// A suggester's only purpose is to return the
// source of the query as a JSON-serializable
// object. Returning a map[string]interface{}
// will do.
type Suggester interface {
	Name() string
	Source(includeName bool) (interface{}, error)
}
