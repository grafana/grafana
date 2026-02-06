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
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	gapic "cloud.google.com/go/storage/internal/apiv2"
	"cloud.google.com/go/storage/internal/apiv2/storagepb"
	gax "github.com/googleapis/gax-go/v2"
	"google.golang.org/api/googleapi"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

const (
	// defaultWriteChunkRetryDeadline is the default deadline for the upload
	// of a single chunk. It can be overwritten by Writer.ChunkRetryDeadline.
	defaultWriteChunkRetryDeadline = 32 * time.Second
	// maxPerMessageWriteSize is the maximum amount of content that can be sent
	// per WriteObjectRequest message. A buffer reaching this amount will
	// precipitate a flush of the buffer. It is only used by the gRPC Writer
	// implementation.
	maxPerMessageWriteSize int = int(storagepb.ServiceConstants_MAX_WRITE_CHUNK_BYTES)
)

func withBidiWriteObjectRedirectionErrorRetries(s *settings) (newr *retryConfig) {
	oldr := s.retry
	newr = oldr.clone()
	if newr == nil {
		newr = &retryConfig{}
	}
	if (oldr.policy == RetryIdempotent && !s.idempotent) || oldr.policy == RetryNever {
		// We still retry redirection errors even when settings indicate not to
		// retry.
		//
		// The protocol requires us to respect redirection errors, so RetryNever has
		// to ignore them.
		//
		// Idempotency is always protected by redirection errors: they either
		// contain a handle which can be used as idempotency information, or they do
		// not contain a handle and are "affirmative failures" which indicate that
		// no server-side action occurred.
		newr.policy = RetryAlways
		newr.shouldRetry = func(err error) bool {
			return errors.Is(err, bidiWriteObjectRedirectionError{})
		}
		return newr
	}
	// If retry settings allow retries normally, fall back to that behavior.
	newr.shouldRetry = func(err error) bool {
		if errors.Is(err, bidiWriteObjectRedirectionError{}) {
			return true
		}
		v := oldr.runShouldRetry(err)
		return v
	}
	return newr
}

func (c *grpcStorageClient) OpenWriter(params *openWriterParams, opts ...storageOption) (*io.PipeWriter, error) {
	var offset int64
	errorf := params.setError
	setObj := params.setObj
	setFlush := params.setFlush
	pr, pw := io.Pipe()

	s := callSettings(c.settings, opts...)

	retryDeadline := defaultWriteChunkRetryDeadline
	if params.chunkRetryDeadline != 0 {
		retryDeadline = params.chunkRetryDeadline
	}
	if s.retry == nil {
		s.retry = defaultRetry.clone()
	}
	if params.append {
		s.retry = withBidiWriteObjectRedirectionErrorRetries(s)
	}
	s.retry.maxRetryDuration = retryDeadline

	// Set Flush func for use by exported Writer.Flush.
	var gw *gRPCWriter
	setFlush(func() (int64, error) {
		return gw.flush()
	})
	gw, err := newGRPCWriter(c, s, params, pr, pr, pw, params.setPipeWriter)
	if err != nil {
		errorf(err)
		pr.CloseWithError(err)
		close(params.donec)
		return nil, err
	}

	var o *storagepb.Object

	// If we are taking over an appendable object, send the first message here
	// to get the append offset.
	if params.appendGen > 0 {
		// Create the buffer sender. This opens a stream and blocks until we
		// get a response that tells us what offset to write from.
		wbs, err := gw.newGRPCAppendTakeoverWriteBufferSender(params.ctx)
		if err != nil {
			return nil, fmt.Errorf("storage: creating buffer sender: %w", err)
		}
		// Propagate append offset to caller and buffer sending logic below.
		params.setTakeoverOffset(wbs.takeoverOffset)
		offset = wbs.takeoverOffset
		gw.streamSender = wbs
		o = wbs.objResource
		setObj(newObjectFromProto(o))
	}

	// This function reads the data sent to the pipe and sends sets of messages
	// on the gRPC client-stream as the buffer is filled.
	go func() {
		err := func() error {
			// Unless the user told us the content type, we have to determine it from
			// the first read.
			if params.attrs.ContentType == "" && !params.forceEmptyContentType {
				gw.reader, gw.spec.Resource.ContentType = gax.DetermineContentType(gw.reader)
			}

			// Loop until there is an error or the Object has been finalized.
			for {
				// Note: This blocks until either the buffer is full or EOF is read.
				recvd, doneReading, err := gw.read()
				if err != nil {
					return err
				}

				uploadBuff := func(ctx context.Context) error {
					obj, err := gw.uploadBuffer(ctx, recvd, offset, doneReading)
					if obj != nil {
						o = obj
						setObj(newObjectFromProto(o))
					}
					return err
				}

				// Add routing headers to the context metadata for single-shot and resumable
				// writes. Append writes need to set this at a lower level to pass the routing
				// token.
				bctx := gw.ctx
				if !gw.append {
					bctx = bucketContext(bctx, gw.bucket)
				}
				err = run(bctx, uploadBuff, gw.settings.retry, s.idempotent)
				offset += int64(recvd)
				// If this buffer upload was triggered by a flush, reset and
				// communicate back the result.
				if gw.flushInProgress {
					gw.setSize(offset)
					gw.flushInProgress = false
					gw.flushComplete <- flushResult{offset: offset, err: err}
				}
				if err != nil {
					return err
				}
				// When we are done reading data without errors, set the object and
				// finish.
				if doneReading {
					// Build Object from server's response.
					setObj(newObjectFromProto(o))
					return nil
				}
			}
		}()

		// These calls are still valid if err is nil
		err = checkCanceled(err)
		errorf(err)
		gw.pr.CloseWithError(err)
		close(params.donec)
	}()

	return pw, nil
}

