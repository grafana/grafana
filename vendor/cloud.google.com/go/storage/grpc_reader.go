// Copyright 2025 Google LLC
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

package storage

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"

	"cloud.google.com/go/internal/trace"
	"cloud.google.com/go/storage/internal/apiv2/storagepb"
	"github.com/googleapis/gax-go/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
	"google.golang.org/grpc/mem"
	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
)

// Below is the legacy implementation of gRPC downloads using the ReadObject API.
// It's used by gRPC if the experimental option WithGRPCBidiReads was not passed.
// TODO: once BidiReadObject is in GA, remove this implementation.

// Custom codec to be used for unmarshaling ReadObjectResponse messages.
// This is used to avoid a copy of object data in proto.Unmarshal.
type bytesCodecReadObject struct {
}

var _ encoding.CodecV2 = bytesCodecReadObject{}

// Marshal is used to encode messages to send for bytesCodecReadObject. Since we are only
// using this to send ReadObjectRequest messages we don't need to recycle buffers
// here.
func (bytesCodecReadObject) Marshal(v any) (mem.BufferSlice, error) {
	vv, ok := v.(proto.Message)
	if !ok {
		return nil, fmt.Errorf("failed to marshal, message is %T, want proto.Message", v)
	}
	var data mem.BufferSlice
	buf, err := proto.Marshal(vv)
	if err != nil {
		return nil, err
	}
	data = append(data, mem.SliceBuffer(buf))
	return data, nil
}

// Unmarshal is used for data received for ReadObjectResponse. We want to preserve
// the mem.BufferSlice in most cases rather than copying and calling proto.Unmarshal.
func (bytesCodecReadObject) Unmarshal(data mem.BufferSlice, v any) error {
	switch v := v.(type) {
	case *mem.BufferSlice:
		*v = data
		// Pick up a reference to the data so that it is not freed while decoding.
		data.Ref()
		return nil
	case proto.Message:
		buf := data.MaterializeToBuffer(mem.DefaultBufferPool())
		return proto.Unmarshal(buf.ReadOnlyData(), v)
	default:
		return fmt.Errorf("cannot unmarshal type %T, want proto.Message or mem.BufferSlice", v)
	}
}

func (bytesCodecReadObject) Name() string {
	return ""
}

