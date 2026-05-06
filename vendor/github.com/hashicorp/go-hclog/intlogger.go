// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MIT

package hclog

import (
	"bytes"
	"encoding"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"reflect"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/fatih/color"
)

// TimeFormat is the time format to use for plain (non-JSON) output.
// This is a version of RFC3339 that contains millisecond precision.
const TimeFormat = "2006-01-02T15:04:05.000Z0700"

// TimeFormatJSON is the time format to use for JSON output.
// This is a version of RFC3339 that contains microsecond precision.
const TimeFormatJSON = "2006-01-02T15:04:05.000000Z07:00"

// errJsonUnsupportedTypeMsg is included in log json entries, if an arg cannot be serialized to json
const errJsonUnsupportedTypeMsg = "logging contained values that don't serialize to json"

var (
	_levelToBracket = map[Level]string{
		Debug: "[DEBUG]",
		Trace: "[TRACE]",
		Info:  "[INFO] ",
		Warn:  "[WARN] ",
		Error: "[ERROR]",
	}

	_levelToColor = map[Level]*color.Color{
		Debug: color.New(color.FgHiWhite),
		Trace: color.New(color.FgHiGreen),
		Info:  color.New(color.FgHiBlue),
		Warn:  color.New(color.FgHiYellow),
		Error: color.New(color.FgHiRed),
	}

	faintBoldColor                 = color.New(color.Faint, color.Bold)
	faintColor                     = color.New(color.Faint)
	faintMultiLinePrefix           string
	faintFieldSeparator            string
	faintFieldSeparatorWithNewLine string
)

func init() {
	// Force all the colors to enabled because we do our own detection of color usage.
	for _, c := range _levelToColor {
		c.EnableColor()
	}

	faintBoldColor.EnableColor()
	faintColor.EnableColor()

	faintMultiLinePrefix = faintColor.Sprint("  | ")
	faintFieldSeparator = faintColor.Sprint("=")
	faintFieldSeparatorWithNewLine = faintColor.Sprint("=\n")
}

// Make sure that intLogger is a Logger
var _ Logger = &intLogger{}

// intLogger is an internal logger implementation. Internal in that it is
// defined entirely by this package.
type intLogger struct {
	json              bool
	jsonEscapeEnabled bool
	callerOffset      int
	name              string
	timeFormat        string
	timeFn            TimeFunction
	disableTime       bool

	// This is an interface so that it's shared by any derived loggers, since
	// those derived loggers share the bufio.Writer as well.
	mutex  Locker
	writer *writer
	level  *int32

	// The value of curEpoch when our level was set
	setEpoch uint64

	// The value of curEpoch the last time we performed the level sync process
	ownEpoch uint64

	// Shared amongst all the loggers created in this hierachy, used to determine
	// if the level sync process should be run by comparing it with ownEpoch
	curEpoch *uint64

	// The logger this one was created from. Only set when syncParentLevel is set
	parent *intLogger

	headerColor ColorOption
	fieldColor  ColorOption

	implied []interface{}

	exclude func(level Level, msg string, args ...interface{}) bool

	// create subloggers with their own level setting
	independentLevels bool
	syncParentLevel   bool

	subloggerHook func(sub Logger) Logger
}

// New returns a configured logger.
func New(opts *LoggerOptions) Logger {
	return newLogger(opts)
}

// NewSinkAdapter returns a SinkAdapter with configured settings
// defined by LoggerOptions
func NewSinkAdapter(opts *LoggerOptions) SinkAdapter {
	l := newLogger(opts)
	if l.callerOffset > 0 {
		// extra frames for interceptLogger.{Warn,Info,Log,etc...}, and SinkAdapter.Accept
		l.callerOffset += 2
	}
	return l
}

