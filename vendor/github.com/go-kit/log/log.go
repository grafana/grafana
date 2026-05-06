package log

import "errors"

// Logger is the fundamental interface for all log operations. Log creates a
// log event from keyvals, a variadic sequence of alternating keys and values.
// Implementations must be safe for concurrent use by multiple goroutines. In
// particular, any implementation of Logger that appends to keyvals or
// modifies or retains any of its elements must make a copy first.
type Logger interface {
	Log(keyvals ...interface{}) error
}

// ErrMissingValue is appended to keyvals slices with odd length to substitute
// the missing value.
var ErrMissingValue = errors.New("(MISSING)")

// With returns a new contextual logger with keyvals prepended to those passed
// to calls to Log. If logger is also a contextual logger created by With,
// WithPrefix, or WithSuffix, keyvals is appended to the existing context.
//
// The returned Logger replaces all value elements (odd indexes) containing a
// Valuer with their generated value for each call to its Log method.
func With(logger Logger, keyvals ...interface{}) Logger {
	if len(keyvals) == 0 {
		return logger
	}
	l := newContext(logger)
	kvs := append(l.keyvals, keyvals...)
	if len(kvs)%2 != 0 {
		kvs = append(kvs, ErrMissingValue)
	}
	return &context{
		logger: l.logger,
		// Limiting the capacity of the stored keyvals ensures that a new
		// backing array is created if the slice must grow in Log or With.
		// Using the extra capacity without copying risks a data race that
		// would violate the Logger interface contract.
		keyvals:    kvs[:len(kvs):len(kvs)],
		hasValuer:  l.hasValuer || containsValuer(keyvals),
		sKeyvals:   l.sKeyvals,
		sHasValuer: l.sHasValuer,
	}
}

// WithPrefix returns a new contextual logger with keyvals prepended to those
// passed to calls to Log. If logger is also a contextual logger created by
// With, WithPrefix, or WithSuffix, keyvals is prepended to the existing context.
//
// The returned Logger replaces all value elements (odd indexes) containing a
// Valuer with their generated value for each call to its Log method.
func WithPrefix(logger Logger, keyvals ...interface{}) Logger {
	if len(keyvals) == 0 {
		return logger
	}
	l := newContext(logger)
	// Limiting the capacity of the stored keyvals ensures that a new
	// backing array is created if the slice must grow in Log or With.
	// Using the extra capacity without copying risks a data race that
	// would violate the Logger interface contract.
	n := len(l.keyvals) + len(keyvals)
	if len(keyvals)%2 != 0 {
		n++
	}
	kvs := make([]interface{}, 0, n)
	kvs = append(kvs, keyvals...)
	if len(kvs)%2 != 0 {
		kvs = append(kvs, ErrMissingValue)
	}
	kvs = append(kvs, l.keyvals...)
	return &context{
		logger:     l.logger,
		keyvals:    kvs,
		hasValuer:  l.hasValuer || containsValuer(keyvals),
		sKeyvals:   l.sKeyvals,
		sHasValuer: l.sHasValuer,
	}
}

// WithSuffix returns a new contextual logger with keyvals appended to those
// passed to calls to Log. If logger is also a contextual logger created by
// With, WithPrefix, or WithSuffix, keyvals is appended to the existing context.
//
// The returned Logger replaces all value elements (odd indexes) containing a
// Valuer with their generated value for each call to its Log method.
func WithSuffix(logger Logger, keyvals ...interface{}) Logger {
	if len(keyvals) == 0 {
		return logger
	}
	l := newContext(logger)
	// Limiting the capacity of the stored keyvals ensures that a new
	// backing array is created if the slice must grow in Log or With.
	// Using the extra capacity without copying risks a data race that
	// would violate the Logger interface contract.
	n := len(l.sKeyvals) + len(keyvals)
	if len(keyvals)%2 != 0 {
		n++
	}
	kvs := make([]interface{}, 0, n)
	kvs = append(kvs, keyvals...)
	if len(kvs)%2 != 0 {
		kvs = append(kvs, ErrMissingValue)
	}
	kvs = append(l.sKeyvals, kvs...)
	return &context{
		logger:     l.logger,
		keyvals:    l.keyvals,
		hasValuer:  l.hasValuer,
		sKeyvals:   kvs,
		sHasValuer: l.sHasValuer || containsValuer(keyvals),
	}
}

// context is the Logger implementation returned by With, WithPrefix, and
// WithSuffix. It wraps a Logger and holds keyvals that it includes in all
// log events. Its Log method calls bindValues to generate values for each
// Valuer in the context keyvals.
//
// A context must always have the same number of stack frames between calls to
// its Log method and the eventual binding of Valuers to their value. This
// requirement comes from the functional requirement to allow a context to
// resolve application call site information for a Caller stored in the
// context. To do this we must be able to predict the number of logging
// functions on the stack when bindValues is called.
//
// Two implementation details provide the needed stack depth consistency.
//
//    1. newContext avoids introducing an additional layer when asked to
//       wrap another context.
//    2. With, WithPrefix, and WithSuffix avoid introducing an additional
//       layer by returning a newly constructed context with a merged keyvals
//       rather than simply wrapping the existing context.
type context struct {
	logger     Logger
	keyvals    []interface{}
	sKeyvals   []interface{} // suffixes
	hasValuer  bool
	sHasValuer bool
}

func newContext(logger Logger) *context {
	if c, ok := logger.(*context); ok {
		return c
	}
	return &context{logger: logger}
}

// Log replaces all value elements (odd indexes) containing a Valuer in the
// stored context with their generated value, appends keyvals, and passes the
// result to the wrapped Logger.
func (l *context) Log(keyvals ...interface{}) error {
	kvs := append(l.keyvals, keyvals...)
	if len(kvs)%2 != 0 {
		kvs = append(kvs, ErrMissingValue)
	}
	if l.hasValuer {
		// If no keyvals were appended above then we must copy l.keyvals so
		// that future log events will reevaluate the stored Valuers.
		if len(keyvals) == 0 {
			kvs = append([]interface{}{}, l.keyvals...)
		}
		bindValues(kvs[:(len(l.keyvals))])
	}
	kvs = append(kvs, l.sKeyvals...)
	if l.sHasValuer {
		bindValues(kvs[len(kvs)-len(l.sKeyvals):])
	}
	return l.logger.Log(kvs...)
}

// LoggerFunc is an adapter to allow use of ordinary functions as Loggers. If
// f is a function with the appropriate signature, LoggerFunc(f) is a Logger
// object that calls f.
type LoggerFunc func(...interface{}) error

// Log implements Logger by calling f(keyvals...).
func (f LoggerFunc) Log(keyvals ...interface{}) error {
	return f(keyvals...)
}