func newGRPCWriter(c *grpcStorageClient, s *settings, params *openWriterParams, r io.Reader, pr *io.PipeReader, pw *io.PipeWriter, setPipeWriter func(*io.PipeWriter)) (*gRPCWriter, error) {
	if params.attrs.Retention != nil {
		// TO-DO: remove once ObjectRetention is available - see b/308194853
		return nil, status.Errorf(codes.Unimplemented, "storage: object retention is not supported in gRPC")
	}

	size := googleapi.MinUploadChunkSize
	// A completely bufferless upload (params.chunkSize <= 0) is not possible in
	// gRPC because the buffer must be provided to the message. Use the minimum
	// size possible.
	if params.chunkSize > 0 {
		size = params.chunkSize
	}

	// Round up chunksize to nearest 256KiB
	if size%googleapi.MinUploadChunkSize != 0 {
		size += googleapi.MinUploadChunkSize - (size % googleapi.MinUploadChunkSize)
	}

	if s.userProject != "" {
		params.ctx = setUserProjectMetadata(params.ctx, s.userProject)
	}

	spec := &storagepb.WriteObjectSpec{
		Resource:   params.attrs.toProtoObject(params.bucket),
		Appendable: proto.Bool(params.append),
	}
	var appendSpec *storagepb.AppendObjectSpec
	if params.appendGen > 0 {
		appendSpec = &storagepb.AppendObjectSpec{
			Bucket:     bucketResourceName(globalProjectAlias, params.bucket),
			Object:     params.attrs.Name,
			Generation: params.appendGen,
		}
	}
	// WriteObject doesn't support the generation condition, so use default.
	if err := applyCondsProto("WriteObject", defaultGen, params.conds, spec); err != nil {
		return nil, err
	}

	return &gRPCWriter{
		buf:                   make([]byte, size),
		c:                     c,
		ctx:                   params.ctx,
		reader:                r,
		pw:                    pw,
		pr:                    pr,
		bucket:                params.bucket,
		attrs:                 params.attrs,
		conds:                 params.conds,
		spec:                  spec,
		appendSpec:            appendSpec,
		encryptionKey:         params.encryptionKey,
		settings:              s,
		progress:              params.progress,
		setSize:               params.setSize,
		sendCRC32C:            params.sendCRC32C,
		forceOneShot:          params.chunkSize <= 0,
		forceEmptyContentType: params.forceEmptyContentType,
		append:                params.append,
		finalizeOnClose:       params.finalizeOnClose,
		setPipeWriter:         setPipeWriter,
		flushComplete:         make(chan flushResult),
	}, nil
}

