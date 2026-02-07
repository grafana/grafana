// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlploghttp // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"google.golang.org/protobuf/proto"

	"go.opentelemetry.io/otel"
	collogpb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	logpb "go.opentelemetry.io/proto/otlp/logs/v1"

	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp/internal/retry"
)

type client struct {
	uploadLogs func(context.Context, []*logpb.ResourceLogs) error
}

func (c *client) UploadLogs(ctx context.Context, rl []*logpb.ResourceLogs) error {
	if c.uploadLogs != nil {
		return c.uploadLogs(ctx, rl)
	}
	return nil
}

func newNoopClient() *client {
	return &client{}
}

// newHTTPClient creates a new HTTP log client.
func newHTTPClient(cfg config) (*client, error) {
	hc := cfg.httpClient
	if hc == nil {
		hc = &http.Client{
			Transport: ourTransport,
			Timeout:   cfg.timeout.Value,
		}

		if cfg.tlsCfg.Value != nil || cfg.proxy.Value != nil {
			clonedTransport := ourTransport.Clone()
			hc.Transport = clonedTransport

			if cfg.tlsCfg.Value != nil {
				clonedTransport.TLSClientConfig = cfg.tlsCfg.Value
			}
			if cfg.proxy.Value != nil {
				clonedTransport.Proxy = cfg.proxy.Value
			}
		}
	}

	u := &url.URL{
		Scheme: "https",
		Host:   cfg.endpoint.Value,
		Path:   cfg.path.Value,
	}
	if cfg.insecure.Value {
		u.Scheme = "http"
	}
	// Body is set when this is cloned during upload.
	req, err := http.NewRequest(http.MethodPost, u.String(), http.NoBody)
	if err != nil {
		return nil, err
	}

	userAgent := "OTel Go OTLP over HTTP/protobuf logs exporter/" + Version()
	req.Header.Set("User-Agent", userAgent)

	if n := len(cfg.headers.Value); n > 0 {
		for k, v := range cfg.headers.Value {
			req.Header.Set(k, v)
		}
	}
	req.Header.Set("Content-Type", "application/x-protobuf")

	c := &httpClient{
		compression: cfg.compression.Value,
		req:         req,
		requestFunc: cfg.retryCfg.Value.RequestFunc(evaluate),
		client:      hc,
	}
	return &client{uploadLogs: c.uploadLogs}, nil
}

type httpClient struct {
	// req is cloned for every upload the client makes.
	req         *http.Request
	compression Compression
	requestFunc retry.RequestFunc
	client      *http.Client
}

// Keep it in sync with golang's DefaultTransport from net/http! We
// have our own copy to avoid handling a situation where the
// DefaultTransport is overwritten with some different implementation
// of http.RoundTripper or it's modified by another package.
var ourTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	ForceAttemptHTTP2:     true,
	MaxIdleConns:          100,
	IdleConnTimeout:       90 * time.Second,
	TLSHandshakeTimeout:   10 * time.Second,
	ExpectContinueTimeout: 1 * time.Second,
}

func (c *httpClient) uploadLogs(ctx context.Context, data []*logpb.ResourceLogs) error {
	// The Exporter synchronizes access to client methods. This is not called
	// after the Exporter is shutdown. Only thing to do here is send data.

	pbRequest := &collogpb.ExportLogsServiceRequest{ResourceLogs: data}
	body, err := proto.Marshal(pbRequest)
	if err != nil {
		return err
	}
	request, err := c.newRequest(ctx, body)
	if err != nil {
		return err
	}

	return c.requestFunc(ctx, func(iCtx context.Context) error {
		select {
		case <-iCtx.Done():
			return iCtx.Err()
		default:
		}

		request.reset(iCtx)
		resp, err := c.client.Do(request.Request)
		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Temporary() {
			return newResponseError(http.Header{}, err)
		}
		if err != nil {
			return err
		}
		if resp != nil && resp.Body != nil {
			defer func() {
				if err := resp.Body.Close(); err != nil {
					otel.Handle(err)
				}
			}()
		}

		if sc := resp.StatusCode; sc >= 200 && sc <= 299 {
			// Success, do not retry.

			// Read the partial success message, if any.
			var respData bytes.Buffer
			if _, err := io.Copy(&respData, resp.Body); err != nil {
				return err
			}
			if respData.Len() == 0 {
				return nil
			}

			if resp.Header.Get("Content-Type") == "application/x-protobuf" {
				var respProto collogpb.ExportLogsServiceResponse
				if err := proto.Unmarshal(respData.Bytes(), &respProto); err != nil {
					return err
				}

				if respProto.PartialSuccess != nil {
					msg := respProto.PartialSuccess.GetErrorMessage()
					n := respProto.PartialSuccess.GetRejectedLogRecords()
					if n != 0 || msg != "" {
						err := fmt.Errorf("OTLP partial success: %s (%d log records rejected)", msg, n)
						otel.Handle(err)
					}
				}
			}
			return nil
		}
		// Error cases.

		// server may return a message with the response
		// body, so we read it to include in the error
		// message to be returned. It will help in
		// debugging the actual issue.
		var respData bytes.Buffer
		if _, err := io.Copy(&respData, resp.Body); err != nil {
			return err
		}
		respStr := strings.TrimSpace(respData.String())
		if len(respStr) == 0 {
			respStr = "(empty)"
		}
		bodyErr := fmt.Errorf("body: %s", respStr)

		switch resp.StatusCode {
		case http.StatusTooManyRequests,
			http.StatusBadGateway,
			http.StatusServiceUnavailable,
			http.StatusGatewayTimeout:
			// Retryable failure.
			return newResponseError(resp.Header, bodyErr)
		default:
			// Non-retryable failure.
			return fmt.Errorf("failed to send logs to %s: %s (%w)", request.URL, resp.Status, bodyErr)
		}
	})
}

