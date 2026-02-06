package fflog

import (
	"fmt"
	"log"
	"log/slog"
	"strings"
	"time"
)

const LogDateFormat = time.RFC3339

type FFLogger struct {
	LeveledLogger *slog.Logger
	LegacyLogger  *log.Logger
}

func (f *FFLogger) Error(msg string, keysAndValues ...any) {
	if f != nil && f.LeveledLogger != nil {
		f.LeveledLogger.Error(msg, keysAndValues...)
		return
	}
	f.legacyLog("ERROR", msg, keysAndValues...)
}
func (f *FFLogger) Info(msg string, keysAndValues ...any) {
	if f != nil && f.LeveledLogger != nil {
		f.LeveledLogger.Info(msg, keysAndValues...)
		return
	}
	f.legacyLog("INFO", msg, keysAndValues...)
}
func (f *FFLogger) Debug(msg string, keysAndValues ...any) {
	if f != nil && f.LeveledLogger != nil {
		f.LeveledLogger.Debug(msg, keysAndValues...)
		return
	}
	f.legacyLog("DEBUG", msg, keysAndValues...)
}
func (f *FFLogger) Warn(msg string, keysAndValues ...any) {
	if f != nil && f.LeveledLogger != nil {
		f.LeveledLogger.Warn(msg, keysAndValues...)
		return
	}
	f.legacyLog("WARN", msg, keysAndValues...)
}

func (f *FFLogger) legacyLog(level string, msg string, keysAndValues ...any) {
	if f != nil && f.LegacyLogger != nil {
		if len(keysAndValues) == 0 {
			f.LegacyLogger.Printf("%s %s %s", time.Now().Format("2006/01/02 15:04:05"), level, msg)
			return
		}

		attrs := make([]string, 0)
		for _, attr := range keysAndValues {
			attrs = append(attrs, fmt.Sprintf("%v", attr))
		}
		f.LegacyLogger.Printf("%s %s %s %v", time.Now().Format("2006/01/02 15:04:05"), level, msg, strings.Join(attrs, " "))
	}
}

func (f *FFLogger) GetLogLogger(level slog.Level) *log.Logger {
	if f.LeveledLogger != nil {
		return slog.NewLogLogger(f.LeveledLogger.Handler(), level)
	}
	return f.LegacyLogger
}

func ConvertToFFLogger(logger *log.Logger) *FFLogger {
	return &FFLogger{
		LegacyLogger: logger,
	}
}
