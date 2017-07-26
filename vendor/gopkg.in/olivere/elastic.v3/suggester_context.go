// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// SuggesterContextQuery is used to define context information within
// a suggestion request.
type SuggesterContextQuery interface {
	Source() (interface{}, error)
}
