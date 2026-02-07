// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package log defines Logging API.
// The global Log variable contains the actual logger. Set it to own implementation to override logging. Set it to nil to disable logging
package log

import (
	"fmt"
	"log"
	"sync"
)

// Log is the library wide logger. Setting to nil disables logging.
var Log Logger = &logger{logLevel: ErrorLevel, prefix: "influxdb2client"}

// Log levels
const (
	ErrorLevel uint = iota
	WarningLevel
	InfoLevel
	DebugLevel
)

// Logger defines interface for logging
type Logger interface {
	// Writes formatted debug message if debug logLevel is enabled.
	Debugf(format string, v ...interface{})
	// Writes debug message if debug is enabled.
	Debug(msg string)
	// Writes formatted info message if info logLevel is enabled.
	Infof(format string, v ...interface{})
	// Writes info message if info logLevel is enabled
	Info(msg string)
	// Writes formatted warning message if warning logLevel is enabled.
	Warnf(format string, v ...interface{})
	// Writes warning message if warning logLevel is enabled.
	Warn(msg string)
	// Writes formatted error message
	Errorf(format string, v ...interface{})
	// Writes error message
	Error(msg string)
	// SetLogLevel sets allowed logging level.
	SetLogLevel(logLevel uint)
	// LogLevel retrieves current logging level
	LogLevel() uint
	// SetPrefix sets logging prefix.
	SetPrefix(prefix string)
}

// logger provides default implementation for Logger. It logs using Go log API
// mutex is needed in cases when multiple clients run concurrently
type logger struct {
	prefix   string
	logLevel uint
	lock     sync.Mutex
}

func (l *logger) SetLogLevel(logLevel uint) {
	l.lock.Lock()
	defer l.lock.Unlock()
	l.logLevel = logLevel
}

func (l *logger) LogLevel() uint {
	l.lock.Lock()
	defer l.lock.Unlock()
	return l.logLevel
}

func (l *logger) SetPrefix(prefix string) {
	l.lock.Lock()
	defer l.lock.Unlock()
	l.prefix = prefix
}

func (l *logger) Debugf(format string, v ...interface{}) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if l.logLevel >= DebugLevel {
		log.Print(l.prefix, " D! ", fmt.Sprintf(format, v...))
	}
}
func (l *logger) Debug(msg string) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if l.logLevel >= DebugLevel {
		log.Print(l.prefix, " D! ", msg)
	}
}

func (l *logger) Infof(format string, v ...interface{}) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if l.logLevel >= InfoLevel {
		log.Print(l.prefix, " I! ", fmt.Sprintf(format, v...))
	}
}
func (l *logger) Info(msg string) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if l.logLevel >= DebugLevel {
		log.Print(l.prefix, " I! ", msg)
	}
}

func (l *logger) Warnf(format string, v ...interface{}) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if l.logLevel >= WarningLevel {
		log.Print(l.prefix, " W! ", fmt.Sprintf(format, v...))
	}
}
func (l *logger) Warn(msg string) {
	l.lock.Lock()
	defer l.lock.Unlock()
	if l.logLevel >= WarningLevel {
		log.Print(l.prefix, " W! ", msg)
	}
}

func (l *logger) Errorf(format string, v ...interface{}) {
	l.lock.Lock()
	defer l.lock.Unlock()
	log.Print(l.prefix, " E! ", fmt.Sprintf(format, v...))
}

func (l *logger) Error(msg string) {
	l.lock.Lock()
	defer l.lock.Unlock()
	log.Print(l.prefix, " E! ", msg)
}
