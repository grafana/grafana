package xlog

import (
	"fmt"
	"io"
	"os"
	"runtime"

	"qiniupkg.com/x/log.v7"
	"qiniupkg.com/x/reqid.v7"

	. "golang.org/x/net/context"
)

const (
	Ldate         = log.Ldate
	Ltime         = log.Ltime
	Lmicroseconds = log.Lmicroseconds
	Llongfile     = log.Llongfile
	Lshortfile    = log.Lshortfile
	Lmodule       = log.Lmodule
	Llevel        = log.Llevel
	LstdFlags     = log.LstdFlags
	Ldefault      = log.Ldefault
)

const (
	Ldebug = log.Ldebug
	Linfo  = log.Linfo
	Lwarn  = log.Lwarn
	Lerror = log.Lerror
	Lpanic = log.Lpanic
	Lfatal = log.Lfatal
)

// ============================================================================
// type *Logger

type Logger struct {
	ReqId string
}

func New(reqId string) *Logger {

	return &Logger{reqId}
}

func NewWith(ctx Context) *Logger {

	reqId, ok := reqid.FromContext(ctx)
	if !ok {
		log.Debug("xlog.New: reqid isn't find in context")
	}
	return &Logger{reqId}
}

func (xlog *Logger) Spawn(child string) *Logger {

	return &Logger{xlog.ReqId + "." + child}
}

// ============================================================================

// Print calls Output to print to the standard Logger.
// Arguments are handled in the manner of fmt.Print.
func (xlog *Logger) Print(v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Linfo, 2, fmt.Sprint(v...))
}

// Printf calls Output to print to the standard Logger.
// Arguments are handled in the manner of fmt.Printf.
func (xlog *Logger) Printf(format string, v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Linfo, 2, fmt.Sprintf(format, v...))
}

// Println calls Output to print to the standard Logger.
// Arguments are handled in the manner of fmt.Println.
func (xlog *Logger) Println(v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Linfo, 2, fmt.Sprintln(v...))
}

// -----------------------------------------

func (xlog *Logger) Debugf(format string, v ...interface{}) {
	if log.Ldebug < log.Std.Level {
		return
	}
	log.Std.Output(xlog.ReqId, log.Ldebug, 2, fmt.Sprintf(format, v...))
}

func (xlog *Logger) Debug(v ...interface{}) {
	if log.Ldebug < log.Std.Level {
		return
	}
	log.Std.Output(xlog.ReqId, log.Ldebug, 2, fmt.Sprintln(v...))
}

// -----------------------------------------

func (xlog *Logger) Infof(format string, v ...interface{}) {
	if log.Linfo < log.Std.Level {
		return
	}
	log.Std.Output(xlog.ReqId, log.Linfo, 2, fmt.Sprintf(format, v...))
}

func (xlog *Logger) Info(v ...interface{}) {
	if log.Linfo < log.Std.Level {
		return
	}
	log.Std.Output(xlog.ReqId, log.Linfo, 2, fmt.Sprintln(v...))
}

// -----------------------------------------

func (xlog *Logger) Warnf(format string, v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lwarn, 2, fmt.Sprintf(format, v...))
}

func (xlog *Logger) Warn(v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lwarn, 2, fmt.Sprintln(v...))
}

// -----------------------------------------

func (xlog *Logger) Errorf(format string, v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lerror, 2, fmt.Sprintf(format, v...))
}

func (xlog *Logger) Error(v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lerror, 2, fmt.Sprintln(v...))
}

// -----------------------------------------

// Fatal is equivalent to Print() followed by a call to os.Exit(1).
func (xlog *Logger) Fatal(v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lfatal, 2, fmt.Sprint(v...))
	os.Exit(1)
}

// Fatalf is equivalent to Printf() followed by a call to os.Exit(1).
func (xlog *Logger) Fatalf(format string, v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lfatal, 2, fmt.Sprintf(format, v...))
	os.Exit(1)
}

// Fatalln is equivalent to Println() followed by a call to os.Exit(1).
func (xlog *Logger) Fatalln(v ...interface{}) {
	log.Std.Output(xlog.ReqId, log.Lfatal, 2, fmt.Sprintln(v...))
	os.Exit(1)
}

// -----------------------------------------

// Panic is equivalent to Print() followed by a call to panic().
func (xlog *Logger) Panic(v ...interface{}) {
	s := fmt.Sprint(v...)
	log.Std.Output(xlog.ReqId, log.Lpanic, 2, s)
	panic(s)
}

// Panicf is equivalent to Printf() followed by a call to panic().
func (xlog *Logger) Panicf(format string, v ...interface{}) {
	s := fmt.Sprintf(format, v...)
	log.Std.Output(xlog.ReqId, log.Lpanic, 2, s)
	panic(s)
}

// Panicln is equivalent to Println() followed by a call to panic().
func (xlog *Logger) Panicln(v ...interface{}) {
	s := fmt.Sprintln(v...)
	log.Std.Output(xlog.ReqId, log.Lpanic, 2, s)
	panic(s)
}

func (xlog *Logger) Stack(v ...interface{}) {
	s := fmt.Sprint(v...)
	s += "\n"
	buf := make([]byte, 1024*1024)
	n := runtime.Stack(buf, true)
	s += string(buf[:n])
	s += "\n"
	log.Std.Output(xlog.ReqId, log.Lerror, 2, s)
}

func (xlog *Logger) SingleStack(v ...interface{}) {
	s := fmt.Sprint(v...)
	s += "\n"
	buf := make([]byte, 1024*1024)
	n := runtime.Stack(buf, false)
	s += string(buf[:n])
	s += "\n"
	log.Std.Output(xlog.ReqId, log.Lerror, 2, s)
}

// ============================================================================

func SetOutput(w io.Writer) {
	log.SetOutput(w)
}

func SetFlags(flag int) {
	log.SetFlags(flag)
}

func SetOutputLevel(lvl int) {
	log.SetOutputLevel(lvl)
}

// ============================================================================
