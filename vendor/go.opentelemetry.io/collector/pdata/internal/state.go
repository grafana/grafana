// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"
import (
	"sync/atomic"

	"go.opentelemetry.io/collector/featuregate"
)

var _ = featuregate.GlobalRegistry().MustRegister(
	"pdata.useCustomProtoEncoding",
	featuregate.StageStable,
	featuregate.WithRegisterDescription("When enabled, enable custom proto encoding. This is required step to enable featuregate pdata.useProtoPooling."),
	featuregate.WithRegisterReferenceURL("https://github.com/open-telemetry/opentelemetry-collector/issues/13631"),
	featuregate.WithRegisterFromVersion("v0.133.0"),
	featuregate.WithRegisterToVersion("v0.137.0"),
)

var UseProtoPooling = featuregate.GlobalRegistry().MustRegister(
	"pdata.useProtoPooling",
	featuregate.StageAlpha,
	featuregate.WithRegisterDescription("When enabled, enable using local memory pools for underlying data that the pdata messages are pushed to."),
	featuregate.WithRegisterReferenceURL("https://github.com/open-telemetry/opentelemetry-collector/issues/13631"),
	featuregate.WithRegisterFromVersion("v0.133.0"),
)

// State defines an ownership state of pmetric.Metrics, plog.Logs or ptrace.Traces.
type State struct {
	refs  atomic.Int32
	state uint32
}

const (
	defaultState          uint32 = 0
	stateReadOnlyBit             = uint32(1 << 0)
	statePipelineOwnedBit        = uint32(1 << 1)
)

func NewState() *State {
	st := &State{
		state: defaultState,
	}
	st.refs.Store(1)
	return st
}

func (st *State) MarkReadOnly() {
	st.state |= stateReadOnlyBit
}

func (st *State) IsReadOnly() bool {
	return st.state&stateReadOnlyBit != 0
}

// AssertMutable panics if the state is not StateMutable.
func (st *State) AssertMutable() {
	if st.state&stateReadOnlyBit != 0 {
		panic("invalid access to shared data")
	}
}

// MarkPipelineOwned marks the data as owned by the pipeline, returns true if the data were
// previously not owned by the pipeline, otherwise false.
func (st *State) MarkPipelineOwned() bool {
	if st.state&statePipelineOwnedBit != 0 {
		return false
	}
	st.state |= statePipelineOwnedBit
	return true
}

// Ref add one to the count of active references.
func (st *State) Ref() {
	st.refs.Add(1)
}

// Unref returns true if reference count got to 0 which means no more active references,
// otherwise it returns false.
func (st *State) Unref() bool {
	refs := st.refs.Add(-1)
	switch {
	case refs > 0:
		return false
	case refs == 0:
		return true
	default:
		panic("Cannot unref freed data")
	}
}
