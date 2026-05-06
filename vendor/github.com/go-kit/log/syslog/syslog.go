//go:build !windows && !plan9 && !nacl
// +build !windows,!plan9,!nacl

// Package syslog provides a Logger that writes to syslog.
package syslog

import (
	"bytes"
	"io"
	"sync"

	gosyslog "log/syslog"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

// SyslogWriter is an interface wrapping stdlib syslog Writer.
type SyslogWriter interface {
	Write([]byte) (int, error)
	Close() error
	Emerg(string) error
	Alert(string) error
	Crit(string) error
	Err(string) error
	Warning(string) error
	Notice(string) error
	Info(string) error
	Debug(string) error
}

// NewSyslogLogger returns a new Logger which writes to syslog in syslog format.
// The body of the log message is the formatted output from the Logger returned
// by newLogger.
func NewSyslogLogger(w SyslogWriter, newLogger func(io.Writer) log.Logger, options ...Option) log.Logger {
	l := &syslogLogger{
		w:                w,
		newLogger:        newLogger,
		prioritySelector: defaultPrioritySelector,
		bufPool: sync.Pool{New: func() interface{} {
			return &loggerBuf{}
		}},
	}

	for _, option := range options {
		option(l)
	}

	return l
}

type syslogLogger struct {
	w                SyslogWriter
	newLogger        func(io.Writer) log.Logger
	prioritySelector PrioritySelector
	bufPool          sync.Pool
}

func (l *syslogLogger) Log(keyvals ...interface{}) error {
	level := l.prioritySelector(keyvals...)

	lb := l.getLoggerBuf()
	defer l.putLoggerBuf(lb)
	if err := lb.logger.Log(keyvals...); err != nil {
		return err
	}

	switch level {
	case gosyslog.LOG_EMERG:
		return l.w.Emerg(lb.buf.String())
	case gosyslog.LOG_ALERT:
		return l.w.Alert(lb.buf.String())
	case gosyslog.LOG_CRIT:
		return l.w.Crit(lb.buf.String())
	case gosyslog.LOG_ERR:
		return l.w.Err(lb.buf.String())
	case gosyslog.LOG_WARNING:
		return l.w.Warning(lb.buf.String())
	case gosyslog.LOG_NOTICE:
		return l.w.Notice(lb.buf.String())
	case gosyslog.LOG_INFO:
		return l.w.Info(lb.buf.String())
	case gosyslog.LOG_DEBUG:
		return l.w.Debug(lb.buf.String())
	default:
		_, err := l.w.Write(lb.buf.Bytes())
		return err
	}
}

type loggerBuf struct {
	buf    *bytes.Buffer
	logger log.Logger
}

func (l *syslogLogger) getLoggerBuf() *loggerBuf {
	lb := l.bufPool.Get().(*loggerBuf)
	if lb.buf == nil {
		lb.buf = &bytes.Buffer{}
		lb.logger = l.newLogger(lb.buf)
	} else {
		lb.buf.Reset()
	}
	return lb
}

func (l *syslogLogger) putLoggerBuf(lb *loggerBuf) {
	l.bufPool.Put(lb)
}

// Option sets a parameter for syslog loggers.
type Option func(*syslogLogger)

// PrioritySelector inspects the list of keyvals and selects a syslog priority.
type PrioritySelector func(keyvals ...interface{}) gosyslog.Priority

// PrioritySelectorOption sets priority selector function to choose syslog
// priority.
func PrioritySelectorOption(selector PrioritySelector) Option {
	return func(l *syslogLogger) { l.prioritySelector = selector }
}

func defaultPrioritySelector(keyvals ...interface{}) gosyslog.Priority {
	l := len(keyvals)
	for i := 0; i < l; i += 2 {
		if keyvals[i] == level.Key() {
			var val interface{}
			if i+1 < l {
				val = keyvals[i+1]
			}
			if v, ok := val.(level.Value); ok {
				switch v {
				case level.DebugValue():
					return gosyslog.LOG_DEBUG
				case level.InfoValue():
					return gosyslog.LOG_INFO
				case level.WarnValue():
					return gosyslog.LOG_WARNING
				case level.ErrorValue():
					return gosyslog.LOG_ERR
				}
			}
		}
	}

	return gosyslog.LOG_INFO
}
