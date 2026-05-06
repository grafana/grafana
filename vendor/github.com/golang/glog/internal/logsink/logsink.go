// Copyright 2023 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package logsink

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang/glog/internal/stackdump"
)

// MaxLogMessageLen is the limit on length of a formatted log message, including
// the standard line prefix and trailing newline.
//
// Chosen to match C++ glog.
const MaxLogMessageLen = 15000

// A Severity is a severity at which a message can be logged.
type Severity int8

// These constants identify the log levels in order of increasing severity.
// A message written to a high-severity log file is also written to each
// lower-severity log file.
const (
	Info Severity = iota
	Warning
	Error

	// Fatal contains logs written immediately before the process terminates.
	//
	// Sink implementations should not terminate the process themselves: the log
	// package will perform any necessary cleanup and terminate the process as
	// appropriate.
	Fatal
)

func (s Severity) String() string {
	switch s {
	case Info:
		return "INFO"
	case Warning:
		return "WARNING"
	case Error:
		return "ERROR"
	case Fatal:
		return "FATAL"
	}
	return fmt.Sprintf("%T(%d)", s, s)
}

// ParseSeverity returns the case-insensitive Severity value for the given string.
func ParseSeverity(name string) (Severity, error) {
	name = strings.ToUpper(name)
	for s := Info; s <= Fatal; s++ {
		if s.String() == name {
			return s, nil
		}
	}
	return -1, fmt.Errorf("logsink: invalid severity %q", name)
}

// Meta is metadata about a logging call.
type Meta struct {
	// The context with which the log call was made (or nil). If set, the context
	// is only valid during the logsink.Structured.Printf call, it should not be
	// retained.
	Context context.Context

	// Time is the time at which the log call was made.
	Time time.Time

	// File is the source file from which the log entry originates.
	File string
	// Line is the line offset within the source file.
	Line int
	// Depth is the number of stack frames between the logsink and the log call.
	Depth int

	Severity Severity

	// Verbose indicates whether the call was made via "log.V".  Log entries below
	// the current verbosity threshold are not sent to the sink.
	Verbose bool

	// Thread ID. This can be populated with a thread ID from another source,
	// such as a system we are importing logs from. In the normal case, this
	// will be set to the process ID (PID), since Go doesn't have threads.
	Thread int64

	// Stack trace starting in the logging function. May be nil.
	// A logsink should implement the StackWanter interface to request this.
	//
	// Even if WantStack returns false, this field may be set (e.g. if another
	// sink wants a stack trace).
	Stack *stackdump.Stack
}

// Structured is a logging destination that accepts structured data as input.
type Structured interface {
	// Printf formats according to a fmt.Printf format specifier and writes a log
	// entry.  The precise result of formatting depends on the sink, but should
	// aim for consistency with fmt.Printf.
	//
	// Printf returns the number of bytes occupied by the log entry, which
	// may not be equal to the total number of bytes written.
	//
	// Printf returns any error encountered *if* it is severe enough that the log
	// package should terminate the process.
	//
	// The sink must not modify the *Meta parameter, nor reference it after
	// Printf has returned: it may be reused in subsequent calls.
	Printf(meta *Meta, format string, a ...any) (n int, err error)
}

// StackWanter can be implemented by a logsink.Structured to indicate that it
// wants a stack trace to accompany at least some of the log messages it receives.
type StackWanter interface {
	// WantStack returns true if the sink requires a stack trace for a log message
	// with this metadata.
	//
	// NOTE: Returning true implies that meta.Stack will be non-nil. Returning
	// false does NOT imply that meta.Stack will be nil.
	WantStack(meta *Meta) bool
}