func (c *grpcStorageClient) NewRangeReaderReadObject(ctx context.Context, params *newRangeReaderParams, opts ...storageOption) (r *Reader, err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.grpcStorageClient.NewRangeReaderReadObject")
	defer func() { trace.EndSpan(ctx, err) }()

	s := callSettings(c.settings, opts...)

	s.gax = append(s.gax, gax.WithGRPCOptions(
		grpc.ForceCodecV2(bytesCodecReadObject{}),
	))

	if s.userProject != "" {
		ctx = setUserProjectMetadata(ctx, s.userProject)
	}

	b := bucketResourceName(globalProjectAlias, params.bucket)
	req := &storagepb.ReadObjectRequest{
		Bucket:                    b,
		Object:                    params.object,
		CommonObjectRequestParams: toProtoCommonObjectRequestParams(params.encryptionKey),
	}
	// The default is a negative value, which means latest.
	if params.gen >= 0 {
		req.Generation = params.gen
	}

	// Define a function that initiates a Read with offset and length, assuming
	// we have already read seen bytes.
	reopen := func(seen int64) (*readStreamResponseReadObject, context.CancelFunc, error) {
		// If the context has already expired, return immediately without making
		// we call.
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}

		cc, cancel := context.WithCancel(ctx)

		req.ReadOffset = params.offset + seen

		// Only set a ReadLimit if length is greater than zero, because <= 0 means
		// to read it all.
		if params.length > 0 {
			req.ReadLimit = params.length - seen
		}

		if err := applyCondsProto("gRPCReadObjectReader.reopen", params.gen, params.conds, req); err != nil {
			cancel()
			return nil, nil, err
		}

		var stream storagepb.Storage_ReadObjectClient
		var err error
		var decoder *readObjectResponseDecoder

		err = run(cc, func(ctx context.Context) error {
			stream, err = c.raw.ReadObject(ctx, req, s.gax...)
			if err != nil {
				return err
			}

			// Receive the message into databuf as a wire-encoded message so we can
			// use a custom decoder to avoid an extra copy at the protobuf layer.
			databufs := mem.BufferSlice{}
			err := stream.RecvMsg(&databufs)
			if err != nil {
				// NotFound types of errors show up on the Recv call, rather than the
				// initialization of the stream via ReadObject above.
				return formatObjectErr(err)
			}
			// Use a custom decoder that uses protobuf unmarshalling for all
			// fields except the object data. Object data is handled separately
			// to avoid a copy.
			decoder = &readObjectResponseDecoder{
				databufs: databufs,
			}
			err = decoder.readFullObjectResponse()
			return err
		}, s.retry, s.idempotent)
		if err != nil {
			// Close the stream context we just created to ensure we don't leak
			// resources.
			cancel()
			// Free any buffers.
			if decoder != nil && decoder.databufs != nil {
				decoder.databufs.Free()
			}
			return nil, nil, err
		}

		return &readStreamResponseReadObject{stream, decoder}, cancel, nil
	}

	res, cancel, err := reopen(0)
	if err != nil {
		return nil, err
	}

	// The first message was Recv'd on stream open, use it to populate the
	// object metadata.
	msg := res.decoder.msg
	obj := msg.GetMetadata()
	// This is the size of the entire object, even if only a range was requested.
	size := obj.GetSize()

	// Only support checksums when reading an entire object, not a range.
	var (
		wantCRC  uint32
		checkCRC bool
	)
	if checksums := msg.GetObjectChecksums(); checksums != nil && checksums.Crc32C != nil {
		if params.offset == 0 && params.length < 0 {
			checkCRC = true
		}
		wantCRC = checksums.GetCrc32C()
	}

	metadata := obj.GetMetadata()
	r = &Reader{
		Attrs: ReaderObjectAttrs{
			Size:            size,
			ContentType:     obj.GetContentType(),
			ContentEncoding: obj.GetContentEncoding(),
			CacheControl:    obj.GetCacheControl(),
			LastModified:    obj.GetUpdateTime().AsTime(),
			Metageneration:  obj.GetMetageneration(),
			Generation:      obj.GetGeneration(),
			CRC32C:          wantCRC,
		},
		objectMetadata: &metadata,
		reader: &gRPCReadObjectReader{
			stream: res.stream,
			reopen: reopen,
			cancel: cancel,
			size:   size,
			// Preserve the decoder to read out object data when Read/WriteTo is called.
			currMsg:   res.decoder,
			settings:  s,
			zeroRange: params.length == 0,
			wantCRC:   wantCRC,
			checkCRC:  checkCRC,
		},
		checkCRC: checkCRC,
	}

	cr := msg.GetContentRange()
	if cr != nil {
		r.Attrs.StartOffset = cr.GetStart()
		r.remain = cr.GetEnd() - cr.GetStart()
	} else {
		r.remain = size
	}

	// For a zero-length request, explicitly close the stream and set remaining
	// bytes to zero.
	if params.length == 0 {
		r.remain = 0
		r.reader.Close()
	}

	return r, nil
}

type readStreamResponseReadObject struct {
	stream  storagepb.Storage_ReadObjectClient
	decoder *readObjectResponseDecoder
}

type gRPCReadObjectReader struct {
	seen, size int64
	zeroRange  bool
	stream     storagepb.Storage_ReadObjectClient
	reopen     func(seen int64) (*readStreamResponseReadObject, context.CancelFunc, error)
	leftovers  []byte
	currMsg    *readObjectResponseDecoder // decoder for the current message
	cancel     context.CancelFunc
	settings   *settings
	checkCRC   bool   // should we check the CRC?
	wantCRC    uint32 // the CRC32c value the server sent in the header
	gotCRC     uint32 // running crc
}

// Update the running CRC with the data in the slice, if CRC checking was enabled.
func (r *gRPCReadObjectReader) updateCRC(b []byte) {
	if r.checkCRC {
		r.gotCRC = crc32.Update(r.gotCRC, crc32cTable, b)
	}
}

// Checks whether the CRC matches at the conclusion of a read, if CRC checking was enabled.
func (r *gRPCReadObjectReader) runCRCCheck() error {
	if r.checkCRC && r.gotCRC != r.wantCRC {
		return fmt.Errorf("storage: bad CRC on read: got %d, want %d", r.gotCRC, r.wantCRC)
	}
	return nil
}

