package logging

import (
	"fmt"
	"os"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
)

// NewGoKitFormat creates a new Interface backed by a GoKit logger
// format can be "json" or defaults to logfmt
func NewGoKitFormat(l Level, f Format) Interface {
	var logger log.Logger
	if f.s == "json" {
		logger = log.NewJSONLogger(log.NewSyncWriter(os.Stderr))
	} else {
		logger = log.NewLogfmtLogger(log.NewSyncWriter(os.Stderr))
	}
	logger = level.NewFilter(logger, l.Gokit)
	logger = log.With(logger, "ts", log.DefaultTimestampUTC, "caller", log.DefaultCaller)
	return gokit{logger}
}

// NewGoKit creates a new Interface backed by a GoKit logger
func NewGoKit(l Level) Interface {
	return NewGoKitFormat(l, Format{s: "logfmt"})
}

// GoKit wraps an existing gokit Logger.
func GoKit(logger log.Logger) Interface {
	return gokit{logger}
}

type gokit struct {
	log.Logger
}

func (g gokit) Debugf(format string, args ...interface{}) {
	level.Debug(g.Logger).Log("msg", fmt.Sprintf(format, args...))
}
func (g gokit) Debugln(args ...interface{}) {
	level.Debug(g.Logger).Log("msg", fmt.Sprintln(args...))
}

func (g gokit) Infof(format string, args ...interface{}) {
	level.Info(g.Logger).Log("msg", fmt.Sprintf(format, args...))
}
func (g gokit) Infoln(args ...interface{}) {
	level.Info(g.Logger).Log("msg", fmt.Sprintln(args...))
}

func (g gokit) Warnf(format string, args ...interface{}) {
	level.Warn(g.Logger).Log("msg", fmt.Sprintf(format, args...))
}
func (g gokit) Warnln(args ...interface{}) {
	level.Warn(g.Logger).Log("msg", fmt.Sprintln(args...))
}

func (g gokit) Errorf(format string, args ...interface{}) {
	level.Error(g.Logger).Log("msg", fmt.Sprintf(format, args...))
}
func (g gokit) Errorln(args ...interface{}) {
	level.Error(g.Logger).Log("msg", fmt.Sprintln(args...))
}

func (g gokit) WithField(key string, value interface{}) Interface {
	return gokit{log.With(g.Logger, key, value)}
}

func (g gokit) WithFields(fields Fields) Interface {
	logger := g.Logger
	for k, v := range fields {
		logger = log.With(logger, k, v)
	}
	return gokit{logger}
}
