//go:build !go1.20
// +build !go1.20

package multierror

import "go.uber.org/multierr"

var (
	Join = multierr.Combine
)