// gRPCWriter is a wrapper around the the gRPC client-stream API that manages
// sending chunks of data provided by the user over the stream.
type gRPCWriter struct {
	c             *grpcStorageClient
	buf           []byte
	reader        io.Reader
	pr            *io.PipeReader // Keep track of pr and pw to update post-flush
	pw            *io.PipeWriter
	setPipeWriter func(*io.PipeWriter) // used to set in parent storage.Writer

	ctx context.Context

	bucket        string
	attrs         *ObjectAttrs
	conds         *Conditions
	spec          *storagepb.WriteObjectSpec
	appendSpec    *storagepb.AppendObjectSpec
	encryptionKey []byte
	settings      *settings
	progress      func(int64)
	setSize       func(int64)

	sendCRC32C            bool
	forceOneShot          bool
	forceEmptyContentType bool
	append                bool
	finalizeOnClose       bool

	streamSender    gRPCBidiWriteBufferSender
	flushInProgress bool             // true when the pipe is being recreated for a flush.
	flushComplete   chan flushResult // use to signal back to flush call that flush to server was completed.
}

type flushResult struct {
	err    error
	offset int64
}

func bucketContext(ctx context.Context, bucket string) context.Context {
	hds := []string{"x-goog-request-params", fmt.Sprintf("bucket=projects/_/buckets/%s", url.QueryEscape(bucket))}
	return gax.InsertMetadataIntoOutgoingContext(ctx, hds...)
}

// drainInboundStream calls stream.Recv() repeatedly until an error is returned.
// It returns the last Resource received on the stream, or nil if no Resource
// was returned. drainInboundStream always returns a non-nil error. io.EOF
// indicates all messages were successfully read.
func drainInboundStream(stream storagepb.Storage_BidiWriteObjectClient) (object *storagepb.Object, err error) {
	for err == nil {
		var resp *storagepb.BidiWriteObjectResponse
		resp, err = stream.Recv()
		// GetResource() returns nil on a nil response
		if resp.GetResource() != nil {
			object = resp.GetResource()
		}
	}
	return object, err
}

func bidiWriteObjectRequest(buf []byte, offset int64, flush, finishWrite bool) *storagepb.BidiWriteObjectRequest {
	var data *storagepb.BidiWriteObjectRequest_ChecksummedData
	if buf != nil {
		data = &storagepb.BidiWriteObjectRequest_ChecksummedData{
			ChecksummedData: &storagepb.ChecksummedData{
				Content: buf,
			},
		}
	}
	req := &storagepb.BidiWriteObjectRequest{
		Data:        data,
		WriteOffset: offset,
		FinishWrite: finishWrite,
		Flush:       flush,
		StateLookup: flush,
	}
	return req
}

type gRPCBidiWriteBufferSender interface {
	// sendBuffer implementations should upload buf, respecting flush and
	// finishWrite. Callers must guarantee that buf is not too long to fit in a
	// gRPC message.
	//
	// If flush is true, implementations must not return until the data in buf is
	// stable. If finishWrite is true, implementations must return the object on
	// success.
	sendBuffer(ctx context.Context, buf []byte, offset int64, flush, finishWrite bool) (*storagepb.Object, error)
}

type gRPCOneshotBidiWriteBufferSender struct {
	firstMessage *storagepb.BidiWriteObjectRequest
	raw          *gapic.Client
	stream       storagepb.Storage_BidiWriteObjectClient
	settings     *settings
}

func (w *gRPCWriter) newGRPCOneshotBidiWriteBufferSender() (*gRPCOneshotBidiWriteBufferSender, error) {
	firstMessage := &storagepb.BidiWriteObjectRequest{
		FirstMessage: &storagepb.BidiWriteObjectRequest_WriteObjectSpec{
			WriteObjectSpec: w.spec,
		},
		CommonObjectRequestParams: toProtoCommonObjectRequestParams(w.encryptionKey),
		// For a non-resumable upload, checksums must be sent in this message.
		// TODO: Currently the checksums are only sent on the first message
		// of the stream, but in the future, we must also support sending it
		// on the *last* message of the stream (instead of the first).
		ObjectChecksums: toProtoChecksums(w.sendCRC32C, w.attrs),
	}

	return &gRPCOneshotBidiWriteBufferSender{
		firstMessage: firstMessage,
		raw:          w.c.raw,
		settings:     w.settings,
	}, nil
}

