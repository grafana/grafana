package http

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	iointernal "github.com/aws/smithy-go/transport/http/internal/io"
)

// Request provides the HTTP specific request structure for HTTP specific
// middleware steps to use to serialize input, and send an operation's request.
type Request struct {
	*http.Request
	stream           io.Reader
	isStreamSeekable bool
	streamStartPos   int64
}

// NewStackRequest returns an initialized request ready to be populated with the
// HTTP request details. Returns empty interface so the function can be used as
// a parameter to the Smithy middleware Stack constructor.
func NewStackRequest() interface{} {
	return &Request{
		Request: &http.Request{
			URL:           &url.URL{},
			Header:        http.Header{},
			ContentLength: -1, // default to unknown length
		},
	}
}

// IsHTTPS returns if the request is HTTPS. Returns false if no endpoint URL is set.
func (r *Request) IsHTTPS() bool {
	if r.URL == nil {
		return false
	}
	return strings.EqualFold(r.URL.Scheme, "https")
}

// Clone returns a deep copy of the Request for the new context. A reference to
// the Stream is copied, but the underlying stream is not copied.
func (r *Request) Clone() *Request {
	rc := *r
	rc.Request = rc.Request.Clone(context.TODO())
	return &rc
}

// StreamLength returns the number of bytes of the serialized stream attached
// to the request and ok set. If the length cannot be determined, an error will
// be returned.
func (r *Request) StreamLength() (size int64, ok bool, err error) {
	return streamLength(r.stream, r.isStreamSeekable, r.streamStartPos)
}

func streamLength(stream io.Reader, seekable bool, startPos int64) (size int64, ok bool, err error) {
	if stream == nil {
		return 0, true, nil
	}

	if l, ok := stream.(interface{ Len() int }); ok {
		return int64(l.Len()), true, nil
	}

	if !seekable {
		return 0, false, nil
	}

	s := stream.(io.Seeker)
	endOffset, err := s.Seek(0, io.SeekEnd)
	if err != nil {
		return 0, false, err
	}

	// The reason to seek to streamStartPos instead of 0 is to ensure that the
	// SDK only sends the stream from the starting position the user's
	// application provided it to the SDK at. For example application opens a
	// file, and wants to skip the first N bytes uploading the rest. The
	// application would move the file's offset N bytes, then hand it off to
	// the SDK to send the remaining. The SDK should respect that initial offset.
	_, err = s.Seek(startPos, io.SeekStart)
	if err != nil {
		return 0, false, err
	}

	return endOffset - startPos, true, nil
}

// RewindStream will rewind the io.Reader to the relative start position if it
// is an io.Seeker.
func (r *Request) RewindStream() error {
	// If there is no stream there is nothing to rewind.
	if r.stream == nil {
		return nil
	}

	if !r.isStreamSeekable {
		return fmt.Errorf("request stream is not seekable")
	}
	_, err := r.stream.(io.Seeker).Seek(r.streamStartPos, io.SeekStart)
	return err
}

// GetStream returns the request stream io.Reader if a stream is set. If no
// stream is present nil will be returned.
func (r *Request) GetStream() io.Reader {
	return r.stream
}

// IsStreamSeekable returns whether the stream is seekable.
func (r *Request) IsStreamSeekable() bool {
	return r.isStreamSeekable
}

// SetStream returns a clone of the request with the stream set to the provided
// reader. May return an error if the provided reader is seekable but returns
// an error.
func (r *Request) SetStream(reader io.Reader) (rc *Request, err error) {
	rc = r.Clone()

	if reader == http.NoBody {
		reader = nil
	}

	var isStreamSeekable bool
	var streamStartPos int64
	switch v := reader.(type) {
	case io.Seeker:
		n, err := v.Seek(0, io.SeekCurrent)
		if err != nil {
			return r, err
		}
		isStreamSeekable = true
		streamStartPos = n
	default:
		// If the stream length can be determined, and is determined to be empty,
		// use a nil stream to prevent confusion between empty vs not-empty
		// streams.
		length, ok, err := streamLength(reader, false, 0)
		if err != nil {
			return nil, err
		} else if ok && length == 0 {
			reader = nil
		}
	}

	rc.stream = reader
	rc.isStreamSeekable = isStreamSeekable
	rc.streamStartPos = streamStartPos

	return rc, err
}

// Build returns a build standard HTTP request value from the Smithy request.
// The request's stream is wrapped in a safe container that allows it to be
// reused for subsequent attempts.
func (r *Request) Build(ctx context.Context) *http.Request {
	req := r.Request.Clone(ctx)

	if r.stream == nil && req.ContentLength == -1 {
		req.ContentLength = 0
	}

	switch stream := r.stream.(type) {
	case *io.PipeReader:
		req.Body = io.NopCloser(stream)
		req.ContentLength = -1
	default:
		// HTTP Client Request must only have a non-nil body if the
		// ContentLength is explicitly unknown (-1) or non-zero. The HTTP
		// Client will interpret a non-nil body and ContentLength 0 as
		// "unknown". This is unwanted behavior.
		if req.ContentLength != 0 && r.stream != nil {
			req.Body = iointernal.NewSafeReadCloser(io.NopCloser(stream))
		}
	}

	return req
}

// RequestCloner is a function that can take an input request type and clone the request
// for use in a subsequent retry attempt.
func RequestCloner(v interface{}) interface{} {
	return v.(*Request).Clone()
}
