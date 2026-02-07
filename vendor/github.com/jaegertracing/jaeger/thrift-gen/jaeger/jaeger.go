// Copyright (c) 2025 The Jaeger Authors.
// SPDX-License-Identifier: Apache-2.0

package jaeger

import (
	modelv1 "github.com/jaegertracing/jaeger-idl/thrift-gen/jaeger"
)

type TagType = modelv1.TagType

const (
	TagType_STRING = modelv1.TagType_STRING
	TagType_DOUBLE = modelv1.TagType_DOUBLE
	TagType_BOOL   = modelv1.TagType_BOOL
	TagType_LONG   = modelv1.TagType_LONG
	TagType_BINARY = modelv1.TagType_BINARY
)

type SpanRefType = modelv1.SpanRefType

const (
	SpanRefType_CHILD_OF     = modelv1.SpanRefType_CHILD_OF
	SpanRefType_FOLLOWS_FROM = modelv1.SpanRefType_FOLLOWS_FROM
)

type Tag = modelv1.Tag

var NewTag = modelv1.NewTag

type Log = modelv1.Log

var NewLog = modelv1.NewLog

type SpanRef = modelv1.SpanRef

var NewSpanRef = modelv1.NewSpanRef

type Span = modelv1.Span

var NewSpan = modelv1.NewSpan

type Process = modelv1.Process

var NewProcess = modelv1.NewProcess

type Batch = modelv1.Batch

var NewBatch = modelv1.NewBatch

type BatchSubmitResponse = modelv1.BatchSubmitResponse

var NewBatchSubmitResponse = modelv1.NewBatchSubmitResponse

type ClientStats = modelv1.ClientStats

var NewClientStats = modelv1.NewClientStats

type (
	Collector       = modelv1.Collector
	CollectorClient = modelv1.CollectorClient
)

var (
	NewCollectorClientFactory  = modelv1.NewCollectorClientFactory
	NewCollectorClientProtocol = modelv1.NewCollectorClientProtocol
	NewCollectorClient         = modelv1.NewCollectorClient
)

type CollectorProcessor = modelv1.CollectorProcessor

var NewCollectorProcessor = modelv1.NewCollectorProcessor
