package hclog

import (
	"log"
	"io/ioutil"
)

// NewNullLogger instantiates a Logger for which all calls
// will succeed without doing anything.
// Useful for testing purposes.
func NewNullLogger() Logger {
	return &nullLogger{}
}

type nullLogger struct{}

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

func (l *nullLogger) With(args ...interface{}) Logger { return l }

func (l *nullLogger) Named(name string) Logger { return l }

func (l *nullLogger) ResetNamed(name string) Logger { return l }

func (l *nullLogger) StandardLogger(opts *StandardLoggerOptions) *log.Logger {
	return log.New(ioutil.Discard, "", log.LstdFlags)
}