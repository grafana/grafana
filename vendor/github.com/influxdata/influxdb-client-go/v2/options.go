// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package influxdb2

import (
	"crypto/tls"
	nethttp "net/http"
	"time"

	"github.com/influxdata/influxdb-client-go/v2/api/http"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
)

// Options holds configuration properties for communicating with InfluxDB server
type Options struct {
	// LogLevel to filter log messages. Each level mean to log all categories bellow. 0 error, 1 - warning, 2 - info, 3 - debug
	logLevel uint
	// Writing options
	writeOptions *write.Options
	// Http options
	httpOptions *http.Options
}

// BatchSize returns size of batch
func (o *Options) BatchSize() uint {
	return o.WriteOptions().BatchSize()
}

// SetBatchSize sets number of points sent in single request
func (o *Options) SetBatchSize(batchSize uint) *Options {
	o.WriteOptions().SetBatchSize(batchSize)
	return o
}

// FlushInterval returns flush interval in ms
func (o *Options) FlushInterval() uint {
	return o.WriteOptions().FlushInterval()
}

// SetFlushInterval sets flush interval in ms in which is buffer flushed if it has not been already written
func (o *Options) SetFlushInterval(flushIntervalMs uint) *Options {
	o.WriteOptions().SetFlushInterval(flushIntervalMs)
	return o
}

// RetryInterval returns the retry interval in ms
func (o *Options) RetryInterval() uint {
	return o.WriteOptions().RetryInterval()
}

// SetRetryInterval sets retry interval in ms, which is set if not sent by server
func (o *Options) SetRetryInterval(retryIntervalMs uint) *Options {
	o.WriteOptions().SetRetryInterval(retryIntervalMs)
	return o
}

// MaxRetries returns maximum count of retry attempts of failed writes, default 5.
func (o *Options) MaxRetries() uint {
	return o.WriteOptions().MaxRetries()
}

// SetMaxRetries sets maximum count of retry attempts of failed writes.
// Setting zero value disables retry strategy.
func (o *Options) SetMaxRetries(maxRetries uint) *Options {
	o.WriteOptions().SetMaxRetries(maxRetries)
	return o
}

// RetryBufferLimit returns retry buffer limit
func (o *Options) RetryBufferLimit() uint {
	return o.WriteOptions().RetryBufferLimit()
}

// SetRetryBufferLimit sets maximum number of points to keep for retry. Should be multiple of BatchSize.
func (o *Options) SetRetryBufferLimit(retryBufferLimit uint) *Options {
	o.WriteOptions().SetRetryBufferLimit(retryBufferLimit)
	return o
}

// MaxRetryInterval returns the maximum delay between each retry attempt in milliseconds, default 125,000.
func (o *Options) MaxRetryInterval() uint {
	return o.WriteOptions().MaxRetryInterval()
}

// SetMaxRetryInterval sets the maximum delay between each retry attempt in millisecond.
func (o *Options) SetMaxRetryInterval(maxRetryIntervalMs uint) *Options {
	o.WriteOptions().SetMaxRetryInterval(maxRetryIntervalMs)
	return o
}

// MaxRetryTime returns the maximum total retry timeout in millisecond, default 180,000.
func (o *Options) MaxRetryTime() uint {
	return o.WriteOptions().MaxRetryTime()
}

// SetMaxRetryTime sets the maximum total retry timeout in millisecond.
func (o *Options) SetMaxRetryTime(maxRetryTimeMs uint) *Options {
	o.WriteOptions().SetMaxRetryTime(maxRetryTimeMs)
	return o
}

// ExponentialBase returns the base for the exponential retry delay. Default 2.
func (o *Options) ExponentialBase() uint {
	return o.WriteOptions().ExponentialBase()
}

// SetExponentialBase sets the base for the exponential retry delay.
func (o *Options) SetExponentialBase(exponentialBase uint) *Options {
	o.WriteOptions().SetExponentialBase(exponentialBase)
	return o
}

// LogLevel returns log level
func (o *Options) LogLevel() uint {
	return o.logLevel
}

