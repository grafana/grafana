package assert

import (
	"fmt"
	"io"
	"os"
	"reflect"
	"runtime"
	"strings"

	"github.com/smartystreets/logging"
)

// Result contains a single assertion failure as an error.
// You should not create a Result directly, use So instead.
// Once created, a Result is read-only and only allows
// queries using the provided methods.
type Result struct {
	invocation string
	err        error

	stdout io.Writer
	logger *logging.Logger
}

// So is a convenience function (as opposed to an inconvenience function?)
// for running assertions on arbitrary arguments in any context. It allows you to perform
// assertion-like behavior and decide what happens in the event of a failure.
// It is a variant of assertions.So in every respect except its return value.
// In this case, the return value is a *Result which possesses several of its
// own convenience methods:
//
//    fmt.Println(assert.So(1, should.Equal, 1)) // Calls String() and prints the representation of the assertion.
//    assert.So(1, should.Equal, 1).Println()    // Calls fmt.Print with the failure message and file:line header.
//    assert.So(1, should.Equal, 1).Log()        // Calls log.Print with the failure message and file:line header.
//    assert.So(1, should.Equal, 1).Panic()      // Calls log.Panic with the failure message and file:line header.
//    assert.So(1, should.Equal, 1).Fatal()      // Calls log.Fatal with the failure message and file:line header.
//    if err := assert.So(1, should.Equal, 1).Error(); err != nil {
//        // Allows custom handling of the error, which will include the failure message and file:line header.
//    }
func So(actual interface{}, assert assertion, expected ...interface{}) *Result {
	result := new(Result)
	result.stdout = os.Stdout
	result.invocation = fmt.Sprintf("So(actual: %v, %v, expected: %v)", actual, assertionName(assert), expected)
	if failure := assert(actual, expected...); len(failure) > 0 {
		_, file, line, _ := runtime.Caller(1)
		result.err = fmt.Errorf("Assertion failure at %s:%d\n%s", file, line, failure)
	}
	return result
}
func assertionName(i interface{}) string {
	functionAddress := runtime.FuncForPC(reflect.ValueOf(i).Pointer())
	fullNameStartingWithPackage := functionAddress.Name()
	parts := strings.Split(fullNameStartingWithPackage, "/")
	baseName := parts[len(parts)-1]
	return strings.Replace(baseName, "assertions.Should", "should.", 1)
}

// Failed returns true if the assertion failed, false if it passed.
func (this *Result) Failed() bool {
	return !this.Passed()
}

// Passed returns true if the assertion passed, false if it failed.
func (this *Result) Passed() bool {
	return this.err == nil
}

// Error returns the error representing an assertion failure, which is nil in the case of a passed assertion.
func (this *Result) Error() error {
	return this.err
}

// String implements fmt.Stringer.
// It returns the error as a string in the case of an assertion failure.
// Unlike other methods defined herein, if returns a non-empty
// representation of the assertion as confirmation of success.
func (this *Result) String() string {
	if this.Passed() {
		return fmt.Sprintf("✔ %s", this.invocation)
	} else {
		return fmt.Sprintf("✘ %s\n%v", this.invocation, this.Error())
	}
}

// Println calls fmt.Println in the case of an assertion failure.
func (this *Result) Println() *Result {
	if this.Failed() {
		fmt.Fprintln(this.stdout, this)
	}
	return this
}

// Log calls log.Print in the case of an assertion failure.
func (this *Result) Log() *Result {
	if this.Failed() {
		this.logger.Print(this)
	}
	return this
}

// Panic calls log.Panic in the case of an assertion failure.
func (this *Result) Panic() *Result {
	if this.Failed() {
		this.logger.Panic(this)
	}
	return this
}

// Fatal calls log.Fatal in the case of an assertion failure.
func (this *Result) Fatal() *Result {
	if this.Failed() {
		this.logger.Fatal(this)
	}
	return this
}

// assertion is a copy of github.com/smartystreets/assertions.assertion.
type assertion func(actual interface{}, expected ...interface{}) string
