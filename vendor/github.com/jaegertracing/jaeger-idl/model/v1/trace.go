// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

// FindSpanByID looks for a span with given span ID and returns the first one
// it finds (search order is unspecified), or nil if no spans have that ID.
func (t *Trace) FindSpanByID(id SpanID) *Span {
	for _, span := range t.Spans {
		if id == span.SpanID {
			return span
		}
	}
	return nil
}

// NormalizeTimestamps changes all timestamps in this trace to UTC.
func (t *Trace) NormalizeTimestamps() {
	for _, span := range t.Spans {
		span.NormalizeTimestamps()
	}
}