// SetLogLevel set level to filter log messages. Each level mean to log all categories bellow. Default is ErrorLevel.
// There are four level constant int the log package in this library:
//   - ErrorLevel
//   - WarningLevel
//   - InfoLevel
//   - DebugLevel
// The DebugLevel will print also content of writen batches, queries.
// The InfoLevel prints HTTP requests info, among others.
// Set log.Log to nil in order to completely disable logging.
func (o *Options) SetLogLevel(logLevel uint) *Options {
	o.logLevel = logLevel
	return o
}

// Precision returns time precision for writes
func (o *Options) Precision() time.Duration {
	return o.WriteOptions().Precision()
}

// SetPrecision sets time precision to use in writes for timestamp. In unit of duration: time.Nanosecond, time.Microsecond, time.Millisecond, time.Second
func (o *Options) SetPrecision(precision time.Duration) *Options {
	o.WriteOptions().SetPrecision(precision)
	return o
}

// UseGZip returns true if write request are gzip`ed
func (o *Options) UseGZip() bool {
	return o.WriteOptions().UseGZip()
}

// SetUseGZip specifies whether to use GZip compression in write requests.
func (o *Options) SetUseGZip(useGZip bool) *Options {
	o.WriteOptions().SetUseGZip(useGZip)
	return o
}

// HTTPClient returns the http.Client that is configured to be used
// for HTTP requests. It will return the one that has been set using
// SetHTTPClient or it will construct a default client using the
// other configured options.
func (o *Options) HTTPClient() *nethttp.Client {
	return o.httpOptions.HTTPClient()
}

// SetHTTPClient will configure the http.Client that is used
// for HTTP requests. If set to nil, an HTTPClient will be
// generated.
//
// Setting the HTTPClient will cause the other HTTP options
// to be ignored.
// In case of UsersAPI.SignIn() is used, HTTPClient.Jar will be used for storing session cookie.
func (o *Options) SetHTTPClient(c *nethttp.Client) *Options {
	o.httpOptions.SetHTTPClient(c)
	return o
}

// TLSConfig returns TLS config
func (o *Options) TLSConfig() *tls.Config {
	return o.HTTPOptions().TLSConfig()
}

// SetTLSConfig sets TLS configuration for secure connection
func (o *Options) SetTLSConfig(tlsConfig *tls.Config) *Options {
	o.HTTPOptions().SetTLSConfig(tlsConfig)
	return o
}

// HTTPRequestTimeout returns HTTP request timeout
func (o *Options) HTTPRequestTimeout() uint {
	return o.HTTPOptions().HTTPRequestTimeout()
}

// SetHTTPRequestTimeout sets HTTP request timeout in sec
func (o *Options) SetHTTPRequestTimeout(httpRequestTimeout uint) *Options {
	o.HTTPOptions().SetHTTPRequestTimeout(httpRequestTimeout)
	return o
}

// WriteOptions returns write related options
func (o *Options) WriteOptions() *write.Options {
	if o.writeOptions == nil {
		o.writeOptions = write.DefaultOptions()
	}
	return o.writeOptions
}

// HTTPOptions returns HTTP related options
func (o *Options) HTTPOptions() *http.Options {
	if o.httpOptions == nil {
		o.httpOptions = http.DefaultOptions()
	}
	return o.httpOptions
}

// AddDefaultTag adds a default tag. DefaultTags are added to each written point.
// If a tag with the same key already exist it is overwritten.
// If a point already defines such a tag, it is left unchanged
func (o *Options) AddDefaultTag(key, value string) *Options {
	o.WriteOptions().AddDefaultTag(key, value)
	return o
}

// ApplicationName returns application name used in the User-Agent HTTP header
func (o *Options) ApplicationName() string {
	return o.HTTPOptions().ApplicationName()
}

// SetApplicationName sets an application name to the User-Agent HTTP header
func (o *Options) SetApplicationName(appName string) *Options {
	o.HTTPOptions().SetApplicationName(appName)
	return o
}

// DefaultOptions returns Options object with default values
func DefaultOptions() *Options {
	return &Options{logLevel: 0, writeOptions: write.DefaultOptions(), httpOptions: http.DefaultOptions()}
}
