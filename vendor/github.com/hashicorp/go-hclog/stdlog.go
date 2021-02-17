package hclog

import (
	"bytes"
	"log"
	"strings"
)

// Provides a io.Writer to shim the data out of *log.Logger
// and back into our Logger. This is basically the only way to
// build upon *log.Logger.
type stdlogAdapter struct {
	log         Logger
	inferLevels bool
	forceLevel  Level
}

// Take the data, infer the levels if configured, and send it through
// a regular Logger.
func (s *stdlogAdapter) Write(data []byte) (int, error) {
	str := string(bytes.TrimRight(data, " \t\n"))

	if s.forceLevel != NoLevel {
		// Use pickLevel to strip log levels included in the line since we are
		// forcing the level
		_, str := s.pickLevel(str)

		// Log at the forced level
		s.dispatch(str, s.forceLevel)
	} else if s.inferLevels {
		level, str := s.pickLevel(str)
		s.dispatch(str, level)
	} else {
		s.log.Info(str)
	}

	return len(data), nil
}

func (s *stdlogAdapter) dispatch(str string, level Level) {
	switch level {
	case Trace:
		s.log.Trace(str)
	case Debug:
		s.log.Debug(str)
	case Info:
		s.log.Info(str)
	case Warn:
		s.log.Warn(str)
	case Error:
		s.log.Error(str)
	default:
		s.log.Info(str)
	}
}

// Detect, based on conventions, what log level this is.
func (s *stdlogAdapter) pickLevel(str string) (Level, string) {
	switch {
	case strings.HasPrefix(str, "[DEBUG]"):
		return Debug, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[TRACE]"):
		return Trace, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[INFO]"):
		return Info, strings.TrimSpace(str[6:])
	case strings.HasPrefix(str, "[WARN]"):
		return Warn, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[ERROR]"):
		return Error, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[ERR]"):
		return Error, strings.TrimSpace(str[5:])
	default:
		return Info, str
	}
}

type logWriter struct {
	l *log.Logger
}

func (l *logWriter) Write(b []byte) (int, error) {
	l.l.Println(string(bytes.TrimRight(b, " \n\t")))
	return len(b), nil
}

// Takes a standard library logger and returns a Logger that will write to it
func FromStandardLogger(l *log.Logger, opts *LoggerOptions) Logger {
	var dl LoggerOptions = *opts

	// Use the time format that log.Logger uses
	dl.DisableTime = true
	dl.Output = &logWriter{l}

	return New(&dl)
}
