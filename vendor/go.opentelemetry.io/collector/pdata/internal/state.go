// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

// State defines an ownership state of pmetric.Metrics, plog.Logs or ptrace.Traces.
type State int32

const (
	// StateMutable indicates that the data is exclusive to the current consumer.
	StateMutable State = iota

	// StateReadOnly indicates that the data is shared with other consumers.
	StateReadOnly
)

// AssertMutable panics if the state is not StateMutable.
func (state *State) AssertMutable() {
	if *state != StateMutable {
		panic("invalid access to shared data")
	}
}
