// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package log

import (
	"bytes"
	"fmt"
	"log"
	"sync"
)

// Logger provides an abstract interface for logging from Reporters.
// Applications can provide their own implementation of this interface to adapt
// reporters logging to whatever logging library they prefer (stdlib log,
// logrus, go-logging, etc).
type Logger interface {
	// Error logs a message at error priority
	Error(msg string)

	// Infof logs a message at info priority
	Infof(msg string, args ...interface{})
}

// StdLogger is implementation of the Logger interface that delegates to default `log` package
var StdLogger = &stdLogger{}

type stdLogger struct{}

func (l *stdLogger) Error(msg string) {
	log.Printf("ERROR: %s", msg)
}

// Infof logs a message at info priority
func (l *stdLogger) Infof(msg string, args ...interface{}) {
	log.Printf(msg, args...)
}

// Debugf logs a message at debug priority
func (l *stdLogger) Debugf(msg string, args ...interface{}) {
	log.Printf(fmt.Sprintf("DEBUG: %s", msg), args...)
}

// NullLogger is implementation of the Logger interface that is no-op
var NullLogger = &nullLogger{}

type nullLogger struct{}

func (l *nullLogger) Error(msg string)                       {}
func (l *nullLogger) Infof(msg string, args ...interface{})  {}
func (l *nullLogger) Debugf(msg string, args ...interface{}) {}

// BytesBufferLogger implements Logger backed by a bytes.Buffer.
type BytesBufferLogger struct {
	mux sync.Mutex
	buf bytes.Buffer
}

// Error implements Logger.
func (l *BytesBufferLogger) Error(msg string) {
	l.mux.Lock()
	l.buf.WriteString(fmt.Sprintf("ERROR: %s\n", msg))
	l.mux.Unlock()
}

// Infof implements Logger.
func (l *BytesBufferLogger) Infof(msg string, args ...interface{}) {
	l.mux.Lock()
	l.buf.WriteString("INFO: " + fmt.Sprintf(msg, args...) + "\n")
	l.mux.Unlock()
}

// Debugf implements Logger.
func (l *BytesBufferLogger) Debugf(msg string, args ...interface{}) {
	l.mux.Lock()
	l.buf.WriteString("DEBUG: " + fmt.Sprintf(msg, args...) + "\n")
	l.mux.Unlock()
}

// String returns string representation of the underlying buffer.
func (l *BytesBufferLogger) String() string {
	l.mux.Lock()
	defer l.mux.Unlock()
	return l.buf.String()
}

// Flush empties the underlying buffer.
func (l *BytesBufferLogger) Flush() {
	l.mux.Lock()
	defer l.mux.Unlock()
	l.buf.Reset()
}

// DebugLogger is an interface which adds a debug logging level
type DebugLogger interface {
	Logger

	// Debugf logs a message at debug priority
	Debugf(msg string, args ...interface{})
}

// DebugLogAdapter is a log adapter that converts a Logger into a DebugLogger
// If the provided Logger doesn't satisfy the interface, a logger with debug
// disabled is returned
func DebugLogAdapter(logger Logger) DebugLogger {
	if logger == nil {
		return nil
	}
	if debugLogger, ok := logger.(DebugLogger); ok {
		return debugLogger
	}
	logger.Infof("debug logging disabled")
	return debugDisabledLogAdapter{logger: logger}
}

type debugDisabledLogAdapter struct {
	logger Logger
}

func (d debugDisabledLogAdapter) Error(msg string) {
	d.logger.Error(msg)
}

func (d debugDisabledLogAdapter) Infof(msg string, args ...interface{}) {
	d.logger.Infof(msg, args...)
}

// Debugf is a nop
func (d debugDisabledLogAdapter) Debugf(msg string, args ...interface{}) {
}
