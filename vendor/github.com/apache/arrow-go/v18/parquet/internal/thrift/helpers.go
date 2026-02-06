// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package thrift is just some useful helpers for interacting with thrift to
// make other code easier to read/write and centralize interactions.
package thrift

import (
	"bytes"
	"context"
	"io"

	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	"github.com/apache/thrift/lib/go/thrift"
)

// default factory for creating thrift protocols for serialization/deserialization
var protocolFactory = thrift.NewTCompactProtocolFactoryConf(&thrift.TConfiguration{})

// DeserializeThrift deserializes the bytes in buf into the given thrift msg type
// returns the number of remaining bytes in the buffer that weren't needed for deserialization
// and any error if there was one, or nil.
func DeserializeThrift(msg thrift.TStruct, buf []byte) (remain uint64, err error) {
	tbuf := &thrift.TMemoryBuffer{Buffer: bytes.NewBuffer(buf)}
	err = msg.Read(context.TODO(), protocolFactory.GetProtocol(tbuf))
	remain = tbuf.RemainingBytes()
	return
}

// SerializeThriftStream writes out the serialized bytes of the passed in type
// to the given writer stream.
func SerializeThriftStream(msg thrift.TStruct, w io.Writer) error {
	return msg.Write(context.TODO(), protocolFactory.GetProtocol(thrift.NewStreamTransportW(w)))
}

// DeserializeThriftStream populates the given msg by reading from the provided
// stream until it completes the deserialization.
func DeserializeThriftStream(msg thrift.TStruct, r io.Reader) error {
	return msg.Read(context.TODO(), protocolFactory.GetProtocol(thrift.NewStreamTransportR(r)))
}

// Serializer is an object that can stick around to provide convenience
// functions and allow object reuse
type Serializer struct {
	thrift.TSerializer
}

// NewThriftSerializer constructs a serializer with a default buffer of 1024
func NewThriftSerializer() *Serializer {
	tbuf := thrift.NewTMemoryBufferLen(1024)
	return &Serializer{thrift.TSerializer{
		Transport: tbuf,
		Protocol:  protocolFactory.GetProtocol(tbuf),
	}}
}

// Serialize will serialize the given msg to the writer stream w, optionally encrypting it on the way
// if enc is not nil, returning the total number of bytes written and any error received, or nil
func (t *Serializer) Serialize(msg thrift.TStruct, w io.Writer, enc encryption.Encryptor) (int, error) {
	b, err := t.Write(context.Background(), msg)
	if err != nil {
		return 0, err
	}

	if enc == nil {
		return w.Write(b)
	}

	var cipherBuf bytes.Buffer
	cipherBuf.Grow(enc.CiphertextSizeDelta() + len(b))
	enc.Encrypt(&cipherBuf, b)
	n, err := cipherBuf.WriteTo(w)
	return int(n), err
}
