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
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"sync"
	"sync/atomic"
)

// duplexHTTPCall is a full-duplex stream between the client and server. The
// request body is the stream from client to server, and the response body is
// the reverse.
//
// Be warned: we need to use some lesser-known APIs to do this with net/http.
type duplexHTTPCall struct {
	ctx              context.Context
	httpClient       HTTPClient
	streamType       StreamType
	onRequestSend    func(*http.Request)
	validateResponse func(*http.Response) *Error

	// io.Pipe is used to implement the request body for client streaming calls.
	// If the request is unary, requestBodyWriter is nil.
	requestBodyWriter *io.PipeWriter

	// requestSent ensures we only send the request once.
	requestSent atomic.Bool
	request     *http.Request

	// responseReady is closed when the response is ready or when the request
	// fails. Any error on request initialisation will be set on the
	// responseErr. There's always a response if responseErr is nil.
	responseReady chan struct{}
	response      *http.Response
	responseErr   error
}

func newDuplexHTTPCall(
	ctx context.Context,
	httpClient HTTPClient,
	url *url.URL,
	spec Spec,
	header http.Header,
) *duplexHTTPCall {
	// ensure we make a copy of the url before we pass along to the
	// Request. This ensures if a transport out of our control wants
	// to mutate the req.URL, we don't feel the effects of it.
	url = cloneURL(url)

	// This is mirroring what http.NewRequestContext did, but
	// using an already parsed url.URL object, rather than a string
	// and parsing it again. This is a bit funny with HTTP/1.1
	// explicitly, but this is logic copied over from
	// NewRequestContext and doesn't effect the actual version
	// being transmitted.
	request := (&http.Request{
		Method:     http.MethodPost,
		URL:        url,
		Header:     header,
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		Body:       http.NoBody,
		GetBody:    getNoBody,
		Host:       url.Host,
	}).WithContext(ctx)
	return &duplexHTTPCall{
		ctx:           ctx,
		httpClient:    httpClient,
		streamType:    spec.StreamType,
		request:       request,
		responseReady: make(chan struct{}),
	}
}

// Send sends a message to the server.
func (d *duplexHTTPCall) Send(payload messagePayload) (int64, error) {
	if d.streamType&StreamTypeClient == 0 {
		return d.sendUnary(payload)
	}
	isFirst := d.requestSent.CompareAndSwap(false, true)
	if isFirst {
		// This is the first time we're sending a message to the server.
		// We need to send the request headers and start the request.
		pipeReader, pipeWriter := io.Pipe()
		d.requestBodyWriter = pipeWriter
		d.request.Body = pipeReader
		d.request.GetBody = nil // GetBody not supported for client streaming
		d.request.ContentLength = -1
		go d.makeRequest() // concurrent request
	}
	if err := d.ctx.Err(); err != nil {
		return 0, wrapIfContextError(err)
	}
	if isFirst && payload.Len() == 0 {
		// On first write a nil Send is used to send request headers. Avoid
		// writing a zero-length payload to avoid superfluous errors with close.
		return 0, nil
	}
	// It's safe to write to this side of the pipe while net/http concurrently
	// reads from the other side.
	bytesWritten, err := payload.WriteTo(d.requestBodyWriter)
	if err != nil && errors.Is(err, io.ErrClosedPipe) {
		// Signal that the stream is closed with the more-typical io.EOF instead of
		// io.ErrClosedPipe. This makes it easier for protocol-specific wrappers to
		// match grpc-go's behavior.
		err = io.EOF
	}
	return bytesWritten, err
}

func (d *duplexHTTPCall) sendUnary(payload messagePayload) (int64, error) {
	// Unary messages are sent as a single HTTP request. We don't need to use a
	// pipe for the request body and we don't need to send headers separately.
	if !d.requestSent.CompareAndSwap(false, true) {
		return 0, errors.New("request already sent")
	}
	payloadLength := int64(payload.Len())
	if payloadLength > 0 {
		// Build the request body from the payload.
		payloadBody := newPayloadCloser(payload)
		d.request.Body = payloadBody
		d.request.ContentLength = payloadLength
		d.request.GetBody = func() (io.ReadCloser, error) {
			if !payloadBody.Rewind() {
				return nil, errors.New("payload cannot be retried")
			}
			return payloadBody, nil
		}
		// Release the payload ensuring that after Send returns the
		// payload is safe to be reused. See [http.RoundTripper] for
		// more details.
		defer payloadBody.Release()
	}
	d.makeRequest() // synchronous request
	if d.responseErr != nil {
		// Check on response errors for context errors. Other errors are
		// handled on read.
		if err := d.ctx.Err(); err != nil {
			return 0, wrapIfContextError(err)
		}
	}
	return payloadLength, nil
}