// Read reads bytes into the user's buffer from an open gRPC stream.
func (r *gRPCReadObjectReader) Read(p []byte) (int, error) {
	// The entire object has been read by this reader, check the checksum if
	// necessary and return EOF.
	if r.size == r.seen || r.zeroRange {
		if err := r.runCRCCheck(); err != nil {
			return 0, err
		}
		return 0, io.EOF
	}

	// No stream to read from, either never initialized or Close was called.
	// Note: There is a potential concurrency issue if multiple routines are
	// using the same reader. One encounters an error and the stream is closed
	// and then reopened while the other routine attempts to read from it.
	if r.stream == nil {
		return 0, fmt.Errorf("storage: reader has been closed")
	}

	var n int

	// If there is data remaining in the current message, return what was
	// available to conform to the Reader
	// interface: https://pkg.go.dev/io#Reader.
	if !r.currMsg.done {
		n = r.currMsg.readAndUpdateCRC(p, func(b []byte) {
			r.updateCRC(b)
		})
		r.seen += int64(n)
		return n, nil
	}

	// Attempt to Recv the next message on the stream.
	// This will update r.currMsg with the decoder for the new message.
	err := r.recv()
	if err != nil {
		return 0, err
	}

	// TODO: Determine if we need to capture incremental CRC32C for this
	// chunk. The Object CRC32C checksum is captured when directed to read
	// the entire Object. If directed to read a range, we may need to
	// calculate the range's checksum for verification if the checksum is
	// present in the response here.
	// TODO: Figure out if we need to support decompressive transcoding
	// https://cloud.google.com/storage/docs/transcoding.

	n = r.currMsg.readAndUpdateCRC(p, func(b []byte) {
		r.updateCRC(b)
	})
	r.seen += int64(n)
	return n, nil
}

// WriteTo writes all the data requested by the Reader into w, implementing
// io.WriterTo.
func (r *gRPCReadObjectReader) WriteTo(w io.Writer) (int64, error) {
	// The entire object has been read by this reader, check the checksum if
	// necessary and return nil.
	if r.size == r.seen || r.zeroRange {
		if err := r.runCRCCheck(); err != nil {
			return 0, err
		}
		return 0, nil
	}

	// No stream to read from, either never initialized or Close was called.
	// Note: There is a potential concurrency issue if multiple routines are
	// using the same reader. One encounters an error and the stream is closed
	// and then reopened while the other routine attempts to read from it.
	if r.stream == nil {
		return 0, fmt.Errorf("storage: reader has been closed")
	}

	// Track bytes written during before call.
	var alreadySeen = r.seen

	// Write any already received message to the stream. There will be some leftovers from the
	// original NewRangeReaderReadObject call.
	if r.currMsg != nil && !r.currMsg.done {
		written, err := r.currMsg.writeToAndUpdateCRC(w, func(b []byte) {
			r.updateCRC(b)
		})
		r.seen += int64(written)
		r.currMsg = nil
		if err != nil {
			return r.seen - alreadySeen, err
		}
	}

	// Loop and receive additional messages until the entire data is written.
	for {
		// Attempt to receive the next message on the stream.
		// Will terminate with io.EOF once data has all come through.
		// recv() handles stream reopening and retry logic so no need for retries here.
		err := r.recv()
		if err != nil {
			if err == io.EOF {
				// We are done; check the checksum if necessary and return.
				err = r.runCRCCheck()
			}
			return r.seen - alreadySeen, err
		}

		// TODO: Determine if we need to capture incremental CRC32C for this
		// chunk. The Object CRC32C checksum is captured when directed to read
		// the entire Object. If directed to read a range, we may need to
		// calculate the range's checksum for verification if the checksum is
		// present in the response here.
		// TODO: Figure out if we need to support decompressive transcoding
		// https://cloud.google.com/storage/docs/transcoding.
		written, err := r.currMsg.writeToAndUpdateCRC(w, func(b []byte) {
			r.updateCRC(b)
		})
		r.seen += int64(written)
		if err != nil {
			return r.seen - alreadySeen, err
		}
	}

}

// Close cancels the read stream's context in order for it to be closed and
// collected, and frees any currently in use buffers.
func (r *gRPCReadObjectReader) Close() error {
	if r.cancel != nil {
		r.cancel()
	}
	r.stream = nil
	r.currMsg = nil
	return nil
}

