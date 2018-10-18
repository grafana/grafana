package level

import "github.com/go-kit/kit/log"

// Error returns a logger that includes a Key/ErrorValue pair.
func Error(logger log.Logger) log.Logger {
	return log.WithPrefix(logger, Key(), ErrorValue())
}

// Warn returns a logger that includes a Key/WarnValue pair.
func Warn(logger log.Logger) log.Logger {
	return log.WithPrefix(logger, Key(), WarnValue())
}

// Info returns a logger that includes a Key/InfoValue pair.
func Info(logger log.Logger) log.Logger {
	return log.WithPrefix(logger, Key(), InfoValue())
}

// Debug returns a logger that includes a Key/DebugValue pair.
func Debug(logger log.Logger) log.Logger {
	return log.WithPrefix(logger, Key(), DebugValue())
}

// NewFilter wraps next and implements level filtering. See the commentary on
// the Option functions for a detailed description of how to configure levels.
// If no options are provided, all leveled log events created with Debug,
// Info, Warn or Error helper methods are squelched and non-leveled log
// events are passed to next unmodified.
func NewFilter(next log.Logger, options ...Option) log.Logger {
	l := &logger{
		next: next,
	}
	for _, option := range options {
		option(l)
	}
	return l
}

type logger struct {
	next           log.Logger
	allowed        level
	squelchNoLevel bool
	errNotAllowed  error
	errNoLevel     error
}

func (l *logger) Log(keyvals ...interface{}) error {
	var hasLevel, levelAllowed bool
	for i := 1; i < len(keyvals); i += 2 {
		if v, ok := keyvals[i].(*levelValue); ok {
			hasLevel = true
			levelAllowed = l.allowed&v.level != 0
			break
		}
	}
	if !hasLevel && l.squelchNoLevel {
		return l.errNoLevel
	}
	if hasLevel && !levelAllowed {
		return l.errNotAllowed
	}
	return l.next.Log(keyvals...)
}

// Option sets a parameter for the leveled logger.
type Option func(*logger)

// AllowAll is an alias for AllowDebug.
func AllowAll() Option {
	return AllowDebug()
}

// AllowDebug allows error, warn, info and debug level log events to pass.
func AllowDebug() Option {
	return allowed(levelError | levelWarn | levelInfo | levelDebug)
}

// AllowInfo allows error, warn and info level log events to pass.
func AllowInfo() Option {
	return allowed(levelError | levelWarn | levelInfo)
}

// AllowWarn allows error and warn level log events to pass.
func AllowWarn() Option {
	return allowed(levelError | levelWarn)
}

// AllowError allows only error level log events to pass.
func AllowError() Option {
	return allowed(levelError)
}

// AllowNone allows no leveled log events to pass.
func AllowNone() Option {
	return allowed(0)
}

func allowed(allowed level) Option {
	return func(l *logger) { l.allowed = allowed }
}

// ErrNotAllowed sets the error to return from Log when it squelches a log
// event disallowed by the configured Allow[Level] option. By default,
// ErrNotAllowed is nil; in this case the log event is squelched with no
// error.
func ErrNotAllowed(err error) Option {
	return func(l *logger) { l.errNotAllowed = err }
}

// SquelchNoLevel instructs Log to squelch log events with no level, so that
// they don't proceed through to the wrapped logger. If SquelchNoLevel is set
// to true and a log event is squelched in this way, the error value
// configured with ErrNoLevel is returned to the caller.
func SquelchNoLevel(squelch bool) Option {
	return func(l *logger) { l.squelchNoLevel = squelch }
}

// ErrNoLevel sets the error to return from Log when it squelches a log event
// with no level. By default, ErrNoLevel is nil; in this case the log event is
// squelched with no error.
func ErrNoLevel(err error) Option {
	return func(l *logger) { l.errNoLevel = err }
}

// NewInjector wraps next and returns a logger that adds a Key/level pair to
// the beginning of log events that don't already contain a level. In effect,
// this gives a default level to logs without a level.
func NewInjector(next log.Logger, level Value) log.Logger {
	return &injector{
		next:  next,
		level: level,
	}
}

type injector struct {
	next  log.Logger
	level interface{}
}

func (l *injector) Log(keyvals ...interface{}) error {
	for i := 1; i < len(keyvals); i += 2 {
		if _, ok := keyvals[i].(*levelValue); ok {
			return l.next.Log(keyvals...)
		}
	}
	kvs := make([]interface{}, len(keyvals)+2)
	kvs[0], kvs[1] = key, l.level
	copy(kvs[2:], keyvals)
	return l.next.Log(kvs...)
}

// Value is the interface that each of the canonical level values implement.
// It contains unexported methods that prevent types from other packages from
// implementing it and guaranteeing that NewFilter can distinguish the levels
// defined in this package from all other values.
type Value interface {
	String() string
	levelVal()
}

// Key returns the unique key added to log events by the loggers in this
// package.
func Key() interface{} { return key }

// ErrorValue returns the unique value added to log events by Error.
func ErrorValue() Value { return errorValue }

// WarnValue returns the unique value added to log events by Warn.
func WarnValue() Value { return warnValue }

// InfoValue returns the unique value added to log events by Info.
func InfoValue() Value { return infoValue }

// DebugValue returns the unique value added to log events by Warn.
func DebugValue() Value { return debugValue }

var (
	// key is of type interfae{} so that it allocates once during package
	// initialization and avoids allocating every time the value is added to a
	// []interface{} later.
	key interface{} = "level"

	errorValue = &levelValue{level: levelError, name: "error"}
	warnValue  = &levelValue{level: levelWarn, name: "warn"}
	infoValue  = &levelValue{level: levelInfo, name: "info"}
	debugValue = &levelValue{level: levelDebug, name: "debug"}
)

type level byte

const (
	levelDebug level = 1 << iota
	levelInfo
	levelWarn
	levelError
)

type levelValue struct {
	name string
	level
}

func (v *levelValue) String() string { return v.name }
func (v *levelValue) levelVal()      {}
