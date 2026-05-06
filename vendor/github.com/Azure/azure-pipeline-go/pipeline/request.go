package pipeline

import (
	"io"
	"net/http"
	"net/url"
	"strconv"
)

// Request is a thin wrapper over an http.Request. The wrapper provides several helper methods.
type Request struct {
	*http.Request
}

// NewRequest initializes a new HTTP request object with any desired options.
func NewRequest(method string, url url.URL, body io.ReadSeeker) (request Request, err error) {
	// Note: the url is passed by value so that any pipeline operations that modify it do so on a copy.

	// This code to construct an http.Request is copied from http.NewRequest(); we intentionally omitted removeEmptyPort for now.
	request.Request = &http.Request{
		Method:     method,
		URL:        &url,
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		Header:     make(http.Header),
		Host:       url.Host,
	}

	if body != nil {
		err = request.SetBody(body)
	}
	return
}

// SetBody sets the body and content length, assumes body is not nil.
func (r Request) SetBody(body io.ReadSeeker) error {
	size, err := body.Seek(0, io.SeekEnd)
	if err != nil {
		return err
	}

	body.Seek(0, io.SeekStart)
	r.ContentLength = size
	r.Header["Content-Length"] = []string{strconv.FormatInt(size, 10)}

	if size != 0 {
		r.Body = &retryableRequestBody{body: body}
		r.GetBody = func() (io.ReadCloser, error) {
			_, err := body.Seek(0, io.SeekStart)
			if err != nil {
				return nil, err
			}
			return r.Body, nil
		}
	} else {
		// in case the body is an empty stream, we need to use http.NoBody to explicitly provide no content
		r.Body = http.NoBody
		r.GetBody = func() (io.ReadCloser, error) {
			return http.NoBody, nil
		}

		// close the user-provided empty body
		if c, ok := body.(io.Closer); ok {
			c.Close()
		}
	}

	return nil
}

// Copy makes a copy of an http.Request. Specifically, it makes a deep copy
// of its Method, URL, Host, Proto(Major/Minor), Header. ContentLength, Close,
// RemoteAddr, RequestURI. Copy makes a shallow copy of the Body, GetBody, TLS,
// Cancel, Response, and ctx fields. Copy panics if any of these fields are
// not nil: TransferEncoding, Form, PostForm, MultipartForm, or Trailer.
func (r Request) Copy() Request {
	if r.TransferEncoding != nil || r.Form != nil || r.PostForm != nil || r.MultipartForm != nil || r.Trailer != nil {
		panic("Can't make a deep copy of the http.Request because at least one of the following is not nil:" +
			"TransferEncoding, Form, PostForm, MultipartForm, or Trailer.")
	}
	copy := *r.Request          // Copy the request
	urlCopy := *(r.Request.URL) // Copy the URL
	copy.URL = &urlCopy
	copy.Header = http.Header{} // Copy the header
	for k, vs := range r.Header {
		for _, value := range vs {
			copy.Header.Add(k, value)
		}
	}
	return Request{Request: &copy} // Return the copy
}

func (r Request) close() error {
	if r.Body != nil && r.Body != http.NoBody {
		c, ok := r.Body.(*retryableRequestBody)
		if !ok {
			panic("unexpected request body type (should be *retryableReadSeekerCloser)")
		}
		return c.realClose()
	}
	return nil
}

// RewindBody seeks the request's Body stream back to the beginning so it can be resent when retrying an operation.
func (r Request) RewindBody() error {
	if r.Body != nil && r.Body != http.NoBody {
		s, ok := r.Body.(io.Seeker)
		if !ok {
			panic("unexpected request body type (should be io.Seeker)")
		}

		// Reset the stream back to the beginning
		_, err := s.Seek(0, io.SeekStart)
		return err
	}
	return nil
}

// ********** The following type/methods implement the retryableRequestBody (a ReadSeekCloser)

// This struct is used when sending a body to the network
type retryableRequestBody struct {
	body io.ReadSeeker // Seeking is required to support retries
}

// Read reads a block of data from an inner stream and reports progress
func (b *retryableRequestBody) Read(p []byte) (n int, err error) {
	return b.body.Read(p)
}

func (b *retryableRequestBody) Seek(offset int64, whence int) (offsetFromStart int64, err error) {
	return b.body.Seek(offset, whence)
}

func (b *retryableRequestBody) Close() error {
	// We don't want the underlying transport to close the request body on transient failures so this is a nop.
	// The pipeline closes the request body upon success.
	return nil
}

func (b *retryableRequestBody) realClose() error {
	if c, ok := b.body.(io.Closer); ok {
		return c.Close()
	}
	return nil
}
