package hclog

import (
	"io"
	"log"
	"os"
	"strings"
	"sync"
)

var (
	DefaultOutput = os.Stderr
	DefaultLevel  = Info
)

type Level int

const (
	// This is a special level used to indicate that no level has been
	// set and allow for a default to be used.
	NoLevel Level = 0

	// The most verbose level. Intended to be used for the tracing of actions
	// in code, such as function enters/exits, etc.
	Trace Level = 1

	// For programmer lowlevel analysis.
	Debug Level = 2

	// For information about steady state operations.
	Info Level = 3

	// For information about rare but handled events.
	Warn Level = 4

	// For information about unrecoverable events.
	Error Level = 5
)

// LevelFromString returns a Level type for the named log level, or "NoLevel" if
// the level string is invalid. This facilitates setting the log level via
// config or environment variable by name in a predictable way.
func LevelFromString(levelStr string) Level {
	// We don't care about case. Accept "INFO" or "info"
	levelStr = strings.ToLower(strings.TrimSpace(levelStr))
	switch levelStr {
	case "trace":
		return Trace
	case "debug":
		return Debug
	case "info":
		return Info
	case "warn":
		return Warn
	case "error":
		return Error
	default:
		return NoLevel
	}
}

// The main Logger interface. All code should code against this interface only.
type Logger interface {
	// Args are alternating key, val pairs
	// keys must be strings
	// vals can be any type, but display is implementation specific
	// Emit a message and key/value pairs at the TRACE level
	Trace(msg string, args ...interface{})

	// Emit a message and key/value pairs at the DEBUG level
	Debug(msg string, args ...interface{})

	// Emit a message and key/value pairs at the INFO level
	Info(msg string, args ...interface{})

	// Emit a message and key/value pairs at the WARN level
	Warn(msg string, args ...interface{})

	// Emit a message and key/value pairs at the ERROR level
	Error(msg string, args ...interface{})

	// Indicate if TRACE logs would be emitted. This and the other Is* guards
	// are used to elide expensive logging code based on the current level.
	IsTrace() bool

	// Indicate if DEBUG logs would be emitted. This and the other Is* guards
	IsDebug() bool

	// Indicate if INFO logs would be emitted. This and the other Is* guards
	IsInfo() bool

	// Indicate if WARN logs would be emitted. This and the other Is* guards
	IsWarn() bool

	// Indicate if ERROR logs would be emitted. This and the other Is* guards
	IsError() bool

	// Creates a sublogger that will always have the given key/value pairs
	With(args ...interface{}) Logger

	// Create a logger that will prepend the name string on the front of all messages.
	// If the logger already has a name, the new value will be appended to the current
	// name. That way, a major subsystem can use this to decorate all it's own logs
	// without losing context.
	Named(name string) Logger

	// Create a logger that will prepend the name string on the front of all messages.
	// This sets the name of the logger to the value directly, unlike Named which honor
	// the current name as well.
	ResetNamed(name string) Logger

	// Return a value that conforms to the stdlib log.Logger interface
	StandardLogger(opts *StandardLoggerOptions) *log.Logger
}

type StandardLoggerOptions struct {
	// Indicate that some minimal parsing should be done on strings to try
	// and detect their level and re-emit them.
	// This supports the strings like [ERROR], [ERR] [TRACE], [WARN], [INFO],
	// [DEBUG] and strip it off before reapplying it.
	InferLevels bool
}

type LoggerOptions struct {
	// Name of the subsystem to prefix logs with
	Name string

	// The threshold for the logger. Anything less severe is supressed
	Level Level

	// Where to write the logs to. Defaults to os.Stdout if nil
	Output io.Writer

	// An optional mutex pointer in case Output is shared
	Mutex *sync.Mutex

	// Control if the output should be in JSON.
	JSONFormat bool

	// Include file and line information in each log line
	IncludeLocation bool

	// The time format to use instead of the default
	TimeFormat string
}
