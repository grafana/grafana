// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"

import (
	"go.uber.org/multierr"

	otlpcommon "go.opentelemetry.io/collector/pdata/internal/data/protogen/common/v1"
)

// AsRaw return []any copy of the Slice.
func (es Slice) AsRaw() []any {
	rawSlice := make([]any, 0, es.Len())
	for i := 0; i < es.Len(); i++ {
		rawSlice = append(rawSlice, es.At(i).AsRaw())
	}
	return rawSlice
}

// FromRaw copies []any into the Slice.
func (es Slice) FromRaw(rawSlice []any) error {
	es.getState().AssertMutable()
	if len(rawSlice) == 0 {
		*es.getOrig() = nil
		return nil
	}
	var errs error
	origs := make([]otlpcommon.AnyValue, len(rawSlice))
	for ix, iv := range rawSlice {
		errs = multierr.Append(errs, newValue(&origs[ix], es.getState()).FromRaw(iv))
	}
	*es.getOrig() = origs
	return errs
}

// Equal checks equality with another Slice
func (es Slice) Equal(val Slice) bool {
	if es.Len() != val.Len() {
		return false
	}

	for i := 0; i < es.Len(); i++ {
		if !es.At(i).Equal(val.At(i)) {
			return false
		}
	}
	return true
}