// Text is a logging destination that accepts pre-formatted log lines (instead of
// structured data).
type Text interface {
	// Enabled returns whether this sink should output messages for the given
	// Meta.  If the sink returns false for a given Meta, the Printf function will
	// not call Emit on it for the corresponding log message.
	Enabled(*Meta) bool

	// Emit writes a pre-formatted text log entry (including any applicable
	// header) to the log.  It returns the number of bytes occupied by the entry
	// (which may differ from the length of the passed-in slice).
	//
	// Emit returns any error encountered *if* it is severe enough that the log
	// package should terminate the process.
	//
	// The sink must not modify the *Meta parameter, nor reference it after
	// Printf has returned: it may be reused in subsequent calls.
	//
	// NOTE: When developing a text sink, keep in mind the surface in which the
	// logs will be displayed, and whether it's important that the sink be
	// resistent to tampering in the style of b/211428300. Standard text sinks
	// (like `stderrSink`) do not protect against this (e.g. by escaping
	// characters) because the cases where they would show user-influenced bytes
	// are vanishingly small.
	Emit(*Meta, []byte) (n int, err error)
}

// bufs is a pool of *bytes.Buffer used in formatting log entries.
var bufs sync.Pool // Pool of *bytes.Buffer.

// textPrintf formats a text log entry and emits it to all specified Text sinks.
//
// The returned n is the maximum across all Emit calls.
// The returned err is the first non-nil error encountered.
// Sinks that are disabled by configuration should return (0, nil).
func textPrintf(m *Meta, textSinks []Text, format string, args ...any) (n int, err error) {
	// We expect at most file, stderr, and perhaps syslog.  If there are more,
	// we'll end up allocating - no big deal.
	const maxExpectedTextSinks = 3
	var noAllocSinks [maxExpectedTextSinks]Text

	sinks := noAllocSinks[:0]
	for _, s := range textSinks {
		if s.Enabled(m) {
			sinks = append(sinks, s)
		}
	}
	if len(sinks) == 0 && m.Severity != Fatal {
		return 0, nil // No TextSinks specified; don't bother formatting.
	}

	bufi := bufs.Get()
	var buf *bytes.Buffer
	if bufi == nil {
		buf = bytes.NewBuffer(nil)
		bufi = buf
	} else {
		buf = bufi.(*bytes.Buffer)
		buf.Reset()
	}

	// Lmmdd hh:mm:ss.uuuuuu PID/GID file:line]
	//
	// The "PID" entry arguably ought to be TID for consistency with other
	// environments, but TID is not meaningful in a Go program due to the
	// multiplexing of goroutines across threads.
	//
	// Avoid Fprintf, for speed. The format is so simple that we can do it quickly by hand.
	// It's worth about 3X. Fprintf is hard.
	const severityChar = "IWEF"
	buf.WriteByte(severityChar[m.Severity])

	_, month, day := m.Time.Date()
	hour, minute, second := m.Time.Clock()
	twoDigits(buf, int(month))
	twoDigits(buf, day)
	buf.WriteByte(' ')
	twoDigits(buf, hour)
	buf.WriteByte(':')
	twoDigits(buf, minute)
	buf.WriteByte(':')
	twoDigits(buf, second)
	buf.WriteByte('.')
	nDigits(buf, 6, uint64(m.Time.Nanosecond()/1000), '0')
	buf.WriteByte(' ')

	nDigits(buf, 7, uint64(m.Thread), ' ')
	buf.WriteByte(' ')

	{
		file := m.File
		if i := strings.LastIndex(file, "/"); i >= 0 {
			file = file[i+1:]
		}
		buf.WriteString(file)
	}

	buf.WriteByte(':')
	{
		var tmp [19]byte
		buf.Write(strconv.AppendInt(tmp[:0], int64(m.Line), 10))
	}
	buf.WriteString("] ")

	msgStart := buf.Len()
	fmt.Fprintf(buf, format, args...)
	if buf.Len() > MaxLogMessageLen-1 {
		buf.Truncate(MaxLogMessageLen - 1)
	}
	msgEnd := buf.Len()
	if b := buf.Bytes(); b[len(b)-1] != '\n' {
		buf.WriteByte('\n')
	}

	for _, s := range sinks {
		sn, sErr := s.Emit(m, buf.Bytes())
		if sn > n {
			n = sn
		}
		if sErr != nil && err == nil {
			err = sErr
		}
	}

	if m.Severity == Fatal {
		savedM := *m
		fatalMessageStore(savedEntry{
			meta: &savedM,
			msg:  buf.Bytes()[msgStart:msgEnd],
		})
	} else {
		bufs.Put(bufi)
	}
	return n, err
}

