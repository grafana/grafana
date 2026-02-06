package log

import (
	"log"
	"os"
	"strings"
	"testing"
)

// Validate our types implement the required interfaces.
var (
	_ Logger = (*log.Logger)(nil)
	_ Logger = (*noopLogger)(nil)
	_ Logger = (*testLogger)(nil)
)

// Logger defines the Logger interface.
type Logger interface {
	Printf(format string, v ...any)
}

// defaultLogger is the default Logger instance.
var defaultLogger Logger = &noopLogger{}

func init() {
	// Enable default logger in the testing with a verbose flag.
	if testing.Testing() {
		// Parse manually because testing.Verbose() panics unless flag.Parse() has done.
		for _, arg := range os.Args {
			if strings.EqualFold(arg, "-test.v=true") || strings.EqualFold(arg, "-v") {
				defaultLogger = log.New(os.Stderr, "", log.LstdFlags)
			}
		}
	}
}

// Default returns the default Logger instance.
func Default() Logger {
	return defaultLogger
}

// SetDefault sets the default Logger instance.
func SetDefault(logger Logger) {
	defaultLogger = logger
}

func Printf(format string, v ...any) {
	defaultLogger.Printf(format, v...)
}

type noopLogger struct{}

// Printf implements Logging.
func (n noopLogger) Printf(_ string, _ ...any) {
	// NOOP
}

// TestLogger returns a Logging implementation for testing.TB
// This way logs from testcontainers are part of the test output of a test suite or test case.
func TestLogger(tb testing.TB) Logger {
	tb.Helper()
	return testLogger{TB: tb}
}

type testLogger struct {
	testing.TB
}

// Printf implements Logging.
func (t testLogger) Printf(format string, v ...any) {
	t.Helper()
	t.Logf(format, v...)
}