var gzPool = sync.Pool{
	New: func() interface{} {
		w := gzip.NewWriter(io.Discard)
		return w
	},
}

func (c *httpClient) newRequest(ctx context.Context, body []byte) (request, error) {
	r := c.req.Clone(ctx)
	req := request{Request: r}

	switch c.compression {
	case NoCompression:
		r.ContentLength = (int64)(len(body))
		req.bodyReader = bodyReader(body)
	case GzipCompression:
		// Ensure the content length is not used.
		r.ContentLength = -1
		r.Header.Set("Content-Encoding", "gzip")

		gz := gzPool.Get().(*gzip.Writer)
		defer gzPool.Put(gz)

		var b bytes.Buffer
		gz.Reset(&b)

		if _, err := gz.Write(body); err != nil {
			return req, err
		}
		// Close needs to be called to ensure body is fully written.
		if err := gz.Close(); err != nil {
			return req, err
		}

		req.bodyReader = bodyReader(b.Bytes())
	}

	return req, nil
}

// bodyReader returns a closure returning a new reader for buf.
func bodyReader(buf []byte) func() io.ReadCloser {
	return func() io.ReadCloser {
		return io.NopCloser(bytes.NewReader(buf))
	}
}

// request wraps an http.Request with a resettable body reader.
type request struct {
	*http.Request

	// bodyReader allows the same body to be used for multiple requests.
	bodyReader func() io.ReadCloser
}

// reset reinitializes the request Body and uses ctx for the request.
func (r *request) reset(ctx context.Context) {
	r.Body = r.bodyReader()
	r.Request = r.WithContext(ctx)
}

// retryableError represents a request failure that can be retried.
type retryableError struct {
	throttle int64
	err      error
}

// newResponseError returns a retryableError and will extract any explicit
// throttle delay contained in headers. The returned error wraps wrapped
// if it is not nil.
func newResponseError(header http.Header, wrapped error) error {
	var rErr retryableError
	if v := header.Get("Retry-After"); v != "" {
		if t, err := strconv.ParseInt(v, 10, 64); err == nil {
			rErr.throttle = t
		}
	}

	rErr.err = wrapped
	return rErr
}

func (e retryableError) Error() string {
	if e.err != nil {
		return fmt.Sprintf("retry-able request failure: %v", e.err.Error())
	}

	return "retry-able request failure"
}

func (e retryableError) Unwrap() error {
	return e.err
}

func (e retryableError) As(target interface{}) bool {
	if e.err == nil {
		return false
	}

	switch v := target.(type) {
	case **retryableError:
		*v = &e
		return true
	default:
		return false
	}
}

// evaluate returns if err is retry-able. If it is and it includes an explicit
// throttling delay, that delay is also returned.
func evaluate(err error) (bool, time.Duration) {
	if err == nil {
		return false, 0
	}

	// Do not use errors.As here, this should only be flattened one layer. If
	// there are several chained errors, all the errors above it will be
	// discarded if errors.As is used instead.
	rErr, ok := err.(retryableError) //nolint:errorlint
	if !ok {
		return false, 0
	}

	return true, time.Duration(rErr.throttle)
}
