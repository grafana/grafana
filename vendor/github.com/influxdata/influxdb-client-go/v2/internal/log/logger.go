// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package log provides internal logging infrastructure
package log

import (
	ilog "github.com/influxdata/influxdb-client-go/v2/log"
)

// Debugf writes formatted debug message to the Logger instance
func Debugf(format string, v ...interface{}) {
	if ilog.Log != nil {
		ilog.Log.Debugf(format, v...)
	}
}

// Debug writes debug message message to the Logger instance
func Debug(msg string) {
	if ilog.Log != nil {
		ilog.Log.Debug(msg)
	}
}

// Infof writes formatted info message to the Logger instance
func Infof(format string, v ...interface{}) {
	if ilog.Log != nil {
		ilog.Log.Infof(format, v...)
	}
}

// Info writes info message message to the Logger instance
func Info(msg string) {
	if ilog.Log != nil {
		ilog.Log.Info(msg)
	}
}

// Warnf writes formatted warning message to the Logger instance
func Warnf(format string, v ...interface{}) {
	if ilog.Log != nil {
		ilog.Log.Warnf(format, v...)
	}
}

// Warn writes warning message message to the Logger instance
func Warn(msg string) {
	if ilog.Log != nil {
		ilog.Log.Warn(msg)
	}
}

// Errorf writes formatted error message to the Logger instance
func Errorf(format string, v ...interface{}) {
	if ilog.Log != nil {
		ilog.Log.Errorf(format, v...)
	}
}

// Error writes error message message to the Logger instance
func Error(msg string) {
	if ilog.Log != nil {
		ilog.Log.Error(msg)
	}
}

// Level retrieves current logging level form the Logger instance
func Level() uint {
	if ilog.Log != nil {
		return ilog.Log.LogLevel()
	}
	return ilog.ErrorLevel
}
