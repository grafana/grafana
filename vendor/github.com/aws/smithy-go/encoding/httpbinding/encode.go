package httpbinding

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	contentLengthHeader = "Content-Length"
	floatNaN            = "NaN"
	floatInfinity       = "Infinity"
	floatNegInfinity    = "-Infinity"
)

// An Encoder provides encoding of REST URI path, query, and header components
// of an HTTP request. Can also encode a stream as the payload.
//
// Does not support SetFields.
type Encoder struct {
	path, rawPath, pathBuffer []byte

	query  url.Values
	header http.Header
}

// NewEncoder creates a new encoder from the passed in request. It assumes that
// raw path contains no valuable information at this point, so it passes in path
// as path and raw path for subsequent trans
func NewEncoder(path, query string, headers http.Header) (*Encoder, error) {
	return NewEncoderWithRawPath(path, path, query, headers)
}

// NewHTTPBindingEncoder creates a new encoder from the passed in request. All query and
// header values will be added on top of the request's existing values. Overwriting
// duplicate values.
func NewEncoderWithRawPath(path, rawPath, query string, headers http.Header) (*Encoder, error) {
	parseQuery, err := url.ParseQuery(query)
	if err != nil {
		return nil, fmt.Errorf("failed to parse query string: %w", err)
	}

	e := &Encoder{
		path:    []byte(path),
		rawPath: []byte(rawPath),
		query:   parseQuery,
		header:  headers.Clone(),
	}

	return e, nil
}

// Encode returns a REST protocol encoder for encoding HTTP bindings.
//
// Due net/http requiring `Content-Length` to be specified on the http.Request#ContentLength directly. Encode
// will look for whether the header is present, and if so will remove it and set the respective value on http.Request.
//
// Returns any error occurring during encoding.
func (e *Encoder) Encode(req *http.Request) (*http.Request, error) {
	req.URL.Path, req.URL.RawPath = string(e.path), string(e.rawPath)
	req.URL.RawQuery = e.query.Encode()

	// net/http ignores Content-Length header and requires it to be set on http.Request
	if v := e.header.Get(contentLengthHeader); len(v) > 0 {
		iv, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return nil, err
		}
		req.ContentLength = iv
		e.header.Del(contentLengthHeader)
	}

	req.Header = e.header

	return req, nil
}

// AddHeader returns a HeaderValue for appending to the given header name
func (e *Encoder) AddHeader(key string) HeaderValue {
	return newHeaderValue(e.header, key, true)
}

// SetHeader returns a HeaderValue for setting the given header name
func (e *Encoder) SetHeader(key string) HeaderValue {
	return newHeaderValue(e.header, key, false)
}

// Headers returns a Header used for encoding headers with the given prefix
func (e *Encoder) Headers(prefix string) Headers {
	return Headers{
		header: e.header,
		prefix: strings.TrimSpace(prefix),
	}
}

// HasHeader returns if a header with the key specified exists with one or
// more value.
func (e Encoder) HasHeader(key string) bool {
	return len(e.header[key]) != 0
}

// SetURI returns a URIValue used for setting the given path key
func (e *Encoder) SetURI(key string) URIValue {
	return newURIValue(&e.path, &e.rawPath, &e.pathBuffer, key)
}

// SetQuery returns a QueryValue used for setting the given query key
func (e *Encoder) SetQuery(key string) QueryValue {
	return NewQueryValue(e.query, key, false)
}

// AddQuery returns a QueryValue used for appending the given query key
func (e *Encoder) AddQuery(key string) QueryValue {
	return NewQueryValue(e.query, key, true)
}

// HasQuery returns if a query with the key specified exists with one or
// more values.
func (e *Encoder) HasQuery(key string) bool {
	return len(e.query.Get(key)) != 0
}