// recv attempts to Recv the next message on the stream and extract the object
// data that it contains. In the event that a retryable error is encountered,
// the stream will be closed, reopened, and RecvMsg again.
// This will attempt to Recv until one of the following is true:
//
// * Recv is successful
// * A non-retryable error is encountered
// * The Reader's context is canceled
//
// The last error received is the one that is returned, which could be from
// an attempt to reopen the stream.
func (r *gRPCReadObjectReader) recv() error {
	databufs := mem.BufferSlice{}
	err := r.stream.RecvMsg(&databufs)

	if err != nil && r.settings.retry.runShouldRetry(err) {
		// This will "close" the existing stream and immediately attempt to
		// reopen the stream, but will backoff if further attempts are necessary.
		// Reopening the stream Recvs the first message, so if retrying is
		// successful, r.currMsg will be updated to include the new data.
		return r.reopenStream()
	}

	if err != nil {
		return err
	}

	r.currMsg = &readObjectResponseDecoder{databufs: databufs}
	return r.currMsg.readFullObjectResponse()
}

// ReadObjectResponse field and subfield numbers.
const (
	checksummedDataFieldReadObject        = protowire.Number(1)
	checksummedDataContentFieldReadObject = protowire.Number(1)
	checksummedDataCRC32CFieldReadObject  = protowire.Number(2)
	objectChecksumsFieldReadObject        = protowire.Number(2)
	contentRangeFieldReadObject           = protowire.Number(3)
	metadataFieldReadObject               = protowire.Number(4)
)

// readObjectResponseDecoder is a wrapper on the raw message, used to decode one message
// without copying object data. It also has methods to write out the resulting object
// data to the user application.
type readObjectResponseDecoder struct {
	databufs mem.BufferSlice // raw bytes of the message being processed
	// Decoding offsets
	off     uint64 // offset in the messsage relative to the data as a whole
	currBuf int    // index of the current buffer being processed
	currOff uint64 // offset in the current buffer
	// Processed data
	msg         *storagepb.ReadObjectResponse // processed response message with all fields other than object data populated
	dataOffsets bufferSliceOffsetsReadObject  // offsets of the object data in the message.
	done        bool                          // true if the data has been completely read.
}

type bufferSliceOffsetsReadObject struct {
	startBuf, endBuf int    // indices of start and end buffers of object data in the msg
	startOff, endOff uint64 // offsets within these buffers where the data starts and ends.
	currBuf          int    // index of current buffer being read out to the user application.
	currOff          uint64 // offset of read in current buffer.
}

// peek ahead 10 bytes from the current offset in the databufs. This will return a
// slice of the current buffer if the bytes are all in one buffer, but will copy
// the bytes into a new buffer if the distance is split across buffers. Use this
// to allow protowire methods to be used to parse tags & fixed values.
// The max length of a varint tag is 10 bytes, see
// https://protobuf.dev/programming-guides/encoding/#varints . Other int types
// are shorter.
func (d *readObjectResponseDecoder) peek() []byte {
	b := d.databufs[d.currBuf].ReadOnlyData()
	// Check if the tag will fit in the current buffer. If not, copy the next 10
	// bytes into a new buffer to ensure that we can read the tag correctly
	// without it being divided between buffers.
	tagBuf := b[d.currOff:]
	remainingInBuf := len(tagBuf)
	// If we have less than 10 bytes remaining and are not in the final buffer,
	// copy up to 10 bytes ahead from the next buffer.
	if remainingInBuf < binary.MaxVarintLen64 && d.currBuf != len(d.databufs)-1 {
		tagBuf = d.copyNextBytes(10)
	}
	return tagBuf
}

// Copies up to next n bytes into a new buffer, or fewer if fewer bytes remain in the
// buffers overall. Does not advance offsets.
func (d *readObjectResponseDecoder) copyNextBytes(n int) []byte {
	remaining := n
	if r := d.databufs.Len() - int(d.off); r < remaining {
		remaining = r
	}
	currBuf := d.currBuf
	currOff := d.currOff
	var buf []byte
	for remaining > 0 {
		b := d.databufs[currBuf].ReadOnlyData()
		remainingInCurr := len(b[currOff:])
		if remainingInCurr < remaining {
			buf = append(buf, b[currOff:]...)
			remaining -= remainingInCurr
			currBuf++
			currOff = 0
		} else {
			buf = append(buf, b[currOff:currOff+uint64(remaining)]...)
			remaining = 0
		}
	}
	return buf
}

