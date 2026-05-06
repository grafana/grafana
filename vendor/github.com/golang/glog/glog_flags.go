// Go support for leveled logs, analogous to https://github.com/google/glog.
//
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

package glog

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/golang/glog/internal/logsink"
)

// modulePat contains a filter for the -vmodule flag.
// It holds a verbosity level and a file pattern to match.
type modulePat struct {
	pattern string
	literal bool // The pattern is a literal string
	full    bool // The pattern wants to match the full path
	level   Level
}

// match reports whether the file matches the pattern. It uses a string
// comparison if the pattern contains no metacharacters.
func (m *modulePat) match(full, file string) bool {
	if m.literal {
		if m.full {
			return full == m.pattern
		}
		return file == m.pattern
	}
	if m.full {
		match, _ := filepath.Match(m.pattern, full)
		return match
	}
	match, _ := filepath.Match(m.pattern, file)
	return match
}

// isLiteral reports whether the pattern is a literal string, that is, has no metacharacters
// that require filepath.Match to be called to match the pattern.
func isLiteral(pattern string) bool {
	return !strings.ContainsAny(pattern, `\*?[]`)
}

// isFull reports whether the pattern matches the full file path, that is,
// whether it contains /.
func isFull(pattern string) bool {
	return strings.ContainsRune(pattern, '/')
}

// verboseFlags represents the setting of the -v and -vmodule flags.
type verboseFlags struct {
	// moduleLevelCache is a sync.Map storing the -vmodule Level for each V()
	// call site, identified by PC. If there is no matching -vmodule filter,
	// the cached value is exactly v. moduleLevelCache is replaced with a new
	// Map whenever the -vmodule or -v flag changes state.
	moduleLevelCache atomic.Value

	// mu guards all fields below.
	mu sync.Mutex

	// v stores the value of the -v flag.  It may be read safely using
	// sync.LoadInt32, but is only modified under mu.
	v Level

	// module stores the parsed -vmodule flag.
	module []modulePat

	// moduleLength caches len(module).  If greater than zero, it
	// means vmodule is enabled. It may be read safely using sync.LoadInt32, but
	// is only modified under mu.
	moduleLength int32
}

// NOTE: For compatibility with the open-sourced v1 version of this
// package (github.com/golang/glog) we need to retain that flag.Level
// implements the flag.Value interface. See also go/log-vs-glog.

// String is part of the flag.Value interface.
func (l *Level) String() string {
	return strconv.FormatInt(int64(l.Get().(Level)), 10)
}

// Get is part of the flag.Value interface.
func (l *Level) Get() any {
	if l == &vflags.v {
		// l is the value registered for the -v flag.
		return Level(atomic.LoadInt32((*int32)(l)))
	}
	return *l
}

// Set is part of the flag.Value interface.
func (l *Level) Set(value string) error {
	v, err := strconv.Atoi(value)
	if err != nil {
		return err
	}
	if l == &vflags.v {
		// l is the value registered for the -v flag.
		vflags.mu.Lock()
		defer vflags.mu.Unlock()
		vflags.moduleLevelCache.Store(&sync.Map{})
		atomic.StoreInt32((*int32)(l), int32(v))
		return nil
	}
	*l = Level(v)
	return nil
}

// vModuleFlag is the flag.Value for the --vmodule flag.
type vModuleFlag struct{ *verboseFlags }

func (f vModuleFlag) String() string {
	// Do not panic on the zero value.
	// https://groups.google.com/g/golang-nuts/c/Atlr8uAjn6U/m/iId17Td5BQAJ.
	if f.verboseFlags == nil {
		return ""
	}
	f.mu.Lock()
	defer f.mu.Unlock()

	var b bytes.Buffer
	for i, f := range f.module {
		if i > 0 {
			b.WriteRune(',')
		}
		fmt.Fprintf(&b, "%s=%d", f.pattern, f.level)
	}
	return b.String()
}

