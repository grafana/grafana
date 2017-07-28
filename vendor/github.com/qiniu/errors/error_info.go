package errors

import (
	"errors"
	"fmt"
	"runtime"
	"strconv"
	"strings"

	"github.com/qiniu/log.v1"
)

const prefix = " ==> "

// --------------------------------------------------------------------

func New(msg string) error {
	return errors.New(msg)
}

// --------------------------------------------------------------------

type errorDetailer interface {
	ErrorDetail() string
}

func Detail(err error) string {
	if e, ok := err.(errorDetailer); ok {
		return e.ErrorDetail()
	}
	return prefix + err.Error()
}

// --------------------------------------------------------------------

type ErrorInfo struct {
	Err  error
	Why  error
	Cmd  []interface{}
	File string
	Line int
}

func shortFile(file string) string {
	pos := strings.LastIndex(file, "/src/")
	if pos != -1 {
		return file[pos+5:]
	}
	return file
}

func Info(err error, cmd ...interface{}) *ErrorInfo {
	_, file, line, ok := runtime.Caller(1)
	if !ok {
		file = "???"
	}
	return &ErrorInfo{Cmd: cmd, Err: Err(err), File: file, Line: line}
}

func InfoEx(skip int, err error, cmd ...interface{}) *ErrorInfo {
	if e, ok := err.(*ErrorInfo); ok {
		err = e.Err
	}
	_, file, line, ok := runtime.Caller(skip)
	if !ok {
		file = "???"
	}
	return &ErrorInfo{Cmd: cmd, Err: err, File: file, Line: line}
}

func (r *ErrorInfo) Cause() error {
	return r.Err
}

func (r *ErrorInfo) Error() string {
	return r.Err.Error()
}

func (r *ErrorInfo) ErrorDetail() string {
	e := prefix + shortFile(r.File) + ":" + strconv.Itoa(r.Line) + ": " + r.Err.Error() + " ~ " + fmt.Sprintln(r.Cmd...)
	if r.Why != nil {
		e += Detail(r.Why)
	} else {
		e = e[:len(e)-1]
	}
	return e
}

func (r *ErrorInfo) Detail(err error) *ErrorInfo {
	r.Why = err
	return r
}

func (r *ErrorInfo) Method() (cmd string, ok bool) {
	if len(r.Cmd) > 0 {
		if cmd, ok = r.Cmd[0].(string); ok {
			if pos := strings.Index(cmd, " "); pos > 1 {
				cmd = cmd[:pos]
			}
		}
	}
	return
}

func (r *ErrorInfo) LogMessage() string {
	detail := r.ErrorDetail()
	if cmd, ok := r.Method(); ok {
		detail = cmd + " failed:\n" + detail
	}
	return detail
}

// deprecated. please use (*ErrorInfo).LogWarn
//
func (r *ErrorInfo) Warn() *ErrorInfo {
	log.Std.Output("", log.Lwarn, 2, r.LogMessage())
	return r
}

func (r *ErrorInfo) LogWarn(reqId string) *ErrorInfo {
	log.Std.Output(reqId, log.Lwarn, 2, r.LogMessage())
	return r
}

func (r *ErrorInfo) LogError(reqId string) *ErrorInfo {
	log.Std.Output(reqId, log.Lerror, 2, r.LogMessage())
	return r
}

func (r *ErrorInfo) Log(level int, reqId string) *ErrorInfo {
	log.Std.Output(reqId, level, 2, r.LogMessage())
	return r
}

// --------------------------------------------------------------------

type causer interface {
	Cause() error
}

func Err(err error) error {
	if e, ok := err.(causer); ok {
		if diag := e.Cause(); diag != nil {
			return diag
		}
	}
	return err
}

// --------------------------------------------------------------------
