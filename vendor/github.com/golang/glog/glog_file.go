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

// File I/O for logs.

package glog

import (
	"bufio"
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/golang/glog/internal/logsink"
)

// logDirs lists the candidate directories for new log files.
var logDirs []string

var (
	// If non-empty, overrides the choice of directory in which to write logs.
	// See createLogDirs for the full list of possible destinations.
	logDir      = flag.String("log_dir", "", "If non-empty, write log files in this directory")
	logLink     = flag.String("log_link", "", "If non-empty, add symbolic links in this directory to the log files")
	logBufLevel = flag.Int("logbuflevel", int(logsink.Info), "Buffer log messages logged at this level or lower"+
		" (-1 means don't buffer; 0 means buffer INFO only; ...). Has limited applicability on non-prod platforms.")
)

func createLogDirs() {
	if *logDir != "" {
		logDirs = append(logDirs, *logDir)
	}
	logDirs = append(logDirs, os.TempDir())
}

var (
	pid      = os.Getpid()
	program  = filepath.Base(os.Args[0])
	host     = "unknownhost"
	userName = "unknownuser"
)

func init() {
	h, err := os.Hostname()
	if err == nil {
		host = shortHostname(h)
	}

	if u := lookupUser(); u != "" {
		userName = u
	}
	// Sanitize userName since it is used to construct file paths.
	userName = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		default:
			return '_'
		}
		return r
	}, userName)
}

// shortHostname returns its argument, truncating at the first period.
// For instance, given "www.google.com" it returns "www".
func shortHostname(hostname string) string {
	if i := strings.Index(hostname, "."); i >= 0 {
		return hostname[:i]
	}
	return hostname
}

// logName returns a new log file name containing tag, with start time t, and
// the name for the symlink for tag.
func logName(tag string, t time.Time) (name, link string) {
	name = fmt.Sprintf("%s.%s.%s.log.%s.%04d%02d%02d-%02d%02d%02d.%d",
		program,
		host,
		userName,
		tag,
		t.Year(),
		t.Month(),
		t.Day(),
		t.Hour(),
		t.Minute(),
		t.Second(),
		pid)
	return name, program + "." + tag
}

var onceLogDirs sync.Once

// create creates a new log file and returns the file and its filename, which
// contains tag ("INFO", "FATAL", etc.) and t.  If the file is created
// successfully, create also attempts to update the symlink for that tag, ignoring
// errors.
func create(tag string, t time.Time, dir string) (f *os.File, filename string, err error) {
	if dir != "" {
		f, name, err := createInDir(dir, tag, t)
		if err == nil {
			return f, name, err
		}
		return nil, "", fmt.Errorf("log: cannot create log: %v", err)
	}

	onceLogDirs.Do(createLogDirs)
	if len(logDirs) == 0 {
		return nil, "", errors.New("log: no log dirs")
	}
	var lastErr error
	for _, dir := range logDirs {
		f, name, err := createInDir(dir, tag, t)
		if err == nil {
			return f, name, err
		}
		lastErr = err
	}
	return nil, "", fmt.Errorf("log: cannot create log: %v", lastErr)
}

func createInDir(dir, tag string, t time.Time) (f *os.File, name string, err error) {
	name, link := logName(tag, t)
	fname := filepath.Join(dir, name)
	// O_EXCL is important here, as it prevents a vulnerability. The general idea is that logs often
	// live in an insecure directory (like /tmp), so an unprivileged attacker could create fname in
	// advance as a symlink to a file the logging process can access, but the attacker cannot. O_EXCL
	// fails the open if it already exists, thus prevent our this code from opening the existing file
	// the attacker points us to.
	f, err = os.OpenFile(fname, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0666)
	if err == nil {
		symlink := filepath.Join(dir, link)
		os.Remove(symlink)        // ignore err
		os.Symlink(name, symlink) // ignore err
		if *logLink != "" {
			lsymlink := filepath.Join(*logLink, link)
			os.Remove(lsymlink)         // ignore err
			os.Symlink(fname, lsymlink) // ignore err
		}
		return f, fname, nil
	}
	return nil, "", err
}

