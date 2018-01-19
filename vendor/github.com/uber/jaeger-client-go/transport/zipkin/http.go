// Copyright (c) 2017 The OpenTracing Authors
// Copyright (c) 2016 Bas van Beek
// Copyright (c) 2016 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package zipkin

// This code is adapted from 'collector-http.go' from
// https://github.com/openzipkin/zipkin-go-opentracing/

import (
	"bytes"
	"net/http"
	"time"

	"github.com/apache/thrift/lib/go/thrift"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/thrift-gen/zipkincore"
)

// Default timeout for http request in seconds
const defaultHTTPTimeout = time.Second * 5

// HTTPTransport implements Transport by forwarding spans to a http server.
type HTTPTransport struct {
	logger          jaeger.Logger
	url             string
	client          *http.Client
	batchSize       int
	batch           []*zipkincore.Span
	httpCredentials *HTTPBasicAuthCredentials
}

// HTTPBasicAuthCredentials stores credentials for HTTP basic auth.
type HTTPBasicAuthCredentials struct {
	username string
	password string
}

// HTTPOption sets a parameter for the HttpCollector
type HTTPOption func(c *HTTPTransport)

// HTTPLogger sets the logger used to report errors in the collection
// process. By default, a no-op logger is used, i.e. no errors are logged
// anywhere. It's important to set this option in a production service.
func HTTPLogger(logger jaeger.Logger) HTTPOption {
	return func(c *HTTPTransport) { c.logger = logger }
}

// HTTPTimeout sets maximum timeout for http request.
func HTTPTimeout(duration time.Duration) HTTPOption {
	return func(c *HTTPTransport) { c.client.Timeout = duration }
}

// HTTPBatchSize sets the maximum batch size, after which a collect will be
// triggered. The default batch size is 100 spans.
func HTTPBatchSize(n int) HTTPOption {
	return func(c *HTTPTransport) { c.batchSize = n }
}

// HTTPBasicAuth sets the credentials required to perform HTTP basic auth
func HTTPBasicAuth(username string, password string) HTTPOption {
	return func(c *HTTPTransport) {
		c.httpCredentials = &HTTPBasicAuthCredentials{username: username, password: password}
	}
}

// NewHTTPTransport returns a new HTTP-backend transport. url should be an http
// url to handle post request, typically something like:
//     http://hostname:9411/api/v1/spans
func NewHTTPTransport(url string, options ...HTTPOption) (*HTTPTransport, error) {
	c := &HTTPTransport{
		logger:    log.NullLogger,
		url:       url,
		client:    &http.Client{Timeout: defaultHTTPTimeout},
		batchSize: 100,
		batch:     []*zipkincore.Span{},
	}

	for _, option := range options {
		option(c)
	}
	return c, nil
}

// Append implements Transport.
func (c *HTTPTransport) Append(span *jaeger.Span) (int, error) {
	zSpan := jaeger.BuildZipkinThrift(span)
	c.batch = append(c.batch, zSpan)
	if len(c.batch) >= c.batchSize {
		return c.Flush()
	}
	return 0, nil
}

// Flush implements Transport.
func (c *HTTPTransport) Flush() (int, error) {
	count := len(c.batch)
	if count == 0 {
		return 0, nil
	}
	err := c.send(c.batch)
	c.batch = c.batch[:0]
	return count, err
}

// Close implements Transport.
func (c *HTTPTransport) Close() error {
	return nil
}

func httpSerialize(spans []*zipkincore.Span) (*bytes.Buffer, error) {
	t := thrift.NewTMemoryBuffer()
	p := thrift.NewTBinaryProtocolTransport(t)
	if err := p.WriteListBegin(thrift.STRUCT, len(spans)); err != nil {
		return nil, err
	}
	for _, s := range spans {
		if err := s.Write(p); err != nil {
			return nil, err
		}
	}
	if err := p.WriteListEnd(); err != nil {
		return nil, err
	}
	return t.Buffer, nil
}

func (c *HTTPTransport) send(spans []*zipkincore.Span) error {
	body, err := httpSerialize(spans)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", c.url, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-thrift")

	if c.httpCredentials != nil {
		req.SetBasicAuth(c.httpCredentials.username, c.httpCredentials.password)
	}

	_, err = c.client.Do(req)

	return err
}