func newLogger(opts *LoggerOptions) *intLogger {
	if opts == nil {
		opts = &LoggerOptions{}
	}

	output := opts.Output
	if output == nil {
		output = DefaultOutput
	}

	level := opts.Level
	if level == NoLevel {
		level = DefaultLevel
	}

	mutex := opts.Mutex
	if mutex == nil {
		mutex = new(sync.Mutex)
	}

	var (
		primaryColor = ColorOff
		headerColor  = ColorOff
		fieldColor   = ColorOff
	)
	switch {
	case opts.ColorHeaderOnly:
		headerColor = opts.Color
	case opts.ColorHeaderAndFields:
		fieldColor = opts.Color
		headerColor = opts.Color
	default:
		primaryColor = opts.Color
	}

	l := &intLogger{
		json:              opts.JSONFormat,
		jsonEscapeEnabled: !opts.JSONEscapeDisabled,
		name:              opts.Name,
		timeFormat:        TimeFormat,
		timeFn:            time.Now,
		disableTime:       opts.DisableTime,
		mutex:             mutex,
		writer:            newWriter(output, primaryColor),
		level:             new(int32),
		curEpoch:          new(uint64),
		exclude:           opts.Exclude,
		independentLevels: opts.IndependentLevels,
		syncParentLevel:   opts.SyncParentLevel,
		headerColor:       headerColor,
		fieldColor:        fieldColor,
		subloggerHook:     opts.SubloggerHook,
	}
	if opts.IncludeLocation {
		l.callerOffset = offsetIntLogger + opts.AdditionalLocationOffset
	}

	if l.json {
		l.timeFormat = TimeFormatJSON
	}
	if opts.TimeFn != nil {
		l.timeFn = opts.TimeFn
	}
	if opts.TimeFormat != "" {
		l.timeFormat = opts.TimeFormat
	}

	if l.subloggerHook == nil {
		l.subloggerHook = identityHook
	}

	l.setColorization(opts)

	atomic.StoreInt32(l.level, int32(level))

	return l
}

func identityHook(logger Logger) Logger {
	return logger
}

// offsetIntLogger is the stack frame offset in the call stack for the caller to
// one of the Warn, Info, Log, etc methods.
const offsetIntLogger = 3

// Log a message and a set of key/value pairs if the given level is at
// or more severe that the threshold configured in the Logger.
func (l *intLogger) log(name string, level Level, msg string, args ...interface{}) {
	if level < l.GetLevel() {
		return
	}

	t := l.timeFn()

	l.mutex.Lock()
	defer l.mutex.Unlock()

	if l.exclude != nil && l.exclude(level, msg, args...) {
		return
	}

	if l.json {
		l.logJSON(t, name, level, msg, args...)
	} else {
		l.logPlain(t, name, level, msg, args...)
	}

	l.writer.Flush(level)
}

// Cleanup a path by returning the last 2 segments of the path only.
func trimCallerPath(path string) string {
	// lovely borrowed from zap
	// nb. To make sure we trim the path correctly on Windows too, we
	// counter-intuitively need to use '/' and *not* os.PathSeparator here,
	// because the path given originates from Go stdlib, specifically
	// runtime.Caller() which (as of Mar/17) returns forward slashes even on
	// Windows.
	//
	// See https://github.com/golang/go/issues/3335
	// and https://github.com/golang/go/issues/18151
	//
	// for discussion on the issue on Go side.

	// Find the last separator.
	idx := strings.LastIndexByte(path, '/')
	if idx == -1 {
		return path
	}

	// Find the penultimate separator.
	idx = strings.LastIndexByte(path[:idx], '/')
	if idx == -1 {
		return path
	}

	return path[idx+1:]
}

// isNormal indicates if the rune is one allowed to exist as an unquoted
// string value. This is a subset of ASCII, `-` through `~`.
func isNormal(r rune) bool {
	return 0x2D <= r && r <= 0x7E // - through ~
}

// needsQuoting returns false if all the runes in string are normal, according
// to isNormal
func needsQuoting(str string) bool {
	for _, r := range str {
		if !isNormal(r) {
			return true
		}
	}

	return false
}