// Advance current buffer & byte offset in the decoding by n bytes. Returns an error if we
// go past the end of the data.
func (d *readObjectResponseDecoder) advanceOffset(n uint64) error {
	remaining := n
	for remaining > 0 {
		remainingInCurr := uint64(d.databufs[d.currBuf].Len()) - d.currOff
		if remainingInCurr <= remaining {
			remaining -= remainingInCurr
			d.currBuf++
			d.currOff = 0
		} else {
			d.currOff += remaining
			remaining = 0
		}
	}
	// If we have advanced past the end of the buffers, something went wrong.
	if (d.currBuf == len(d.databufs) && d.currOff > 0) || d.currBuf > len(d.databufs) {
		return errors.New("decoding: truncated message, cannot advance offset")
	}
	d.off += n
	return nil

}

// This copies object data from the message into the buffer and returns the number of
// bytes copied. The data offsets are incremented in the message. The updateCRC
// function is called on the copied bytes.
func (d *readObjectResponseDecoder) readAndUpdateCRC(p []byte, updateCRC func([]byte)) int {
	// For a completely empty message, just return 0
	if len(d.databufs) == 0 {
		return 0
	}
	databuf := d.databufs[d.dataOffsets.currBuf]
	startOff := d.dataOffsets.currOff
	var b []byte
	if d.dataOffsets.currBuf == d.dataOffsets.endBuf {
		b = databuf.ReadOnlyData()[startOff:d.dataOffsets.endOff]
	} else {
		b = databuf.ReadOnlyData()[startOff:]
	}
	n := copy(p, b)
	updateCRC(b[:n])
	d.dataOffsets.currOff += uint64(n)

	// We've read all the data from this message. Free the underlying buffers.
	if d.dataOffsets.currBuf == d.dataOffsets.endBuf && d.dataOffsets.currOff == d.dataOffsets.endOff {
		d.done = true
		d.databufs.Free()
	}
	// We are at the end of the current buffer
	if d.dataOffsets.currBuf != d.dataOffsets.endBuf && d.dataOffsets.currOff == uint64(databuf.Len()) {
		d.dataOffsets.currOff = 0
		d.dataOffsets.currBuf++
	}
	return n
}

func (d *readObjectResponseDecoder) writeToAndUpdateCRC(w io.Writer, updateCRC func([]byte)) (int64, error) {
	// For a completely empty message, just return 0
	if len(d.databufs) == 0 {
		return 0, nil
	}
	var written int64
	for !d.done {
		databuf := d.databufs[d.dataOffsets.currBuf]
		startOff := d.dataOffsets.currOff
		var b []byte
		if d.dataOffsets.currBuf == d.dataOffsets.endBuf {
			b = databuf.ReadOnlyData()[startOff:d.dataOffsets.endOff]
		} else {
			b = databuf.ReadOnlyData()[startOff:]
		}
		var n int
		// Write all remaining data from the current buffer
		n, err := w.Write(b)
		written += int64(n)
		updateCRC(b)
		if err != nil {
			return written, err
		}
		d.dataOffsets.currOff = 0
		// We've read all the data from this message.
		if d.dataOffsets.currBuf == d.dataOffsets.endBuf {
			d.done = true
			d.databufs.Free()
		} else {
			d.dataOffsets.currBuf++
		}
	}
	return written, nil
}

// Consume the next available tag in the input data and return the field number and type.
// Advances the relevant offsets in the data.
func (d *readObjectResponseDecoder) consumeTag() (protowire.Number, protowire.Type, error) {
	tagBuf := d.peek()

	// Consume the next tag. This will tell us which field is next in the
	// buffer, its type, and how much space it takes up.
	fieldNum, fieldType, tagLength := protowire.ConsumeTag(tagBuf)
	if tagLength < 0 {
		return 0, 0, protowire.ParseError(tagLength)
	}
	// Update the offsets and current buffer depending on the tag length.
	if err := d.advanceOffset(uint64(tagLength)); err != nil {
		return 0, 0, fmt.Errorf("consuming tag: %w", err)
	}
	return fieldNum, fieldType, nil
}

