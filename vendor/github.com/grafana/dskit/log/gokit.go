// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/logging/gokit.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package log

import (
	"fmt"
	"io"
	"os"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

const (
	LogfmtFormat = "logfmt"
	JSONFormat   = "json"
)

// NewGoKit creates a new GoKit logger with the given format.
// If the given format is empty or unknown, logfmt is used.
// No additional fields nor filters are added to the created logger, and
// if they are required, the caller is expected to add them.
func NewGoKit(format string) log.Logger {
	writer := log.NewSyncWriter(os.Stderr)
	return newGoKit(format, writer)
}

// NewGoKitWithLevel creates a new GoKit logger with the given level and format.
// If the given format is empty or unknown, logfmt is used.
func NewGoKitWithLevel(lvl Level, format string) log.Logger {
	logger := NewGoKit(format)
	return level.NewFilter(logger, lvl.Option)
}

// NewGoKitWithWriter creates a new GoKit logger with the given format and writer.
// The input writer must be provided, must be thread-safe, and the caller is
// expected to guarantee these requirements.
// If the given format is empty or unknown, logfmt is used.
// No additional fields nor filters are added to the created logger, and
// if they are required, the caller is expected to add them.
func NewGoKitWithWriter(format string, writer io.Writer) log.Logger {
	return newGoKit(format, writer)
}

func newGoKit(format string, writer io.Writer) log.Logger {
	if format == JSONFormat {
		return log.NewJSONLogger(writer)
	}
	return log.NewLogfmtLogger(writer)
}

// stand-alone for test purposes
func addStandardFields(logger log.Logger) log.Logger {
	return log.With(logger, "ts", log.DefaultTimestampUTC, "caller", log.Caller(5))
}

type Sprintf struct {
	format string
	args   []interface{}
}

func LazySprintf(format string, args ...interface{}) *Sprintf {
	return &Sprintf{
		format: format,
		args:   args,
	}
}

func (s *Sprintf) String() string {
	return fmt.Sprintf(s.format, s.args...)
}