func (s *gRPCOneshotBidiWriteBufferSender) sendBuffer(ctx context.Context, buf []byte, offset int64, flush, finishWrite bool) (obj *storagepb.Object, err error) {
	var firstMessage *storagepb.BidiWriteObjectRequest
	if s.stream == nil {
		s.stream, err = s.raw.BidiWriteObject(ctx, s.settings.gax...)
		if err != nil {
			return
		}
		firstMessage = s.firstMessage
	}
	req := bidiWriteObjectRequest(buf, offset, flush, finishWrite)
	if firstMessage != nil {
		proto.Merge(req, firstMessage)
	}

	sendErr := s.stream.Send(req)
	if sendErr != nil {
		obj, err = drainInboundStream(s.stream)
		s.stream = nil
		if sendErr != io.EOF {
			err = sendErr
		}
		return
	}
	// Oneshot uploads assume all flushes succeed

	if finishWrite {
		s.stream.CloseSend()
		// Oneshot uploads only read from the response stream on completion or
		// failure
		obj, err = drainInboundStream(s.stream)
		s.stream = nil
		if err == io.EOF {
			err = nil
		}
	}
	return
}

type gRPCResumableBidiWriteBufferSender struct {
	queryRetry        *retryConfig
	upid              string
	progress          func(int64)
	raw               *gapic.Client
	forceFirstMessage bool
	stream            storagepb.Storage_BidiWriteObjectClient
	flushOffset       int64
	settings          *settings
}

func (w *gRPCWriter) newGRPCResumableBidiWriteBufferSender(ctx context.Context) (*gRPCResumableBidiWriteBufferSender, error) {
	req := &storagepb.StartResumableWriteRequest{
		WriteObjectSpec:           w.spec,
		CommonObjectRequestParams: toProtoCommonObjectRequestParams(w.encryptionKey),
		// TODO: Currently the checksums are only sent on the request to initialize
		// the upload, but in the future, we must also support sending it
		// on the *last* message of the stream.
		ObjectChecksums: toProtoChecksums(w.sendCRC32C, w.attrs),
	}

	var upid string
	err := run(ctx, func(ctx context.Context) error {
		upres, err := w.c.raw.StartResumableWrite(ctx, req, w.settings.gax...)
		upid = upres.GetUploadId()
		return err
	}, w.settings.retry, w.settings.idempotent)
	if err != nil {
		return nil, err
	}

	// Set up an initial connection for the 0 offset, so we don't query state
	// unnecessarily for the first buffer. If we fail, we'll just retry in the
	// normal connect path.
	stream, err := w.c.raw.BidiWriteObject(ctx, w.settings.gax...)
	if err != nil {
		stream = nil
	}

	return &gRPCResumableBidiWriteBufferSender{
		queryRetry:        w.settings.retry,
		upid:              upid,
		progress:          w.progress,
		raw:               w.c.raw,
		forceFirstMessage: true,
		stream:            stream,
		settings:          w.settings,
	}, nil
}

// queryProgress is a helper that queries the status of the resumable upload
// associated with the given upload ID.
func (s *gRPCResumableBidiWriteBufferSender) queryProgress(ctx context.Context) (int64, error) {
	var persistedSize int64
	err := run(ctx, func(ctx context.Context) error {
		q, err := s.raw.QueryWriteStatus(ctx, &storagepb.QueryWriteStatusRequest{
			UploadId: s.upid,
		}, s.settings.gax...)
		// q.GetPersistedSize() will return 0 if q is nil.
		persistedSize = q.GetPersistedSize()
		return err
	}, s.queryRetry, true)

	return persistedSize, err
}

