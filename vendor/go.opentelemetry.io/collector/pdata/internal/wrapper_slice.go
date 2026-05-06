// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	otlpcommon "go.opentelemetry.io/collector/pdata/internal/data/protogen/common/v1"
)

type Slice struct {
	orig  *[]otlpcommon.AnyValue
	state *State
}

func GetOrigSlice(ms Slice) *[]otlpcommon.AnyValue {
	return ms.orig
}

func GetSliceState(ms Slice) *State {
	return ms.state
}

func NewSlice(orig *[]otlpcommon.AnyValue, state *State) Slice {
	return Slice{orig: orig, state: state}
}

func GenerateTestSlice() Slice {
	orig := []otlpcommon.AnyValue{}
	state := StateMutable
	tv := NewSlice(&orig, &state)
	FillTestSlice(tv)
	return tv
}

func FillTestSlice(tv Slice) {
	*tv.orig = make([]otlpcommon.AnyValue, 7)
	for i := 0; i < 7; i++ {
		state := StateMutable
		FillTestValue(NewValue(&(*tv.orig)[i], &state))
	}
}
