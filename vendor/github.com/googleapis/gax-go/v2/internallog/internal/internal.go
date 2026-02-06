// Copyright 2024, Google Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Package internal provides some common logic and types to other logging
// sub-packages.
package internal

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"
)

const (
	// LoggingLevelEnvVar is the environment variable used to enable logging
	// at a particular level.
	LoggingLevelEnvVar = "GOOGLE_SDK_GO_LOGGING_LEVEL"

	googLvlKey    = "severity"
	googMsgKey    = "message"
	googSourceKey = "sourceLocation"
	googTimeKey   = "timestamp"
)

// NewLoggerWithWriter is exposed for testing.
func NewLoggerWithWriter(w io.Writer) *slog.Logger {
	lvl, loggingEnabled := checkLoggingLevel()
	if !loggingEnabled {
		return slog.New(noOpHandler{})
	}
	return slog.New(newGCPSlogHandler(lvl, w))
}

// checkLoggingLevel returned the configured logging level and whether or not
// logging is enabled.
func checkLoggingLevel() (slog.Leveler, bool) {
	sLevel := strings.ToLower(os.Getenv(LoggingLevelEnvVar))
	var level slog.Level
	switch sLevel {
	case "debug":
		level = slog.LevelDebug
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		return nil, false
	}
	return level, true
}

// newGCPSlogHandler returns a Handler that is configured to output in a JSON
// format with well-known keys. For more information on this format see
// https://cloud.google.com/logging/docs/agent/logging/configuration#special-fields.
func newGCPSlogHandler(lvl slog.Leveler, w io.Writer) slog.Handler {
	return slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level:       lvl,
		ReplaceAttr: replaceAttr,
	})
}

// replaceAttr remaps default Go logging keys to match what is expected in
// cloud logging.
func replaceAttr(groups []string, a slog.Attr) slog.Attr {
	if groups == nil {
		if a.Key == slog.LevelKey {
			a.Key = googLvlKey
			return a
		} else if a.Key == slog.MessageKey {
			a.Key = googMsgKey
			return a
		} else if a.Key == slog.SourceKey {
			a.Key = googSourceKey
			return a
		} else if a.Key == slog.TimeKey {
			a.Key = googTimeKey
			if a.Value.Kind() == slog.KindTime {
				a.Value = slog.StringValue(a.Value.Time().Format(time.RFC3339))
			}
			return a
		}
	}
	return a
}

// The handler returned if logging is not enabled.
type noOpHandler struct{}

func (h noOpHandler) Enabled(_ context.Context, _ slog.Level) bool {
	return false
}

func (h noOpHandler) Handle(_ context.Context, _ slog.Record) error {
	return nil
}

func (h noOpHandler) WithAttrs(_ []slog.Attr) slog.Handler {
	return h
}

func (h noOpHandler) WithGroup(_ string) slog.Handler {
	return h
}
