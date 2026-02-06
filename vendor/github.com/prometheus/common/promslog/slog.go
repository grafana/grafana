// Copyright 2024 The Prometheus Authors
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

// Package promslog defines standardised ways to initialize the Go standard
// library's log/slog logger.
// It should typically only ever be imported by main packages.

package promslog

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// LogStyle represents the common logging formats in the Prometheus ecosystem.
type LogStyle string

const (
	SlogStyle  LogStyle = "slog"
	GoKitStyle LogStyle = "go-kit"

	reservedKeyPrefix = "logged_"
)

var (
	// LevelFlagOptions represents allowed logging levels.
	LevelFlagOptions = []string{"debug", "info", "warn", "error"}
	// FormatFlagOptions represents allowed formats.
	FormatFlagOptions = []string{"logfmt", "json"}

	defaultWriter = os.Stderr
)

// Level controls a logging level, with an info default.
// It wraps slog.LevelVar with string-based level control.
// Level is safe to be used concurrently.
type Level struct {
	lvl *slog.LevelVar
}

// NewLevel returns a new Level.
func NewLevel() *Level {
	return &Level{
		lvl: &slog.LevelVar{},
	}
}

func (l *Level) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	type plain string
	if err := unmarshal((*plain)(&s)); err != nil {
		return err
	}
	if s == "" {
		return nil
	}
	if err := l.Set(s); err != nil {
		return err
	}
	return nil
}

// Level returns the value of the logging level as an slog.Level.
func (l *Level) Level() slog.Level {
	return l.lvl.Level()
}

// String returns the current level.
func (l *Level) String() string {
	switch l.lvl.Level() {
	case slog.LevelDebug:
		return "debug"
	case slog.LevelInfo:
		return "info"
	case slog.LevelWarn:
		return "warn"
	case slog.LevelError:
		return "error"
	default:
		return ""
	}
}

// Set updates the logging level with the validation.
func (l *Level) Set(s string) error {
	switch strings.ToLower(s) {
	case "debug":
		l.lvl.Set(slog.LevelDebug)
	case "info":
		l.lvl.Set(slog.LevelInfo)
	case "warn":
		l.lvl.Set(slog.LevelWarn)
	case "error":
		l.lvl.Set(slog.LevelError)
	default:
		return fmt.Errorf("unrecognized log level %s", s)
	}
	return nil
}

// Format controls a logging output format.
// Not concurrency-safe.
type Format struct {
	s string
}

// NewFormat creates a new Format.
func NewFormat() *Format { return &Format{} }

func (f *Format) String() string {
	return f.s
}

// Set updates the value of the allowed format.
func (f *Format) Set(s string) error {
	switch s {
	case "logfmt", "json":
		f.s = s
	default:
		return fmt.Errorf("unrecognized log format %s", s)
	}
	return nil
}

// Config is a struct containing configurable settings for the logger.
type Config struct {
	Level  *Level
	Format *Format
	Style  LogStyle
	Writer io.Writer
}

