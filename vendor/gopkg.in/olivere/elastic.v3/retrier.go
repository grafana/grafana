// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"net/http"
	"time"

	"golang.org/x/net/context"
)

// RetrierFunc specifies the signature of a Retry function.
type RetrierFunc func(context.Context, int, *http.Request, *http.Response, error) (time.Duration, bool, error)

// Retrier decides whether to retry a failed HTTP request with Elasticsearch.
type Retrier interface {
	// Retry is called when a request has failed. It decides whether to retry
	// the call, how long to wait for the next call, or whether to return an
	// error (which will be returned to the service that started the HTTP
	// request in the first place).
	//
	// Callers may also use this to inspect the HTTP request/response and
	// the error that happened. Additional data can be passed through via
	// the context.
	Retry(ctx context.Context, retry int, req *http.Request, resp *http.Response, err error) (time.Duration, bool, error)
}

// -- StopRetrier --

// StopRetrier is an implementation that does no retries.
type StopRetrier struct {
}

// NewStopRetrier returns a retrier that does no retries.
func NewStopRetrier() *StopRetrier {
	return &StopRetrier{}
}

// Retry does not retry.
func (r *StopRetrier) Retry(ctx context.Context, retry int, req *http.Request, resp *http.Response, err error) (time.Duration, bool, error) {
	return 0, false, nil
}

// -- BackoffRetrier --

// BackoffRetrier is an implementation that does nothing but return nil on Retry.
type BackoffRetrier struct {
	backoff Backoff
}

// NewBackoffRetrier returns a retrier that uses the given backoff strategy.
func NewBackoffRetrier(backoff Backoff) *BackoffRetrier {
	return &BackoffRetrier{backoff: backoff}
}

// Retry calls into the backoff strategy and its wait interval.
func (r *BackoffRetrier) Retry(ctx context.Context, retry int, req *http.Request, resp *http.Response, err error) (time.Duration, bool, error) {
	wait, goahead := r.backoff.Next(retry)
	return wait, goahead, nil
}