// logPlain is the non-JSON logging format function which writes directly
// to the underlying writer the logger was initialized with.
//
// If the logger was initialized with a color function, it also handles
// applying the color to the log message.
//
// Color Options
//  1. No color.
//  2. Color the whole log line, based on the level.
//  3. Color only the header (level) part of the log line.
//  4. Color both the header and fields of the log line.
func (l *intLogger) logPlain(t time.Time, name string, level Level, msg string, args ...interface{}) {

	if !l.disableTime {
		l.writer.WriteString(t.Format(l.timeFormat))
		l.writer.WriteByte(' ')
	}

	s, ok := _levelToBracket[level]
	if ok {
		if l.headerColor != ColorOff {
			color := _levelToColor[level]
			color.Fprint(l.writer, s)
		} else {
			l.writer.WriteString(s)
		}
	} else {
		l.writer.WriteString("[?????]")
	}

	if l.callerOffset > 0 {
		if _, file, line, ok := runtime.Caller(l.callerOffset); ok {
			l.writer.WriteByte(' ')
			l.writer.WriteString(trimCallerPath(file))
			l.writer.WriteByte(':')
			l.writer.WriteString(strconv.Itoa(line))
			l.writer.WriteByte(':')
		}
	}

	l.writer.WriteByte(' ')

	if name != "" {
		l.writer.WriteString(name)
		if msg != "" {
			l.writer.WriteString(": ")
			l.writer.WriteString(msg)
		}
	} else if msg != "" {
		l.writer.WriteString(msg)
	}

	args = append(l.implied, args...)

	var stacktrace CapturedStacktrace

	if len(args) > 0 {
		if len(args)%2 != 0 {
			cs, ok := args[len(args)-1].(CapturedStacktrace)
			if ok {
				args = args[:len(args)-1]
				stacktrace = cs
			} else {
				extra := args[len(args)-1]
				args = append(args[:len(args)-1], MissingKey, extra)
			}
		}

		l.writer.WriteByte(':')

		// Handle the field arguments, which come in pairs (key=val).
	FOR:
		for i := 0; i < len(args); i = i + 2 {
			var (
				key string
				val string
				raw bool
			)

			// Convert the field value to a string.
			switch st := args[i+1].(type) {
			case string:
				val = st
				if st == "" {
					val = `""`
					raw = true
				}
			case int:
				val = strconv.FormatInt(int64(st), 10)
			case int64:
				val = strconv.FormatInt(int64(st), 10)
			case int32:
				val = strconv.FormatInt(int64(st), 10)
			case int16:
				val = strconv.FormatInt(int64(st), 10)
			case int8:
				val = strconv.FormatInt(int64(st), 10)
			case uint:
				val = strconv.FormatUint(uint64(st), 10)
			case uint64:
				val = strconv.FormatUint(uint64(st), 10)
			case uint32:
				val = strconv.FormatUint(uint64(st), 10)
			case uint16:
				val = strconv.FormatUint(uint64(st), 10)
			case uint8:
				val = strconv.FormatUint(uint64(st), 10)
			case Hex:
				val = "0x" + strconv.FormatUint(uint64(st), 16)
			case Octal:
				val = "0" + strconv.FormatUint(uint64(st), 8)
			case Binary:
				val = "0b" + strconv.FormatUint(uint64(st), 2)
			case CapturedStacktrace:
				stacktrace = st
				continue FOR
			case Format:
				val = fmt.Sprintf(st[0].(string), st[1:]...)
			case Quote:
				raw = true
				val = strconv.Quote(string(st))
			default:
				v := reflect.ValueOf(st)
				if v.Kind() == reflect.Slice {
					val = l.renderSlice(v)
					raw = true
				} else {
					val = fmt.Sprintf("%v", st)
				}
			}

			// Convert the field key to a string.
			switch st := args[i].(type) {
			case string:
				key = st
			default:
				key = fmt.Sprintf("%s", st)
			}

			// Optionally apply the ANSI "faint" and "bold"
			// SGR values to the key.
			if l.fieldColor != ColorOff {
				key = faintBoldColor.Sprint(key)
			}

			// Values may contain multiple lines, and that format
			// is preserved, with each line prefixed with a "  | "
			// to show it's part of a collection of lines.
			//
			// Values may also need quoting, if not all the runes
			// in the value string are "normal", like if they
			// contain ANSI escape sequences.
			if strings.Contains(val, "\n") {
				l.writer.WriteString("\n  ")
				l.writer.WriteString(key)
				if l.fieldColor != ColorOff {
					l.writer.WriteString(faintFieldSeparatorWithNewLine)
					writeIndent(l.writer, val, faintMultiLinePrefix)
				} else {
					l.writer.WriteString("=\n")
					writeIndent(l.writer, val, "  | ")
				}
				l.writer.WriteString("  ")
			} else if !raw && needsQuoting(val) {
				l.writer.WriteByte(' ')
				l.writer.WriteString(key)
				if l.fieldColor != ColorOff {
					l.writer.WriteString(faintFieldSeparator)
				} else {
					l.writer.WriteByte('=')
				}
				l.writer.WriteByte('"')
				writeEscapedForOutput(l.writer, val, true)
				l.writer.WriteByte('"')
			} else {
				l.writer.WriteByte(' ')
				l.writer.WriteString(key)
				if l.fieldColor != ColorOff {
					l.writer.WriteString(faintFieldSeparator)
				} else {
					l.writer.WriteByte('=')
				}
				l.writer.WriteString(val)
			}
		}
	}

	l.writer.WriteString("\n")

	if stacktrace != "" {
		l.writer.WriteString(string(stacktrace))
		l.writer.WriteString("\n")
	}
}

