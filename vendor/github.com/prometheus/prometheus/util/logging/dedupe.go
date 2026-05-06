// Copyright 2019 The Prometheus Authors
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
	"log/slog"
	"sync"
	"time"
)

const (
	garbageCollectEvery = 10 * time.Second
	expireEntriesAfter  = 1 * time.Minute
	maxEntries          = 1024
)

var _ slog.Handler = (*Deduper)(nil)

// Deduper implements *slog.Handler, dedupes log lines based on a time duration.
type Deduper struct {
	next   *slog.Logger
	repeat time.Duration
	quit   chan struct{}
	mtx    *sync.RWMutex
	seen   map[string]time.Time
}

// Dedupe log lines to next, only repeating every repeat duration.
func Dedupe(next *slog.Logger, repeat time.Duration) *Deduper {
	d := &Deduper{
		next:   next,
		repeat: repeat,
		quit:   make(chan struct{}),
		mtx:    new(sync.RWMutex),
		seen:   map[string]time.Time{},
	}
	go d.run()
	return d
}

// Enabled returns true if the Deduper's internal slog.Logger is enabled at the
// provided context and log level, and returns false otherwise. It implements
// slog.Handler.
func (d *Deduper) Enabled(ctx context.Context, level slog.Level) bool {
	return d.next.Enabled(ctx, level)
}

// Handle uses the provided context and slog.Record to deduplicate messages
// every 1m. Log records received within the interval are not acted on, and
// thus dropped. Log records that pass deduplication and need action invoke the
// Handle() method on the Deduper's internal slog.Logger's handler, effectively
// chaining log calls to the internal slog.Logger.
func (d *Deduper) Handle(ctx context.Context, r slog.Record) error {
	line := r.Message
	d.mtx.RLock()
	last, ok := d.seen[line]
	d.mtx.RUnlock()

	if ok && time.Since(last) < d.repeat {
		return nil
	}

	d.mtx.Lock()
	if len(d.seen) < maxEntries {
		d.seen[line] = time.Now()
	}
	d.mtx.Unlock()

	return d.next.Handler().Handle(ctx, r.Clone())
}

// WithAttrs adds the provided attributes to the Deduper's internal
// slog.Logger. It implements slog.Handler.
func (d *Deduper) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &Deduper{
		next:   slog.New(d.next.Handler().WithAttrs(attrs)),
		repeat: d.repeat,
		quit:   d.quit,
		seen:   d.seen,
		mtx:    d.mtx,
	}
}

// WithGroup adds the provided group name to the Deduper's internal
// slog.Logger. It implements slog.Handler.
func (d *Deduper) WithGroup(name string) slog.Handler {
	if name == "" {
		return d
	}

	return &Deduper{
		next:   slog.New(d.next.Handler().WithGroup(name)),
		repeat: d.repeat,
		quit:   d.quit,
		seen:   d.seen,
		mtx:    d.mtx,
	}
}

// Stop the Deduper.
func (d *Deduper) Stop() {
	close(d.quit)
}

func (d *Deduper) run() {
	ticker := time.NewTicker(garbageCollectEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			d.mtx.Lock()
			now := time.Now()
			for line, seen := range d.seen {
				if now.Sub(seen) > expireEntriesAfter {
					delete(d.seen, line)
				}
			}
			d.mtx.Unlock()
		case <-d.quit:
			return
		}
	}
}