func (s *gRPCResumableBidiWriteBufferSender) sendBuffer(ctx context.Context, buf []byte, offset int64, flush, finishWrite bool) (obj *storagepb.Object, err error) {
	if s.stream == nil {
		// Determine offset and reconnect
		s.flushOffset, err = s.queryProgress(ctx)
		if err != nil {
			return
		}
		s.stream, err = s.raw.BidiWriteObject(ctx, s.settings.gax...)
		if err != nil {
			return
		}
		s.forceFirstMessage = true
	}

	// clean up buf. We'll still write the message if a flush/finishWrite was
	// requested.
	if offset < s.flushOffset {
		trim := s.flushOffset - offset
		if int64(len(buf)) <= trim {
			trim = int64(len(buf))
		}
		buf = buf[trim:]
		offset += trim
	}
	if len(buf) == 0 && !flush && !finishWrite {
		// no need to send anything
		return nil, nil
	}

	req := bidiWriteObjectRequest(buf, offset, flush, finishWrite)
	if s.forceFirstMessage {
		req.FirstMessage = &storagepb.BidiWriteObjectRequest_UploadId{UploadId: s.upid}
		s.forceFirstMessage = false
	}

	sendErr := s.stream.Send(req)
	if sendErr != nil {
		obj, err = drainInboundStream(s.stream)
		s.stream = nil
		if err == io.EOF {
			// This is unexpected - we got an error on Send(), but not on Recv().
			// Bubble up the sendErr.
			err = sendErr
		}
		return
	}

	if finishWrite {
		s.stream.CloseSend()
		obj, err = drainInboundStream(s.stream)
		s.stream = nil
		if err == io.EOF {
			err = nil
			if obj.GetSize() > s.flushOffset {
				s.progress(obj.GetSize())
			}
		}
		return
	}

	if flush {
		resp, err := s.stream.Recv()
		if err != nil {
			return nil, err
		}
		persistedOffset := resp.GetPersistedSize()
		if persistedOffset > s.flushOffset {
			s.flushOffset = persistedOffset
			s.progress(s.flushOffset)
		}
	}
	return
}

// uploadBuffer uploads the buffer at the given offset using a bi-directional
// Write stream. It will open a new stream if necessary (on the first call or
// after resuming from failure) and chunk the buffer per maxPerMessageWriteSize.
// The final Object is returned on success if doneReading is true.
//
// Returns object and any error that is not retriable.
func (w *gRPCWriter) uploadBuffer(ctx context.Context, recvd int, start int64, doneReading bool) (obj *storagepb.Object, err error) {
	if w.streamSender == nil {
		if w.append {
			// Appendable object semantics
			w.streamSender, err = w.newGRPCAppendableObjectBufferSender()
		} else if doneReading || w.forceOneShot {
			// One shot semantics
			w.streamSender, err = w.newGRPCOneshotBidiWriteBufferSender()
		} else {
			// Resumable write semantics
			w.streamSender, err = w.newGRPCResumableBidiWriteBufferSender(ctx)
		}
		if err != nil {
			return
		}
	}

	data := w.buf[:recvd]
	offset := start
	// We want to go through this loop at least once, in case we have to
	// finishWrite with an empty buffer.
	for {
		// Send as much as we can fit into a single gRPC message. Only flush once,
		// when sending the very last message.
		l := maxPerMessageWriteSize
		flush := false
		if len(data) <= l {
			l = len(data)
			flush = true
		}
		obj, err = w.streamSender.sendBuffer(ctx, data[:l], offset, flush, flush && doneReading)
		if err != nil {
			return nil, err
		}
		data = data[l:]
		offset += int64(l)
		if len(data) == 0 {
			// Update object size to match persisted offset.
			if obj != nil {
				obj.Size = offset
			}
			break
		}
	}
	return
}

// read copies the data in the reader to the given buffer and reports how much
// data was read into the buffer and if there is no more data to read (EOF).
// read returns when either 1. the buffer is full, 2. Writer.Flush was called,
// or 3. Writer.Close was called.
func (w *gRPCWriter) read() (int, bool, error) {
	// Set n to -1 to start the Read loop.
	var n, recvd int = -1, 0
	var err error
	for err == nil && n != 0 {
		// The routine blocks here until data is received.
		n, err = w.reader.Read(w.buf[recvd:])
		recvd += n
	}
	var done bool
	if err == io.EOF {
		err = nil
		// EOF can come from Writer.Flush or Writer.Close.
		if w.flushInProgress {
			// Reset pipe for additional writes after the flush.
			pr, pw := io.Pipe()
			w.reader = pr
			w.pw = pw
			w.pr = pr
			w.setPipeWriter(pw)
		} else {
			done = true
		}
	}
	return recvd, done, err
}

// flush flushes the current buffer regardless of whether it is full or not.
// It's the implementation for Writer.Flush.
func (w *gRPCWriter) flush() (int64, error) {
	if !w.append {
		return 0, errors.New("Flush is supported only if Writer.Append is set to true")
	}

	// Close PipeWriter to trigger EOF on read side of the stream.
	w.flushInProgress = true
	w.pw.Close()

	// Wait for flush to complete
	result := <-w.flushComplete
	return result.offset, result.err
}

