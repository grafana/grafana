// Copyright 2020 The Prometheus Authors
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

package logging

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"

	"github.com/prometheus/common/promslog"
)

var _ slog.Handler = (*JSONFileLogger)(nil)

var _ io.Closer = (*JSONFileLogger)(nil)

// JSONFileLogger represents a logger that writes JSON to a file. It implements
// the slog.Handler interface, as well as the io.Closer interface.
type JSONFileLogger struct {
	handler slog.Handler
	file    *os.File
}

// NewJSONFileLogger returns a new JSONFileLogger.
func NewJSONFileLogger(s string) (*JSONFileLogger, error) {
	if s == "" {
		return nil, nil
	}

	f, err := os.OpenFile(s, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o666)
	if err != nil {
		return nil, fmt.Errorf("can't create json log file: %w", err)
	}

	jsonFmt := promslog.NewFormat()
	_ = jsonFmt.Set("json")
	return &JSONFileLogger{
		handler: promslog.New(&promslog.Config{Format: jsonFmt, Writer: f}).Handler(),
		file:    f,
	}, nil
}

// Close closes the underlying file. It implements the io.Closer interface.
func (l *JSONFileLogger) Close() error {
	return l.file.Close()
}

// Enabled returns true if and only if the internal slog.Handler is enabled. It
// implements the slog.Handler interface.
func (l *JSONFileLogger) Enabled(ctx context.Context, level slog.Level) bool {
	return l.handler.Enabled(ctx, level)
}

// Handle takes record created by an slog.Logger and forwards it to the
// internal slog.Handler for dispatching the log call to the backing file. It
// implements the slog.Handler interface.
func (l *JSONFileLogger) Handle(ctx context.Context, r slog.Record) error {
	return l.handler.Handle(ctx, r.Clone())
}

// WithAttrs returns a new *JSONFileLogger with a new internal handler that has
// the provided attrs attached as attributes on all further log calls. It
// implements the slog.Handler interface.
func (l *JSONFileLogger) WithAttrs(attrs []slog.Attr) slog.Handler {
	if len(attrs) == 0 {
		return l
	}

	return &JSONFileLogger{file: l.file, handler: l.handler.WithAttrs(attrs)}
}

// WithGroup returns a new *JSONFileLogger with a new internal handler that has
// the provided group name attached, to group all other attributes added to the
// logger. It implements the slog.Handler interface.
func (l *JSONFileLogger) WithGroup(name string) slog.Handler {
	if name == "" {
		return l
	}

	return &JSONFileLogger{file: l.file, handler: l.handler.WithGroup(name)}
}
