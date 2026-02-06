// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package write provides service and its stuff
package write

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	http2 "github.com/influxdata/influxdb-client-go/v2/api/http"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
	"github.com/influxdata/influxdb-client-go/v2/internal/gzip"
	"github.com/influxdata/influxdb-client-go/v2/internal/log"
	ilog "github.com/influxdata/influxdb-client-go/v2/log"
	lp "github.com/influxdata/line-protocol"
)

// Batch holds information for sending points batch
type Batch struct {
	// lines to send
	Batch string
	// retry attempts so far
	RetryAttempts uint
	// true if it was removed from queue
	Evicted bool
	// time when this batch expires
	Expires time.Time
}

// NewBatch creates new batch
func NewBatch(data string, expireDelayMs uint) *Batch {
	return &Batch{
		Batch:   data,
		Expires: time.Now().Add(time.Duration(expireDelayMs) * time.Millisecond),
	}
}

// BatchErrorCallback is synchronously notified in case non-blocking write fails.
// It returns  true if WriteAPI should continue with retrying, false will discard the batch.
type BatchErrorCallback func(batch *Batch, error2 http2.Error) bool

// Service is responsible for reliable writing of batches
type Service struct {
	org                  string
	bucket               string
	httpService          http2.Service
	url                  string
	lastWriteAttempt     time.Time
	retryQueue           *queue
	lock                 sync.Mutex
	writeOptions         *write.Options
	retryExponentialBase uint
	errorCb              BatchErrorCallback
	retryDelay           uint
	retryAttempts        uint
}

// NewService creates new write service
func NewService(org string, bucket string, httpService http2.Service, options *write.Options) *Service {

	retryBufferLimit := options.RetryBufferLimit() / options.BatchSize()
	if retryBufferLimit == 0 {
		retryBufferLimit = 1
	}
	u, _ := url.Parse(httpService.ServerAPIURL())
	u, _ = u.Parse("write")
	params := u.Query()
	params.Set("org", org)
	params.Set("bucket", bucket)
	params.Set("precision", precisionToString(options.Precision()))
	if options.Consistency() != "" {
		params.Set("consistency", string(options.Consistency()))
	}
	u.RawQuery = params.Encode()
	writeURL := u.String()
	return &Service{
		org:                  org,
		bucket:               bucket,
		httpService:          httpService,
		url:                  writeURL,
		writeOptions:         options,
		retryQueue:           newQueue(int(retryBufferLimit)),
		retryExponentialBase: 2,
		retryDelay:           options.RetryInterval(),
		retryAttempts:        0,
	}
}

// SetBatchErrorCallback sets callback allowing custom handling of failed writes.
// If callback returns true, failed batch will be retried, otherwise discarded.
func (w *Service) SetBatchErrorCallback(cb BatchErrorCallback) {
	w.errorCb = cb
}

