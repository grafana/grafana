// SPDX-License-Identifier: BSD-3-Clause
package common

import (
	"errors"
	"testing"
)

func SkipIfNotImplementedErr(tb testing.TB, err error) {
	tb.Helper()
	if errors.Is(err, ErrNotImplementedError) {
		tb.Skip("not implemented")
	}
}
