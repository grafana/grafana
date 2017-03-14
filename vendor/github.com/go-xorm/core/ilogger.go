package core

type LogLevel int

const (
	// !nashtsai! following level also match syslog.Priority value
	LOG_UNKNOWN LogLevel = iota - 2
	LOG_OFF     LogLevel = iota - 1
	LOG_ERR     LogLevel = iota + 3
	LOG_WARNING
	LOG_INFO LogLevel = iota + 6
	LOG_DEBUG
)

// logger interface
type ILogger interface {
	Debug(v ...interface{}) (err error)
	Debugf(format string, v ...interface{}) (err error)
	Err(v ...interface{}) (err error)
	Errf(format string, v ...interface{}) (err error)
	Info(v ...interface{}) (err error)
	Infof(format string, v ...interface{}) (err error)
	Warning(v ...interface{}) (err error)
	Warningf(format string, v ...interface{}) (err error)

	Level() LogLevel
	SetLevel(l LogLevel) (err error)
}