func newGoKitStyleReplaceAttrFunc(lvl *Level) func(groups []string, a slog.Attr) slog.Attr {
	return func(_ []string, a slog.Attr) slog.Attr {
		key := a.Key
		switch key {
		case slog.TimeKey, "ts":
			if t, ok := a.Value.Any().(time.Time); ok {
				a.Key = "ts"

				// This timestamp format differs from RFC3339Nano by using .000 instead
				// of .999999999 which changes the timestamp from 9 variable to 3 fixed
				// decimals (.130 instead of .130987456).
				a.Value = slog.StringValue(t.UTC().Format("2006-01-02T15:04:05.000Z07:00"))
			} else {
				// If we can't cast the any from the value to a
				// time.Time, it means the caller logged
				// another attribute with a key of `ts`.
				// Prevent duplicate keys (necessary for proper
				// JSON) by renaming the key to `logged_ts`.
				a.Key = reservedKeyPrefix + key
			}
		case slog.SourceKey, "caller":
			if src, ok := a.Value.Any().(*slog.Source); ok {
				a.Key = "caller"
				switch lvl.String() {
				case "debug":
					a.Value = slog.StringValue(filepath.Base(src.File) + "(" + filepath.Base(src.Function) + "):" + strconv.Itoa(src.Line))
				default:
					a.Value = slog.StringValue(filepath.Base(src.File) + ":" + strconv.Itoa(src.Line))
				}
			} else {
				// If we can't cast the any from the value to
				// an *slog.Source, it means the caller logged
				// another attribute with a key of `caller`.
				// Prevent duplicate keys (necessary for proper
				// JSON) by renaming the key to
				// `logged_caller`.
				a.Key = reservedKeyPrefix + key
			}
		case slog.LevelKey:
			if lvl, ok := a.Value.Any().(slog.Level); ok {
				a.Value = slog.StringValue(strings.ToLower(lvl.String()))
			} else {
				// If we can't cast the any from the value to
				// an slog.Level, it means the caller logged
				// another attribute with a key of `level`.
				// Prevent duplicate keys (necessary for proper
				// JSON) by renaming the key to `logged_level`.
				a.Key = reservedKeyPrefix + key
			}
		default:
		}

		// Ensure time.Duration values are _always_ formatted as a Go
		// duration string (ie, "1d2h3m").
		if v, ok := a.Value.Any().(time.Duration); ok {
			a.Value = slog.StringValue(v.String())
		}

		return a
	}
}

func defaultReplaceAttr(_ []string, a slog.Attr) slog.Attr {
	key := a.Key
	switch key {
	case slog.TimeKey:
		// Note that we do not change the timezone to UTC anymore.
		if _, ok := a.Value.Any().(time.Time); !ok {
			// If we can't cast the any from the value to a
			// time.Time, it means the caller logged
			// another attribute with a key of `time`.
			// Prevent duplicate keys (necessary for proper
			// JSON) by renaming the key to `logged_time`.
			a.Key = reservedKeyPrefix + key
		}
	case slog.SourceKey:
		if src, ok := a.Value.Any().(*slog.Source); ok {
			a.Value = slog.StringValue(filepath.Base(src.File) + ":" + strconv.Itoa(src.Line))
		} else {
			// If we can't cast the any from the value to
			// an *slog.Source, it means the caller logged
			// another attribute with a key of `source`.
			// Prevent duplicate keys (necessary for proper
			// JSON) by renaming the key to
			// `logged_source`.
			a.Key = reservedKeyPrefix + key
		}
	case slog.LevelKey:
		if _, ok := a.Value.Any().(slog.Level); !ok {
			// If we can't cast the any from the value to
			// an slog.Level, it means the caller logged
			// another attribute with a key of `level`.
			// Prevent duplicate keys (necessary for proper
			// JSON) by renaming the key to
			// `logged_level`.
			a.Key = reservedKeyPrefix + key
		}
	default:
	}

	// Ensure time.Duration values are _always_ formatted as a Go duration
	// string (ie, "1d2h3m").
	if v, ok := a.Value.Any().(time.Duration); ok {
		a.Value = slog.StringValue(v.String())
	}

	return a
}

// New returns a new slog.Logger. Each logged line will be annotated
// with a timestamp. The output always goes to stderr.
func New(config *Config) *slog.Logger {
	if config.Level == nil {
		config.Level = NewLevel()
	}

	if config.Writer == nil {
		config.Writer = defaultWriter
	}

	logHandlerOpts := &slog.HandlerOptions{
		Level:       config.Level.lvl,
		AddSource:   true,
		ReplaceAttr: defaultReplaceAttr,
	}

	if config.Style == GoKitStyle {
		logHandlerOpts.ReplaceAttr = newGoKitStyleReplaceAttrFunc(config.Level)
	}

	if config.Format != nil && config.Format.s == "json" {
		return slog.New(slog.NewJSONHandler(config.Writer, logHandlerOpts))
	}
	return slog.New(slog.NewTextHandler(config.Writer, logHandlerOpts))
}

// NewNopLogger is a convenience function to return an slog.Logger that writes
// to io.Discard.
func NewNopLogger() *slog.Logger {
	return New(&Config{Writer: io.Discard})
}
