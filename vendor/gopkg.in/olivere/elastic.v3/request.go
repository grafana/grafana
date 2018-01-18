// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"runtime"
	"strings"
)

// Elasticsearch-specific HTTP request
type Request http.Request

// NewRequest is a http.Request and adds features such as encoding the body.
func NewRequest(method, url string) (*Request, error) {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("User-Agent", "elastic/"+Version+" ("+runtime.GOOS+"-"+runtime.GOARCH+")")
	req.Header.Add("Accept", "application/json")
	return (*Request)(req), nil
}

// SetBasicAuth wraps http.Request's SetBasicAuth.
func (r *Request) SetBasicAuth(username, password string) {
	((*http.Request)(r)).SetBasicAuth(username, password)
}

// SetBody encodes the body in the request. Optionally, it performs GZIP compression.
func (r *Request) SetBody(body interface{}, gzipCompress bool) error {
	switch b := body.(type) {
	case string:
		if gzipCompress {
			return r.setBodyGzip(b)
		}
		return r.setBodyString(b)
	default:
		if gzipCompress {
			return r.setBodyGzip(body)
		}
		return r.setBodyJson(body)
	}
}

// setBodyJson encodes the body as a struct to be marshaled via json.Marshal.
func (r *Request) setBodyJson(data interface{}) error {
	body, err := json.Marshal(data)
	if err != nil {
		return err
	}
	r.Header.Set("Content-Type", "application/json")
	r.setBodyReader(bytes.NewReader(body))
	return nil
}

// setBodyString encodes the body as a string.
func (r *Request) setBodyString(body string) error {
	return r.setBodyReader(strings.NewReader(body))
}

// setBodyGzip gzip's the body. It accepts both strings and structs as body.
// The latter will be encoded via json.Marshal.
func (r *Request) setBodyGzip(body interface{}) error {
	switch b := body.(type) {
	case string:
		buf := new(bytes.Buffer)
		w := gzip.NewWriter(buf)
		if _, err := w.Write([]byte(b)); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
		r.Header.Add("Content-Encoding", "gzip")
		r.Header.Add("Vary", "Accept-Encoding")
		return r.setBodyReader(bytes.NewReader(buf.Bytes()))
	default:
		data, err := json.Marshal(b)
		if err != nil {
			return err
		}
		buf := new(bytes.Buffer)
		w := gzip.NewWriter(buf)
		if _, err := w.Write(data); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
		r.Header.Add("Content-Encoding", "gzip")
		r.Header.Add("Vary", "Accept-Encoding")
		r.Header.Set("Content-Type", "application/json")
		return r.setBodyReader(bytes.NewReader(buf.Bytes()))
	}
}

// setBodyReader writes the body from an io.Reader.
func (r *Request) setBodyReader(body io.Reader) error {
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}
	r.Body = rc
	if body != nil {
		switch v := body.(type) {
		case *strings.Reader:
			r.ContentLength = int64(v.Len())
		case *bytes.Buffer:
			r.ContentLength = int64(v.Len())
		}
	}
	return nil
}
