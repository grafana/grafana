// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	"go.opentelemetry.io/collector/pdata/internal/json"
)

type TraceState struct {
	orig  *string
	state *State
}

func GetOrigTraceState(ms TraceState) *string {
	return ms.orig
}

func GetTraceStateState(ms TraceState) *State {
	return ms.state
}

func NewTraceState(orig *string, state *State) TraceState {
	return TraceState{orig: orig, state: state}
}

func GenerateTestTraceState() TraceState {
	return NewTraceState(GenTestOrigTraceState(), NewState())
}

// UnmarshalJSONOrigTraceState marshals all properties from the current struct to the destination stream.
func UnmarshalJSONOrigTraceState(orig *string, iter *json.Iterator) {
	*orig = iter.ReadString()
}

func CopyOrigTraceState(dest, src *string) {
	*dest = *src
}

func GenTestOrigTraceState() *string {
	orig := new(string)
	*orig = "rojo=00f067aa0ba902b7"
	return orig
}
