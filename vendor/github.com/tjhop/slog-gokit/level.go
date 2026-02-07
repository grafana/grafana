package sloggokit

import (
	"log/slog"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

func goKitLevelFunc(logger log.Logger, lvl slog.Level) log.Logger {
	switch lvl {
	case slog.LevelInfo:
		logger = level.Info(logger)
	case slog.LevelWarn:
		logger = level.Warn(logger)
	case slog.LevelError:
		logger = level.Error(logger)
	default:
		logger = level.Debug(logger)
	}

	return logger
}
