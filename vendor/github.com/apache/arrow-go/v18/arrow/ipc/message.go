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

package ipc

import (
	"encoding/binary"
	"fmt"
	"io"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/internal/flatbuf"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

// MetadataVersion represents the Arrow metadata version.
type MetadataVersion flatbuf.MetadataVersion

const (
	MetadataV1 = MetadataVersion(flatbuf.MetadataVersionV1) // version for Arrow Format-0.1.0
	MetadataV2 = MetadataVersion(flatbuf.MetadataVersionV2) // version for Arrow Format-0.2.0
	MetadataV3 = MetadataVersion(flatbuf.MetadataVersionV3) // version for Arrow Format-0.3.0 to 0.7.1
	MetadataV4 = MetadataVersion(flatbuf.MetadataVersionV4) // version for >= Arrow Format-0.8.0
	MetadataV5 = MetadataVersion(flatbuf.MetadataVersionV5) // version for >= Arrow Format-1.0.0, backward compatible with v4
)

func (m MetadataVersion) String() string {
	if v, ok := flatbuf.EnumNamesMetadataVersion[flatbuf.MetadataVersion(m)]; ok {
		return v
	}
	return fmt.Sprintf("MetadataVersion(%d)", int16(m))
}

// MessageType represents the type of Message in an Arrow format.
type MessageType flatbuf.MessageHeader

const (
	MessageNone            = MessageType(flatbuf.MessageHeaderNONE)
	MessageSchema          = MessageType(flatbuf.MessageHeaderSchema)
	MessageDictionaryBatch = MessageType(flatbuf.MessageHeaderDictionaryBatch)
	MessageRecordBatch     = MessageType(flatbuf.MessageHeaderRecordBatch)
	MessageTensor          = MessageType(flatbuf.MessageHeaderTensor)
	MessageSparseTensor    = MessageType(flatbuf.MessageHeaderSparseTensor)
)

func (m MessageType) String() string {
	if v, ok := flatbuf.EnumNamesMessageHeader[flatbuf.MessageHeader(m)]; ok {
		return v
	}
	return fmt.Sprintf("MessageType(%d)", int(m))
}

// Message is an IPC message, including metadata and body.
type Message struct {
	refCount atomic.Int64
	msg      *flatbuf.Message
	meta     *memory.Buffer
	body     *memory.Buffer
}

// NewMessage creates a new message from the metadata and body buffers.
// NewMessage panics if any of these buffers is nil.
func NewMessage(meta, body *memory.Buffer) *Message {
	if meta == nil || body == nil {
		panic("arrow/ipc: nil buffers")
	}
	meta.Retain()
	body.Retain()
	m := &Message{
		msg:  flatbuf.GetRootAsMessage(meta.Bytes(), 0),
		meta: meta,
		body: body,
	}
	m.refCount.Add(1)
	return m
}

func newMessageFromFB(meta *flatbuf.Message, body *memory.Buffer) *Message {
	if meta == nil || body == nil {
		panic("arrow/ipc: nil buffers")
	}
	body.Retain()
	m := &Message{
		msg:  meta,
		meta: memory.NewBufferBytes(meta.Table().Bytes),
		body: body,
	}
	m.refCount.Add(1)
	return m
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (msg *Message) Retain() {
	msg.refCount.Add(1)
}

// Release decreases the reference count by 1.
// Release may be called simultaneously from multiple goroutines.
// When the reference count goes to zero, the memory is freed.
func (msg *Message) Release() {
	debug.Assert(msg.refCount.Load() > 0, "too many releases")

	if msg.refCount.Add(-1) == 0 {
		msg.meta.Release()
		msg.body.Release()
		msg.msg = nil
		msg.meta = nil
		msg.body = nil
	}
}

func (msg *Message) Version() MetadataVersion {
	return MetadataVersion(msg.msg.Version())
}

func (msg *Message) Type() MessageType {
	return MessageType(msg.msg.HeaderType())
}

func (msg *Message) BodyLen() int64 {
	return msg.msg.BodyLength()
}

type MessageReader interface {
	Message() (*Message, error)
	Release()
	Retain()
}

// MessageReader reads messages from an io.Reader.
type messageReader struct {
	r io.Reader

	refCount atomic.Int64
	msg      *Message

	mem memory.Allocator
}

// NewMessageReader returns a reader that reads messages from an input stream.
func NewMessageReader(r io.Reader, opts ...Option) MessageReader {
	cfg := newConfig()
	for _, opt := range opts {
		opt(cfg)
	}

	mr := &messageReader{r: r, mem: cfg.alloc}
	mr.refCount.Add(1)
	return mr
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (r *messageReader) Retain() {
	r.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (r *messageReader) Release() {
	debug.Assert(r.refCount.Load() > 0, "too many releases")

	if r.refCount.Add(-1) == 0 {
		if r.msg != nil {
			r.msg.Release()
			r.msg = nil
		}
	}
}

// Message returns the current message that has been extracted from the
// underlying stream.
// It is valid until the next call to Message.
func (r *messageReader) Message() (*Message, error) {
	buf := make([]byte, 4)
	_, err := io.ReadFull(r.r, buf)
	if err != nil {
		return nil, fmt.Errorf("arrow/ipc: could not read continuation indicator: %w", err)
	}
	var (
		cid    = binary.LittleEndian.Uint32(buf)
		msgLen int32
	)
	switch cid {
	case 0:
		// EOS message.
		return nil, io.EOF // FIXME(sbinet): send nil instead? or a special EOS error?
	case kIPCContToken:
		_, err = io.ReadFull(r.r, buf)
		if err != nil {
			return nil, fmt.Errorf("arrow/ipc: could not read message length: %w", err)
		}
		msgLen = int32(binary.LittleEndian.Uint32(buf))
		if msgLen == 0 {
			// optional 0 EOS control message
			return nil, io.EOF // FIXME(sbinet): send nil instead? or a special EOS error?
		}

	default:
		// ARROW-6314: backwards compatibility for reading old IPC
		// messages produced prior to version 0.15.0
		msgLen = int32(cid)
	}

	buf = make([]byte, msgLen)
	_, err = io.ReadFull(r.r, buf)
	if err != nil {
		return nil, fmt.Errorf("arrow/ipc: could not read message metadata: %w", err)
	}

	meta := flatbuf.GetRootAsMessage(buf, 0)
	bodyLen := meta.BodyLength()

	body := memory.NewResizableBuffer(r.mem)
	defer body.Release()
	body.Resize(int(bodyLen))

	_, err = io.ReadFull(r.r, body.Bytes())
	if err != nil {
		return nil, fmt.Errorf("arrow/ipc: could not read message body: %w", err)
	}

	if r.msg != nil {
		r.msg.Release()
		r.msg = nil
	}
	r.msg = newMessageFromFB(meta, body)

	return r.msg, nil
}
