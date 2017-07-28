// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Logger specifies the interface for all log operations.
type Logger interface {
	Printf(format string, v ...interface{})
}
