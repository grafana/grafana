// Copyright 2021-2024 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package connect

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
)

// flagEnvelopeCompressed indicates that the data is compressed. It has the
// same meaning in the gRPC-Web, gRPC-HTTP2, and Connect protocols.
const flagEnvelopeCompressed = 0b00000001

var errSpecialEnvelope = errorf(
	CodeUnknown,
	"final message has protocol-specific flags: %w",
	// User code checks for end of stream with errors.Is(err, io.EOF).
	io.EOF,
)

// envelope is a block of arbitrary bytes wrapped in gRPC and Connect's framing
// protocol.
//
// Each message is preceded by a 5-byte prefix. The first byte is a uint8 used
// as a set of bitwise flags, and the remainder is a uint32 indicating the
// message length. gRPC and Connect interpret the bitwise flags differently, so
// envelope leaves their interpretation up to the caller.
type envelope struct {
	Data   *bytes.Buffer
	Flags  uint8
	offset int64
}

var _ messagePayload = (*envelope)(nil)

func (e *envelope) IsSet(flag uint8) bool {
	return e.Flags&flag == flag
}

// Read implements [io.Reader].
func (e *envelope) Read(data []byte) (readN int, err error) {
	if e.offset < 5 {
		prefix := makeEnvelopePrefix(e.Flags, e.Data.Len())
		readN = copy(data, prefix[e.offset:])
		e.offset += int64(readN)
		if e.offset < 5 {
			return readN, nil
		}
		data = data[readN:]
	}
	n := copy(data, e.Data.Bytes()[e.offset-5:])
	e.offset += int64(n)
	readN += n
	if readN == 0 && e.offset == int64(e.Data.Len()+5) {
		err = io.EOF
	}
	return readN, err
}

// WriteTo implements [io.WriterTo].
func (e *envelope) WriteTo(dst io.Writer) (wroteN int64, err error) {
	if e.offset < 5 {
		prefix := makeEnvelopePrefix(e.Flags, e.Data.Len())
		prefixN, err := dst.Write(prefix[e.offset:])
		e.offset += int64(prefixN)
		wroteN += int64(prefixN)
		if e.offset < 5 {
			return wroteN, err
		}
	}
	n, err := dst.Write(e.Data.Bytes()[e.offset-5:])
	e.offset += int64(n)
	wroteN += int64(n)
	return wroteN, err
}

// Seek implements [io.Seeker]. Based on the implementation of [bytes.Reader].
func (e *envelope) Seek(offset int64, whence int) (int64, error) {
	var abs int64
	switch whence {
	case io.SeekStart:
		abs = offset
	case io.SeekCurrent:
		abs = e.offset + offset
	case io.SeekEnd:
		abs = int64(e.Data.Len()) + offset
	default:
		return 0, errors.New("connect.envelope.Seek: invalid whence")
	}
	if abs < 0 {
		return 0, errors.New("connect.envelope.Seek: negative position")
	}
	e.offset = abs
	return abs, nil
}

// Len returns the number of bytes of the unread portion of the envelope.
func (e *envelope) Len() int {
	if length := int(int64(e.Data.Len()) + 5 - e.offset); length > 0 {
		return length
	}
	return 0
}

type envelopeWriter struct {
	ctx              context.Context //nolint:containedctx
	sender           messageSender
	codec            Codec
	compressMinBytes int
	compressionPool  *compressionPool
	bufferPool       *bufferPool
	sendMaxBytes     int
}

func (w *envelopeWriter) Marshal(message any) *Error {
	if message == nil {
		// Send no-op message to create the request and send headers.
		payload := nopPayload{}
		if _, err := w.sender.Send(payload); err != nil {
			if connectErr, ok := asError(err); ok {
				return connectErr
			}
			return NewError(CodeUnknown, err)
		}
		return nil
	}
	if appender, ok := w.codec.(marshalAppender); ok {
		return w.marshalAppend(message, appender)
	}
	return w.marshal(message)
}

