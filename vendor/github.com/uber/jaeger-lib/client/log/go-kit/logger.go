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

package xkit

import (
	"fmt"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
)

// LoggerOption sets a parameter for the Logger.
type LoggerOption func(*Logger)

// MessageKey sets the key for the actual log message. By default, it's "msg".
func MessageKey(key string) LoggerOption {
	return func(l *Logger) { l.messageKey = key }
}

// Logger wraps a go-kit logger instance in a Jaeger client compatible one.
type Logger struct {
	infoLogger  log.Logger
	errorLogger log.Logger

	messageKey string
}

// NewLogger creates a new Jaeger client logger from a go-kit one.
func NewLogger(kitlogger log.Logger, options ...LoggerOption) *Logger {
	logger := &Logger{
		infoLogger:  level.Info(kitlogger),
		errorLogger: level.Error(kitlogger),

		messageKey: "msg",
	}

	for _, option := range options {
		option(logger)
	}

	return logger
}

// Error implements the github.com/uber/jaeger-client-go/log.Logger interface.
func (l *Logger) Error(msg string) {
	l.errorLogger.Log(l.messageKey, msg)
}

// Infof implements the github.com/uber/jaeger-client-go/log.Logger interface.
func (l *Logger) Infof(msg string, args ...interface{}) {
	l.infoLogger.Log(l.messageKey, fmt.Sprintf(msg, args...))
}
