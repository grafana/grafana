package log

import (
	"time"

	"github.com/go-stack/stack"
)

// A Valuer generates a log value. When passed to With or WithPrefix in a
// value element (odd indexes), it represents a dynamic value which is re-
// evaluated with each log event.
type Valuer func() interface{}

// bindValues replaces all value elements (odd indexes) containing a Valuer
// with their generated value.
func bindValues(keyvals []interface{}) {
	for i := 1; i < len(keyvals); i += 2 {
		if v, ok := keyvals[i].(Valuer); ok {
			keyvals[i] = v()
		}
	}
}

// containsValuer returns true if any of the value elements (odd indexes)
// contain a Valuer.
func containsValuer(keyvals []interface{}) bool {
	for i := 1; i < len(keyvals); i += 2 {
		if _, ok := keyvals[i].(Valuer); ok {
			return true
		}
	}
	return false
}

// Timestamp returns a timestamp Valuer. It invokes the t function to get the
// time; unless you are doing something tricky, pass time.Now.
//
// Most users will want to use DefaultTimestamp or DefaultTimestampUTC, which
// are TimestampFormats that use the RFC3339Nano format.
func Timestamp(t func() time.Time) Valuer {
	return func() interface{} { return t() }
}

// TimestampFormat returns a timestamp Valuer with a custom time format. It
// invokes the t function to get the time to format; unless you are doing
// something tricky, pass time.Now. The layout string is passed to
// Time.Format.
//
// Most users will want to use DefaultTimestamp or DefaultTimestampUTC, which
// are TimestampFormats that use the RFC3339Nano format.
func TimestampFormat(t func() time.Time, layout string) Valuer {
	return func() interface{} {
		return timeFormat{
			time:   t(),
			layout: layout,
		}
	}
}

// A timeFormat represents an instant in time and a layout used when
// marshaling to a text format.
type timeFormat struct {
	time   time.Time
	layout string
}

func (tf timeFormat) String() string {
	return tf.time.Format(tf.layout)
}

// MarshalText implements encoding.TextMarshaller.
func (tf timeFormat) MarshalText() (text []byte, err error) {
	// The following code adapted from the standard library time.Time.Format
	// method. Using the same undocumented magic constant to extend the size
	// of the buffer as seen there.
	b := make([]byte, 0, len(tf.layout)+10)
	b = tf.time.AppendFormat(b, tf.layout)
	return b, nil
}

// Caller returns a Valuer that returns a file and line from a specified depth
// in the callstack. Users will probably want to use DefaultCaller.
func Caller(depth int) Valuer {
	return func() interface{} { return stack.Caller(depth) }
}

var (
	// DefaultTimestamp is a Valuer that returns the current wallclock time,
	// respecting time zones, when bound.
	DefaultTimestamp = TimestampFormat(time.Now, time.RFC3339Nano)

	// DefaultTimestampUTC is a Valuer that returns the current time in UTC
	// when bound.
	DefaultTimestampUTC = TimestampFormat(
		func() time.Time { return time.Now().UTC() },
		time.RFC3339Nano,
	)

	// DefaultCaller is a Valuer that returns the file and line where the Log
	// method was invoked. It can only be used with log.With.
	DefaultCaller = Caller(3)
)
