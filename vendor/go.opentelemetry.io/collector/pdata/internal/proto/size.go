// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package proto // import "go.opentelemetry.io/collector/pdata/internal/proto"

import (
	"math/bits"
)

func Sov(x uint64) (n int) {
	return (bits.Len64(x|1) + 6) / 7
}

func Soz(x uint64) (n int) {
	//nolint:gosec
	return Sov((x << 1) ^ uint64((int64(x) >> 63)))
}