// CloseWrite closes the request body. Callers *must* call CloseWrite before Read when
// using HTTP/1.x.
func (d *duplexHTTPCall) CloseWrite() error {
	// Even if Write was never called, we need to make an HTTP request. This
	// ensures that we've sent any headers to the server and that we have an HTTP
	// response to read from.
	if d.requestSent.CompareAndSwap(false, true) {
		go d.makeRequest()
		// We never setup a request body, so it's effectively already closed.
		// So nothing else to do.
		return nil
	}
	// The user calls CloseWrite to indicate that they're done sending data. It's
	// safe to close the write side of the pipe while net/http is reading from
	// it.
	//
	// Because connect also supports some RPC types over HTTP/1.1, we need to be
	// careful how we expose this method to users. HTTP/1.1 doesn't support
	// bidirectional streaming - the write side of the stream (aka request body)
	// must be closed before we start reading the response or we'll just block
	// forever. To make sure users don't have to worry about this, the generated
	// code for unary, client streaming, and server streaming RPCs must call
	// CloseWrite automatically rather than requiring the user to do it.
	if d.requestBodyWriter != nil {
		return d.requestBodyWriter.Close()
	}
	return d.request.Body.Close()
}

// Header returns the HTTP request headers.
func (d *duplexHTTPCall) Header() http.Header {
	return d.request.Header
}

// Trailer returns the HTTP request trailers.
func (d *duplexHTTPCall) Trailer() http.Header {
	return d.request.Trailer
}

// URL returns the URL for the request.
func (d *duplexHTTPCall) URL() *url.URL {
	return d.request.URL
}

// Method returns the HTTP method for the request (GET or POST).
func (d *duplexHTTPCall) Method() string {
	return d.request.Method
}

// SetMethod changes the method of the request before it is sent.
func (d *duplexHTTPCall) SetMethod(method string) {
	d.request.Method = method
}

// Read from the response body. Returns the first error passed to SetError.
func (d *duplexHTTPCall) Read(data []byte) (int, error) {
	// First, we wait until we've gotten the response headers and established the
	// server-to-client side of the stream.
	if err := d.BlockUntilResponseReady(); err != nil {
		// The stream is already closed or corrupted.
		return 0, err
	}
	// Before we read, check if the context has been canceled.
	if err := d.ctx.Err(); err != nil {
		return 0, wrapIfContextError(err)
	}
	n, err := d.response.Body.Read(data)
	if err != nil && !errors.Is(err, io.EOF) {
		err = wrapIfContextDone(d.ctx, err)
		err = wrapIfRSTError(err)
	}
	return n, err
}

func (d *duplexHTTPCall) CloseRead() error {
	_ = d.BlockUntilResponseReady()
	if d.response == nil {
		return nil
	}
	err := d.response.Body.Close()
	err = wrapIfContextDone(d.ctx, err)
	return wrapIfRSTError(err)
}

// ResponseStatusCode is the response's HTTP status code.
func (d *duplexHTTPCall) ResponseStatusCode() (int, error) {
	if err := d.BlockUntilResponseReady(); err != nil {
		return 0, err
	}
	return d.response.StatusCode, nil
}

// ResponseHeader returns the response HTTP headers.
func (d *duplexHTTPCall) ResponseHeader() http.Header {
	_ = d.BlockUntilResponseReady()
	if d.response != nil {
		return d.response.Header
	}
	return make(http.Header)
}

// ResponseTrailer returns the response HTTP trailers.
func (d *duplexHTTPCall) ResponseTrailer() http.Header {
	_ = d.BlockUntilResponseReady()
	if d.response != nil {
		return d.response.Trailer
	}
	return make(http.Header)
}

// SetValidateResponse sets the response validation function. The function runs
// in a background goroutine.
func (d *duplexHTTPCall) SetValidateResponse(validate func(*http.Response) *Error) {
	d.validateResponse = validate
}

// BlockUntilResponseReady returns when the response is ready or reports an
// error from initializing the request.
func (d *duplexHTTPCall) BlockUntilResponseReady() error {
	<-d.responseReady
	return d.responseErr
}

