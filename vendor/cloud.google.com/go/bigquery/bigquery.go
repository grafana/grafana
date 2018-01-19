// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bigquery

import (
	"fmt"
	"io"
	"net/http"
	"time"

	gax "github.com/googleapis/gax-go"

	"cloud.google.com/go/internal"
	"cloud.google.com/go/internal/version"

	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
	htransport "google.golang.org/api/transport/http"

	"golang.org/x/net/context"
	bq "google.golang.org/api/bigquery/v2"
)

const (
	prodAddr  = "https://www.googleapis.com/bigquery/v2/"
	Scope     = "https://www.googleapis.com/auth/bigquery"
	userAgent = "gcloud-golang-bigquery/20160429"
)

var xGoogHeader = fmt.Sprintf("gl-go/%s gccl/%s", version.Go(), version.Repo)

func setClientHeader(headers http.Header) {
	headers.Set("x-goog-api-client", xGoogHeader)
}

// Client may be used to perform BigQuery operations.
type Client struct {
	projectID string
	bqs       *bq.Service
}

// NewClient constructs a new Client which can perform BigQuery operations.
// Operations performed via the client are billed to the specified GCP project.
func NewClient(ctx context.Context, projectID string, opts ...option.ClientOption) (*Client, error) {
	o := []option.ClientOption{
		option.WithEndpoint(prodAddr),
		option.WithScopes(Scope),
		option.WithUserAgent(userAgent),
	}
	o = append(o, opts...)
	httpClient, endpoint, err := htransport.NewClient(ctx, o...)
	if err != nil {
		return nil, fmt.Errorf("bigquery: dialing: %v", err)
	}
	bqs, err := bq.New(httpClient)
	if err != nil {
		return nil, fmt.Errorf("bigquery: constructing client: %v", err)
	}
	bqs.BasePath = endpoint
	c := &Client{
		projectID: projectID,
		bqs:       bqs,
	}
	return c, nil
}

// Close closes any resources held by the client.
// Close should be called when the client is no longer needed.
// It need not be called at program exit.
func (c *Client) Close() error {
	return nil
}

// Calls the Jobs.Insert RPC and returns a Job.
func (c *Client) insertJob(ctx context.Context, job *bq.Job, media io.Reader) (*Job, error) {
	call := c.bqs.Jobs.Insert(c.projectID, job).Context(ctx)
	setClientHeader(call.Header())
	if media != nil {
		call.Media(media)
	}
	var res *bq.Job
	var err error
	invoke := func() error {
		res, err = call.Do()
		return err
	}
	// A job with a client-generated ID can be retried; the presence of the
	// ID makes the insert operation idempotent.
	// We don't retry if there is media, because it is an io.Reader. We'd
	// have to read the contents and keep it in memory, and that could be expensive.
	// TODO(jba): Look into retrying if media != nil.
	if job.JobReference != nil && media == nil {
		err = runWithRetry(ctx, invoke)
	} else {
		err = invoke()
	}
	if err != nil {
		return nil, err
	}
	return bqToJob(res, c)
}

// Convert a number of milliseconds since the Unix epoch to a time.Time.
// Treat an input of zero specially: convert it to the zero time,
// rather than the start of the epoch.
func unixMillisToTime(m int64) time.Time {
	if m == 0 {
		return time.Time{}
	}
	return time.Unix(0, m*1e6)
}

// runWithRetry calls the function until it returns nil or a non-retryable error, or
// the context is done.
// See the similar function in ../storage/invoke.go. The main difference is the
// reason for retrying.
func runWithRetry(ctx context.Context, call func() error) error {
	// These parameters match the suggestions in https://cloud.google.com/bigquery/sla.
	backoff := gax.Backoff{
		Initial:    1 * time.Second,
		Max:        32 * time.Second,
		Multiplier: 2,
	}
	return internal.Retry(ctx, backoff, func() (stop bool, err error) {
		err = call()
		if err == nil {
			return true, nil
		}
		return !retryableError(err), err
	})
}

// This is the correct definition of retryable according to the BigQuery team.
func retryableError(err error) bool {
	e, ok := err.(*googleapi.Error)
	if !ok {
		return false
	}
	var reason string
	if len(e.Errors) > 0 {
		reason = e.Errors[0].Reason
	}
	return reason == "backendError" || reason == "rateLimitExceeded"
}
