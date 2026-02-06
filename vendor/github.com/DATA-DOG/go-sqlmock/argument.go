package sqlmock

import "database/sql/driver"

// Argument interface allows to match
// any argument in specific way when used with
// ExpectedQuery and ExpectedExec expectations.
type Argument interface {
	Match(driver.Value) bool
}

// AnyArg will return an Argument which can
// match any kind of arguments.
//
// Useful for time.Time or similar kinds of arguments.
func AnyArg() Argument {
	return anyArgument{}
}

type anyArgument struct{}

func (a anyArgument) Match(_ driver.Value) bool {
	return true
}
