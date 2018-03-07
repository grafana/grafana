// Package stack implements utilities to capture, manipulate, and format call
// stacks. It provides a simpler API than package runtime.
//
// The implementation takes care of the minutia and special cases of
// interpreting the program counter (pc) values returned by runtime.Callers.
//
// Package stack's types implement fmt.Formatter, which provides a simple and
// flexible way to declaratively configure formatting when used with logging
// or error tracking packages.
package stack

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"runtime"
	"strconv"
	"strings"
)

// Call records a single function invocation from a goroutine stack.
type Call struct {
	fn *runtime.Func
	pc uintptr
}

// Caller returns a Call from the stack of the current goroutine. The argument
// skip is the number of stack frames to ascend, with 0 identifying the
// calling function.
func Caller(skip int) Call {
	var pcs [2]uintptr
	n := runtime.Callers(skip+1, pcs[:])

	var c Call

	if n < 2 {
		return c
	}

	c.pc = pcs[1]
	if runtime.FuncForPC(pcs[0]) != sigpanic {
		c.pc--
	}
	c.fn = runtime.FuncForPC(c.pc)
	return c
}

// String implements fmt.Stinger. It is equivalent to fmt.Sprintf("%v", c).
func (c Call) String() string {
	return fmt.Sprint(c)
}

// MarshalText implements encoding.TextMarshaler. It formats the Call the same
// as fmt.Sprintf("%v", c).
func (c Call) MarshalText() ([]byte, error) {
	if c.fn == nil {
		return nil, ErrNoFunc
	}
	buf := bytes.Buffer{}
	fmt.Fprint(&buf, c)
	return buf.Bytes(), nil
}

// ErrNoFunc means that the Call has a nil *runtime.Func. The most likely
// cause is a Call with the zero value.
var ErrNoFunc = errors.New("no call stack information")

// Format implements fmt.Formatter with support for the following verbs.
//
//    %s    source file
//    %d    line number
//    %n    function name
//    %v    equivalent to %s:%d
//
// It accepts the '+' and '#' flags for most of the verbs as follows.
//
//    %+s   path of source file relative to the compile time GOPATH
//    %#s   full path of source file
//    %+n   import path qualified function name
//    %+v   equivalent to %+s:%d
//    %#v   equivalent to %#s:%d
func (c Call) Format(s fmt.State, verb rune) {
	if c.fn == nil {
		fmt.Fprintf(s, "%%!%c(NOFUNC)", verb)
		return
	}

	switch verb {
	case 's', 'v':
		file, line := c.fn.FileLine(c.pc)
		switch {
		case s.Flag('#'):
			// done
		case s.Flag('+'):
			file = file[pkgIndex(file, c.fn.Name()):]
		default:
			const sep = "/"
			if i := strings.LastIndex(file, sep); i != -1 {
				file = file[i+len(sep):]
			}
		}
		io.WriteString(s, file)
		if verb == 'v' {
			buf := [7]byte{':'}
			s.Write(strconv.AppendInt(buf[:1], int64(line), 10))
		}

	case 'd':
		_, line := c.fn.FileLine(c.pc)
		buf := [6]byte{}
		s.Write(strconv.AppendInt(buf[:0], int64(line), 10))

	case 'n':
		name := c.fn.Name()
		if !s.Flag('+') {
			const pathSep = "/"
			if i := strings.LastIndex(name, pathSep); i != -1 {
				name = name[i+len(pathSep):]
			}
			const pkgSep = "."
			if i := strings.Index(name, pkgSep); i != -1 {
				name = name[i+len(pkgSep):]
			}
		}
		io.WriteString(s, name)
	}
}

// PC returns the program counter for this call frame; multiple frames may
// have the same PC value.
func (c Call) PC() uintptr {
	return c.pc
}

// name returns the import path qualified name of the function containing the
// call.
func (c Call) name() string {
	if c.fn == nil {
		return "???"
	}
	return c.fn.Name()
}

func (c Call) file() string {
	if c.fn == nil {
		return "???"
	}
	file, _ := c.fn.FileLine(c.pc)
	return file
}

func (c Call) line() int {
	if c.fn == nil {
		return 0
	}
	_, line := c.fn.FileLine(c.pc)
	return line
}

// CallStack records a sequence of function invocations from a goroutine
// stack.
type CallStack []Call

// String implements fmt.Stinger. It is equivalent to fmt.Sprintf("%v", cs).
func (cs CallStack) String() string {
	return fmt.Sprint(cs)
}

var (
	openBracketBytes  = []byte("[")
	closeBracketBytes = []byte("]")
	spaceBytes        = []byte(" ")
)

// MarshalText implements encoding.TextMarshaler. It formats the CallStack the
// same as fmt.Sprintf("%v", cs).
func (cs CallStack) MarshalText() ([]byte, error) {
	buf := bytes.Buffer{}
	buf.Write(openBracketBytes)
	for i, pc := range cs {
		if pc.fn == nil {
			return nil, ErrNoFunc
		}
		if i > 0 {
			buf.Write(spaceBytes)
		}
		fmt.Fprint(&buf, pc)
	}
	buf.Write(closeBracketBytes)
	return buf.Bytes(), nil
}

