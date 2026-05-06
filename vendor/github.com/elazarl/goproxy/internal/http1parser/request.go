package http1parser

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/textproto"
)

type RequestReader struct {
	preventCanonicalization bool
	reader                  *bufio.Reader
	// Used only when preventCanonicalization value is true
	cloned *bytes.Buffer
}

func NewRequestReader(preventCanonicalization bool, conn io.Reader) *RequestReader {
	if !preventCanonicalization {
		return &RequestReader{
			preventCanonicalization: false,
			reader:                  bufio.NewReader(conn),
		}
	}

	var cloned bytes.Buffer
	reader := bufio.NewReader(io.TeeReader(conn, &cloned))
	return &RequestReader{
		preventCanonicalization: true,
		reader:                  reader,
		cloned:                  &cloned,
	}
}

// IsEOF returns true if there is no more data that can be read from the
// buffer and the underlying connection is closed.
func (r *RequestReader) IsEOF() bool {
	_, err := r.reader.Peek(1)
	return errors.Is(err, io.EOF)
}

// Reader is used to take over the buffered connection data
// (e.g. with HTTP/2 data).
// After calling this function, make sure to consume all the data related
// to the current request.
func (r *RequestReader) Reader() *bufio.Reader {
	return r.reader
}

func (r *RequestReader) ReadRequest() (*http.Request, error) {
	if !r.preventCanonicalization {
		// Just call the HTTP library function if the preventCanonicalization
		// configuration is disabled
		return http.ReadRequest(r.reader)
	}

	req, err := http.ReadRequest(r.reader)
	if err != nil {
		return nil, err
	}

	httpDataReader := getRequestReader(r.reader, r.cloned)
	headers, _ := Http1ExtractHeaders(httpDataReader)

	for _, headerName := range headers {
		canonicalizedName := textproto.CanonicalMIMEHeaderKey(headerName)
		if canonicalizedName == headerName {
			continue
		}

		// Rewrite header keys to the non-canonical parsed value
		values, ok := req.Header[canonicalizedName]
		if ok {
			req.Header.Del(canonicalizedName)
			req.Header[headerName] = values
		}
	}

	return req, nil
}

func getRequestReader(r *bufio.Reader, cloned *bytes.Buffer) *textproto.Reader {
	// "Cloned" buffer uses the raw connection as the data source.
	// However, the *bufio.Reader can read also bytes of another unrelated
	// request on the same connection, since it's buffered, so we have to
	// ignore them before passing the data to our headers parser.
	// Data related to the next request will remain inside the buffer for
	// later usage.
	data := cloned.Next(cloned.Len() - r.Buffered())
	return &textproto.Reader{
		R: bufio.NewReader(bytes.NewReader(data)),
	}
}
