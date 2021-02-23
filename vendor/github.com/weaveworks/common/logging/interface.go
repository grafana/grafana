package logging

// Interface 'unifies' gokit logging and logrus logging, such that
// the middleware in this repo can be used in projects which use either
// loggers.
type Interface interface {
	Debugf(format string, args ...interface{})
	Debugln(args ...interface{})

	Infof(format string, args ...interface{})
	Infoln(args ...interface{})

	Errorf(format string, args ...interface{})
	Errorln(args ...interface{})

	Warnf(format string, args ...interface{})
	Warnln(args ...interface{})

	WithField(key string, value interface{}) Interface
	WithFields(Fields) Interface
}

// Fields convenience type for adding multiple fields to a log statement.
type Fields map[string]interface{}
