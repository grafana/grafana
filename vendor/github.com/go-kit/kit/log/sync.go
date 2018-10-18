package log

import (
	"io"
	"sync"
	"sync/atomic"
)

// SwapLogger wraps another logger that may be safely replaced while other
// goroutines use the SwapLogger concurrently. The zero value for a SwapLogger
// will discard all log events without error.
//
// SwapLogger serves well as a package global logger that can be changed by
// importers.
type SwapLogger struct {
	logger atomic.Value
}

type loggerStruct struct {
	Logger
}

// Log implements the Logger interface by forwarding keyvals to the currently
// wrapped logger. It does not log anything if the wrapped logger is nil.
func (l *SwapLogger) Log(keyvals ...interface{}) error {
	s, ok := l.logger.Load().(loggerStruct)
	if !ok || s.Logger == nil {
		return nil
	}
	return s.Log(keyvals...)
}

// Swap replaces the currently wrapped logger with logger. Swap may be called
// concurrently with calls to Log from other goroutines.
func (l *SwapLogger) Swap(logger Logger) {
	l.logger.Store(loggerStruct{logger})
}

// NewSyncWriter returns a new writer that is safe for concurrent use by
// multiple goroutines. Writes to the returned writer are passed on to w. If
// another write is already in progress, the calling goroutine blocks until
// the writer is available.
//
// If w implements the following interface, so does the returned writer.
//
//    interface {
//        Fd() uintptr
//    }
func NewSyncWriter(w io.Writer) io.Writer {
	switch w := w.(type) {
	case fdWriter:
		return &fdSyncWriter{fdWriter: w}
	default:
		return &syncWriter{Writer: w}
	}
}

// syncWriter synchronizes concurrent writes to an io.Writer.
type syncWriter struct {
	sync.Mutex
	io.Writer
}

// Write writes p to the underlying io.Writer. If another write is already in
// progress, the calling goroutine blocks until the syncWriter is available.
func (w *syncWriter) Write(p []byte) (n int, err error) {
	w.Lock()
	n, err = w.Writer.Write(p)
	w.Unlock()
	return n, err
}

// fdWriter is an io.Writer that also has an Fd method. The most common
// example of an fdWriter is an *os.File.
type fdWriter interface {
	io.Writer
	Fd() uintptr
}

// fdSyncWriter synchronizes concurrent writes to an fdWriter.
type fdSyncWriter struct {
	sync.Mutex
	fdWriter
}

// Write writes p to the underlying io.Writer. If another write is already in
// progress, the calling goroutine blocks until the fdSyncWriter is available.
func (w *fdSyncWriter) Write(p []byte) (n int, err error) {
	w.Lock()
	n, err = w.fdWriter.Write(p)
	w.Unlock()
	return n, err
}

// syncLogger provides concurrent safe logging for another Logger.
type syncLogger struct {
	mu     sync.Mutex
	logger Logger
}

// NewSyncLogger returns a logger that synchronizes concurrent use of the
// wrapped logger. When multiple goroutines use the SyncLogger concurrently
// only one goroutine will be allowed to log to the wrapped logger at a time.
// The other goroutines will block until the logger is available.
func NewSyncLogger(logger Logger) Logger {
	return &syncLogger{logger: logger}
}

// Log logs keyvals to the underlying Logger. If another log is already in
// progress, the calling goroutine blocks until the syncLogger is available.
func (l *syncLogger) Log(keyvals ...interface{}) error {
	l.mu.Lock()
	err := l.logger.Log(keyvals...)
	l.mu.Unlock()
	return err
}