// Consume a varint that represents the length of a bytes field. Return the length of
// the data, and advance the offsets by the length of the varint.
func (d *readObjectResponseDecoder) consumeVarint() (uint64, error) {
	tagBuf := d.peek()

	// Consume the next tag. This will tell us which field is next in the
	// buffer, its type, and how much space it takes up.
	dataLength, tagLength := protowire.ConsumeVarint(tagBuf)
	if tagLength < 0 {
		return 0, protowire.ParseError(tagLength)
	}

	// Update the offsets and current buffer depending on the tag length.
	d.advanceOffset(uint64(tagLength))
	return dataLength, nil
}

func (d *readObjectResponseDecoder) consumeFixed32() (uint32, error) {
	valueBuf := d.peek()

	// Consume the next tag. This will tell us which field is next in the
	// buffer, its type, and how much space it takes up.
	value, tagLength := protowire.ConsumeFixed32(valueBuf)
	if tagLength < 0 {
		return 0, protowire.ParseError(tagLength)
	}

	// Update the offsets and current buffer depending on the tag length.
	d.advanceOffset(uint64(tagLength))
	return value, nil
}

func (d *readObjectResponseDecoder) consumeFixed64() (uint64, error) {
	valueBuf := d.peek()

	// Consume the next tag. This will tell us which field is next in the
	// buffer, its type, and how much space it takes up.
	value, tagLength := protowire.ConsumeFixed64(valueBuf)
	if tagLength < 0 {
		return 0, protowire.ParseError(tagLength)
	}

	// Update the offsets and current buffer depending on the tag length.
	d.advanceOffset(uint64(tagLength))
	return value, nil
}

// Consume any field values up to the end offset provided and don't return anything.
// This is used to skip any values which are not going to be used.
// msgEndOff is indexed in terms of the overall data across all buffers.
func (d *readObjectResponseDecoder) consumeFieldValue(fieldNum protowire.Number, fieldType protowire.Type) error {
	// reimplement protowire.ConsumeFieldValue without the extra case for groups (which
	// are are complicted and not a thing in proto3).
	var err error
	switch fieldType {
	case protowire.VarintType:
		_, err = d.consumeVarint()
	case protowire.Fixed32Type:
		_, err = d.consumeFixed32()
	case protowire.Fixed64Type:
		_, err = d.consumeFixed64()
	case protowire.BytesType:
		_, err = d.consumeBytes()
	default:
		return fmt.Errorf("unknown field type %v in field %v", fieldType, fieldNum)
	}
	if err != nil {
		return fmt.Errorf("consuming field %v of type %v: %w", fieldNum, fieldType, err)
	}

	return nil
}

// Consume a bytes field from the input. Returns offsets for the data in the buffer slices
// and an error.
func (d *readObjectResponseDecoder) consumeBytes() (bufferSliceOffsetsReadObject, error) {
	// m is the length of the data past the tag.
	m, err := d.consumeVarint()
	if err != nil {
		return bufferSliceOffsetsReadObject{}, fmt.Errorf("consuming bytes field: %w", err)
	}
	offsets := bufferSliceOffsetsReadObject{
		startBuf: d.currBuf,
		startOff: d.currOff,
		currBuf:  d.currBuf,
		currOff:  d.currOff,
	}

	// Advance offsets to lengths of bytes field and capture where we end.
	d.advanceOffset(m)
	offsets.endBuf = d.currBuf
	offsets.endOff = d.currOff
	return offsets, nil
}

// Consume a bytes field from the input and copy into a new buffer if
// necessary (if the data is split across buffers in databuf).  This can be
// used to leverage proto.Unmarshal for small bytes fields (i.e. anything
// except object data).
func (d *readObjectResponseDecoder) consumeBytesCopy() ([]byte, error) {
	// m is the length of the bytes data.
	m, err := d.consumeVarint()
	if err != nil {
		return nil, fmt.Errorf("consuming varint: %w", err)
	}
	// Copy the data into a buffer and advance the offset
	b := d.copyNextBytes(int(m))
	if err := d.advanceOffset(m); err != nil {
		return nil, fmt.Errorf("advancing offset: %w", err)
	}
	return b, nil
}