// HandleWrite handles writes of batches and handles retrying.
// Retrying is triggered by new writes, there is no scheduler.
// It first checks retry queue, because it has the highest priority.
// If there are some batches in retry queue, those are written and incoming batch is added to end of retry queue.
// Immediate write is allowed only in case there was success or not retryable error.
// Otherwise, delay is checked based on recent batch.
// If write of batch fails with retryable error (connection errors and HTTP code >= 429),
// Batch retry time is calculated based on #of attempts.
// If writes continues failing and # of attempts reaches maximum or total retry time reaches maxRetryTime,
// batch is discarded.
func (w *Service) HandleWrite(ctx context.Context, batch *Batch) error {
	log.Debug("Write proc: received write request")
	batchToWrite := batch
	retrying := false
	for {
		select {
		case <-ctx.Done():
			log.Debug("Write proc: ctx cancelled req")
			return ctx.Err()
		default:
		}
		if !w.retryQueue.isEmpty() {
			log.Debug("Write proc: taking batch from retry queue")
			if !retrying {
				b := w.retryQueue.first()

				// Discard batches at beginning of retryQueue that have already expired
				if time.Now().After(b.Expires) {
					log.Error("Write proc: oldest batch in retry queue expired, discarding")
					if !b.Evicted {
						w.retryQueue.pop()
					}

					continue
				}

				// Can we write? In case of retryable error we must wait a bit
				if w.lastWriteAttempt.IsZero() || time.Now().After(w.lastWriteAttempt.Add(time.Millisecond*time.Duration(w.retryDelay))) {
					retrying = true
				} else {
					log.Warn("Write proc: cannot write yet, storing batch to queue")
					if w.retryQueue.push(batch) {
						log.Error("Write proc: Retry buffer full, discarding oldest batch")
					}
					batchToWrite = nil
				}
			}
			if retrying {
				batchToWrite = w.retryQueue.first()
				if batch != nil { //store actual batch to retry queue
					if w.retryQueue.push(batch) {
						log.Error("Write proc: Retry buffer full, discarding oldest batch")
					}
					batch = nil
				}
			}
		}
		// write batch
		if batchToWrite != nil {
			perror := w.WriteBatch(ctx, batchToWrite)
			if perror != nil {
				if isIgnorableError(perror) {
					log.Warnf("Write error: %s", perror.Error())
				} else {
					if w.writeOptions.MaxRetries() != 0 && (perror.StatusCode == 0 || perror.StatusCode >= http.StatusTooManyRequests) {
						log.Errorf("Write error: %s, batch kept for retrying\n", perror.Error())
						if perror.RetryAfter > 0 {
							w.retryDelay = perror.RetryAfter * 1000
						} else {
							w.retryDelay = w.computeRetryDelay(w.retryAttempts)
						}
						if w.errorCb != nil && !w.errorCb(batchToWrite, *perror) {
							log.Error("Callback rejected batch, discarding")
							if !batchToWrite.Evicted {
								w.retryQueue.pop()
							}
							return perror
						}
						// store new batch (not taken from queue)
						if !batchToWrite.Evicted && batchToWrite != w.retryQueue.first() {
							if w.retryQueue.push(batch) {
								log.Error("Retry buffer full, discarding oldest batch")
							}
						} else if batchToWrite.RetryAttempts == w.writeOptions.MaxRetries() {
							log.Error("Reached maximum number of retries, discarding batch")
							if !batchToWrite.Evicted {
								w.retryQueue.pop()
							}
						}
						batchToWrite.RetryAttempts++
						w.retryAttempts++
						log.Debugf("Write proc: next wait for write is %dms\n", w.retryDelay)
					} else {
						log.Errorf("Write error: %s\n", perror.Error())
					}
					return fmt.Errorf("write failed (attempts %d): %w", batchToWrite.RetryAttempts, perror)
				}
			}

			w.retryDelay = w.writeOptions.RetryInterval()
			w.retryAttempts = 0
			if retrying && !batchToWrite.Evicted {
				w.retryQueue.pop()
			}
			batchToWrite = nil
		} else {
			break
		}
	}
	return nil
}

// Non-retryable errors
const (
	errStringHintedHandoffNotEmpty = "hinted handoff queue not empty"
	errStringPartialWrite          = "partial write"
	errStringPointsBeyondRP        = "points beyond retention policy"
	errStringUnableToParse         = "unable to parse"
)

func isIgnorableError(error *http2.Error) bool {
	// This "error" is an informational message about the state of the
	// InfluxDB cluster.
	if strings.Contains(error.Message, errStringHintedHandoffNotEmpty) {
		return true
	}
	// Points beyond retention policy is returned when points are immediately
	// discarded for being older than the retention policy.  Usually this not
	// a cause for concern, and we don't want to retry.
	if strings.Contains(error.Message, errStringPointsBeyondRP) {
		return true
	}
	// Other partial write errors, such as "field type conflict", are not
	// correctable at this point and so the point is dropped instead of
	// retrying.
	if strings.Contains(error.Message, errStringPartialWrite) {
		return true
	}
	// This error indicates an error in line protocol
	// serialization, retries would not be successful.
	if strings.Contains(error.Message, errStringUnableToParse) {
		return true
	}
	return false
}

// computeRetryDelay calculates retry delay.
// Retry delay is calculated as random value within the interval
// [retry_interval * exponential_base^(attempts) and retry_interval * exponential_base^(attempts+1)]
func (w *Service) computeRetryDelay(attempts uint) uint {
	minDelay := int(w.writeOptions.RetryInterval() * pow(w.writeOptions.ExponentialBase(), attempts))
	maxDelay := int(w.writeOptions.RetryInterval() * pow(w.writeOptions.ExponentialBase(), attempts+1))
	diff := maxDelay - minDelay
	if diff <= 0 { //check overflows
		return w.writeOptions.MaxRetryInterval()
	}
	retryDelay := uint(rand.Intn(diff) + minDelay)
	if retryDelay > w.writeOptions.MaxRetryInterval() {
		retryDelay = w.writeOptions.MaxRetryInterval()
	}
	return retryDelay
}

