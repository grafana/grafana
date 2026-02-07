package log

// noopLogger implements Logger but does nothing.
type NoopLogger struct{}

func (n *NoopLogger) Debug(msg string, keysAndValues ...any) {}
func (n *NoopLogger) Info(msg string, keysAndValues ...any)  {}
func (n *NoopLogger) Error(msg string, keysAndValues ...any) {}
func (n *NoopLogger) Warn(msg string, keysAndValues ...any)  {}
