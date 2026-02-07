// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package ptrace // import "go.opentelemetry.io/collector/pdata/ptrace"

// MarkReadOnly marks the Traces as shared so that no further modifications can be done on it.
func (ms Traces) MarkReadOnly() {
	ms.getState().MarkReadOnly()
}

// IsReadOnly returns true if this Traces instance is read-only.
func (ms Traces) IsReadOnly() bool {
	return ms.getState().IsReadOnly()
}

// SpanCount calculates the total number of spans.
func (ms Traces) SpanCount() int {
	spanCount := 0
	rss := ms.ResourceSpans()
	for i := 0; i < rss.Len(); i++ {
		rs := rss.At(i)
		ilss := rs.ScopeSpans()
		for j := 0; j < ilss.Len(); j++ {
			spanCount += ilss.At(j).Spans().Len()
		}
	}
	return spanCount
}