// pow computes x**y
func pow(x, y uint) uint {
	p := uint(1)
	if y == 0 {
		return 1
	}
	for i := uint(1); i <= y; i++ {
		p = p * x
	}
	return p
}

// WriteBatch performs actual writing via HTTP service
func (w *Service) WriteBatch(ctx context.Context, batch *Batch) *http2.Error {
	var body io.Reader
	var err error
	body = strings.NewReader(batch.Batch)

	if log.Level() >= ilog.DebugLevel {
		log.Debugf("Writing batch: %s", batch.Batch)
	}
	if w.writeOptions.UseGZip() {
		body, err = gzip.CompressWithGzip(body)
		if err != nil {
			return http2.NewError(err)
		}
	}
	w.lock.Lock()
	w.lastWriteAttempt = time.Now()
	w.lock.Unlock()
	perror := w.httpService.DoPostRequest(ctx, w.url, body, func(req *http.Request) {
		if w.writeOptions.UseGZip() {
			req.Header.Set("Content-Encoding", "gzip")
		}
	}, func(r *http.Response) error {
		return r.Body.Close()
	})
	return perror
}

// Flush sends batches from retry queue immediately, without retrying
func (w *Service) Flush() {
	for !w.retryQueue.isEmpty() {
		b := w.retryQueue.pop()
		if time.Now().After(b.Expires) {
			log.Error("Oldest batch in retry queue expired, discarding")
			continue
		}
		if err := w.WriteBatch(context.Background(), b); err != nil {
			log.Errorf("Error flushing batch from retry queue: %w", err.Unwrap())
		}
	}
}

// pointWithDefaultTags encapsulates Point with default tags
type pointWithDefaultTags struct {
	point       *write.Point
	defaultTags map[string]string
}

// Name returns the name of measurement of a point.
func (p *pointWithDefaultTags) Name() string {
	return p.point.Name()
}

// Time is the timestamp of a Point.
func (p *pointWithDefaultTags) Time() time.Time {
	return p.point.Time()
}

// FieldList returns a slice containing the fields of a Point.
func (p *pointWithDefaultTags) FieldList() []*lp.Field {
	return p.point.FieldList()
}

// TagList returns tags from point along with default tags
// If point of tag can override default tag
func (p *pointWithDefaultTags) TagList() []*lp.Tag {
	tags := make([]*lp.Tag, 0, len(p.point.TagList())+len(p.defaultTags))
	tags = append(tags, p.point.TagList()...)
	for k, v := range p.defaultTags {
		if !existTag(p.point.TagList(), k) {
			tags = append(tags, &lp.Tag{
				Key:   k,
				Value: v,
			})
		}
	}
	sort.Slice(tags, func(i, j int) bool { return tags[i].Key < tags[j].Key })
	return tags
}

func existTag(tags []*lp.Tag, key string) bool {
	for _, tag := range tags {
		if key == tag.Key {
			return true
		}
	}
	return false
}

// EncodePoints creates line protocol string from points
func (w *Service) EncodePoints(points ...*write.Point) (string, error) {
	var buffer bytes.Buffer
	e := lp.NewEncoder(&buffer)
	e.SetFieldTypeSupport(lp.UintSupport)
	e.FailOnFieldErr(true)
	e.SetPrecision(w.writeOptions.Precision())
	for _, point := range points {
		_, err := e.Encode(w.pointToEncode(point))
		if err != nil {
			return "", err
		}
	}
	return buffer.String(), nil
}

// pointToEncode determines whether default tags should be applied
// and returns point with default tags instead of point
func (w *Service) pointToEncode(point *write.Point) lp.Metric {
	var m lp.Metric
	if len(w.writeOptions.DefaultTags()) > 0 {
		m = &pointWithDefaultTags{
			point:       point,
			defaultTags: w.writeOptions.DefaultTags(),
		}
	} else {
		m = point
	}
	return m
}

// WriteURL returns current write URL
func (w *Service) WriteURL() string {
	return w.url
}

func precisionToString(precision time.Duration) string {
	prec := "ns"
	switch precision {
	case time.Microsecond:
		prec = "us"
	case time.Millisecond:
		prec = "ms"
	case time.Second:
		prec = "s"
	}
	return prec
}
