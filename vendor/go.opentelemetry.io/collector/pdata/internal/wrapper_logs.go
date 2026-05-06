// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	otlpcollectorlog "go.opentelemetry.io/collector/pdata/internal/data/protogen/collector/logs/v1"
	otlplogs "go.opentelemetry.io/collector/pdata/internal/data/protogen/logs/v1"
)

type Logs struct {
	orig  *otlpcollectorlog.ExportLogsServiceRequest
	state *State
}

func GetOrigLogs(ms Logs) *otlpcollectorlog.ExportLogsServiceRequest {
	return ms.orig
}

func GetLogsState(ms Logs) *State {
	return ms.state
}

func SetLogsState(ms Logs, state State) {
	*ms.state = state
}

func NewLogs(orig *otlpcollectorlog.ExportLogsServiceRequest, state *State) Logs {
	return Logs{orig: orig, state: state}
}

// LogsToProto internal helper to convert Logs to protobuf representation.
func LogsToProto(l Logs) otlplogs.LogsData {
	return otlplogs.LogsData{
		ResourceLogs: l.orig.ResourceLogs,
	}
}

// LogsFromProto internal helper to convert protobuf representation to Logs.
// This function set exclusive state assuming that it's called only once per Logs.
func LogsFromProto(orig otlplogs.LogsData) Logs {
	state := StateMutable
	return NewLogs(&otlpcollectorlog.ExportLogsServiceRequest{
		ResourceLogs: orig.ResourceLogs,
	}, &state)
}