// Write writes the enveloped message, compressing as necessary. It doesn't
// retain any references to the supplied envelope or its underlying data.
func (w *envelopeWriter) Write(env *envelope) *Error {
	if env.IsSet(flagEnvelopeCompressed) ||
		w.compressionPool == nil ||
		env.Data.Len() < w.compressMinBytes {
		if w.sendMaxBytes > 0 && env.Data.Len() > w.sendMaxBytes {
			return errorf(CodeResourceExhausted, "message size %d exceeds sendMaxBytes %d", env.Data.Len(), w.sendMaxBytes)
		}
		return w.write(env)
	}
	data := w.bufferPool.Get()
	defer w.bufferPool.Put(data)
	if err := w.compressionPool.Compress(data, env.Data); err != nil {
		return err
	}
	if w.sendMaxBytes > 0 && data.Len() > w.sendMaxBytes {
		return errorf(CodeResourceExhausted, "compressed message size %d exceeds sendMaxBytes %d", data.Len(), w.sendMaxBytes)
	}
	return w.write(&envelope{
		Data:  data,
		Flags: env.Flags | flagEnvelopeCompressed,
	})
}

func (w *envelopeWriter) marshalAppend(message any, codec marshalAppender) *Error {
	// Codec supports MarshalAppend; try to re-use a []byte from the pool.
	buffer := w.bufferPool.Get()
	defer w.bufferPool.Put(buffer)
	raw, err := codec.MarshalAppend(buffer.Bytes(), message)
	if err != nil {
		return errorf(CodeInternal, "marshal message: %w", err)
	}
	if cap(raw) > buffer.Cap() {
		// The buffer from the pool was too small, so MarshalAppend grew the slice.
		// Pessimistically assume that the too-small buffer is insufficient for the
		// application workload, so there's no point in keeping it in the pool.
		// Instead, replace it with the larger, newly-allocated slice. This
		// allocates, but it's a small, constant-size allocation.
		*buffer = *bytes.NewBuffer(raw)
	} else {
		// MarshalAppend didn't allocate, but we need to fix the internal state of
		// the buffer. Compared to replacing the buffer (as above), buffer.Write
		// copies but avoids allocating.
		buffer.Write(raw)
	}
	envelope := &envelope{Data: buffer}
	return w.Write(envelope)
}

func (w *envelopeWriter) marshal(message any) *Error {
	// Codec doesn't support MarshalAppend; let Marshal allocate a []byte.
	raw, err := w.codec.Marshal(message)
	if err != nil {
		return errorf(CodeInternal, "marshal message: %w", err)
	}
	buffer := bytes.NewBuffer(raw)
	// Put our new []byte into the pool for later reuse.
	defer w.bufferPool.Put(buffer)
	envelope := &envelope{Data: buffer}
	return w.Write(envelope)
}