// flushSyncWriter is the interface satisfied by logging destinations.
type flushSyncWriter interface {
	Flush() error
	Sync() error
	io.Writer
	filenames() []string
}

var sinks struct {
	stderr stderrSink
	file   fileSink
}

func init() {
	// Register stderr first: that way if we crash during file-writing at least
	// the log will have gone somewhere.
	if shouldRegisterStderrSink() {
		logsink.TextSinks = append(logsink.TextSinks, &sinks.stderr)
	}
	logsink.TextSinks = append(logsink.TextSinks, &sinks.file)

	sinks.file.flushChan = make(chan logsink.Severity, 1)
	go sinks.file.flushDaemon()
}

// stderrSink is a logsink.Text that writes log entries to stderr
// if they meet certain conditions.
type stderrSink struct {
	mu sync.Mutex
	w  io.Writer // if nil Emit uses os.Stderr directly
}

// Enabled implements logsink.Text.Enabled.  It returns true if any of the
// various stderr flags are enabled for logs of the given severity, if the log
// message is from the standard "log" package, or if google.Init has not yet run
// (and hence file logging is not yet initialized).
func (s *stderrSink) Enabled(m *logsink.Meta) bool {
	return toStderr || alsoToStderr || m.Severity >= stderrThreshold.get()
}

// Emit implements logsink.Text.Emit.
func (s *stderrSink) Emit(m *logsink.Meta, data []byte) (n int, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w := s.w
	if w == nil {
		w = os.Stderr
	}
	dn, err := w.Write(data)
	n += dn
	return n, err
}

// severityWriters is an array of flushSyncWriter with a value for each
// logsink.Severity.
type severityWriters [4]flushSyncWriter

// fileSink is a logsink.Text that prints to a set of Google log files.
type fileSink struct {
	mu sync.Mutex
	// file holds writer for each of the log types.
	file      severityWriters
	flushChan chan logsink.Severity
}

// Enabled implements logsink.Text.Enabled.  It returns true if google.Init
// has run and both --disable_log_to_disk and --logtostderr are false.
func (s *fileSink) Enabled(m *logsink.Meta) bool {
	return !toStderr
}

// Emit implements logsink.Text.Emit
func (s *fileSink) Emit(m *logsink.Meta, data []byte) (n int, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err = s.createMissingFiles(m.Severity); err != nil {
		return 0, err
	}
	for sev := m.Severity; sev >= logsink.Info; sev-- {
		if _, fErr := s.file[sev].Write(data); fErr != nil && err == nil {
			err = fErr // Take the first error.
		}
	}
	n = len(data)
	if int(m.Severity) > *logBufLevel {
		select {
		case s.flushChan <- m.Severity:
		default:
		}
	}

	return n, err
}

// syncBuffer joins a bufio.Writer to its underlying file, providing access to the
// file's Sync method and providing a wrapper for the Write method that provides log
// file rotation. There are conflicting methods, so the file cannot be embedded.
// s.mu is held for all its methods.
type syncBuffer struct {
	sink *fileSink
	*bufio.Writer
	file   *os.File
	names  []string
	sev    logsink.Severity
	nbytes uint64 // The number of bytes written to this file
	madeAt time.Time
}

func (sb *syncBuffer) Sync() error {
	return sb.file.Sync()
}

func (sb *syncBuffer) Write(p []byte) (n int, err error) {
	// Rotate the file if it is too large, but ensure we only do so,
	// if rotate doesn't create a conflicting filename.
	if sb.nbytes+uint64(len(p)) >= MaxSize {
		now := timeNow()
		if now.After(sb.madeAt.Add(1*time.Second)) || now.Second() != sb.madeAt.Second() {
			if err := sb.rotateFile(now); err != nil {
				return 0, err
			}
		}
	}
	n, err = sb.Writer.Write(p)
	sb.nbytes += uint64(n)
	return n, err
}

func (sb *syncBuffer) filenames() []string {
	return sb.names
}

const footer = "\nCONTINUED IN NEXT FILE\n"

