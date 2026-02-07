// Package is provides a lightweight extension to the
// standard library's testing capabilities.
//
// Comments on the assertion lines are used to add
// a description.
//
// The following failing test:
//
//	func Test(t *testing.T) {
//		is := is.New(t)
//		a, b := 1, 2
//		is.Equal(a, b) // expect to be the same
//	}
//
// Will output:
//
//		your_test.go:123: 1 != 2 // expect to be the same
//
// Usage
//
// The following code shows a range of useful ways you can use
// the helper methods:
//
//	func Test(t *testing.T) {
//		// always start tests with this
//		is := is.New(t)
//
//		signedin, err := isSignedIn(ctx)
//		is.NoErr(err)            // isSignedIn error
//		is.Equal(signedin, true) // must be signed in
//
//		body := readBody(r)
//		is.True(strings.Contains(body, "Hi there"))
//	}
package is

import (
	"bufio"
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
)

// T reports when failures occur.
// testing.T implements this interface.
type T interface {
	// Fail indicates that the test has failed but
	// allowed execution to continue.
	// Fail is called in relaxed mode (via NewRelaxed).
	Fail()
	// FailNow indicates that the test has failed and
	// aborts the test.
	// FailNow is called in strict mode (via New).
	FailNow()
}

// I is the test helper harness.
type I struct {
	t        T
	fail     func()
	out      io.Writer
	colorful bool

	helpers map[string]struct{} // functions to be skipped when writing file/line info
}

var noColorFlag bool

func init() {
	var envNoColor bool

	// prefer https://no-color.org (with any value)
	if _, ok := os.LookupEnv("NO_COLOR"); ok {
		envNoColor = true
	}

	if v, ok := os.LookupEnv("IS_NO_COLOR"); ok {
		if b, err := strconv.ParseBool(v); err == nil {
			envNoColor = b
		}
	}

	flag.BoolVar(&noColorFlag, "nocolor", envNoColor, "turns off colors")
}

// New makes a new testing helper using the specified
// T through which failures will be reported.
// In strict mode, failures call T.FailNow causing the test
// to be aborted. See NewRelaxed for alternative behavior.
func New(t T) *I {
	return &I{t, t.FailNow, os.Stdout, !noColorFlag, map[string]struct{}{}}
}

// NewRelaxed makes a new testing helper using the specified
// T through which failures will be reported.
// In relaxed mode, failures call T.Fail allowing
// multiple failures per test.
func NewRelaxed(t T) *I {
	return &I{t, t.Fail, os.Stdout, !noColorFlag, map[string]struct{}{}}
}

func (is *I) log(args ...interface{}) {
	s := is.decorate(fmt.Sprint(args...))
	fmt.Fprintf(is.out, s)
	is.fail()
}

func (is *I) logf(format string, args ...interface{}) {
	is.log(fmt.Sprintf(format, args...))
}

// Fail immediately fails the test.
//
//	func Test(t *testing.T) {
//		is := is.New(t)
//		is.Fail() // TODO: write this test
//	}
//
// In relaxed mode, execution will continue after a call to
// Fail, but that test will still fail.
func (is *I) Fail() {
	is.log("failed")
}

// True asserts that the expression is true. The expression
// code itself will be reported if the assertion fails.
//
//	func Test(t *testing.T) {
//		is := is.New(t)
//		val := method()
//		is.True(val != nil) // val should never be nil
//	}
//
// Will output:
//
//	your_test.go:123: not true: val != nil
func (is *I) True(expression bool) {
	if !expression {
		is.log("not true: $ARGS")
	}
}

// Equal asserts that a and b are equal.
//
//	func Test(t *testing.T) {
//		is := is.New(t)
//		a := greet("Mat")
//		is.Equal(a, "Hi Mat") // greeting
//	}
//
// Will output:
//
//	your_test.go:123: Hey Mat != Hi Mat // greeting
func (is *I) Equal(a, b interface{}) {
	if areEqual(a, b) {
		return
	}
	if isNil(a) || isNil(b) {
		is.logf("%s != %s", is.valWithType(a), is.valWithType(b))
	} else if reflect.ValueOf(a).Type() == reflect.ValueOf(b).Type() {
		is.logf("%v != %v", a, b)
	} else {
		is.logf("%s != %s", is.valWithType(a), is.valWithType(b))
	}
}

// New is a method wrapper around the New function.
// It allows you to write subtests using a similar
// pattern:
//
//	func Test(t *testing.T) {
//		is := is.New(t)
//		t.Run("sub", func(t *testing.T) {
//			is := is.New(t)
//			// TODO: test
//		})
//	}
func (is *I) New(t T) *I {
	return New(t)
}

// NewRelaxed is a method wrapper around the NewRelaxed
// method. It allows you to write subtests using a similar
// pattern:
//
//	func Test(t *testing.T) {
//		is := is.NewRelaxed(t)
//		t.Run("sub", func(t *testing.T) {
//			is := is.NewRelaxed(t)
//			// TODO: test
//		})
//	}
func (is *I) NewRelaxed(t T) *I {
	return NewRelaxed(t)
}

