// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MIT

package hclog

import (
	"io"
	"log"
	"sync"
	"sync/atomic"
)

var _ Logger = &interceptLogger{}

type interceptLogger struct {
	Logger

	mu        *sync.Mutex
	sinkCount *int32
	Sinks     map[SinkAdapter]struct{}
}

func NewInterceptLogger(opts *LoggerOptions) InterceptLogger {
	l := newLogger(opts)
	if l.callerOffset > 0 {
		// extra frames for interceptLogger.{Warn,Info,Log,etc...}, and interceptLogger.log
		l.callerOffset += 2
	}
	intercept := &interceptLogger{
		Logger:    l,
		mu:        new(sync.Mutex),
		sinkCount: new(int32),
		Sinks:     make(map[SinkAdapter]struct{}),
	}

	atomic.StoreInt32(intercept.sinkCount, 0)

	return intercept
}

func (i *interceptLogger) Log(level Level, msg string, args ...interface{}) {
	i.log(level, msg, args...)
}

// log is used to make the caller stack frame lookup consistent. If Warn,Info,etc
// all called Log then direct calls to Log would have a different stack frame
// depth. By having all the methods call the same helper we ensure the stack
// frame depth is the same.
func (i *interceptLogger) log(level Level, msg string, args ...interface{}) {
	i.Logger.Log(level, msg, args...)
	if atomic.LoadInt32(i.sinkCount) == 0 {
		return
	}

	i.mu.Lock()
	defer i.mu.Unlock()
	for s := range i.Sinks {
		s.Accept(i.Name(), level, msg, i.retrieveImplied(args...)...)
	}
}

// Emit the message and args at TRACE level to log and sinks
func (i *interceptLogger) Trace(msg string, args ...interface{}) {
	i.log(Trace, msg, args...)
}

// Emit the message and args at DEBUG level to log and sinks
func (i *interceptLogger) Debug(msg string, args ...interface{}) {
	i.log(Debug, msg, args...)
}

// Emit the message and args at INFO level to log and sinks
func (i *interceptLogger) Info(msg string, args ...interface{}) {
	i.log(Info, msg, args...)
}

// Emit the message and args at WARN level to log and sinks
func (i *interceptLogger) Warn(msg string, args ...interface{}) {
	i.log(Warn, msg, args...)
}

// Emit the message and args at ERROR level to log and sinks
func (i *interceptLogger) Error(msg string, args ...interface{}) {
	i.log(Error, msg, args...)
}

func (i *interceptLogger) retrieveImplied(args ...interface{}) []interface{} {
	top := i.Logger.ImpliedArgs()

	cp := make([]interface{}, len(top)+len(args))
	copy(cp, top)
	copy(cp[len(top):], args)

	return cp
}

// Create a new sub-Logger that a name descending from the current name.
// This is used to create a subsystem specific Logger.
// Registered sinks will subscribe to these messages as well.
func (i *interceptLogger) Named(name string) Logger {
	return i.NamedIntercept(name)
}

// Create a new sub-Logger with an explicit name. This ignores the current
// name. This is used to create a standalone logger that doesn't fall
// within the normal hierarchy. Registered sinks will subscribe
// to these messages as well.
func (i *interceptLogger) ResetNamed(name string) Logger {
	return i.ResetNamedIntercept(name)
}

// Create a new sub-Logger that a name decending from the current name.
// This is used to create a subsystem specific Logger.
// Registered sinks will subscribe to these messages as well.
func (i *interceptLogger) NamedIntercept(name string) InterceptLogger {
	var sub interceptLogger

	sub = *i
	sub.Logger = i.Logger.Named(name)
	return &sub
}

// Create a new sub-Logger with an explicit name. This ignores the current
// name. This is used to create a standalone logger that doesn't fall
// within the normal hierarchy. Registered sinks will subscribe
// to these messages as well.
func (i *interceptLogger) ResetNamedIntercept(name string) InterceptLogger {
	var sub interceptLogger

	sub = *i
	sub.Logger = i.Logger.ResetNamed(name)
	return &sub
}

// Return a sub-Logger for which every emitted log message will contain
// the given key/value pairs. This is used to create a context specific
// Logger.
func (i *interceptLogger) With(args ...interface{}) Logger {
	var sub interceptLogger

	sub = *i

	sub.Logger = i.Logger.With(args...)

	return &sub
}

// RegisterSink attaches a SinkAdapter to interceptLoggers sinks.
func (i *interceptLogger) RegisterSink(sink SinkAdapter) {
	i.mu.Lock()
	defer i.mu.Unlock()

	i.Sinks[sink] = struct{}{}

	atomic.AddInt32(i.sinkCount, 1)
}

// DeregisterSink removes a SinkAdapter from interceptLoggers sinks.
func (i *interceptLogger) DeregisterSink(sink SinkAdapter) {
	i.mu.Lock()
	defer i.mu.Unlock()

	delete(i.Sinks, sink)

	atomic.AddInt32(i.sinkCount, -1)
}

func (i *interceptLogger) StandardLoggerIntercept(opts *StandardLoggerOptions) *log.Logger {
	return i.StandardLogger(opts)
}

func (i *interceptLogger) StandardLogger(opts *StandardLoggerOptions) *log.Logger {
	if opts == nil {
		opts = &StandardLoggerOptions{}
	}

	return log.New(i.StandardWriter(opts), "", 0)
}

func (i *interceptLogger) StandardWriterIntercept(opts *StandardLoggerOptions) io.Writer {
	return i.StandardWriter(opts)
}

func (i *interceptLogger) StandardWriter(opts *StandardLoggerOptions) io.Writer {
	return &stdlogAdapter{
		log:                      i,
		inferLevels:              opts.InferLevels,
		inferLevelsWithTimestamp: opts.InferLevelsWithTimestamp,
		forceLevel:               opts.ForceLevel,
	}
}

func (i *interceptLogger) ResetOutput(opts *LoggerOptions) error {
	if or, ok := i.Logger.(OutputResettable); ok {
		return or.ResetOutput(opts)
	} else {
		return nil
	}
}

func (i *interceptLogger) ResetOutputWithFlush(opts *LoggerOptions, flushable Flushable) error {
	if or, ok := i.Logger.(OutputResettable); ok {
		return or.ResetOutputWithFlush(opts, flushable)
	} else {
		return nil
	}
}
