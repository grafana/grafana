// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	"go.opentelemetry.io/collector/pdata/internal/data"
	"go.opentelemetry.io/collector/pdata/internal/json"
)

func DeleteOrigTraceID(*data.TraceID, bool) {}

func DeleteOrigSpanID(*data.SpanID, bool) {}

func DeleteOrigProfileID(*data.ProfileID, bool) {}

func GenTestOrigTraceID() *data.TraceID {
	id := data.TraceID([16]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
	return &id
}

func GenTestOrigSpanID() *data.SpanID {
	id := data.SpanID([8]byte{1, 2, 3, 4, 5, 6, 7, 8})
	return &id
}

func GenTestOrigProfileID() *data.ProfileID {
	id := data.ProfileID([16]byte{16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1})
	return &id
}

func MarshalJSONOrigTraceID(id *data.TraceID, dest *json.Stream) {
	id.MarshalJSONStream(dest)
}

func MarshalJSONOrigSpanID(id *data.SpanID, dest *json.Stream) {
	id.MarshalJSONStream(dest)
}

func MarshalJSONOrigProfileID(id *data.ProfileID, dest *json.Stream) {
	id.MarshalJSONStream(dest)
}

func UnmarshalJSONOrigTraceID(id *data.TraceID, iter *json.Iterator) {
	id.UnmarshalJSONIter(iter)
}

func UnmarshalJSONOrigSpanID(id *data.SpanID, iter *json.Iterator) {
	id.UnmarshalJSONIter(iter)
}

func UnmarshalJSONOrigProfileID(id *data.ProfileID, iter *json.Iterator) {
	id.UnmarshalJSONIter(iter)
}

func SizeProtoOrigTraceID(id *data.TraceID) int {
	return id.Size()
}

func SizeProtoOrigSpanID(id *data.SpanID) int {
	return id.Size()
}

func SizeProtoOrigProfileID(id *data.ProfileID) int {
	return id.Size()
}

func MarshalProtoOrigTraceID(id *data.TraceID, buf []byte) int {
	size := id.Size()
	_, _ = id.MarshalTo(buf[len(buf)-size:])
	return size
}

func MarshalProtoOrigSpanID(id *data.SpanID, buf []byte) int {
	size := id.Size()
	_, _ = id.MarshalTo(buf[len(buf)-size:])
	return size
}

func MarshalProtoOrigProfileID(id *data.ProfileID, buf []byte) int {
	size := id.Size()
	_, _ = id.MarshalTo(buf[len(buf)-size:])
	return size
}

func UnmarshalProtoOrigTraceID(id *data.TraceID, buf []byte) error {
	return id.Unmarshal(buf)
}

func UnmarshalProtoOrigSpanID(id *data.SpanID, buf []byte) error {
	return id.Unmarshal(buf)
}

func UnmarshalProtoOrigProfileID(id *data.ProfileID, buf []byte) error {
	return id.Unmarshal(buf)
}