func checkCanceled(err error) error {
	if status.Code(err) == codes.Canceled {
		return context.Canceled
	}

	return err
}

type gRPCAppendBidiWriteBufferSender struct {
	bucket          string
	routingToken    *string
	raw             *gapic.Client
	settings        *settings
	stream          storagepb.Storage_BidiWriteObjectClient
	firstMessage    *storagepb.BidiWriteObjectRequest
	objectChecksums *storagepb.ObjectChecksums

	finalizeOnClose bool

	forceFirstMessage bool
	progress          func(int64)
	flushOffset       int64
	takeoverOffset    int64
	objResource       *storagepb.Object // Captures received obj to set w.Attrs.

	// Fields used to report responses from the receive side of the stream
	// recvs is closed when the current recv goroutine is complete. recvErr is set
	// to the result of that stream (including io.EOF to indicate success)
	recvs   <-chan *storagepb.BidiWriteObjectResponse
	recvErr error
}

// Use for a newly created appendable object.
func (w *gRPCWriter) newGRPCAppendableObjectBufferSender() (*gRPCAppendBidiWriteBufferSender, error) {
	s := &gRPCAppendBidiWriteBufferSender{
		bucket:   w.spec.GetResource().GetBucket(),
		raw:      w.c.raw,
		settings: w.settings,
		firstMessage: &storagepb.BidiWriteObjectRequest{
			FirstMessage: &storagepb.BidiWriteObjectRequest_WriteObjectSpec{
				WriteObjectSpec: w.spec,
			},
			CommonObjectRequestParams: toProtoCommonObjectRequestParams(w.encryptionKey),
		},
		objectChecksums:   toProtoChecksums(w.sendCRC32C, w.attrs),
		finalizeOnClose:   w.finalizeOnClose,
		forceFirstMessage: true,
		progress:          w.progress,
	}
	return s, nil
}

// Use for a takeover of an appendable object.
// Unlike newGRPCAppendableObjectBufferSender, this blocks until the stream is
// open because it needs to get the append offset from the server.
func (w *gRPCWriter) newGRPCAppendTakeoverWriteBufferSender(ctx context.Context) (*gRPCAppendBidiWriteBufferSender, error) {
	s := &gRPCAppendBidiWriteBufferSender{
		bucket:   w.spec.GetResource().GetBucket(),
		raw:      w.c.raw,
		settings: w.settings,
		firstMessage: &storagepb.BidiWriteObjectRequest{
			FirstMessage: &storagepb.BidiWriteObjectRequest_AppendObjectSpec{
				AppendObjectSpec: w.appendSpec,
			},
		},
		objectChecksums:   toProtoChecksums(w.sendCRC32C, w.attrs),
		finalizeOnClose:   w.finalizeOnClose,
		forceFirstMessage: true,
		progress:          w.progress,
	}
	if err := s.connect(ctx); err != nil {
		return nil, fmt.Errorf("storage: opening appendable write stream: %w", err)
	}
	_, err := s.sendOnConnectedStream(nil, 0, false, false, true)
	if err != nil {
		return nil, err
	}
	firstResp := <-s.recvs
	// Check recvErr after getting the response.
	if s.recvErr != nil {
		return nil, s.recvErr
	}

	// Object resource is returned in the first response on takeover, so capture
	// this now.
	s.objResource = firstResp.GetResource()
	s.takeoverOffset = firstResp.GetResource().GetSize()
	return s, nil
}

