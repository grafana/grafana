// Copyright 2017 The Prometheus Authors
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

// Package promlog defines standardised ways to initialize Go kit loggers
// across Prometheus components.
// It should typically only ever be imported by main packages.
package promlog

import (
	"os"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/pkg/errors"
)

// AllowedLevel is a settable identifier for the minimum level a log entry
// must be have.
type AllowedLevel struct {
	s string
	o level.Option
}

func (l *AllowedLevel) String() string {
	return l.s
}

// Set updates the value of the allowed level.
func (l *AllowedLevel) Set(s string) error {
	switch s {
	case "debug":
		l.o = level.AllowDebug()
	case "info":
		l.o = level.AllowInfo()
	case "warn":
		l.o = level.AllowWarn()
	case "error":
		l.o = level.AllowError()
	default:
		return errors.Errorf("unrecognized log level %q", s)
	}
	l.s = s
	return nil
}

// New returns a new leveled oklog logger in the logfmt format. Each logged line will be annotated
// with a timestamp. The output always goes to stderr.
func New(al AllowedLevel) log.Logger {
	l := log.NewLogfmtLogger(log.NewSyncWriter(os.Stderr))
	l = level.NewFilter(l, al.o)
	l = log.With(l, "ts", log.DefaultTimestampUTC, "caller", log.DefaultCaller)
	return l
}