func (w *envelopeWriter) write(env *envelope) *Error {
	if _, err := w.sender.Send(env); err != nil {
		err = wrapIfContextDone(w.ctx, err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return errorf(CodeUnknown, "write envelope: %w", err)
	}
	return nil
}

type envelopeReader struct {
	ctx             context.Context //nolint:containedctx
	reader          io.Reader
	bytesRead       int64 // detect trailers-only gRPC responses
	codec           Codec
	last            envelope
	compressionPool *compressionPool
	bufferPool      *bufferPool
	readMaxBytes    int
}

func (r *envelopeReader) Unmarshal(message any) *Error {
	buffer := r.bufferPool.Get()
	var dontRelease *bytes.Buffer
	defer func() {
		if buffer != dontRelease {
			r.bufferPool.Put(buffer)
		}
	}()

	env := &envelope{Data: buffer}
	err := r.Read(env)
	switch {
	case err == nil && env.IsSet(flagEnvelopeCompressed) && r.compressionPool == nil:
		return errorf(
			CodeInternal,
			"protocol error: sent compressed message without compression support",
		)
	case err == nil &&
		(env.Flags == 0 || env.Flags == flagEnvelopeCompressed) &&
		env.Data.Len() == 0:
		// This is a standard message (because none of the top 7 bits are set) and
		// there's no data, so the zero value of the message is correct.
		return nil
	case err != nil && errors.Is(err, io.EOF):
		// The stream has ended. Propagate the EOF to the caller.
		return err
	case err != nil:
		// Something's wrong.
		return err
	}

	data := env.Data
	if data.Len() > 0 && env.IsSet(flagEnvelopeCompressed) {
		decompressed := r.bufferPool.Get()
		defer func() {
			if decompressed != dontRelease {
				r.bufferPool.Put(decompressed)
			}
		}()
		if err := r.compressionPool.Decompress(decompressed, data, int64(r.readMaxBytes)); err != nil {
			return err
		}
		data = decompressed
	}

	if env.Flags != 0 && env.Flags != flagEnvelopeCompressed {
		// Drain the rest of the stream to ensure there is no extra data.
		numBytes, err := discard(r.reader)
		r.bytesRead += numBytes
		if err != nil {
			err = wrapIfContextError(err)
			if connErr, ok := asError(err); ok {
				return connErr
			}
			return errorf(CodeInternal, "corrupt response: I/O error after end-stream message: %w", err)
		} else if numBytes > 0 {
			return errorf(CodeInternal, "corrupt response: %d extra bytes after end of stream", numBytes)
		}
		// One of the protocol-specific flags are set, so this is the end of the
		// stream. Save the message for protocol-specific code to process and
		// return a sentinel error. We alias the buffer with dontRelease as a
		// way of marking it so above defers don't release it to the pool.
		r.last = envelope{
			Data:  data,
			Flags: env.Flags,
		}
		dontRelease = data
		return errSpecialEnvelope
	}

	if err := r.codec.Unmarshal(data.Bytes(), message); err != nil {
		return errorf(CodeInvalidArgument, "unmarshal message: %w", err)
	}
	return nil
}

func (r *envelopeReader) Read(env *envelope) *Error {
	prefixes := [5]byte{}
	// io.ReadFull reads the number of bytes requested, or returns an error.
	// io.EOF will only be returned if no bytes were read.
	n, err := io.ReadFull(r.reader, prefixes[:])
	r.bytesRead += int64(n)
	if err != nil {
		if errors.Is(err, io.EOF) {
			// The stream ended cleanly. That's expected, but we need to propagate an EOF
			// to the user so that they know that the stream has ended. We shouldn't
			// add any alarming text about protocol errors, though.
			return NewError(CodeUnknown, err)
		}
		err = wrapIfMaxBytesError(err, "read 5 byte message prefix")
		err = wrapIfContextDone(r.ctx, err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		// Something else has gone wrong - the stream didn't end cleanly.
		return errorf(
			CodeInvalidArgument,
			"protocol error: incomplete envelope: %w", err,
		)
	}
	size := int64(binary.BigEndian.Uint32(prefixes[1:5]))
	if r.readMaxBytes > 0 && size > int64(r.readMaxBytes) {
		n, err := io.CopyN(io.Discard, r.reader, size)
		r.bytesRead += n
		if err != nil && !errors.Is(err, io.EOF) {
			return errorf(CodeResourceExhausted, "message is larger than configured max %d - unable to determine message size: %w", r.readMaxBytes, err)
		}
		return errorf(CodeResourceExhausted, "message size %d is larger than configured max %d", size, r.readMaxBytes)
	}
	// We've read the prefix, so we know how many bytes to expect.
	// CopyN will return an error if it doesn't read the requested
	// number of bytes.
	readN, err := io.CopyN(env.Data, r.reader, size)
	r.bytesRead += readN
	if err != nil {
		if errors.Is(err, io.EOF) {
			// We've gotten fewer bytes than we expected, so the stream has ended
			// unexpectedly.
			return errorf(
				CodeInvalidArgument,
				"protocol error: promised %d bytes in enveloped message, got %d bytes",
				size,
				readN,
			)
		}
		err = wrapIfMaxBytesError(err, "read %d byte message", size)
		err = wrapIfContextDone(r.ctx, err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return errorf(CodeUnknown, "read enveloped message: %w", err)
	}
	env.Flags = prefixes[0]
	return nil
}

func makeEnvelopePrefix(flags uint8, size int) [5]byte {
	prefix := [5]byte{}
	prefix[0] = flags
	binary.BigEndian.PutUint32(prefix[1:5], uint32(size))
	return prefix
}
