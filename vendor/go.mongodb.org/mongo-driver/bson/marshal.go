// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bson

import (
	"bytes"
	"encoding/json"
	"sync"

	"go.mongodb.org/mongo-driver/bson/bsoncodec"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

const defaultDstCap = 256

var bvwPool = bsonrw.NewBSONValueWriterPool()
var extjPool = bsonrw.NewExtJSONValueWriterPool()

// Marshaler is the interface implemented by types that can marshal themselves
// into a valid BSON document.
//
// Implementations of Marshaler must return a full BSON document. To create
// custom BSON marshaling behavior for individual values in a BSON document,
// implement the ValueMarshaler interface instead.
type Marshaler interface {
	MarshalBSON() ([]byte, error)
}

// ValueMarshaler is the interface implemented by types that can marshal
// themselves into a valid BSON value. The format of the returned bytes must
// match the returned type.
//
// Implementations of ValueMarshaler must return an individual BSON value. To
// create custom BSON marshaling behavior for an entire BSON document, implement
// the Marshaler interface instead.
type ValueMarshaler interface {
	MarshalBSONValue() (bsontype.Type, []byte, error)
}

// Marshal returns the BSON encoding of val as a BSON document. If val is not a type that can be transformed into a
// document, MarshalValue should be used instead.
//
// Marshal will use the default registry created by NewRegistry to recursively
// marshal val into a []byte. Marshal will inspect struct tags and alter the
// marshaling process accordingly.
func Marshal(val interface{}) ([]byte, error) {
	return MarshalWithRegistry(DefaultRegistry, val)
}

// MarshalAppend will encode val as a BSON document and append the bytes to dst. If dst is not large enough to hold the
// bytes, it will be grown. If val is not a type that can be transformed into a document, MarshalValueAppend should be
// used instead.
//
// Deprecated: Use [NewEncoder] and pass the dst byte slice (wrapped by a bytes.Buffer) into
// [bsonrw.NewBSONValueWriter]:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//
// See [Encoder] for more examples.
func MarshalAppend(dst []byte, val interface{}) ([]byte, error) {
	return MarshalAppendWithRegistry(DefaultRegistry, dst, val)
}

// MarshalWithRegistry returns the BSON encoding of val as a BSON document. If val is not a type that can be transformed
// into a document, MarshalValueWithRegistry should be used instead.
//
// Deprecated: Use [NewEncoder] and specify the Registry by calling [Encoder.SetRegistry] instead:
//
//	buf := new(bytes.Buffer)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.SetRegistry(reg)
//
// See [Encoder] for more examples.
func MarshalWithRegistry(r *bsoncodec.Registry, val interface{}) ([]byte, error) {
	dst := make([]byte, 0)
	return MarshalAppendWithRegistry(r, dst, val)
}

// MarshalWithContext returns the BSON encoding of val as a BSON document using EncodeContext ec. If val is not a type
// that can be transformed into a document, MarshalValueWithContext should be used instead.
//
// Deprecated: Use [NewEncoder] and use the Encoder configuration methods to set the desired marshal
// behavior instead:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.IntMinSize()
//
// See [Encoder] for more examples.
func MarshalWithContext(ec bsoncodec.EncodeContext, val interface{}) ([]byte, error) {
	dst := make([]byte, 0)
	return MarshalAppendWithContext(ec, dst, val)
}

// MarshalAppendWithRegistry will encode val as a BSON document using Registry r and append the bytes to dst. If dst is
// not large enough to hold the bytes, it will be grown. If val is not a type that can be transformed into a document,
// MarshalValueAppendWithRegistry should be used instead.
//
// Deprecated: Use [NewEncoder], and pass the dst byte slice (wrapped by a bytes.Buffer) into
// [bsonrw.NewBSONValueWriter], and specify the Registry by calling [Encoder.SetRegistry] instead:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.SetRegistry(reg)
//
// See [Encoder] for more examples.
func MarshalAppendWithRegistry(r *bsoncodec.Registry, dst []byte, val interface{}) ([]byte, error) {
	return MarshalAppendWithContext(bsoncodec.EncodeContext{Registry: r}, dst, val)
}

// Pool of buffers for marshalling BSON.
var bufPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

// MarshalAppendWithContext will encode val as a BSON document using Registry r and EncodeContext ec and append the
// bytes to dst. If dst is not large enough to hold the bytes, it will be grown. If val is not a type that can be
// transformed into a document, MarshalValueAppendWithContext should be used instead.
//
// Deprecated: Use [NewEncoder], pass the dst byte slice (wrapped by a bytes.Buffer) into
// [bsonrw.NewBSONValueWriter], and use the Encoder configuration methods to set the desired marshal
// behavior instead:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.IntMinSize()
//
// See [Encoder] for more examples.
func MarshalAppendWithContext(ec bsoncodec.EncodeContext, dst []byte, val interface{}) ([]byte, error) {
	sw := bufPool.Get().(*bytes.Buffer)
	defer func() {
		// Proper usage of a sync.Pool requires each entry to have approximately
		// the same memory cost. To obtain this property when the stored type
		// contains a variably-sized buffer, we add a hard limit on the maximum
		// buffer to place back in the pool. We limit the size to 16MiB because
		// that's the maximum wire message size supported by any current MongoDB
		// server.
		//
		// Comment based on
		// https://cs.opensource.google/go/go/+/refs/tags/go1.19:src/fmt/print.go;l=147
		//
		// Recycle byte slices that are smaller than 16MiB and at least half
		// occupied.
		if sw.Cap() < 16*1024*1024 && sw.Cap()/2 < sw.Len() {
			bufPool.Put(sw)
		}
	}()

	sw.Reset()
	vw := bvwPool.Get(sw)
	defer bvwPool.Put(vw)

	enc := encPool.Get().(*Encoder)
	defer encPool.Put(enc)

	err := enc.Reset(vw)
	if err != nil {
		return nil, err
	}
	err = enc.SetContext(ec)
	if err != nil {
		return nil, err
	}

	err = enc.Encode(val)
	if err != nil {
		return nil, err
	}

	return append(dst, sw.Bytes()...), nil
}

// MarshalValue returns the BSON encoding of val.
//
// MarshalValue will use bson.DefaultRegistry to transform val into a BSON value. If val is a struct, this function will
// inspect struct tags and alter the marshalling process accordingly.
func MarshalValue(val interface{}) (bsontype.Type, []byte, error) {
	return MarshalValueWithRegistry(DefaultRegistry, val)
}

// MarshalValueAppend will append the BSON encoding of val to dst. If dst is not large enough to hold the BSON encoding
// of val, dst will be grown.
//
// Deprecated: Appending individual BSON elements to an existing slice will not be supported in Go
// Driver 2.0.
func MarshalValueAppend(dst []byte, val interface{}) (bsontype.Type, []byte, error) {
	return MarshalValueAppendWithRegistry(DefaultRegistry, dst, val)
}

// MarshalValueWithRegistry returns the BSON encoding of val using Registry r.
//
// Deprecated: Using a custom registry to marshal individual BSON values will not be supported in Go
// Driver 2.0.
func MarshalValueWithRegistry(r *bsoncodec.Registry, val interface{}) (bsontype.Type, []byte, error) {
	dst := make([]byte, 0)
	return MarshalValueAppendWithRegistry(r, dst, val)
}

// MarshalValueWithContext returns the BSON encoding of val using EncodeContext ec.
//
// Deprecated: Using a custom EncodeContext to marshal individual BSON elements will not be
// supported in Go Driver 2.0.
func MarshalValueWithContext(ec bsoncodec.EncodeContext, val interface{}) (bsontype.Type, []byte, error) {
	dst := make([]byte, 0)
	return MarshalValueAppendWithContext(ec, dst, val)
}

// MarshalValueAppendWithRegistry will append the BSON encoding of val to dst using Registry r. If dst is not large
// enough to hold the BSON encoding of val, dst will be grown.
//
// Deprecated: Appending individual BSON elements to an existing slice will not be supported in Go
// Driver 2.0.
func MarshalValueAppendWithRegistry(r *bsoncodec.Registry, dst []byte, val interface{}) (bsontype.Type, []byte, error) {
	return MarshalValueAppendWithContext(bsoncodec.EncodeContext{Registry: r}, dst, val)
}

// MarshalValueAppendWithContext will append the BSON encoding of val to dst using EncodeContext ec. If dst is not large
// enough to hold the BSON encoding of val, dst will be grown.
//
// Deprecated: Appending individual BSON elements to an existing slice will not be supported in Go
// Driver 2.0.
func MarshalValueAppendWithContext(ec bsoncodec.EncodeContext, dst []byte, val interface{}) (bsontype.Type, []byte, error) {
	// get a ValueWriter configured to write to dst
	sw := new(bsonrw.SliceWriter)
	*sw = dst
	vwFlusher := bvwPool.GetAtModeElement(sw)

	// get an Encoder and encode the value
	enc := encPool.Get().(*Encoder)
	defer encPool.Put(enc)
	if err := enc.Reset(vwFlusher); err != nil {
		return 0, nil, err
	}
	if err := enc.SetContext(ec); err != nil {
		return 0, nil, err
	}
	if err := enc.Encode(val); err != nil {
		return 0, nil, err
	}

	// flush the bytes written because we cannot guarantee that a full document has been written
	// after the flush, *sw will be in the format
	// [value type, 0 (null byte to indicate end of empty element name), value bytes..]
	if err := vwFlusher.Flush(); err != nil {
		return 0, nil, err
	}
	buffer := *sw
	return bsontype.Type(buffer[0]), buffer[2:], nil
}

// MarshalExtJSON returns the extended JSON encoding of val.
func MarshalExtJSON(val interface{}, canonical, escapeHTML bool) ([]byte, error) {
	return MarshalExtJSONWithRegistry(DefaultRegistry, val, canonical, escapeHTML)
}

// MarshalExtJSONAppend will append the extended JSON encoding of val to dst.
// If dst is not large enough to hold the extended JSON encoding of val, dst
// will be grown.
//
// Deprecated: Use [NewEncoder] and pass the dst byte slice (wrapped by a bytes.Buffer) into
// [bsonrw.NewExtJSONValueWriter] instead:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewExtJSONValueWriter(buf, true, false)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//
// See [Encoder] for more examples.
func MarshalExtJSONAppend(dst []byte, val interface{}, canonical, escapeHTML bool) ([]byte, error) {
	return MarshalExtJSONAppendWithRegistry(DefaultRegistry, dst, val, canonical, escapeHTML)
}

// MarshalExtJSONWithRegistry returns the extended JSON encoding of val using Registry r.
//
// Deprecated: Use [NewEncoder] and specify the Registry by calling [Encoder.SetRegistry] instead:
//
//	buf := new(bytes.Buffer)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.SetRegistry(reg)
//
// See [Encoder] for more examples.
func MarshalExtJSONWithRegistry(r *bsoncodec.Registry, val interface{}, canonical, escapeHTML bool) ([]byte, error) {
	dst := make([]byte, 0, defaultDstCap)
	return MarshalExtJSONAppendWithContext(bsoncodec.EncodeContext{Registry: r}, dst, val, canonical, escapeHTML)
}

// MarshalExtJSONWithContext returns the extended JSON encoding of val using Registry r.
//
// Deprecated: Use [NewEncoder] and use the Encoder configuration methods to set the desired marshal
// behavior instead:
//
//	buf := new(bytes.Buffer)
//	vw, err := bsonrw.NewBSONValueWriter(buf)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.IntMinSize()
//
// See [Encoder] for more examples.
func MarshalExtJSONWithContext(ec bsoncodec.EncodeContext, val interface{}, canonical, escapeHTML bool) ([]byte, error) {
	dst := make([]byte, 0, defaultDstCap)
	return MarshalExtJSONAppendWithContext(ec, dst, val, canonical, escapeHTML)
}

// MarshalExtJSONAppendWithRegistry will append the extended JSON encoding of
// val to dst using Registry r. If dst is not large enough to hold the BSON
// encoding of val, dst will be grown.
//
// Deprecated: Use [NewEncoder], pass the dst byte slice (wrapped by a bytes.Buffer) into
// [bsonrw.NewExtJSONValueWriter], and specify the Registry by calling [Encoder.SetRegistry]
// instead:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewExtJSONValueWriter(buf, true, false)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//
// See [Encoder] for more examples.
func MarshalExtJSONAppendWithRegistry(r *bsoncodec.Registry, dst []byte, val interface{}, canonical, escapeHTML bool) ([]byte, error) {
	return MarshalExtJSONAppendWithContext(bsoncodec.EncodeContext{Registry: r}, dst, val, canonical, escapeHTML)
}

// MarshalExtJSONAppendWithContext will append the extended JSON encoding of
// val to dst using Registry r. If dst is not large enough to hold the BSON
// encoding of val, dst will be grown.
//
// Deprecated: Use [NewEncoder], pass the dst byte slice (wrapped by a bytes.Buffer) into
// [bsonrw.NewExtJSONValueWriter], and use the Encoder configuration methods to set the desired marshal
// behavior instead:
//
//	buf := bytes.NewBuffer(dst)
//	vw, err := bsonrw.NewExtJSONValueWriter(buf, true, false)
//	if err != nil {
//		panic(err)
//	}
//	enc, err := bson.NewEncoder(vw)
//	if err != nil {
//		panic(err)
//	}
//	enc.IntMinSize()
//
// See [Encoder] for more examples.
func MarshalExtJSONAppendWithContext(ec bsoncodec.EncodeContext, dst []byte, val interface{}, canonical, escapeHTML bool) ([]byte, error) {
	sw := new(bsonrw.SliceWriter)
	*sw = dst
	ejvw := extjPool.Get(sw, canonical, escapeHTML)
	defer extjPool.Put(ejvw)

	enc := encPool.Get().(*Encoder)
	defer encPool.Put(enc)

	err := enc.Reset(ejvw)
	if err != nil {
		return nil, err
	}
	err = enc.SetContext(ec)
	if err != nil {
		return nil, err
	}

	err = enc.Encode(val)
	if err != nil {
		return nil, err
	}

	return *sw, nil
}

// IndentExtJSON will prefix and indent the provided extended JSON src and append it to dst.
func IndentExtJSON(dst *bytes.Buffer, src []byte, prefix, indent string) error {
	return json.Indent(dst, src, prefix, indent)
}

// MarshalExtJSONIndent returns the extended JSON encoding of val with each line with prefixed
// and indented.
func MarshalExtJSONIndent(val interface{}, canonical, escapeHTML bool, prefix, indent string) ([]byte, error) {
	marshaled, err := MarshalExtJSON(val, canonical, escapeHTML)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	err = IndentExtJSON(&buf, marshaled, prefix, indent)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
