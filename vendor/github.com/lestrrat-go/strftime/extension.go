package strftime

import (
	"strconv"
	"time"
)

// NOTE: declare private variable and iniitalize once in init(),
// and leave the Milliseconds() function as returning static content.
// This way, `go doc -all` does not show the contents of the
// milliseconds function
var milliseconds Appender
var microseconds Appender
var unixseconds Appender

func init() {
	milliseconds = AppendFunc(func(b []byte, t time.Time) []byte {
		millisecond := int(t.Nanosecond()) / int(time.Millisecond)
		if millisecond < 100 {
			b = append(b, '0')
		}
		if millisecond < 10 {
			b = append(b, '0')
		}
		return append(b, strconv.Itoa(millisecond)...)
	})
	microseconds = AppendFunc(func(b []byte, t time.Time) []byte {
		microsecond := int(t.Nanosecond()) / int(time.Microsecond)
		if microsecond < 100000 {
			b = append(b, '0')
		}
		if microsecond < 10000 {
			b = append(b, '0')
		}
		if microsecond < 1000 {
			b = append(b, '0')
		}
		if microsecond < 100 {
			b = append(b, '0')
		}
		if microsecond < 10 {
			b = append(b, '0')
		}
		return append(b, strconv.Itoa(microsecond)...)
	})
	unixseconds = AppendFunc(func(b []byte, t time.Time) []byte {
		return append(b, strconv.FormatInt(t.Unix(), 10)...)
	})
}

// Milliseconds returns the Appender suitable for creating a zero-padded,
// 3-digit millisecond textual representation.
func Milliseconds() Appender {
	return milliseconds
}

// Microsecond returns the Appender suitable for creating a zero-padded,
// 6-digit microsecond textual representation.
func Microseconds() Appender {
	return microseconds
}

// UnixSeconds returns the Appender suitable for creating
// unix timestamp textual representation.
func UnixSeconds() Appender {
	return unixseconds
}
