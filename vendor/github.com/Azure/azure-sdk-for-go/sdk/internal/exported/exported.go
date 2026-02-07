//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package exported

import (
	"errors"
	"io"
	"net/http"
)

// HasStatusCode returns true if the Response's status code is one of the specified values.
// Exported as runtime.HasStatusCode().
func HasStatusCode(resp *http.Response, statusCodes ...int) bool {
	if resp == nil {
		return false
	}
	for _, sc := range statusCodes {
		if resp.StatusCode == sc {
			return true
		}
	}
	return false
}

// PayloadOptions contains the optional values for the Payload func.
// NOT exported but used by azcore.
type PayloadOptions struct {
	// BytesModifier receives the downloaded byte slice and returns an updated byte slice.
	// Use this to modify the downloaded bytes in a payload (e.g. removing a BOM).
	BytesModifier func([]byte) []byte
}

// Payload reads and returns the response body or an error.
// On a successful read, the response body is cached.
// Subsequent reads will access the cached value.
// Exported as runtime.Payload() WITHOUT the opts parameter.
func Payload(resp *http.Response, opts *PayloadOptions) ([]byte, error) {
	if resp.Body == nil {
		// this shouldn't happen in real-world scenarios as a
		// response with no body should set it to http.NoBody
		return nil, nil
	}
	modifyBytes := func(b []byte) []byte { return b }
	if opts != nil && opts.BytesModifier != nil {
		modifyBytes = opts.BytesModifier
	}

	// r.Body won't be a nopClosingBytesReader if downloading was skipped
	if buf, ok := resp.Body.(*nopClosingBytesReader); ok {
		bytesBody := modifyBytes(buf.Bytes())
		buf.Set(bytesBody)
		return bytesBody, nil
	}

	bytesBody, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, err
	}

	bytesBody = modifyBytes(bytesBody)
	resp.Body = &nopClosingBytesReader{s: bytesBody}
	return bytesBody, nil
}

// PayloadDownloaded returns true if the response body has already been downloaded.
// This implies that the Payload() func above has been previously called.
// NOT exported but used by azcore.
func PayloadDownloaded(resp *http.Response) bool {
	_, ok := resp.Body.(*nopClosingBytesReader)
	return ok
}

// nopClosingBytesReader is an io.ReadSeekCloser around a byte slice.
// It also provides direct access to the byte slice to avoid rereading.
type nopClosingBytesReader struct {
	s []byte
	i int64
}

// Bytes returns the underlying byte slice.
func (r *nopClosingBytesReader) Bytes() []byte {
	return r.s
}

// Close implements the io.Closer interface.
func (*nopClosingBytesReader) Close() error {
	return nil
}

// Read implements the io.Reader interface.
func (r *nopClosingBytesReader) Read(b []byte) (n int, err error) {
	if r.i >= int64(len(r.s)) {
		return 0, io.EOF
	}
	n = copy(b, r.s[r.i:])
	r.i += int64(n)
	return
}

// Set replaces the existing byte slice with the specified byte slice and resets the reader.
func (r *nopClosingBytesReader) Set(b []byte) {
	r.s = b
	r.i = 0
}

// Seek implements the io.Seeker interface.
func (r *nopClosingBytesReader) Seek(offset int64, whence int) (int64, error) {
	var i int64
	switch whence {
	case io.SeekStart:
		i = offset
	case io.SeekCurrent:
		i = r.i + offset
	case io.SeekEnd:
		i = int64(len(r.s)) + offset
	default:
		return 0, errors.New("nopClosingBytesReader: invalid whence")
	}
	if i < 0 {
		return 0, errors.New("nopClosingBytesReader: negative position")
	}
	r.i = i
	return i, nil
}
