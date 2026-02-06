// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/logging/global.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package log

import (
	"github.com/go-kit/log"
)

var global = log.NewNopLogger()

// Global returns the global logger.
func Global() log.Logger {
	return global
}

// SetGlobal sets the global logger.
func SetGlobal(logger log.Logger) {
	global = logger
}
