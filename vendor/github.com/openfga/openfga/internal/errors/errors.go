package errors

import "errors"

// Idea for this package is to hold sentinel errors that can be eventually mapped to a distinct HTTP status code,
// If you need to add more details to the error so it will surface to the customer,
// use error wrapping (https://github.com/tomarrell/wrapcheck#why)

var ErrUnknown = errors.New("internal server error")
