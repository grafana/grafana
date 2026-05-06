package sloggokit

import (
	"context"
	"log/slog"
	"os"

	"github.com/go-kit/log"
)

var _ slog.Handler = (*GoKitHandler)(nil)

var defaultGoKitLogger = log.NewLogfmtLogger(os.Stderr)

// GoKitHandler implements the slog.Handler interface. It holds an internal
// go-kit logger that is used to perform the true logging.
type GoKitHandler struct {
	level        slog.Leveler
	logger       log.Logger
	preformatted []any
	group        string
}

// NewGoKitHandler returns a new slog logger from the provided go-kit
// logger. Calls to the slog logger are chained to the handler's internal
// go-kit logger. If provided a level, it will be used to filter log events in
// the handler's Enabled() method.
func NewGoKitHandler(logger log.Logger, level slog.Leveler) slog.Handler {
	if logger == nil {
		logger = defaultGoKitLogger
	}

	// Adjust runtime call depth to compensate for the adapter and point to
	// the appropriate source line.
	logger = log.With(logger, "caller", log.Caller(6))

	if level == nil {
		level = &slog.LevelVar{} // Info level by default.
	}

	return &GoKitHandler{logger: logger, level: level}
}

// Enabled returns true if the internal slog.Leveler is enabled for the
// provided log level. It implements slog.Handler.
func (h *GoKitHandler) Enabled(_ context.Context, level slog.Level) bool {
	if h.level == nil {
		h.level = &slog.LevelVar{} // Info level by default.
	}

	return level >= h.level.Level()
}

// Handler take an slog.Record created by an slog.Logger and dispatches the log
// call to the internal go-kit logger. Groups and attributes created by slog
// are formatted and added to the log call as individual key/value pairs. It
// implements slog.Handler.
func (h *GoKitHandler) Handle(_ context.Context, record slog.Record) error {
	if h.logger == nil {
		h.logger = defaultGoKitLogger
	}

	logger := goKitLevelFunc(h.logger, record.Level)

	// 1 slog.Attr == 1 key and 1 value, set capacity >= (2 * num attrs).
	//
	// Note: this could probably be (micro)-optimized further -- we know we
	// need to also append on a timestamp from the record, the message, the
	// preformatted vals, all things we more or less know the size of at
	// creation time here.
	pairs := make([]any, 0, (2 * record.NumAttrs()))
	if !record.Time.IsZero() {
		pairs = append(pairs, "time", record.Time)
	}
	pairs = append(pairs, "msg", record.Message)
	pairs = append(pairs, h.preformatted...)

	record.Attrs(func(a slog.Attr) bool {
		pairs = appendPair(pairs, h.group, a)
		return true
	})

	return logger.Log(pairs...)
}

// WithAttrs formats the provided attributes and caches them in the handler to
// attach to all future log calls. It implements slog.Handler.
func (h *GoKitHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	pairs := make([]any, 0, 2*len(attrs))
	for _, a := range attrs {
		pairs = appendPair(pairs, h.group, a)
	}

	if h.preformatted != nil {
		pairs = append(h.preformatted, pairs...)
	}

	return &GoKitHandler{
		logger:       h.logger,
		level:        h.level,
		preformatted: pairs,
		group:        h.group,
	}
}

// WithGroup sets the group prefix string and caches it within the handler to
// use to prefix all future log attribute pairs. It implements slog.Handler.
func (h *GoKitHandler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}

	g := name
	if h.group != "" {
		g = h.group + "." + g
	}

	return &GoKitHandler{
		logger:       h.logger,
		level:        h.level,
		preformatted: h.preformatted,
		group:        g,
	}
}

func appendPair(pairs []any, groupPrefix string, attr slog.Attr) []any {
	if attr.Equal(slog.Attr{}) {
		return pairs
	}

	switch attr.Value.Kind() {
	case slog.KindGroup:
		attrs := attr.Value.Group()
		if len(attrs) > 0 {
			// Only process groups that have non-empty attributes
			// to properly conform to slog.Handler interface
			// contract.

			if attr.Key != "" {
				// If a group's key is empty, attributes should
				// be inlined to properly conform to
				// slog.Handler interface contract.
				if groupPrefix != "" {
					groupPrefix = groupPrefix + "." + attr.Key
				} else {
					groupPrefix = attr.Key
				}
			}
			for _, a := range attrs {
				pairs = appendPair(pairs, groupPrefix, a)
			}
		}
	default:
		key := attr.Key
		if groupPrefix != "" {
			key = groupPrefix + "." + key
		}

		pairs = append(pairs, key, attr.Value)
	}

	return pairs
}
