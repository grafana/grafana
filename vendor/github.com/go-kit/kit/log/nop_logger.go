package log

type nopLogger struct{}

// NewNopLogger returns a logger that doesn't do anything.
func NewNopLogger() Logger { return nopLogger{} }

func (nopLogger) Log(...interface{}) error { return nil }
