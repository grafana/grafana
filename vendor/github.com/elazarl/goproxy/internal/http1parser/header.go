package http1parser

import (
	"errors"
	"net/textproto"
	"strings"
)

var ErrBadProto = errors.New("bad protocol")

// Http1ExtractHeaders is an HTTP/1.0 and HTTP/1.1 header-only parser,
// to extract the original header names for the received request.
// Fully inspired by readMIMEHeader() in
// https://github.com/golang/go/blob/master/src/net/textproto/reader.go
func Http1ExtractHeaders(r *textproto.Reader) ([]string, error) {
	// Discard first line, it doesn't contain useful information, and it has
	// already been validated in http.ReadRequest()
	if _, err := r.ReadLine(); err != nil {
		return nil, err
	}

	// The first line cannot start with a leading space.
	if buf, err := r.R.Peek(1); err == nil && (buf[0] == ' ' || buf[0] == '\t') {
		return nil, ErrBadProto
	}

	var headerNames []string
	for {
		kv, err := r.ReadContinuedLine()
		if len(kv) == 0 {
			// We have finished to parse the headers if we receive empty
			// data without an error
			return headerNames, err
		}

		// Key ends at first colon.
		k, _, ok := strings.Cut(kv, ":")
		if !ok {
			return nil, ErrBadProto
		}
		headerNames = append(headerNames, k)
	}
}
