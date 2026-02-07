// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

import (
	"sort"
)

type byTraceID []*TraceID

func (s byTraceID) Len() int      { return len(s) }
func (s byTraceID) Swap(i, j int) { s[i], s[j] = s[j], s[i] }
func (s byTraceID) Less(i, j int) bool {
	if s[i].High < s[j].High {
		return true
	} else if s[i].High > s[j].High {
		return false
	}
	return s[i].Low < s[j].Low
}

// SortTraceIDs sorts a list of TraceIDs
func SortTraceIDs(traceIDs []*TraceID) {
	sort.Sort(byTraceID(traceIDs))
}

type traceByTraceID []*Trace

func (s traceByTraceID) Len() int      { return len(s) }
func (s traceByTraceID) Swap(i, j int) { s[i], s[j] = s[j], s[i] }
func (s traceByTraceID) Less(i, j int) bool {
	switch {
	case len(s[i].Spans) == 0:
		return true
	case len(s[j].Spans) == 0:
		return false
	default:
		return s[i].Spans[0].TraceID.Low < s[j].Spans[0].TraceID.Low
	}
}

// SortTraces deep sorts a list of traces by TraceID.
func SortTraces(traces []*Trace) {
	sort.Sort(traceByTraceID(traces))
	for _, trace := range traces {
		SortTrace(trace)
	}
}

type spanBySpanID []*Span

func (s spanBySpanID) Len() int           { return len(s) }
func (s spanBySpanID) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s spanBySpanID) Less(i, j int) bool { return s[i].SpanID < s[j].SpanID }

// SortTrace deep sorts a trace's spans by SpanID.
func SortTrace(trace *Trace) {
	sort.Sort(spanBySpanID(trace.Spans))
	for _, span := range trace.Spans {
		SortSpan(span)
	}
}

// SortSpan deep sorts a span: this sorts its tags, logs by timestamp, tags in logs, and tags in process.
func SortSpan(span *Span) {
	span.NormalizeTimestamps()
	sortTags(span.Tags)
	sortLogs(span.Logs)
	sortProcess(span.Process)
}

type tagByKey []KeyValue

func (t tagByKey) Len() int           { return len(t) }
func (t tagByKey) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
func (t tagByKey) Less(i, j int) bool { return t[i].Key < t[j].Key }

func sortTags(tags []KeyValue) {
	sort.Sort(tagByKey(tags))
}

type logByTimestamp []Log

func (t logByTimestamp) Len() int           { return len(t) }
func (t logByTimestamp) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
func (t logByTimestamp) Less(i, j int) bool { return t[i].Timestamp.Before(t[j].Timestamp) }

func sortLogs(logs []Log) {
	sort.Sort(logByTimestamp(logs))
	for _, log := range logs {
		sortTags(log.Fields)
	}
}

func sortProcess(process *Process) {
	if process != nil {
		sortTags(process.Tags)
	}
}