// readFullObjectResponse returns the ReadObjectResponse that is encoded in the
// wire-encoded message buffer b, or an error if the message is invalid.
// This must be used on the first recv of an object as it may contain all fields
// of ReadObjectResponse, and we use or pass on those fields to the user.
// This function is essentially identical to proto.Unmarshal, except it aliases
// the data in the input []byte. If the proto library adds a feature to
// Unmarshal that does that, this function can be dropped.
func (d *readObjectResponseDecoder) readFullObjectResponse() error {
	msg := &storagepb.ReadObjectResponse{}

	// Loop over the entire message, extracting fields as we go. This does not
	// handle field concatenation, in which the contents of a single field
	// are split across multiple protobuf tags.
	for d.off < uint64(d.databufs.Len()) {
		fieldNum, fieldType, err := d.consumeTag()
		if err != nil {
			return fmt.Errorf("consuming next tag: %w", err)
		}

		// Unmarshal the field according to its type. Only fields that are not
		// nil will be present.
		switch {
		case fieldNum == checksummedDataFieldReadObject && fieldType == protowire.BytesType:
			// The ChecksummedData field was found. Initialize the struct.
			msg.ChecksummedData = &storagepb.ChecksummedData{}

			bytesFieldLen, err := d.consumeVarint()
			if err != nil {
				return fmt.Errorf("consuming bytes: %w", err)
			}

			var contentEndOff = d.off + bytesFieldLen
			for d.off < contentEndOff {
				gotNum, gotTyp, err := d.consumeTag()
				if err != nil {
					return fmt.Errorf("consuming checksummedData tag: %w", err)
				}

				switch {
				case gotNum == checksummedDataContentFieldReadObject && gotTyp == protowire.BytesType:
					// Get the offsets of the content bytes.
					d.dataOffsets, err = d.consumeBytes()
					if err != nil {
						return fmt.Errorf("invalid ReadObjectResponse.ChecksummedData.Content: %w", err)
					}
				case gotNum == checksummedDataCRC32CFieldReadObject && gotTyp == protowire.Fixed32Type:
					v, err := d.consumeFixed32()
					if err != nil {
						return fmt.Errorf("invalid ReadObjectResponse.ChecksummedData.Crc32C: %w", err)
					}
					msg.ChecksummedData.Crc32C = &v
				default:
					err := d.consumeFieldValue(gotNum, gotTyp)
					if err != nil {
						return fmt.Errorf("invalid field in ReadObjectResponse.ChecksummedData: %w", err)
					}
				}
			}
		case fieldNum == objectChecksumsFieldReadObject && fieldType == protowire.BytesType:
			// The field was found. Initialize the struct.
			msg.ObjectChecksums = &storagepb.ObjectChecksums{}
			// Consume the bytes and copy them into a single buffer if they are split across buffers.
			buf, err := d.consumeBytesCopy()
			if err != nil {
				return fmt.Errorf("invalid ReadObjectResponse.ObjectChecksums: %w", err)
			}
			// Unmarshal.
			if err := proto.Unmarshal(buf, msg.ObjectChecksums); err != nil {
				return err
			}
		case fieldNum == contentRangeFieldReadObject && fieldType == protowire.BytesType:
			msg.ContentRange = &storagepb.ContentRange{}
			buf, err := d.consumeBytesCopy()
			if err != nil {
				return fmt.Errorf("invalid ReadObjectResponse.ContentRange: %w", err)
			}
			if err := proto.Unmarshal(buf, msg.ContentRange); err != nil {
				return err
			}
		case fieldNum == metadataFieldReadObject && fieldType == protowire.BytesType:
			msg.Metadata = &storagepb.Object{}

			buf, err := d.consumeBytesCopy()
			if err != nil {
				return fmt.Errorf("invalid ReadObjectResponse.Metadata: %w", err)
			}

			if err := proto.Unmarshal(buf, msg.Metadata); err != nil {
				return err
			}
		default:
			err := d.consumeFieldValue(fieldNum, fieldType)
			if err != nil {
				return fmt.Errorf("invalid field in ReadObjectResponse: %w", err)
			}
		}
	}
	d.msg = msg
	return nil
}

// reopenStream "closes" the existing stream and attempts to reopen a stream and
// sets the Reader's stream and cancelStream properties in the process.
func (r *gRPCReadObjectReader) reopenStream() error {
	// Close existing stream and initialize new stream with updated offset.
	r.Close()

	res, cancel, err := r.reopen(r.seen)
	if err != nil {
		return err
	}
	r.stream = res.stream
	r.currMsg = res.decoder
	r.cancel = cancel
	return nil
}
