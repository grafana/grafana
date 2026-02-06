// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"

import (
	"go.opentelemetry.io/collector/pdata/internal"
)

// TraceState represents the trace state from the w3c-trace-context.
//
// Must use NewTraceState function to create new instances.
// Important: zero-initialized instance is not valid for use.
type TraceState internal.TraceState

func NewTraceState() TraceState {
	return TraceState(internal.NewTraceState(new(string), internal.NewState()))
}

func (ms TraceState) getOrig() *string {
	return internal.GetOrigTraceState(internal.TraceState(ms))
}

func (ms TraceState) getState() *internal.State {
	return internal.GetTraceStateState(internal.TraceState(ms))
}

// AsRaw returns the string representation of the tracestate in w3c-trace-context format: https://www.w3.org/TR/trace-context/#tracestate-header
func (ms TraceState) AsRaw() string {
	return *ms.getOrig()
}

// FromRaw copies the string representation in w3c-trace-context format of the tracestate into this TraceState.
func (ms TraceState) FromRaw(v string) {
	ms.getState().AssertMutable()
	*ms.getOrig() = v
}

// MoveTo moves the TraceState instance overriding the destination
// and resetting the current instance to its zero value.
func (ms TraceState) MoveTo(dest TraceState) {
	ms.getState().AssertMutable()
	dest.getState().AssertMutable()
	// If they point to the same data, they are the same, nothing to do.
	if ms.getOrig() == dest.getOrig() {
		return
	}
	*dest.getOrig() = *ms.getOrig()
	*ms.getOrig() = ""
}

// CopyTo copies the TraceState instance overriding the destination.
func (ms TraceState) CopyTo(dest TraceState) {
	dest.getState().AssertMutable()
	*dest.getOrig() = *ms.getOrig()
}