func (d *duplexHTTPCall) makeRequest() {
	// This runs concurrently with Write and CloseWrite. Read and CloseRead wait
	// on d.responseReady, so we can't race with them.
	defer close(d.responseReady)

	// Promote the header Host to the request object.
	if host := getHeaderCanonical(d.request.Header, headerHost); len(host) > 0 {
		d.request.Host = host
	}
	if d.onRequestSend != nil {
		d.onRequestSend(d.request)
	}
	// Once we send a message to the server, they send a message back and
	// establish the receive side of the stream.
	// On error, we close the request body using the Write side of the pipe.
	// This ensures HTTP2 streams receive an io.EOF from the Read side of the
	// pipe. Write's check for io.ErrClosedPipe and will convert this to io.EOF.
	response, err := d.httpClient.Do(d.request) //nolint:bodyclose
	if err != nil {
		if errors.Is(err, io.EOF) {
			// We use io.EOF as a sentinel in many places and don't want this
			// transport error to be confused for those other situations.
			err = io.ErrUnexpectedEOF
		}
		err = wrapIfContextError(err)
		err = wrapIfLikelyH2CNotConfiguredError(d.request, err)
		err = wrapIfLikelyWithGRPCNotUsedError(err)
		err = wrapIfRSTError(err)
		if _, ok := asError(err); !ok {
			err = NewError(CodeUnavailable, err)
		}
		d.responseErr = err
		_ = d.CloseWrite()
		return
	}
	// We've got a response. We can now read from the response body.
	// Closing the response body is delegated to the caller even on error.
	d.response = response
	if err := d.validateResponse(response); err != nil {
		d.responseErr = err
		_ = d.CloseWrite()
		return
	}
	if (d.streamType&StreamTypeBidi) == StreamTypeBidi && response.ProtoMajor < 2 {
		// If we somehow dialed an HTTP/1.x server, fail with an explicit message
		// rather than returning a more cryptic error later on.
		d.responseErr = errorf(
			CodeUnimplemented,
			"response from %v is HTTP/%d.%d: bidi streams require at least HTTP/2",
			d.request.URL,
			response.ProtoMajor,
			response.ProtoMinor,
		)
		_ = d.CloseWrite()
	}
}

// getNoBody is a GetBody function for http.NoBody.
func getNoBody() (io.ReadCloser, error) {
	return http.NoBody, nil
}

// messagePayload is a sized and seekable message payload. The interface is
// implemented by [*bytes.Reader] and *envelope. Reads must be non-blocking.
type messagePayload interface {
	io.Reader
	io.WriterTo
	io.Seeker
	Len() int
}

// nopPayload is a message payload that does nothing. It's used to send headers
// to the server.
type nopPayload struct{}

var _ messagePayload = nopPayload{}

func (nopPayload) Read([]byte) (int, error) {
	return 0, io.EOF
}
func (nopPayload) WriteTo(io.Writer) (int64, error) {
	return 0, nil
}
func (nopPayload) Seek(int64, int) (int64, error) {
	return 0, nil
}
func (nopPayload) Len() int {
	return 0
}

// messageSender sends a message payload. The interface is implemented by
// [*duplexHTTPCall] and writeSender.
type messageSender interface {
	Send(messagePayload) (int64, error)
}

// writeSender is a sender that writes to an [io.Writer]. Useful for wrapping
// [http.ResponseWriter].
type writeSender struct {
	writer io.Writer
}

var _ messageSender = writeSender{}

func (w writeSender) Send(payload messagePayload) (int64, error) {
	return payload.WriteTo(w.writer)
}

// See: https://cs.opensource.google/go/go/+/refs/tags/go1.20.1:src/net/http/clone.go;l=22-33
func cloneURL(oldURL *url.URL) *url.URL {
	if oldURL == nil {
		return nil
	}
	newURL := new(url.URL)
	*newURL = *oldURL
	if oldURL.User != nil {
		newURL.User = new(url.Userinfo)
		*newURL.User = *oldURL.User
	}
	return newURL
}

// payloadCloser is an [io.ReadCloser] that wraps a messagePayload. It's used to
// implement the request body for unary calls. To safely reuse the buffer
// call Release after the response is received to ensure the payload is safe for
// reuse.
type payloadCloser struct {
	mu      sync.Mutex
	payload messagePayload // nil after Release
}

func newPayloadCloser(payload messagePayload) *payloadCloser {
	return &payloadCloser{
		payload: payload,
	}
}

// Read implements [io.Reader].
func (p *payloadCloser) Read(dst []byte) (readN int, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.payload == nil {
		return 0, io.EOF
	}
	return p.payload.Read(dst)
}

// WriteTo implements [io.WriterTo].
func (p *payloadCloser) WriteTo(dst io.Writer) (int64, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.payload == nil {
		return 0, nil
	}
	return p.payload.WriteTo(dst)
}

// Close implements [io.Closer].
func (p *payloadCloser) Close() error {
	return nil
}

// Rewind rewinds the payload to the beginning. It returns false if the
// payload has been discarded from a previous call to Release.
func (p *payloadCloser) Rewind() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.payload == nil {
		return false
	}
	if _, err := p.payload.Seek(0, io.SeekStart); err != nil {
		return false
	}
	return true
}

// Release discards the payload. After Release is called, the payload cannot be
// rewound and the payload is safe to reuse.
func (p *payloadCloser) Release() {
	p.mu.Lock()
	p.payload = nil
	p.mu.Unlock()
}
