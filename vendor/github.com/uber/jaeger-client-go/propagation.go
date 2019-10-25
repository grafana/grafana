// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net/url"
	"strings"
	"sync"

	opentracing "github.com/opentracing/opentracing-go"
)

// Injector is responsible for injecting SpanContext instances in a manner suitable
// for propagation via a format-specific "carrier" object. Typically the
// injection will take place across an RPC boundary, but message queues and
// other IPC mechanisms are also reasonable places to use an Injector.
type Injector interface {
	// Inject takes `SpanContext` and injects it into `carrier`. The actual type
	// of `carrier` depends on the `format` passed to `Tracer.Inject()`.
	//
	// Implementations may return opentracing.ErrInvalidCarrier or any other
	// implementation-specific error if injection fails.
	Inject(ctx SpanContext, carrier interface{}) error
}

// Extractor is responsible for extracting SpanContext instances from a
// format-specific "carrier" object. Typically the extraction will take place
// on the server side of an RPC boundary, but message queues and other IPC
// mechanisms are also reasonable places to use an Extractor.
type Extractor interface {
	// Extract decodes a SpanContext instance from the given `carrier`,
	// or (nil, opentracing.ErrSpanContextNotFound) if no context could
	// be found in the `carrier`.
	Extract(carrier interface{}) (SpanContext, error)
}

// TextMapPropagator is a combined Injector and Extractor for TextMap format
type TextMapPropagator struct {
	headerKeys  *HeadersConfig
	metrics     Metrics
	encodeValue func(string) string
	decodeValue func(string) string
}

// NewTextMapPropagator creates a combined Injector and Extractor for TextMap format
func NewTextMapPropagator(headerKeys *HeadersConfig, metrics Metrics) *TextMapPropagator {
	return &TextMapPropagator{
		headerKeys: headerKeys,
		metrics:    metrics,
		encodeValue: func(val string) string {
			return val
		},
		decodeValue: func(val string) string {
			return val
		},
	}
}

// NewHTTPHeaderPropagator creates a combined Injector and Extractor for HTTPHeaders format
func NewHTTPHeaderPropagator(headerKeys *HeadersConfig, metrics Metrics) *TextMapPropagator {
	return &TextMapPropagator{
		headerKeys: headerKeys,
		metrics:    metrics,
		encodeValue: func(val string) string {
			return url.QueryEscape(val)
		},
		decodeValue: func(val string) string {
			// ignore decoding errors, cannot do anything about them
			if v, err := url.QueryUnescape(val); err == nil {
				return v
			}
			return val
		},
	}
}

// BinaryPropagator is a combined Injector and Extractor for Binary format
type BinaryPropagator struct {
	tracer  *Tracer
	buffers sync.Pool
}

// NewBinaryPropagator creates a combined Injector and Extractor for Binary format
func NewBinaryPropagator(tracer *Tracer) *BinaryPropagator {
	return &BinaryPropagator{
		tracer:  tracer,
		buffers: sync.Pool{New: func() interface{} { return &bytes.Buffer{} }},
	}
}

// Inject implements Injector of TextMapPropagator
func (p *TextMapPropagator) Inject(
	sc SpanContext,
	abstractCarrier interface{},
) error {
	textMapWriter, ok := abstractCarrier.(opentracing.TextMapWriter)
	if !ok {
		return opentracing.ErrInvalidCarrier
	}

	// Do not encode the string with trace context to avoid accidental double-encoding
	// if people are using opentracing < 0.10.0. Our colon-separated representation
	// of the trace context is already safe for HTTP headers.
	textMapWriter.Set(p.headerKeys.TraceContextHeaderName, sc.String())
	for k, v := range sc.baggage {
		safeKey := p.addBaggageKeyPrefix(k)
		safeVal := p.encodeValue(v)
		textMapWriter.Set(safeKey, safeVal)
	}
	return nil
}

// Extract implements Extractor of TextMapPropagator
func (p *TextMapPropagator) Extract(abstractCarrier interface{}) (SpanContext, error) {
	textMapReader, ok := abstractCarrier.(opentracing.TextMapReader)
	if !ok {
		return emptyContext, opentracing.ErrInvalidCarrier
	}
	var ctx SpanContext
	var baggage map[string]string
	err := textMapReader.ForeachKey(func(rawKey, value string) error {
		key := strings.ToLower(rawKey) // TODO not necessary for plain TextMap
		if key == p.headerKeys.TraceContextHeaderName {
			var err error
			safeVal := p.decodeValue(value)
			if ctx, err = ContextFromString(safeVal); err != nil {
				return err
			}
		} else if key == p.headerKeys.JaegerDebugHeader {
			ctx.debugID = p.decodeValue(value)
		} else if key == p.headerKeys.JaegerBaggageHeader {
			if baggage == nil {
				baggage = make(map[string]string)
			}
			for k, v := range p.parseCommaSeparatedMap(value) {
				baggage[k] = v
			}
		} else if strings.HasPrefix(key, p.headerKeys.TraceBaggageHeaderPrefix) {
			if baggage == nil {
				baggage = make(map[string]string)
			}
			safeKey := p.removeBaggageKeyPrefix(key)
			safeVal := p.decodeValue(value)
			baggage[safeKey] = safeVal
		}
		return nil
	})
	if err != nil {
		p.metrics.DecodingErrors.Inc(1)
		return emptyContext, err
	}
	if !ctx.traceID.IsValid() && ctx.debugID == "" && len(baggage) == 0 {
		return emptyContext, opentracing.ErrSpanContextNotFound
	}
	ctx.baggage = baggage
	return ctx, nil
}

