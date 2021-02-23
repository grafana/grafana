package logging

var global = Noop()

// Global returns the global logger.
func Global() Interface {
	return global
}

// SetGlobal sets the global logger.
func SetGlobal(i Interface) {
	global = i
}

// Debugf convenience function calls the global loggerr.
func Debugf(format string, args ...interface{}) {
	global.Debugf(format, args...)
}

// Debugln convenience function calls the global logger.
func Debugln(args ...interface{}) {
	global.Debugln(args...)
}

// Infof convenience function calls the global logger.
func Infof(format string, args ...interface{}) {
	global.Infof(format, args...)
}

// Infoln convenience function calls the global logger.
func Infoln(args ...interface{}) {
	global.Infoln(args...)
}

// Warnf convenience function calls the global logger.
func Warnf(format string, args ...interface{}) {
	global.Warnf(format, args...)
}

// Warnln convenience function calls the global logger.
func Warnln(args ...interface{}) {
	global.Warnln(args...)
}

// Errorf convenience function calls the global logger.
func Errorf(format string, args ...interface{}) {
	global.Errorf(format, args...)
}

// Errorln convenience function calls the global logger.
func Errorln(args ...interface{}) {
	global.Errorln(args...)
}

// WithField convenience function calls the global logger.
func WithField(key string, value interface{}) Interface {
	return global.WithField(key, value)
}