func (s *gRPCAppendBidiWriteBufferSender) connect(ctx context.Context) (err error) {
	err = func() error {
		// If this is a forced first message, we've already determined it's safe to
		// send.
		if s.forceFirstMessage {
			s.forceFirstMessage = false
			return nil
		}

		// It's always ok to reconnect if there is a handle. This is the common
		// case.
		if s.firstMessage.GetAppendObjectSpec().GetWriteHandle() != nil {
			return nil
		}
		// Also always okay to reconnect if there is a generation.
		if s.firstMessage.GetAppendObjectSpec().GetGeneration() != 0 {
			return nil
		}
		// Also always ok to reconnect if we've seen a redirect token
		if s.routingToken != nil {
			return nil
		}

		// We can also reconnect if the first message has an if_generation_match or
		// if_metageneration_match condition. Note that negative conditions like
		// if_generation_not_match are not necessarily safe to retry.
		aos := s.firstMessage.GetAppendObjectSpec()
		wos := s.firstMessage.GetWriteObjectSpec()

		if aos != nil && aos.IfMetagenerationMatch != nil {
			return nil
		}

		if wos != nil && wos.IfGenerationMatch != nil {
			return nil
		}
		if wos != nil && wos.IfMetagenerationMatch != nil {
			return nil
		}

		// Otherwise, it is not safe to reconnect.
		return errors.New("cannot safely reconnect; no write handle or preconditions")
	}()
	if err != nil {
		return err
	}

	return s.startReceiver(ctx)
}

func (s *gRPCAppendBidiWriteBufferSender) withRequestParams(ctx context.Context) context.Context {
	param := fmt.Sprintf("appendable=true&bucket=%s", s.bucket)
	if s.routingToken != nil {
		param = param + fmt.Sprintf("&routing_token=%s", *s.routingToken)
	}
	return gax.InsertMetadataIntoOutgoingContext(ctx, "x-goog-request-params", param)
}

func (s *gRPCAppendBidiWriteBufferSender) startReceiver(ctx context.Context) (err error) {
	s.stream, err = s.raw.BidiWriteObject(s.withRequestParams(ctx), s.settings.gax...)
	if err != nil {
		return
	}

	recvs := make(chan *storagepb.BidiWriteObjectResponse)
	s.recvs = recvs
	s.recvErr = nil
	go s.receiveMessages(recvs)
	return
}

func (s *gRPCAppendBidiWriteBufferSender) ensureFirstMessageAppendObjectSpec() {
	if s.firstMessage.GetWriteObjectSpec() != nil {
		w := s.firstMessage.GetWriteObjectSpec()
		s.firstMessage.FirstMessage = &storagepb.BidiWriteObjectRequest_AppendObjectSpec{
			AppendObjectSpec: &storagepb.AppendObjectSpec{
				Bucket:                   w.GetResource().GetBucket(),
				Object:                   w.GetResource().GetName(),
				IfMetagenerationMatch:    w.IfMetagenerationMatch,
				IfMetagenerationNotMatch: w.IfMetagenerationNotMatch,
			},
		}
	}
}

func (s *gRPCAppendBidiWriteBufferSender) maybeUpdateFirstMessage(resp *storagepb.BidiWriteObjectResponse) {
	// Any affirmative response should switch us to an AppendObjectSpec.
	s.ensureFirstMessageAppendObjectSpec()

	if r := resp.GetResource(); r != nil {
		aos := s.firstMessage.GetAppendObjectSpec()
		aos.Bucket = r.GetBucket()
		aos.Object = r.GetName()
		aos.Generation = r.GetGeneration()
	}

	if h := resp.GetWriteHandle(); h != nil {
		s.firstMessage.GetAppendObjectSpec().WriteHandle = h
	}
}

type bidiWriteObjectRedirectionError struct{}

func (e bidiWriteObjectRedirectionError) Error() string {
	return ""
}

func (s *gRPCAppendBidiWriteBufferSender) handleRedirectionError(e *storagepb.BidiWriteObjectRedirectedError) bool {
	if e.RoutingToken == nil {
		// This shouldn't happen, but we don't want to blindly retry here. Instead,
		// surface the error to the caller.
		return false
	}

	if e.WriteHandle != nil {
		// If we get back a write handle, we should use it. We can only use it
		// on an append object spec.
		s.ensureFirstMessageAppendObjectSpec()
		s.firstMessage.GetAppendObjectSpec().WriteHandle = e.WriteHandle
		// Generation is meant to only come with the WriteHandle, so ignore it
		// otherwise.
		if e.Generation != nil {
			s.firstMessage.GetAppendObjectSpec().Generation = e.GetGeneration()
		}
	}

	s.routingToken = e.RoutingToken
	return true
}

