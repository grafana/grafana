package config

import "fmt"

// UnsupportedDirective error.
type UnsupportedDirective struct {
	text string
}

// Error implements the error interface for unsupported directives.
func (e UnsupportedDirective) Error() string {
	return e.text
}

// Invalid config error.
type Invalid struct {
	text string
}

// Error implements the error interface for invalid config error.
func (e Invalid) Error() string {
	return e.text
}

// InvalidErrorf creates a new Invalid error.
func InvalidErrorf(format string, a ...interface{}) Invalid {
	return Invalid{
		text: fmt.Sprintf("invalid krb5 config "+format, a...),
	}
}
