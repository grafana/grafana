// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

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
	var orig string
	state := StateMutable
	ms := NewTraceState(&orig, &state)
	FillTestTraceState(ms)
	return ms
}

func FillTestTraceState(dest TraceState) {
	*dest.orig = "rojo=00f067aa0ba902b7"
}
