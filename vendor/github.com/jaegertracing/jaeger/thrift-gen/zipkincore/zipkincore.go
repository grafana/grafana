// Copyright (c) 2025 The Jaeger Authors.
// SPDX-License-Identifier: Apache-2.0

package zipkincore

import (
	modelv1 "github.com/jaegertracing/jaeger-idl/thrift-gen/zipkincore"
)

type AnnotationType = modelv1.AnnotationType

const (
	AnnotationType_BOOL   = modelv1.AnnotationType_BOOL
	AnnotationType_BYTES  = modelv1.AnnotationType_BYTES
	AnnotationType_I16    = modelv1.AnnotationType_I16
	AnnotationType_I32    = modelv1.AnnotationType_I32
	AnnotationType_I64    = modelv1.AnnotationType_I64
	AnnotationType_DOUBLE = modelv1.AnnotationType_DOUBLE
	AnnotationType_STRING = modelv1.AnnotationType_STRING
)

type Endpoint = modelv1.Endpoint

var NewEndpoint = modelv1.NewEndpoint

type Annotation = modelv1.Annotation

var NewAnnotation = modelv1.NewAnnotation

type BinaryAnnotation = modelv1.BinaryAnnotation

var NewBinaryAnnotation = modelv1.NewBinaryAnnotation

type Span = modelv1.Span

var NewSpan = modelv1.NewSpan

type Response = modelv1.Response

var NewResponse = modelv1.NewResponse

type (
	ZipkinCollector       = modelv1.ZipkinCollector
	ZipkinCollectorClient = modelv1.ZipkinCollectorClient
)

var (
	NewZipkinCollectorClientFactory  = modelv1.NewZipkinCollectorClientFactory
	NewZipkinCollectorClientProtocol = modelv1.NewZipkinCollectorClientProtocol
	NewZipkinCollectorClient         = modelv1.NewZipkinCollectorClient
)

type ZipkinCollectorProcessor = modelv1.ZipkinCollectorProcessor

var NewZipkinCollectorProcessor = modelv1.NewZipkinCollectorProcessor

const (
	CLIENT_SEND          = modelv1.CLIENT_SEND
	CLIENT_RECV          = modelv1.CLIENT_RECV
	SERVER_SEND          = modelv1.SERVER_SEND
	SERVER_RECV          = modelv1.SERVER_RECV
	MESSAGE_SEND         = modelv1.MESSAGE_SEND
	MESSAGE_RECV         = modelv1.MESSAGE_RECV
	WIRE_SEND            = modelv1.WIRE_SEND
	WIRE_RECV            = modelv1.WIRE_RECV
	CLIENT_SEND_FRAGMENT = modelv1.CLIENT_SEND_FRAGMENT
	CLIENT_RECV_FRAGMENT = modelv1.CLIENT_RECV_FRAGMENT
	SERVER_SEND_FRAGMENT = modelv1.SERVER_SEND_FRAGMENT
	SERVER_RECV_FRAGMENT = modelv1.SERVER_RECV_FRAGMENT
	LOCAL_COMPONENT      = modelv1.LOCAL_COMPONENT
	CLIENT_ADDR          = modelv1.CLIENT_ADDR
	SERVER_ADDR          = modelv1.SERVER_ADDR
	MESSAGE_ADDR         = modelv1.MESSAGE_ADDR
)
