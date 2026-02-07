package smtpmock

import (
	"io"
	"log"
	"os"
)

// Logger interface
type Logger interface {
	InfoActivity(string)
	Info(string)
	Warning(string)
	Error(string)
}

// Custom logger that supports 3 different log levels (info, warning, error)
type eventLogger struct {
	eventInfo, eventWarning, eventError *log.Logger
	logToStdout, logServerActivity      bool
	flag                                int
	stdout, stderr                      io.Writer
}

// Logger builder. Returns pointer to builded new logger structure
func newLogger(logToStdout, logServerActivity bool) *eventLogger {
	return &eventLogger{
		logToStdout:       logToStdout,
		logServerActivity: logServerActivity,
		flag:              logFlag,
		stdout:            os.Stdout,
		stderr:            os.Stderr,
	}
}

// logger methods

// Provides INFO log level for server activities. Writes to stdout for case when
// logger.logToStdout and logger.logServerActivity are enabled, suppressed otherwise
func (logger *eventLogger) InfoActivity(message string) {
	if logger.logToStdout && logger.logServerActivity {
		if logger.eventInfo == nil {
			logger.eventInfo = log.New(logger.stdout, infoLogLevel+": ", logger.flag)
		}

		logger.eventInfo.Println(message)
	}
}

// Provides INFO log level. Writes to stdout for case when logger.logToStdout is enabled,
// suppressed otherwise
func (logger *eventLogger) Info(message string) {
	if logger.logToStdout {
		if logger.eventInfo == nil {
			logger.eventInfo = log.New(logger.stdout, infoLogLevel+": ", logger.flag)
		}

		logger.eventInfo.Println(message)
	}
}

// Provides WARNING log level. Writes to stdout for case when logger.logToStdout is enabled,
// suppressed otherwise
func (logger *eventLogger) Warning(message string) {
	if logger.logToStdout {
		if logger.eventWarning == nil {
			logger.eventWarning = log.New(logger.stdout, warningLogLevel+": ", logger.flag)
		}

		logger.eventWarning.Println(message)
	}
}

// Provides ERROR log level. Writes to stdout for case when logger.logToStdout is enabled,
// suppressed otherwise
func (logger *eventLogger) Error(message string) {
	if logger.logToStdout {
		if logger.eventError == nil {
			logger.eventError = log.New(logger.stderr, errorLogLevel+": ", logger.flag)
		}

		logger.eventError.Println(message)
	}
}