func writeIndent(w *writer, str string, indent string) {
	for {
		nl := strings.IndexByte(str, "\n"[0])
		if nl == -1 {
			if str != "" {
				w.WriteString(indent)
				writeEscapedForOutput(w, str, false)
				w.WriteString("\n")
			}
			return
		}

		w.WriteString(indent)
		writeEscapedForOutput(w, str[:nl], false)
		w.WriteString("\n")
		str = str[nl+1:]
	}
}

func needsEscaping(str string) bool {
	for _, b := range str {
		if !unicode.IsPrint(b) || b == '"' {
			return true
		}
	}

	return false
}

const (
	lowerhex = "0123456789abcdef"
)

var bufPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

func writeEscapedForOutput(w io.Writer, str string, escapeQuotes bool) {
	if !needsEscaping(str) {
		w.Write([]byte(str))
		return
	}

	bb := bufPool.Get().(*bytes.Buffer)
	bb.Reset()

	defer bufPool.Put(bb)

	for _, r := range str {
		if escapeQuotes && r == '"' {
			bb.WriteString(`\"`)
		} else if unicode.IsPrint(r) {
			bb.WriteRune(r)
		} else {
			switch r {
			case '\a':
				bb.WriteString(`\a`)
			case '\b':
				bb.WriteString(`\b`)
			case '\f':
				bb.WriteString(`\f`)
			case '\n':
				bb.WriteString(`\n`)
			case '\r':
				bb.WriteString(`\r`)
			case '\t':
				bb.WriteString(`\t`)
			case '\v':
				bb.WriteString(`\v`)
			default:
				switch {
				case r < ' ':
					bb.WriteString(`\x`)
					bb.WriteByte(lowerhex[byte(r)>>4])
					bb.WriteByte(lowerhex[byte(r)&0xF])
				case !utf8.ValidRune(r):
					r = 0xFFFD
					fallthrough
				case r < 0x10000:
					bb.WriteString(`\u`)
					for s := 12; s >= 0; s -= 4 {
						bb.WriteByte(lowerhex[r>>uint(s)&0xF])
					}
				default:
					bb.WriteString(`\U`)
					for s := 28; s >= 0; s -= 4 {
						bb.WriteByte(lowerhex[r>>uint(s)&0xF])
					}
				}
			}
		}
	}

	w.Write(bb.Bytes())
}