// rotateFile closes the syncBuffer's file and starts a new one.
func (sb *syncBuffer) rotateFile(now time.Time) error {
	var err error
	pn := "<none>"
	file, name, err := create(sb.sev.String(), now, "")
	sb.madeAt = now

	if sb.file != nil {
		// The current log file becomes the previous log at the end of
		// this block, so save its name for use in the header of the next
		// file.
		pn = sb.file.Name()
		sb.Flush()
		// If there's an existing file, write a footer with the name of
		// the next file in the chain, followed by the constant string
		// \nCONTINUED IN NEXT FILE\n to make continuation detection simple.
		sb.file.Write([]byte("Next log: "))
		sb.file.Write([]byte(name))
		sb.file.Write([]byte(footer))
		sb.file.Close()
	}

	sb.file = file
	sb.names = append(sb.names, name)
	sb.nbytes = 0
	if err != nil {
		return err
	}

	sb.Writer = bufio.NewWriterSize(sb.file, bufferSize)

	// Write header.
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "Log file created at: %s\n", now.Format("2006/01/02 15:04:05"))
	fmt.Fprintf(&buf, "Running on machine: %s\n", host)
	fmt.Fprintf(&buf, "Binary: Built with %s %s for %s/%s\n", runtime.Compiler, runtime.Version(), runtime.GOOS, runtime.GOARCH)
	fmt.Fprintf(&buf, "Previous log: %s\n", pn)
	fmt.Fprintf(&buf, "Log line format: [IWEF]mmdd hh:mm:ss.uuuuuu threadid file:line] msg\n")
	n, err := sb.file.Write(buf.Bytes())
	sb.nbytes += uint64(n)
	return err
}

// bufferSize sizes the buffer associated with each log file. It's large
// so that log records can accumulate without the logging thread blocking
// on disk I/O. The flushDaemon will block instead.
const bufferSize = 256 * 1024

// createMissingFiles creates all the log files for severity from infoLog up to
// upTo that have not already been created.
// s.mu is held.
func (s *fileSink) createMissingFiles(upTo logsink.Severity) error {
	if s.file[upTo] != nil {
		return nil
	}
	now := time.Now()
	// Files are created in increasing severity order, so we can be assured that
	// if a high severity logfile exists, then so do all of lower severity.
	for sev := logsink.Info; sev <= upTo; sev++ {
		if s.file[sev] != nil {
			continue
		}
		sb := &syncBuffer{
			sink: s,
			sev:  sev,
		}
		if err := sb.rotateFile(now); err != nil {
			return err
		}
		s.file[sev] = sb
	}
	return nil
}

// flushDaemon periodically flushes the log file buffers.
func (s *fileSink) flushDaemon() {
	tick := time.NewTicker(30 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-tick.C:
			s.Flush()
		case sev := <-s.flushChan:
			s.flush(sev)
		}
	}
}

// Flush flushes all pending log I/O.
func Flush() {
	sinks.file.Flush()
}

// Flush flushes all the logs and attempts to "sync" their data to disk.
func (s *fileSink) Flush() error {
	return s.flush(logsink.Info)
}

// flush flushes all logs of severity threshold or greater.
func (s *fileSink) flush(threshold logsink.Severity) error {
	var firstErr error
	updateErr := func(err error) {
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	// Remember where we flushed, so we can call sync without holding
	// the lock.
	var files []flushSyncWriter
	func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		// Flush from fatal down, in case there's trouble flushing.
		for sev := logsink.Fatal; sev >= threshold; sev-- {
			if file := s.file[sev]; file != nil {
				updateErr(file.Flush())
				files = append(files, file)
			}
		}
	}()

	for _, file := range files {
		updateErr(file.Sync())
	}

	return firstErr
}

// Names returns the names of the log files holding the FATAL, ERROR,
// WARNING, or INFO logs. Returns ErrNoLog if the log for the given
// level doesn't exist (e.g. because no messages of that level have been
// written). This may return multiple names if the log type requested
// has rolled over.
func Names(s string) ([]string, error) {
	severity, err := logsink.ParseSeverity(s)
	if err != nil {
		return nil, err
	}

	sinks.file.mu.Lock()
	defer sinks.file.mu.Unlock()
	f := sinks.file.file[severity]
	if f == nil {
		return nil, ErrNoLog
	}

	return f.filenames(), nil
}
