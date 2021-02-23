package logging

import (
	"os"

	"github.com/sirupsen/logrus"
)

// NewLogrusFormat makes a new Interface backed by a logrus logger
// format can be "json" or defaults to logfmt
func NewLogrusFormat(level Level, f Format) Interface {
	log := logrus.New()
	log.Out = os.Stderr
	log.Level = level.Logrus
	log.Formatter = f.Logrus
	return logrusLogger{log}
}

// NewLogrus makes a new Interface backed by a logrus logger
func NewLogrus(level Level) Interface {
	return NewLogrusFormat(level, Format{Logrus: &logrus.TextFormatter{}})
}

// Logrus wraps an existing Logrus logger.
func Logrus(l *logrus.Logger) Interface {
	return logrusLogger{l}
}

type logrusLogger struct {
	*logrus.Logger
}

func (l logrusLogger) WithField(key string, value interface{}) Interface {
	return logrusEntry{
		Entry: l.Logger.WithField(key, value),
	}
}

func (l logrusLogger) WithFields(fields Fields) Interface {
	return logrusEntry{
		Entry: l.Logger.WithFields(map[string]interface{}(fields)),
	}
}

type logrusEntry struct {
	*logrus.Entry
}

func (l logrusEntry) WithField(key string, value interface{}) Interface {
	return logrusEntry{
		Entry: l.Entry.WithField(key, value),
	}
}

func (l logrusEntry) WithFields(fields Fields) Interface {
	return logrusEntry{
		Entry: l.Entry.WithFields(map[string]interface{}(fields)),
	}
}