func (s *gRPCAppendBidiWriteBufferSender) receiveMessages(resps chan<- *storagepb.BidiWriteObjectResponse) {
	resp, err := s.stream.Recv()
	for err == nil {
		s.maybeUpdateFirstMessage(resp)

		if resp.WriteStatus != nil {
			// We only get a WriteStatus if this was a solicited message (either
			// state_lookup: true or finish_write: true). Unsolicited messages may
			// arrive to update our handle if necessary. We don't want to block on
			// this channel write if this was an unsolicited message.
			resps <- resp
		}

		resp, err = s.stream.Recv()
	}

	if st, ok := status.FromError(err); ok && st.Code() == codes.Aborted {
		for _, d := range st.Details() {
			if e, ok := d.(*storagepb.BidiWriteObjectRedirectedError); ok {
				// If we can handle this error, wrap it with the sentinel so it gets
				// retried.
				if ok := s.handleRedirectionError(e); ok {
					err = fmt.Errorf("%w%w", bidiWriteObjectRedirectionError{}, err)
				}
			}
		}
	}

	// TODO: automatically reconnect on retriable recv errors, even if there are
	// no sends occurring.
	s.recvErr = err
	close(resps)
}

func (s *gRPCAppendBidiWriteBufferSender) sendOnConnectedStream(buf []byte, offset int64, flush, finishWrite, sendFirstMessage bool) (obj *storagepb.Object, err error) {
	var req *storagepb.BidiWriteObjectRequest
	finalizeObject := finishWrite && s.finalizeOnClose
	if finishWrite {
		// Always flush when finishing the Write, even if not finalizing.
		req = bidiWriteObjectRequest(buf, offset, true, finalizeObject)
	} else {
		req = bidiWriteObjectRequest(buf, offset, flush, false)
	}
	if finalizeObject {
		// appendable objects pass checksums on the finalize message only
		req.ObjectChecksums = s.objectChecksums
	}
	if sendFirstMessage {
		proto.Merge(req, s.firstMessage)
	}

	if err = s.stream.Send(req); err != nil {
		return nil, err
	}

	if finishWrite {
		s.stream.CloseSend()
		for resp := range s.recvs {
			if resp.GetResource() != nil {
				obj = resp.GetResource()
			}
			// When closing the stream, update the object resource to reflect
			// the persisted size. We get a new object from the stream if
			// the object was finalized, but not if it's unfinalized.
			if s.objResource != nil && resp.GetPersistedSize() > 0 {
				s.objResource.Size = resp.GetPersistedSize()
			}
		}
		if s.recvErr != io.EOF {
			return nil, s.recvErr
		}
		if obj.GetSize() > s.flushOffset {
			s.flushOffset = obj.GetSize()
			s.progress(s.flushOffset)
		}
		return
	}

	if flush {
		// We don't necessarily expect multiple responses for a single flush, but
		// this allows the server to send multiple responses if it wants to.
		flushOffset := s.flushOffset

		// Await a response on the stream. Loop at least once or until the
		// persisted offset matches the flush offset.
		for {
			resp, ok := <-s.recvs
			if !ok {
				return nil, s.recvErr
			}
			pSize := resp.GetPersistedSize()
			rSize := resp.GetResource().GetSize()
			if flushOffset < pSize {
				flushOffset = pSize
			}
			if flushOffset < rSize {
				flushOffset = rSize
			}
			// On the first flush, we expect to get an object resource back and
			// should return it.
			if resp.GetResource() != nil {
				obj = resp.GetResource()
			}
			if flushOffset <= offset+int64(len(buf)) {
				break
			}
		}
		if s.flushOffset < flushOffset {
			s.flushOffset = flushOffset
			s.progress(s.flushOffset)
		}
	}
	return
}

func (s *gRPCAppendBidiWriteBufferSender) sendBuffer(ctx context.Context, buf []byte, offset int64, flush, finishWrite bool) (obj *storagepb.Object, err error) {
	for {
		sendFirstMessage := false
		if s.stream == nil {
			sendFirstMessage = true
			if err = s.connect(ctx); err != nil {
				return
			}
		}

		obj, err = s.sendOnConnectedStream(buf, offset, flush, finishWrite, sendFirstMessage)
		if obj != nil {
			s.objResource = obj
		}
		if err == nil {
			return
		}

		// await recv stream termination
		for range s.recvs {
		}
		if s.recvErr != io.EOF {
			err = s.recvErr
		}
		s.stream = nil
		return
	}
}
