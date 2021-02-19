package hclog

import (
	"bytes"
	"io"
)

type writer struct {
	b bytes.Buffer
	w io.Writer
}

func newWriter(w io.Writer) *writer {
	return &writer{w: w}
}

func (w *writer) Flush(level Level) (err error) {
	if lw, ok := w.w.(LevelWriter); ok {
		_, err = lw.LevelWrite(level, w.b.Bytes())
	} else {
		_, err = w.w.Write(w.b.Bytes())
	}
	w.b.Reset()
	return err
}

func (w *writer) Write(p []byte) (int, error) {
	return w.b.Write(p)
}

func (w *writer) WriteByte(c byte) error {
	return w.b.WriteByte(c)
}

func (w *writer) WriteString(s string) (int, error) {
	return w.b.WriteString(s)
}

// LevelWriter is the interface that wraps the LevelWrite method.
type LevelWriter interface {
	LevelWrite(level Level, p []byte) (n int, err error)
}

// LeveledWriter writes all log messages to the standard writer,
// except for log levels that are defined in the overrides map.
type LeveledWriter struct {
	standard  io.Writer
	overrides map[Level]io.Writer
}

// NewLeveledWriter returns an initialized LeveledWriter.
//
// standard will be used as the default writer for all log levels,
// except for log levels that are defined in the overrides map.
func NewLeveledWriter(standard io.Writer, overrides map[Level]io.Writer) *LeveledWriter {
	return &LeveledWriter{
		standard:  standard,
		overrides: overrides,
	}
}

// Write implements io.Writer.
func (lw *LeveledWriter) Write(p []byte) (int, error) {
	return lw.standard.Write(p)
}

// LevelWrite implements LevelWriter.
func (lw *LeveledWriter) LevelWrite(level Level, p []byte) (int, error) {
	w, ok := lw.overrides[level]
	if !ok {
		w = lw.standard
	}
	return w.Write(p)
}