func (l *intLogger) renderSlice(v reflect.Value) string {
	var buf bytes.Buffer

	buf.WriteRune('[')

	for i := 0; i < v.Len(); i++ {
		if i > 0 {
			buf.WriteString(", ")
		}

		sv := v.Index(i)

		var val string

		switch sv.Kind() {
		case reflect.String:
			val = strconv.Quote(sv.String())
		case reflect.Int, reflect.Int16, reflect.Int32, reflect.Int64:
			val = strconv.FormatInt(sv.Int(), 10)
		case reflect.Uint, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			val = strconv.FormatUint(sv.Uint(), 10)
		default:
			val = fmt.Sprintf("%v", sv.Interface())
			if strings.ContainsAny(val, " \t\n\r") {
				val = strconv.Quote(val)
			}
		}

		buf.WriteString(val)
	}

	buf.WriteRune(']')

	return buf.String()
}

// JSON logging function
func (l *intLogger) logJSON(t time.Time, name string, level Level, msg string, args ...interface{}) {
	vals := l.jsonMapEntry(t, name, level, msg)
	args = append(l.implied, args...)

	if len(args) > 0 {
		if len(args)%2 != 0 {
			cs, ok := args[len(args)-1].(CapturedStacktrace)
			if ok {
				args = args[:len(args)-1]
				vals["stacktrace"] = cs
			} else {
				extra := args[len(args)-1]
				args = append(args[:len(args)-1], MissingKey, extra)
			}
		}

		for i := 0; i < len(args); i = i + 2 {
			val := args[i+1]
			switch sv := val.(type) {
			case error:
				// Check if val is of type error. If error type doesn't
				// implement json.Marshaler or encoding.TextMarshaler
				// then set val to err.Error() so that it gets marshaled
				switch sv.(type) {
				case json.Marshaler, encoding.TextMarshaler:
				default:
					val = sv.Error()
				}
			case Format:
				val = fmt.Sprintf(sv[0].(string), sv[1:]...)
			}

			var key string

			switch st := args[i].(type) {
			case string:
				key = st
			default:
				key = fmt.Sprintf("%s", st)
			}
			vals[key] = val
		}
	}

	encoder := json.NewEncoder(l.writer)
	encoder.SetEscapeHTML(l.jsonEscapeEnabled)
	err := encoder.Encode(vals)
	if err != nil {
		if _, ok := err.(*json.UnsupportedTypeError); ok {
			plainVal := l.jsonMapEntry(t, name, level, msg)
			plainVal["@warn"] = errJsonUnsupportedTypeMsg

			errEncoder := json.NewEncoder(l.writer)
			errEncoder.SetEscapeHTML(l.jsonEscapeEnabled)
			errEncoder.Encode(plainVal)
		}
	}
}

func (l intLogger) jsonMapEntry(t time.Time, name string, level Level, msg string) map[string]interface{} {
	vals := map[string]interface{}{
		"@message": msg,
	}
	if !l.disableTime {
		vals["@timestamp"] = t.Format(l.timeFormat)
	}

	var levelStr string
	switch level {
	case Error:
		levelStr = "error"
	case Warn:
		levelStr = "warn"
	case Info:
		levelStr = "info"
	case Debug:
		levelStr = "debug"
	case Trace:
		levelStr = "trace"
	default:
		levelStr = "all"
	}

	vals["@level"] = levelStr

	if name != "" {
		vals["@module"] = name
	}

	if l.callerOffset > 0 {
		if _, file, line, ok := runtime.Caller(l.callerOffset + 1); ok {
			vals["@caller"] = fmt.Sprintf("%s:%d", file, line)
		}
	}
	return vals
}

