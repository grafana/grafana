package assert
// Testing helpers for doozer.

import (
	"github.com/kr/pretty"
	"reflect"
	"testing"
	"runtime"
	"fmt"
)

func assert(t *testing.T, result bool, f func(), cd int) {
	if !result {
		_, file, line, _ := runtime.Caller(cd + 1)
		t.Errorf("%s:%d", file, line)
		f()
		t.FailNow()
	}
}

func equal(t *testing.T, exp, got interface{}, cd int, args ...interface{}) {
	fn := func() {
		for _, desc := range pretty.Diff(exp, got) {
			t.Error("!", desc)
		}
		if len(args) > 0 {
			t.Error("!", " -", fmt.Sprint(args...))
		}
	}
	result := reflect.DeepEqual(exp, got)
	assert(t, result, fn, cd+1)
}

func tt(t *testing.T, result bool, cd int, args ...interface{}) {
	fn := func() {
		t.Errorf("!  Failure")
		if len(args) > 0 {
			t.Error("!", " -", fmt.Sprint(args...))
		}
	}
	assert(t, result, fn, cd+1)
}

func T(t *testing.T, result bool, args ...interface{}) {
	tt(t, result, 1, args...)
}

func Tf(t *testing.T, result bool, format string, args ...interface{}) {
	tt(t, result, 1, fmt.Sprintf(format, args...))
}

func Equal(t *testing.T, exp, got interface{}, args ...interface{}) {
	equal(t, exp, got, 1, args...)
}

func Equalf(t *testing.T, exp, got interface{}, format string, args ...interface{}) {
	equal(t, exp, got, 1, fmt.Sprintf(format, args...))
}

func NotEqual(t *testing.T, exp, got interface{}, args ...interface{}) {
	fn := func() {
		t.Errorf("!  Unexpected: <%#v>", exp)
		if len(args) > 0 {
			t.Error("!", " -", fmt.Sprint(args...))
		}
	}
	result := !reflect.DeepEqual(exp, got)
	assert(t, result, fn, 1)
}

func Panic(t *testing.T, err interface{}, fn func()) {
	defer func() {
		equal(t, err, recover(), 3)
	}()
	fn()
}
