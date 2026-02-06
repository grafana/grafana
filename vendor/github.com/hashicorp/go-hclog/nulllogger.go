// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MIT

package hclog

import (
	"io"
	"io/ioutil"
	"log"
)

// NewNullLogger instantiates a Logger for which all calls
// will succeed without doing anything.
// Useful for testing purposes.
func NewNullLogger() Logger {
	return &nullLogger{}
}

type nullLogger struct{}

func (l *nullLogger) Log(level Level, msg string, args ...interface{}) {}

func (l *nullLogger) Trace(msg string, args ...interface{}) {}

func (l *nullLogger) Debug(msg string, args ...interface{}) {}

func (l *nullLogger) Info(msg string, args ...interface{}) {}

func (l *nullLogger) Warn(msg string, args ...interface{}) {}

func (l *nullLogger) Error(msg string, args ...interface{}) {}

func (l *nullLogger) IsTrace() bool { return false }

func (l *nullLogger) IsDebug() bool { return false }

func (l *nullLogger) IsInfo() bool { return false }

func (l *nullLogger) IsWarn() bool { return false }

func (l *nullLogger) IsError() bool { return false }

func (l *nullLogger) ImpliedArgs() []interface{} { return []interface{}{} }

func (l *nullLogger) With(args ...interface{}) Logger { return l }

func (l *nullLogger) Name() string { return "" }

func (l *nullLogger) Named(name string) Logger { return l }

func (l *nullLogger) ResetNamed(name string) Logger { return l }

func (l *nullLogger) SetLevel(level Level) {}

func (l *nullLogger) GetLevel() Level { return NoLevel }

func (l *nullLogger) StandardLogger(opts *StandardLoggerOptions) *log.Logger {
	return log.New(l.StandardWriter(opts), "", log.LstdFlags)
}

func (l *nullLogger) StandardWriter(opts *StandardLoggerOptions) io.Writer {
	return ioutil.Discard
}