const digits = "0123456789"

// twoDigits formats a zero-prefixed two-digit integer to buf.
func twoDigits(buf *bytes.Buffer, d int) {
	buf.WriteByte(digits[(d/10)%10])
	buf.WriteByte(digits[d%10])
}

// nDigits formats an n-digit integer to buf, padding with pad on the left. It
// assumes d != 0.
func nDigits(buf *bytes.Buffer, n int, d uint64, pad byte) {
	var tmp [20]byte

	cutoff := len(tmp) - n
	j := len(tmp) - 1
	for ; d > 0; j-- {
		tmp[j] = digits[d%10]
		d /= 10
	}
	for ; j >= cutoff; j-- {
		tmp[j] = pad
	}
	j++
	buf.Write(tmp[j:])
}

// Printf writes a log entry to all registered TextSinks in this package, then
// to all registered StructuredSinks.
//
// The returned n is the maximum across all Emit and Printf calls.
// The returned err is the first non-nil error encountered.
// Sinks that are disabled by configuration should return (0, nil).
func Printf(m *Meta, format string, args ...any) (n int, err error) {
	m.Depth++
	n, err = textPrintf(m, TextSinks, format, args...)

	for _, sink := range StructuredSinks {
		// TODO: Support TextSinks that implement StackWanter?
		if sw, ok := sink.(StackWanter); ok && sw.WantStack(m) {
			if m.Stack == nil {
				// First, try to find a stacktrace in args, otherwise generate one.
				for _, arg := range args {
					if stack, ok := arg.(stackdump.Stack); ok {
						m.Stack = &stack
						break
					}
				}
				if m.Stack == nil {
					stack := stackdump.Caller( /* skipDepth = */ m.Depth)
					m.Stack = &stack
				}
			}
		}
		sn, sErr := sink.Printf(m, format, args...)
		if sn > n {
			n = sn
		}
		if sErr != nil && err == nil {
			err = sErr
		}
	}
	return n, err
}

// The sets of sinks to which logs should be written.
//
// These must only be modified during package init, and are read-only thereafter.
var (
	// StructuredSinks is the set of Structured sink instances to which logs
	// should be written.
	StructuredSinks []Structured

	// TextSinks is the set of Text sink instances to which logs should be
	// written.
	//
	// These are registered separately from Structured sink implementations to
	// avoid the need to repeat the work of formatting a message for each Text
	// sink that writes it.  The package-level Printf function writes to both sets
	// independenty, so a given log destination should only register a Structured
	// *or* a Text sink (not both).
	TextSinks []Text
)

type savedEntry struct {
	meta *Meta
	msg  []byte
}

// StructuredTextWrapper is a Structured sink which forwards logs to a set of Text sinks.
//
// The purpose of this sink is to allow applications to intercept logging calls before they are
// serialized and sent to Text sinks. For example, if one needs to redact PII from logging
// arguments before they reach STDERR, one solution would be to do the redacting in a Structured
// sink that forwards logs to a StructuredTextWrapper instance, and make STDERR a child of that
// StructuredTextWrapper instance. This is how one could set this up in their application:
//
// func init() {
//
//	wrapper := logsink.StructuredTextWrapper{TextSinks: logsink.TextSinks}
//	// sanitizersink will intercept logs and remove PII
//	sanitizer := sanitizersink{Sink: &wrapper}
//	logsink.StructuredSinks = append(logsink.StructuredSinks, &sanitizer)
//	logsink.TextSinks = nil
//
// }
type StructuredTextWrapper struct {
	// TextSinks is the set of Text sinks that should receive logs from this
	// StructuredTextWrapper instance.
	TextSinks []Text
}

// Printf forwards logs to all Text sinks registered in the StructuredTextWrapper.
func (w *StructuredTextWrapper) Printf(meta *Meta, format string, args ...any) (n int, err error) {
	return textPrintf(meta, w.TextSinks, format, args...)
}
