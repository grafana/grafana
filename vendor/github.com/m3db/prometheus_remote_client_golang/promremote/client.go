// Copyright (c) 2019 Uber Technologies, Inc.
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

package promremote

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/golang/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/prometheus/prometheus/prompb"
)

const (
	// DefaultRemoteWrite is the default Prom remote write endpoint in m3coordinator.
	DefaultRemoteWrite = "http://localhost:7201/api/v1/prom/remote/write"

	defaulHTTPClientTimeout = 30 * time.Second
	defaultUserAgent        = "promremote-go/1.0.0"
)

// DefaultConfig represents the default configuration used to construct a client.
var DefaultConfig = Config{
	WriteURL:          DefaultRemoteWrite,
	HTTPClientTimeout: defaulHTTPClientTimeout,
	UserAgent:         defaultUserAgent,
}

// Label is a metric label.
type Label struct {
	Name  string
	Value string
}

// TimeSeries are made of labels and a datapoint.
type TimeSeries struct {
	Labels    []Label
	Datapoint Datapoint
}

// TSList is a slice of TimeSeries.
type TSList []TimeSeries

// A Datapoint is a single data value reported at a given time.
type Datapoint struct {
	Timestamp time.Time
	Value     float64
}

// Client is used to write timeseries data to a Prom remote write endpoint
// such as the one in m3coordinator.
type Client interface {
	// WriteProto writes the Prom proto WriteRequest to the specified endpoint.
	WriteProto(
		ctx context.Context,
		req *prompb.WriteRequest,
		opts WriteOptions,
	) (WriteResult, WriteError)

	// WriteTimeSeries converts the []TimeSeries to Protobuf then writes it to the specified endpoint.
	WriteTimeSeries(
		ctx context.Context,
		ts TSList,
		opts WriteOptions,
	) (WriteResult, WriteError)
}

// WriteOptions specifies additional write options.
type WriteOptions struct {
	// Headers to append or override the outgoing headers.
	Headers map[string]string
}

// WriteResult returns the successful HTTP status code.
type WriteResult struct {
	StatusCode int
}

// WriteError is an error that can also return the HTTP status code
// if the response is what caused an error.
type WriteError interface {
	error
	StatusCode() int
}

// Config defines the configuration used to construct a client.
type Config struct {
	// WriteURL is the URL which the client uses to write to m3coordinator.
	WriteURL string `yaml:"writeURL"`

	//HTTPClientTimeout is the timeout that is set for the client.
	HTTPClientTimeout time.Duration `yaml:"httpClientTimeout"`

	// If not nil, http client is used instead of constructing one.
	HTTPClient *http.Client

	// UserAgent is the `User-Agent` header in the request.
	UserAgent string `yaml:"userAgent"`
}

// ConfigOption defines a config option that can be used when constructing a client.
type ConfigOption func(*Config)

// NewConfig creates a new Config struct based on options passed to the function.
func NewConfig(opts ...ConfigOption) Config {
	cfg := DefaultConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	return cfg
}

func (c Config) validate() error {
	if c.HTTPClientTimeout <= 0 {
		return fmt.Errorf("http client timeout should be greater than 0: %d", c.HTTPClientTimeout)
	}

	if c.WriteURL == "" {
		return errors.New("remote write URL should not be blank")
	}

	if c.UserAgent == "" {
		return errors.New("User-Agent should not be blank")
	}

	return nil
}

// WriteURLOption sets the URL which the client uses to write to m3coordinator.
func WriteURLOption(writeURL string) ConfigOption {
	return func(c *Config) {
		c.WriteURL = writeURL
	}
}

// HTTPClientTimeoutOption sets the timeout that is set for the client.
func HTTPClientTimeoutOption(httpClientTimeout time.Duration) ConfigOption {
	return func(c *Config) {
		c.HTTPClientTimeout = httpClientTimeout
	}
}

// HTTPClientOption sets the HTTP client that is set for the client.
func HTTPClientOption(httpClient *http.Client) ConfigOption {
	return func(c *Config) {
		c.HTTPClient = httpClient
	}
}

// UserAgent sets the `User-Agent` header in the request.
func UserAgent(userAgent string) ConfigOption {
	return func(c *Config) {
		c.UserAgent = userAgent
	}
}

type client struct {
	writeURL   string
	httpClient *http.Client
	userAgent  string
}

// NewClient creates a new remote write coordinator client.
func NewClient(c Config) (Client, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	httpClient := &http.Client{
		Timeout: c.HTTPClientTimeout,
	}

	if c.HTTPClient != nil {
		httpClient = c.HTTPClient
	}

	return &client{
		writeURL:   c.WriteURL,
		httpClient: httpClient,
	}, nil
}

func (c *client) WriteTimeSeries(
	ctx context.Context,
	seriesList TSList,
	opts WriteOptions,
) (WriteResult, WriteError) {
	return c.WriteProto(ctx, seriesList.toPromWriteRequest(), opts)
}

func (c *client) WriteProto(
	ctx context.Context,
	promWR *prompb.WriteRequest,
	opts WriteOptions,
) (WriteResult, WriteError) {
	var result WriteResult
	data, err := proto.Marshal(promWR)
	if err != nil {
		return result, writeError{err: fmt.Errorf("unable to marshal protobuf: %v", err)}
	}

	encoded := snappy.Encode(nil, data)

	body := bytes.NewReader(encoded)
	req, err := http.NewRequest("POST", c.writeURL, body)
	if err != nil {
		return result, writeError{err: err}
	}

	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "snappy")
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
	if opts.Headers != nil {
		for k, v := range opts.Headers {
			req.Header.Set(k, v)
		}
	}

	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return result, writeError{err: err}
	}

	result.StatusCode = resp.StatusCode

	defer resp.Body.Close()

	if result.StatusCode/100 != 2 {
		writeErr := writeError{
			err:  fmt.Errorf("expected HTTP 200 status code: actual=%d", resp.StatusCode),
			code: result.StatusCode,
		}

		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			writeErr.err = fmt.Errorf("%v, body_read_error=%s", writeErr.err, err)
			return result, writeErr
		}

		writeErr.err = fmt.Errorf("%v, body=%s", writeErr.err, body)
		return result, writeErr
	}

	return result, nil
}

// toPromWriteRequest converts a list of timeseries to a Prometheus proto write request.
func (t TSList) toPromWriteRequest() *prompb.WriteRequest {
	promTS := make([]prompb.TimeSeries, len(t))

	for i, ts := range t {
		labels := make([]prompb.Label, len(ts.Labels))
		for j, label := range ts.Labels {
			labels[j] = prompb.Label{Name: label.Name, Value: label.Value}
		}

		sample := []prompb.Sample{prompb.Sample{
			// Timestamp is int milliseconds for remote write.
			Timestamp: ts.Datapoint.Timestamp.UnixNano() / int64(time.Millisecond),
			Value:     ts.Datapoint.Value,
		}}
		promTS[i] = prompb.TimeSeries{Labels: labels, Samples: sample}
	}

	return &prompb.WriteRequest{
		Timeseries: promTS,
	}
}

type writeError struct {
	err  error
	code int
}

func (e writeError) Error() string {
	return e.err.Error()
}

// StatusCode returns the HTTP status code of the error if error
// was caused by the response, otherwise it will be just zero.
func (e writeError) StatusCode() int {
	return e.code
}
