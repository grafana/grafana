package gocql

import (
	"bytes"
	"fmt"
	"log"
)

type StdLogger interface {
	Print(v ...interface{})
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

type testLogger struct {
	capture bytes.Buffer
}

func (l *testLogger) Print(v ...interface{})                 { fmt.Fprint(&l.capture, v...) }
func (l *testLogger) Printf(format string, v ...interface{}) { fmt.Fprintf(&l.capture, format, v...) }
func (l *testLogger) Println(v ...interface{})               { fmt.Fprintln(&l.capture, v...) }
func (l *testLogger) String() string                         { return l.capture.String() }

type defaultLogger struct{}

func (l *defaultLogger) Print(v ...interface{})                 { log.Print(v...) }
func (l *defaultLogger) Printf(format string, v ...interface{}) { log.Printf(format, v...) }
func (l *defaultLogger) Println(v ...interface{})               { log.Println(v...) }

var Logger StdLogger = &defaultLogger{}