// Get returns nil for this flag type since the struct is not exported.
func (f vModuleFlag) Get() any { return nil }

var errVmoduleSyntax = errors.New("syntax error: expect comma-separated list of filename=N")

// Syntax: -vmodule=recordio=2,foo/bar/baz=1,gfs*=3
func (f vModuleFlag) Set(value string) error {
	var filter []modulePat
	for _, pat := range strings.Split(value, ",") {
		if len(pat) == 0 {
			// Empty strings such as from a trailing comma can be ignored.
			continue
		}
		patLev := strings.Split(pat, "=")
		if len(patLev) != 2 || len(patLev[0]) == 0 || len(patLev[1]) == 0 {
			return errVmoduleSyntax
		}
		pattern := patLev[0]
		v, err := strconv.Atoi(patLev[1])
		if err != nil {
			return errors.New("syntax error: expect comma-separated list of filename=N")
		}
		// TODO: check syntax of filter?
		filter = append(filter, modulePat{pattern, isLiteral(pattern), isFull(pattern), Level(v)})
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.module = filter
	atomic.StoreInt32((*int32)(&f.moduleLength), int32(len(f.module)))
	f.moduleLevelCache.Store(&sync.Map{})
	return nil
}

func (f *verboseFlags) levelForPC(pc uintptr) Level {
	if level, ok := f.moduleLevelCache.Load().(*sync.Map).Load(pc); ok {
		return level.(Level)
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	level := Level(f.v)
	fn := runtime.FuncForPC(pc)
	file, _ := fn.FileLine(pc)
	// The file is something like /a/b/c/d.go. We want just the d for
	// regular matches, /a/b/c/d for full matches.
	file = strings.TrimSuffix(file, ".go")
	full := file
	if slash := strings.LastIndex(file, "/"); slash >= 0 {
		file = file[slash+1:]
	}
	for _, filter := range f.module {
		if filter.match(full, file) {
			level = filter.level
			break // Use the first matching level.
		}
	}
	f.moduleLevelCache.Load().(*sync.Map).Store(pc, level)
	return level
}

func (f *verboseFlags) enabled(callerDepth int, level Level) bool {
	if atomic.LoadInt32(&f.moduleLength) == 0 {
		// No vmodule values specified, so compare against v level.
		return Level(atomic.LoadInt32((*int32)(&f.v))) >= level
	}

	pcs := [1]uintptr{}
	if runtime.Callers(callerDepth+2, pcs[:]) < 1 {
		return false
	}
	frame, _ := runtime.CallersFrames(pcs[:]).Next()
	return f.levelForPC(frame.Entry) >= level
}

// traceLocation represents an entry in the -log_backtrace_at flag.
type traceLocation struct {
	file string
	line int
}

var errTraceSyntax = errors.New("syntax error: expect file.go:234")

func parseTraceLocation(value string) (traceLocation, error) {
	fields := strings.Split(value, ":")
	if len(fields) != 2 {
		return traceLocation{}, errTraceSyntax
	}
	file, lineStr := fields[0], fields[1]
	if !strings.Contains(file, ".") {
		return traceLocation{}, errTraceSyntax
	}
	line, err := strconv.Atoi(lineStr)
	if err != nil {
		return traceLocation{}, errTraceSyntax
	}
	if line < 0 {
		return traceLocation{}, errors.New("negative value for line")
	}
	return traceLocation{file, line}, nil
}

// match reports whether the specified file and line matches the trace location.
// The argument file name is the full path, not the basename specified in the flag.
func (t traceLocation) match(file string, line int) bool {
	if t.line != line {
		return false
	}
	if i := strings.LastIndex(file, "/"); i >= 0 {
		file = file[i+1:]
	}
	return t.file == file
}

func (t traceLocation) String() string {
	return fmt.Sprintf("%s:%d", t.file, t.line)
}

// traceLocations represents the -log_backtrace_at flag.
// Syntax: -log_backtrace_at=recordio.go:234,sstable.go:456
// Note that unlike vmodule the file extension is included here.
type traceLocations struct {
	mu      sync.Mutex
	locsLen int32 // Safe for atomic read without mu.
	locs    []traceLocation
}

func (t *traceLocations) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()

	var buf bytes.Buffer
	for i, tl := range t.locs {
		if i > 0 {
			buf.WriteString(",")
		}
		buf.WriteString(tl.String())
	}
	return buf.String()
}

// Get always returns nil for this flag type since the struct is not exported
func (t *traceLocations) Get() any { return nil }

func (t *traceLocations) Set(value string) error {
	var locs []traceLocation
	for _, s := range strings.Split(value, ",") {
		if s == "" {
			continue
		}
		loc, err := parseTraceLocation(s)
		if err != nil {
			return err
		}
		locs = append(locs, loc)
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	atomic.StoreInt32(&t.locsLen, int32(len(locs)))
	t.locs = locs
	return nil
}

func (t *traceLocations) match(file string, line int) bool {
	if atomic.LoadInt32(&t.locsLen) == 0 {
		return false
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	for _, tl := range t.locs {
		if tl.match(file, line) {
			return true
		}
	}
	return false
}

// severityFlag is an atomic flag.Value implementation for logsink.Severity.
type severityFlag int32

func (s *severityFlag) get() logsink.Severity {
	return logsink.Severity(atomic.LoadInt32((*int32)(s)))
}
func (s *severityFlag) String() string { return strconv.FormatInt(int64(*s), 10) }
func (s *severityFlag) Get() any       { return s.get() }
func (s *severityFlag) Set(value string) error {
	threshold, err := logsink.ParseSeverity(value)
	if err != nil {
		// Not a severity name.  Try a raw number.
		v, err := strconv.Atoi(value)
		if err != nil {
			return err
		}
		threshold = logsink.Severity(v)
		if threshold < logsink.Info || threshold > logsink.Fatal {
			return fmt.Errorf("Severity %d out of range (min %d, max %d).", v, logsink.Info, logsink.Fatal)
		}
	}
	atomic.StoreInt32((*int32)(s), int32(threshold))
	return nil
}

var (
	vflags verboseFlags // The -v and -vmodule flags.

	logBacktraceAt traceLocations // The -log_backtrace_at flag.

	// Boolean flags. Not handled atomically because the flag.Value interface
	// does not let us avoid the =true, and that shorthand is necessary for
	// compatibility. TODO: does this matter enough to fix? Seems unlikely.
	toStderr     bool // The -logtostderr flag.
	alsoToStderr bool // The -alsologtostderr flag.

	stderrThreshold severityFlag // The -stderrthreshold flag.
)

// verboseEnabled returns whether the caller at the given depth should emit
// verbose logs at the given level, with depth 0 identifying the caller of
// verboseEnabled.
func verboseEnabled(callerDepth int, level Level) bool {
	return vflags.enabled(callerDepth+1, level)
}

// backtraceAt returns whether the logging call at the given function and line
// should also emit a backtrace of the current call stack.
func backtraceAt(file string, line int) bool {
	return logBacktraceAt.match(file, line)
}

func init() {
	vflags.moduleLevelCache.Store(&sync.Map{})

	flag.Var(&vflags.v, "v", "log level for V logs")
	flag.Var(vModuleFlag{&vflags}, "vmodule", "comma-separated list of pattern=N settings for file-filtered logging")

	flag.Var(&logBacktraceAt, "log_backtrace_at", "when logging hits line file:N, emit a stack trace")

	stderrThreshold = severityFlag(logsink.Error)

	flag.BoolVar(&toStderr, "logtostderr", false, "log to standard error instead of files")
	flag.BoolVar(&alsoToStderr, "alsologtostderr", false, "log to standard error as well as files")
	flag.Var(&stderrThreshold, "stderrthreshold", "logs at or above this threshold go to stderr")
}
