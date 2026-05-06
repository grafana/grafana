// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package write

import (
	"time"
)

// Options holds write configuration properties
type Options struct {
	// Maximum number of points sent to server in single request. Default 5000
	batchSize uint
	// Interval, in ms, in which is buffer flushed if it has not been already written (by reaching batch size) . Default 1000ms
	flushInterval uint
	// Precision to use in writes for timestamp. In unit of duration: time.Nanosecond, time.Microsecond, time.Millisecond, time.Second
	// Default time.Nanosecond
	precision time.Duration
	// Whether to use GZip compression in requests. Default false
	useGZip bool
	// Tags added to each point during writing. If a point already has a tag with the same key, it is left unchanged.
	defaultTags map[string]string
	// Default retry interval in ms, if not sent by server. Default 5,000.
	retryInterval uint
	// Maximum count of retry attempts of failed writes, default 5.
	maxRetries uint
	// Maximum number of points to keep for retry. Should be multiple of BatchSize. Default 50,000.
	retryBufferLimit uint
	// The maximum delay between each retry attempt in milliseconds, default 125,000.
	maxRetryInterval uint
	// The maximum total retry timeout in millisecond, default 180,000.
	maxRetryTime uint
	// The base for the exponential retry delay
	exponentialBase uint
	// InfluxDB Enterprise write consistency as explained in https://docs.influxdata.com/enterprise_influxdb/v1.9/concepts/clustering/#write-consistency
	consistency Consistency
}

const (
	// ConsistencyOne requires at least one data node acknowledged a write.
	ConsistencyOne Consistency = "one"

	// ConsistencyAll requires all data nodes to acknowledge a write.
	ConsistencyAll Consistency = "all"

	// ConsistencyQuorum requires a quorum of data nodes to acknowledge a write.
	ConsistencyQuorum Consistency = "quorum"

	// ConsistencyAny allows for hinted hand off, potentially no write happened yet.
	ConsistencyAny Consistency = "any"
)

// Consistency defines enum for allows consistency values for InfluxDB Enterprise, as explained  https://docs.influxdata.com/enterprise_influxdb/v1.9/concepts/clustering/#write-consistency
type Consistency string

// BatchSize returns size of batch
func (o *Options) BatchSize() uint {
	return o.batchSize
}

// SetBatchSize sets number of points sent in single request
func (o *Options) SetBatchSize(batchSize uint) *Options {
	o.batchSize = batchSize
	return o
}

// FlushInterval returns flush interval in ms
func (o *Options) FlushInterval() uint {
	return o.flushInterval
}

// SetFlushInterval sets flush interval in ms in which is buffer flushed if it has not been already written
func (o *Options) SetFlushInterval(flushIntervalMs uint) *Options {
	o.flushInterval = flushIntervalMs
	return o
}

// RetryInterval returns the default retry interval in ms, if not sent by server. Default 5,000.
func (o *Options) RetryInterval() uint {
	return o.retryInterval
}

// SetRetryInterval sets the time to wait before retry unsuccessful write in ms, if not sent by server
func (o *Options) SetRetryInterval(retryIntervalMs uint) *Options {
	o.retryInterval = retryIntervalMs
	return o
}

// MaxRetries returns maximum count of retry attempts of failed writes, default 5.
func (o *Options) MaxRetries() uint {
	return o.maxRetries
}

// SetMaxRetries sets maximum count of retry attempts of failed writes.
// Setting zero value disables retry strategy.
func (o *Options) SetMaxRetries(maxRetries uint) *Options {
	o.maxRetries = maxRetries
	return o
}

// RetryBufferLimit returns retry buffer limit.
func (o *Options) RetryBufferLimit() uint {
	return o.retryBufferLimit
}

// SetRetryBufferLimit sets maximum number of points to keep for retry. Should be multiple of BatchSize.
func (o *Options) SetRetryBufferLimit(retryBufferLimit uint) *Options {
	o.retryBufferLimit = retryBufferLimit
	return o
}

// MaxRetryInterval returns the maximum delay between each retry attempt in milliseconds, default 125,000.
func (o *Options) MaxRetryInterval() uint {
	return o.maxRetryInterval
}

// SetMaxRetryInterval sets the maximum delay between each retry attempt in millisecond
func (o *Options) SetMaxRetryInterval(maxRetryIntervalMs uint) *Options {
	o.maxRetryInterval = maxRetryIntervalMs
	return o
}

// MaxRetryTime returns the maximum total retry timeout in millisecond, default 180,000.
func (o *Options) MaxRetryTime() uint {
	return o.maxRetryTime
}

// SetMaxRetryTime sets the maximum total retry timeout in millisecond.
func (o *Options) SetMaxRetryTime(maxRetryTimeMs uint) *Options {
	o.maxRetryTime = maxRetryTimeMs
	return o
}

// ExponentialBase returns the base for the exponential retry delay. Default 2.
func (o *Options) ExponentialBase() uint {
	return o.exponentialBase
}

// SetExponentialBase sets the base for the exponential retry delay.
func (o *Options) SetExponentialBase(retryExponentialBase uint) *Options {
	o.exponentialBase = retryExponentialBase
	return o
}

// Precision returns time precision for writes
func (o *Options) Precision() time.Duration {
	return o.precision
}

// SetPrecision sets time precision to use in writes for timestamp. In unit of duration: time.Nanosecond, time.Microsecond, time.Millisecond, time.Second
func (o *Options) SetPrecision(precision time.Duration) *Options {
	o.precision = precision
	return o
}

// UseGZip returns true if write request are gzip`ed
func (o *Options) UseGZip() bool {
	return o.useGZip
}

// SetUseGZip specifies whether to use GZip compression in write requests.
func (o *Options) SetUseGZip(useGZip bool) *Options {
	o.useGZip = useGZip
	return o
}

// AddDefaultTag adds a default tag. DefaultTags are added to each written point.
// If a tag with the same key already exist it is overwritten.
// If a point already defines such a tag, it is left unchanged.
func (o *Options) AddDefaultTag(key, value string) *Options {
	o.DefaultTags()[key] = value
	return o
}

// DefaultTags returns set of default tags
func (o *Options) DefaultTags() map[string]string {
	if o.defaultTags == nil {
		o.defaultTags = make(map[string]string)
	}
	return o.defaultTags
}

// Consistency returns consistency for param value
func (o *Options) Consistency() Consistency {
	return o.consistency
}

// SetConsistency allows setting InfluxDB Enterprise write consistency, as explained in https://docs.influxdata.com/enterprise_influxdb/v1.9/concepts/clustering/#write-consistency */
func (o *Options) SetConsistency(consistency Consistency) *Options {
	o.consistency = consistency
	return o
}

// DefaultOptions returns Options object with default values
func DefaultOptions() *Options {
	return &Options{batchSize: 5_000, flushInterval: 1_000, precision: time.Nanosecond, useGZip: false, retryBufferLimit: 50_000, defaultTags: make(map[string]string),
		maxRetries: 5, retryInterval: 5_000, maxRetryInterval: 125_000, maxRetryTime: 180_000, exponentialBase: 2}
}