// Emit the message and args at the provided level
func (l *intLogger) Log(level Level, msg string, args ...interface{}) {
	l.log(l.Name(), level, msg, args...)
}

// Emit the message and args at DEBUG level
func (l *intLogger) Debug(msg string, args ...interface{}) {
	l.log(l.Name(), Debug, msg, args...)
}

// Emit the message and args at TRACE level
func (l *intLogger) Trace(msg string, args ...interface{}) {
	l.log(l.Name(), Trace, msg, args...)
}

// Emit the message and args at INFO level
func (l *intLogger) Info(msg string, args ...interface{}) {
	l.log(l.Name(), Info, msg, args...)
}

// Emit the message and args at WARN level
func (l *intLogger) Warn(msg string, args ...interface{}) {
	l.log(l.Name(), Warn, msg, args...)
}

// Emit the message and args at ERROR level
func (l *intLogger) Error(msg string, args ...interface{}) {
	l.log(l.Name(), Error, msg, args...)
}

// Indicate that the logger would emit TRACE level logs
func (l *intLogger) IsTrace() bool {
	return l.GetLevel() == Trace
}

// Indicate that the logger would emit DEBUG level logs
func (l *intLogger) IsDebug() bool {
	return l.GetLevel() <= Debug
}

// Indicate that the logger would emit INFO level logs
func (l *intLogger) IsInfo() bool {
	return l.GetLevel() <= Info
}

// Indicate that the logger would emit WARN level logs
func (l *intLogger) IsWarn() bool {
	return l.GetLevel() <= Warn
}

// Indicate that the logger would emit ERROR level logs
func (l *intLogger) IsError() bool {
	return l.GetLevel() <= Error
}

const MissingKey = "EXTRA_VALUE_AT_END"

// Return a sub-Logger for which every emitted log message will contain
// the given key/value pairs. This is used to create a context specific
// Logger.
func (l *intLogger) With(args ...interface{}) Logger {
	var extra interface{}

	if len(args)%2 != 0 {
		extra = args[len(args)-1]
		args = args[:len(args)-1]
	}

	sl := l.copy()

	result := make(map[string]interface{}, len(l.implied)+len(args))
	keys := make([]string, 0, len(l.implied)+len(args))

	// Read existing args, store map and key for consistent sorting
	for i := 0; i < len(l.implied); i += 2 {
		key := l.implied[i].(string)
		keys = append(keys, key)
		result[key] = l.implied[i+1]
	}
	// Read new args, store map and key for consistent sorting
	for i := 0; i < len(args); i += 2 {
		key := args[i].(string)
		_, exists := result[key]
		if !exists {
			keys = append(keys, key)
		}
		result[key] = args[i+1]
	}

	// Sort keys to be consistent
	sort.Strings(keys)

	sl.implied = make([]interface{}, 0, len(l.implied)+len(args))
	for _, k := range keys {
		sl.implied = append(sl.implied, k)
		sl.implied = append(sl.implied, result[k])
	}

	if extra != nil {
		sl.implied = append(sl.implied, MissingKey, extra)
	}

	return l.subloggerHook(sl)
}

// Create a new sub-Logger that a name decending from the current name.
// This is used to create a subsystem specific Logger.
func (l *intLogger) Named(name string) Logger {
	sl := l.copy()

	if sl.name != "" {
		sl.name = sl.name + "." + name
	} else {
		sl.name = name
	}

	return l.subloggerHook(sl)
}

// Create a new sub-Logger with an explicit name. This ignores the current
// name. This is used to create a standalone logger that doesn't fall
// within the normal hierarchy.
func (l *intLogger) ResetNamed(name string) Logger {
	sl := l.copy()

	sl.name = name

	return l.subloggerHook(sl)
}

func (l *intLogger) ResetOutput(opts *LoggerOptions) error {
	if opts.Output == nil {
		return errors.New("given output is nil")
	}

	l.mutex.Lock()
	defer l.mutex.Unlock()

	return l.resetOutput(opts)
}