// Inject implements Injector of BinaryPropagator
func (p *BinaryPropagator) Inject(
	sc SpanContext,
	abstractCarrier interface{},
) error {
	carrier, ok := abstractCarrier.(io.Writer)
	if !ok {
		return opentracing.ErrInvalidCarrier
	}

	// Handle the tracer context
	if err := binary.Write(carrier, binary.BigEndian, sc.traceID); err != nil {
		return err
	}
	if err := binary.Write(carrier, binary.BigEndian, sc.spanID); err != nil {
		return err
	}
	if err := binary.Write(carrier, binary.BigEndian, sc.parentID); err != nil {
		return err
	}
	if err := binary.Write(carrier, binary.BigEndian, sc.flags); err != nil {
		return err
	}

	// Handle the baggage items
	if err := binary.Write(carrier, binary.BigEndian, int32(len(sc.baggage))); err != nil {
		return err
	}
	for k, v := range sc.baggage {
		if err := binary.Write(carrier, binary.BigEndian, int32(len(k))); err != nil {
			return err
		}
		io.WriteString(carrier, k)
		if err := binary.Write(carrier, binary.BigEndian, int32(len(v))); err != nil {
			return err
		}
		io.WriteString(carrier, v)
	}

	return nil
}

// Extract implements Extractor of BinaryPropagator
func (p *BinaryPropagator) Extract(abstractCarrier interface{}) (SpanContext, error) {
	carrier, ok := abstractCarrier.(io.Reader)
	if !ok {
		return emptyContext, opentracing.ErrInvalidCarrier
	}
	var ctx SpanContext

	if err := binary.Read(carrier, binary.BigEndian, &ctx.traceID); err != nil {
		return emptyContext, opentracing.ErrSpanContextCorrupted
	}
	if err := binary.Read(carrier, binary.BigEndian, &ctx.spanID); err != nil {
		return emptyContext, opentracing.ErrSpanContextCorrupted
	}
	if err := binary.Read(carrier, binary.BigEndian, &ctx.parentID); err != nil {
		return emptyContext, opentracing.ErrSpanContextCorrupted
	}
	if err := binary.Read(carrier, binary.BigEndian, &ctx.flags); err != nil {
		return emptyContext, opentracing.ErrSpanContextCorrupted
	}

	// Handle the baggage items
	var numBaggage int32
	if err := binary.Read(carrier, binary.BigEndian, &numBaggage); err != nil {
		return emptyContext, opentracing.ErrSpanContextCorrupted
	}
	if iNumBaggage := int(numBaggage); iNumBaggage > 0 {
		ctx.baggage = make(map[string]string, iNumBaggage)
		buf := p.buffers.Get().(*bytes.Buffer)
		defer p.buffers.Put(buf)

		var keyLen, valLen int32
		for i := 0; i < iNumBaggage; i++ {
			if err := binary.Read(carrier, binary.BigEndian, &keyLen); err != nil {
				return emptyContext, opentracing.ErrSpanContextCorrupted
			}
			buf.Reset()
			buf.Grow(int(keyLen))
			if n, err := io.CopyN(buf, carrier, int64(keyLen)); err != nil || int32(n) != keyLen {
				return emptyContext, opentracing.ErrSpanContextCorrupted
			}
			key := buf.String()

			if err := binary.Read(carrier, binary.BigEndian, &valLen); err != nil {
				return emptyContext, opentracing.ErrSpanContextCorrupted
			}
			buf.Reset()
			buf.Grow(int(valLen))
			if n, err := io.CopyN(buf, carrier, int64(valLen)); err != nil || int32(n) != valLen {
				return emptyContext, opentracing.ErrSpanContextCorrupted
			}
			ctx.baggage[key] = buf.String()
		}
	}

	return ctx, nil
}

// Converts a comma separated key value pair list into a map
// e.g. key1=value1, key2=value2, key3 = value3
// is converted to map[string]string { "key1" : "value1",
//                                     "key2" : "value2",
//                                     "key3" : "value3" }
func (p *TextMapPropagator) parseCommaSeparatedMap(value string) map[string]string {
	baggage := make(map[string]string)
	value, err := url.QueryUnescape(value)
	if err != nil {
		log.Printf("Unable to unescape %s, %v", value, err)
		return baggage
	}
	for _, kvpair := range strings.Split(value, ",") {
		kv := strings.Split(strings.TrimSpace(kvpair), "=")
		if len(kv) == 2 {
			baggage[kv[0]] = kv[1]
		} else {
			log.Printf("Malformed value passed in for %s", p.headerKeys.JaegerBaggageHeader)
		}
	}
	return baggage
}

// Converts a baggage item key into an http header format,
// by prepending TraceBaggageHeaderPrefix and encoding the key string
func (p *TextMapPropagator) addBaggageKeyPrefix(key string) string {
	// TODO encodeBaggageKeyAsHeader add caching and escaping
	return fmt.Sprintf("%v%v", p.headerKeys.TraceBaggageHeaderPrefix, key)
}

func (p *TextMapPropagator) removeBaggageKeyPrefix(key string) string {
	// TODO decodeBaggageHeaderKey add caching and escaping
	return key[len(p.headerKeys.TraceBaggageHeaderPrefix):]
}