func (is *I) valWithType(v interface{}) string {
	if isNil(v) {
		return "<nil>"
	}
	if is.colorful {
		return fmt.Sprintf("%[1]s%[3]T(%[2]s%[3]v%[1]s)%[2]s", colorType, colorNormal, v)
	}
	return fmt.Sprintf("%[1]T(%[1]v)", v)
}

// NoErr asserts that err is nil.
//
//	func Test(t *testing.T) {
//		is := is.New(t)
//		val, err := getVal()
//		is.NoErr(err)        // getVal error
//		is.True(len(val) > 10) // val cannot be short
//	}
//
// Will output:
//
//	your_test.go:123: err: not found // getVal error
func (is *I) NoErr(err error) {
	if err != nil {
		is.logf("err: %s", err.Error())
	}
}

// isNil gets whether the object is nil or not.
func isNil(object interface{}) bool {
	if object == nil {
		return true
	}
	value := reflect.ValueOf(object)
	kind := value.Kind()
	if kind >= reflect.Chan && kind <= reflect.Slice && value.IsNil() {
		return true
	}
	return false
}

// areEqual gets whether a equals b or not.
func areEqual(a, b interface{}) bool {
	if isNil(a) && isNil(b) {
		return true
	}
	if isNil(a) || isNil(b) {
		return false
	}
	if reflect.DeepEqual(a, b) {
		return true
	}
	aValue := reflect.ValueOf(a)
	bValue := reflect.ValueOf(b)
	return aValue == bValue
}

// loadComment gets the Go comment from the specified line
// in the specified file.
func loadComment(path string, line int) (string, bool) {
	f, err := os.Open(path)
	if err != nil {
		return "", false
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	i := 1
	for s.Scan() {
		if i != line {
			i++
			continue
		}

		text := s.Text()
		commentI := strings.Index(text, "// ")
		if commentI == -1 {
			return "", false // no comment
		}
		text = text[commentI+2:]
		text = strings.TrimSpace(text)
		return text, true
	}
	return "", false
}

// loadArguments gets the arguments from the function call
// on the specified line of the file.
func loadArguments(path string, line int) (string, bool) {
	f, err := os.Open(path)
	if err != nil {
		return "", false
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	i := 1
	for s.Scan() {
		if i != line {
			i++
			continue
		}
		text := s.Text()
		braceI := strings.Index(text, "(")
		if braceI == -1 {
			return "", false
		}
		text = text[braceI+1:]
		cs := bufio.NewScanner(strings.NewReader(text))
		cs.Split(bufio.ScanBytes)
		j := 0
		c := 1
		for cs.Scan() {
			switch cs.Text() {
			case ")":
				c--
			case "(":
				c++
			}
			if c == 0 {
				break
			}
			j++
		}
		text = text[:j]
		return text, true
	}
	return "", false
}

// decorate prefixes the string with the file and line of the call site
// and inserts the final newline if needed and indentation tabs for formatting.
// this function was copied from the testing framework and modified.
func (is *I) decorate(s string) string {
	path, lineNumber, ok := is.callerinfo() // decorate + log + public function.
	file := filepath.Base(path)
	if ok {
		// Truncate file name at last file name separator.
		if index := strings.LastIndex(file, "/"); index >= 0 {
			file = file[index+1:]
		} else if index = strings.LastIndex(file, "\\"); index >= 0 {
			file = file[index+1:]
		}
	} else {
		file = "???"
		lineNumber = 1
	}
	buf := new(bytes.Buffer)
	// Every line is indented at least one tab.
	buf.WriteByte('\t')
	if is.colorful {
		buf.WriteString(colorFile)
	}
	fmt.Fprintf(buf, "%s:%d: ", file, lineNumber)
	if is.colorful {
		buf.WriteString(colorNormal)
	}

	s = escapeFormatString(s)

	lines := strings.Split(s, "\n")
	if l := len(lines); l > 1 && lines[l-1] == "" {
		lines = lines[:l-1]
	}
	for i, line := range lines {
		if i > 0 {
			// Second and subsequent lines are indented an extra tab.
			buf.WriteString("\n\t\t")
		}
		// expand arguments (if $ARGS is present)
		if strings.Contains(line, "$ARGS") {
			args, _ := loadArguments(path, lineNumber)
			line = strings.Replace(line, "$ARGS", args, -1)
		}
		buf.WriteString(line)
	}
	comment, ok := loadComment(path, lineNumber)
	if ok {
		if is.colorful {
			buf.WriteString(colorComment)
		}
		buf.WriteString(" // ")
		comment = escapeFormatString(comment)
		buf.WriteString(comment)
		if is.colorful {
			buf.WriteString(colorNormal)
		}
	}
	buf.WriteString("\n")
	return buf.String()
}

// escapeFormatString escapes strings for use in formatted functions like Sprintf.
func escapeFormatString(fmt string) string {
	return strings.Replace(fmt, "%", "%%", -1)
}

const (
	colorNormal  = "\u001b[39m"
	colorComment = "\u001b[31m"
	colorFile    = "\u001b[90m"
	colorType    = "\u001b[90m"
)
