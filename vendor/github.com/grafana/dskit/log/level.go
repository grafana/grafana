// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/logging/level.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package log

// Copy-pasted from prometheus/common/promlog.
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

import (
	"flag"

	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
)

// Level is a settable identifier for the minimum level a log entry must have.
type Level struct {
	s      string
	Option level.Option
}

// RegisterFlags adds the log level flag to the provided flagset.
func (l *Level) RegisterFlags(f *flag.FlagSet) {
	_ = l.Set("info")
	f.Var(l, "log.level", "Only log messages with the given severity or above. Valid levels: [debug, info, warn, error]")
}

func (l *Level) String() string {
	return l.s
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (l *Level) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var level string
	if err := unmarshal(&level); err != nil {
		return err
	}
	return l.Set(level)
}

// MarshalYAML implements yaml.Marshaler.
func (l Level) MarshalYAML() (interface{}, error) {
	return l.String(), nil
}

// Set updates the value of the allowed level.  Implments flag.Value.
func (l *Level) Set(s string) error {
	switch s {
	case "debug":
		l.Option = level.AllowDebug()
	case "info":
		l.Option = level.AllowInfo()
	case "warn":
		l.Option = level.AllowWarn()
	case "error":
		l.Option = level.AllowError()
	default:
		return errors.Errorf("unrecognized log level %q", s)
	}

	l.s = s
	return nil
}