// Format implements fmt.Formatter by printing the CallStack as square brackets
// ([, ]) surrounding a space separated list of Calls each formatted with the
// supplied verb and options.
func (cs CallStack) Format(s fmt.State, verb rune) {
	s.Write(openBracketBytes)
	for i, pc := range cs {
		if i > 0 {
			s.Write(spaceBytes)
		}
		pc.Format(s, verb)
	}
	s.Write(closeBracketBytes)
}

// findSigpanic intentionally executes faulting code to generate a stack trace
// containing an entry for runtime.sigpanic.
func findSigpanic() *runtime.Func {
	var fn *runtime.Func
	var p *int
	func() int {
		defer func() {
			if p := recover(); p != nil {
				var pcs [512]uintptr
				n := runtime.Callers(2, pcs[:])
				for _, pc := range pcs[:n] {
					f := runtime.FuncForPC(pc)
					if f.Name() == "runtime.sigpanic" {
						fn = f
						break
					}
				}
			}
		}()
		// intentional nil pointer dereference to trigger sigpanic
		return *p
	}()
	return fn
}

var sigpanic = findSigpanic()

// Trace returns a CallStack for the current goroutine with element 0
// identifying the calling function.
func Trace() CallStack {
	var pcs [512]uintptr
	n := runtime.Callers(2, pcs[:])
	cs := make([]Call, n)

	for i, pc := range pcs[:n] {
		pcFix := pc
		if i > 0 && cs[i-1].fn != sigpanic {
			pcFix--
		}
		cs[i] = Call{
			fn: runtime.FuncForPC(pcFix),
			pc: pcFix,
		}
	}

	return cs
}

// TrimBelow returns a slice of the CallStack with all entries below c
// removed.
func (cs CallStack) TrimBelow(c Call) CallStack {
	for len(cs) > 0 && cs[0].pc != c.pc {
		cs = cs[1:]
	}
	return cs
}

// TrimAbove returns a slice of the CallStack with all entries above c
// removed.
func (cs CallStack) TrimAbove(c Call) CallStack {
	for len(cs) > 0 && cs[len(cs)-1].pc != c.pc {
		cs = cs[:len(cs)-1]
	}
	return cs
}

// pkgIndex returns the index that results in file[index:] being the path of
// file relative to the compile time GOPATH, and file[:index] being the
// $GOPATH/src/ portion of file. funcName must be the name of a function in
// file as returned by runtime.Func.Name.
func pkgIndex(file, funcName string) int {
	// As of Go 1.6.2 there is no direct way to know the compile time GOPATH
	// at runtime, but we can infer the number of path segments in the GOPATH.
	// We note that runtime.Func.Name() returns the function name qualified by
	// the import path, which does not include the GOPATH. Thus we can trim
	// segments from the beginning of the file path until the number of path
	// separators remaining is one more than the number of path separators in
	// the function name. For example, given:
	//
	//    GOPATH     /home/user
	//    file       /home/user/src/pkg/sub/file.go
	//    fn.Name()  pkg/sub.Type.Method
	//
	// We want to produce:
	//
	//    file[:idx] == /home/user/src/
	//    file[idx:] == pkg/sub/file.go
	//
	// From this we can easily see that fn.Name() has one less path separator
	// than our desired result for file[idx:]. We count separators from the
	// end of the file path until it finds two more than in the function name
	// and then move one character forward to preserve the initial path
	// segment without a leading separator.
	const sep = "/"
	i := len(file)
	for n := strings.Count(funcName, sep) + 2; n > 0; n-- {
		i = strings.LastIndex(file[:i], sep)
		if i == -1 {
			i = -len(sep)
			break
		}
	}
	// get back to 0 or trim the leading separator
	return i + len(sep)
}

var runtimePath string

func init() {
	var pcs [1]uintptr
	runtime.Callers(0, pcs[:])
	fn := runtime.FuncForPC(pcs[0])
	file, _ := fn.FileLine(pcs[0])

	idx := pkgIndex(file, fn.Name())

	runtimePath = file[:idx]
	if runtime.GOOS == "windows" {
		runtimePath = strings.ToLower(runtimePath)
	}
}

func inGoroot(c Call) bool {
	file := c.file()
	if len(file) == 0 || file[0] == '?' {
		return true
	}
	if runtime.GOOS == "windows" {
		file = strings.ToLower(file)
	}
	return strings.HasPrefix(file, runtimePath) || strings.HasSuffix(file, "/_testmain.go")
}

// TrimRuntime returns a slice of the CallStack with the topmost entries from
// the go runtime removed. It considers any calls originating from unknown
// files, files under GOROOT, or _testmain.go as part of the runtime.
func (cs CallStack) TrimRuntime() CallStack {
	for len(cs) > 0 && inGoroot(cs[len(cs)-1]) {
		cs = cs[:len(cs)-1]
	}
	return cs
}
