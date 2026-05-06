//go:build go1.20
// +build go1.20

package multierror

import "errors"

var (
	Join = errors.Join
)