func (l *intLogger) ResetOutputWithFlush(opts *LoggerOptions, flushable Flushable) error {
	if opts.Output == nil {
		return errors.New("given output is nil")
	}
	if flushable == nil {
		return errors.New("flushable is nil")
	}

	l.mutex.Lock()
	defer l.mutex.Unlock()

	if err := flushable.Flush(); err != nil {
		return err
	}

	return l.resetOutput(opts)
}

func (l *intLogger) resetOutput(opts *LoggerOptions) error {
	l.writer = newWriter(opts.Output, opts.Color)
	l.setColorization(opts)
	return nil
}

// Update the logging level on-the-fly. This will affect all subloggers as
// well.
func (l *intLogger) SetLevel(level Level) {
	if !l.syncParentLevel {
		atomic.StoreInt32(l.level, int32(level))
		return
	}

	nsl := new(int32)
	*nsl = int32(level)

	l.level = nsl

	l.ownEpoch = atomic.AddUint64(l.curEpoch, 1)
	l.setEpoch = l.ownEpoch
}

func (l *intLogger) searchLevelPtr() *int32 {
	p := l.parent

	ptr := l.level

	max := l.setEpoch

	for p != nil {
		if p.setEpoch > max {
			max = p.setEpoch
			ptr = p.level
		}

		p = p.parent
	}

	return ptr
}

// Returns the current level
func (l *intLogger) GetLevel() Level {
	// We perform the loads immediately to keep the CPU pipeline busy, which
	// effectively makes the second load cost nothing. Once loaded into registers
	// the comparison returns the already loaded value. The comparison is almost
	// always true, so the branch predictor should hit consistently with it.
	var (
		curEpoch = atomic.LoadUint64(l.curEpoch)
		level    = Level(atomic.LoadInt32(l.level))
		own      = l.ownEpoch
	)

	if curEpoch == own {
		return level
	}

	// Perform the level sync process. We'll avoid doing this next time by seeing the
	// epoch as current.

	ptr := l.searchLevelPtr()
	l.level = ptr
	l.ownEpoch = curEpoch

	return Level(atomic.LoadInt32(ptr))
}

// Create a *log.Logger that will send it's data through this Logger. This
// allows packages that expect to be using the standard library log to actually
// use this logger.
func (l *intLogger) StandardLogger(opts *StandardLoggerOptions) *log.Logger {
	if opts == nil {
		opts = &StandardLoggerOptions{}
	}

	return log.New(l.StandardWriter(opts), "", 0)
}

func (l *intLogger) StandardWriter(opts *StandardLoggerOptions) io.Writer {
	newLog := *l
	if l.callerOffset > 0 {
		// the stack is
		// logger.printf() -> l.Output() ->l.out.writer(hclog:stdlogAdaptor.write) -> hclog:stdlogAdaptor.dispatch()
		// So plus 4.
		newLog.callerOffset = l.callerOffset + 4
	}
	return &stdlogAdapter{
		log:                      &newLog,
		inferLevels:              opts.InferLevels,
		inferLevelsWithTimestamp: opts.InferLevelsWithTimestamp,
		forceLevel:               opts.ForceLevel,
	}
}

// Accept implements the SinkAdapter interface
func (i *intLogger) Accept(name string, level Level, msg string, args ...interface{}) {
	i.log(name, level, msg, args...)
}

// ImpliedArgs returns the loggers implied args
func (i *intLogger) ImpliedArgs() []interface{} {
	return i.implied
}

// Name returns the loggers name
func (i *intLogger) Name() string {
	return i.name
}

// copy returns a shallow copy of the intLogger, replacing the level pointer
// when necessary
func (l *intLogger) copy() *intLogger {
	sl := *l

	if l.independentLevels {
		sl.level = new(int32)
		*sl.level = *l.level
	} else if l.syncParentLevel {
		sl.parent = l
	}

	return &sl
}
