// Copyright 2016 Google Inc. All Rights Reserved.
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

// Package errorreporting is a Google Stackdriver Error Reporting library.
//
// This package is still experimental and subject to change.
//
// See https://cloud.google.com/error-reporting/ for more information.
package errorreporting // import "cloud.google.com/go/errorreporting"

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"time"

	api "cloud.google.com/go/errorreporting/apiv1beta1"
	"cloud.google.com/go/internal/version"
	"github.com/golang/protobuf/ptypes"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/support/bundler"
	erpb "google.golang.org/genproto/googleapis/devtools/clouderrorreporting/v1beta1"
)

const (
	userAgent = `gcloud-golang-errorreporting/20160701`
)

// Config is additional configuration for Client.
type Config struct {
	// ServiceName identifies the running program and is included in the error reports.
	// Optional.
	ServiceName string

	// ServiceVersion identifies the version of the running program and is
	// included in the error reports.
	// Optional.
	ServiceVersion string

	// OnError is the function to call if any background
	// tasks errored. By default, errors are logged.
	OnError func(err error)
}

// Entry holds information about the reported error.
type Entry struct {
	Error error
	Req   *http.Request // if error is associated with a request.
	Stack []byte        // if user does not provide a stack trace, runtime.Stack will be called
}

// Client represents a Google Cloud Error Reporting client.
type Client struct {
	projectID      string
	apiClient      client
	serviceContext erpb.ServiceContext
	bundler        *bundler.Bundler

	onErrorFn func(err error)
}

var newClient = func(ctx context.Context, opts ...option.ClientOption) (client, error) {
	client, err := api.NewReportErrorsClient(ctx, opts...)
	if err != nil {
		return nil, err
	}
	client.SetGoogleClientInfo("gccl", version.Repo)
	return client, nil
}

// NewClient returns a new error reporting client. Generally you will want
// to create a client on program initialization and use it through the lifetime
// of the process.
func NewClient(ctx context.Context, projectID string, cfg Config, opts ...option.ClientOption) (*Client, error) {
	if cfg.ServiceName == "" {
		cfg.ServiceName = "goapp"
	}
	c, err := newClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("creating client: %v", err)
	}

	client := &Client{
		apiClient: c,
		projectID: "projects/" + projectID,
		serviceContext: erpb.ServiceContext{
			Service: cfg.ServiceName,
			Version: cfg.ServiceVersion,
		},
	}
	bundler := bundler.NewBundler((*erpb.ReportErrorEventRequest)(nil), func(bundle interface{}) {
		reqs := bundle.([]*erpb.ReportErrorEventRequest)
		for _, req := range reqs {
			_, err = client.apiClient.ReportErrorEvent(ctx, req)
			if err != nil {
				client.onError(fmt.Errorf("failed to upload: %v", err))
			}
		}
	})
	// TODO(jbd): Optimize bundler limits.
	bundler.DelayThreshold = 2 * time.Second
	bundler.BundleCountThreshold = 100
	bundler.BundleByteThreshold = 1000
	bundler.BundleByteLimit = 1000
	bundler.BufferedByteLimit = 10000
	client.bundler = bundler
	return client, nil
}

func (c *Client) onError(err error) {
	if c.onErrorFn != nil {
		c.onErrorFn(err)
		return
	}
	log.Println(err)
}

// Close closes any resources held by the client.
// Close should be called when the client is no longer needed.
// It need not be called at program exit.
func (c *Client) Close() error {
	return c.apiClient.Close()
}

// Report writes an error report. It doesn't block. Errors in
// writing the error report can be handled via Client.OnError.
func (c *Client) Report(e Entry) {
	var stack string
	if e.Stack != nil {
		stack = string(e.Stack)
	}
	req := c.makeReportErrorEventRequest(e.Req, e.Error.Error(), stack)
	c.bundler.Add(req, 1)
}

// ReportSync writes an error report. It blocks until the entry is written.
func (c *Client) ReportSync(ctx context.Context, e Entry) error {
	var stack string
	if e.Stack != nil {
		stack = string(e.Stack)
	}
	req := c.makeReportErrorEventRequest(e.Req, e.Error.Error(), stack)
	_, err := c.apiClient.ReportErrorEvent(ctx, req)
	return err
}

// Flush blocks until all currently buffered error reports are sent.
//
// If any errors occurred since the last call to Flush, or the
// creation of the client if this is the first call, then Flush report the
// error via the (*Client).OnError handler.
func (c *Client) Flush() {
	c.bundler.Flush()
}

func (c *Client) makeReportErrorEventRequest(r *http.Request, msg string, stack string) *erpb.ReportErrorEventRequest {
	if stack == "" {
		// limit the stack trace to 16k.
		var buf [16 * 1024]byte
		stack = chopStack(buf[0:runtime.Stack(buf[:], false)])
	}
	message := msg + "\n" + stack

	var errorContext *erpb.ErrorContext
	if r != nil {
		errorContext = &erpb.ErrorContext{
			HttpRequest: &erpb.HttpRequestContext{
				Method:    r.Method,
				Url:       r.Host + r.RequestURI,
				UserAgent: r.UserAgent(),
				Referrer:  r.Referer(),
				RemoteIp:  r.RemoteAddr,
			},
		}
	}
	return &erpb.ReportErrorEventRequest{
		ProjectName: c.projectID,
		Event: &erpb.ReportedErrorEvent{
			EventTime:      ptypes.TimestampNow(),
			ServiceContext: &c.serviceContext,
			Message:        message,
			Context:        errorContext,
		},
	}
}

// chopStack trims a stack trace so that the function which panics or calls
// Report is first.
func chopStack(s []byte) string {
	f := []byte("cloud.google.com/go/errorreporting.(*Client).Report")

	lfFirst := bytes.IndexByte(s, '\n')
	if lfFirst == -1 {
		return string(s)
	}
	stack := s[lfFirst:]
	panicLine := bytes.Index(stack, f)
	if panicLine == -1 {
		return string(s)
	}
	stack = stack[panicLine+1:]
	for i := 0; i < 2; i++ {
		nextLine := bytes.IndexByte(stack, '\n')
		if nextLine == -1 {
			return string(s)
		}
		stack = stack[nextLine+1:]
	}
	return string(s[:lfFirst+1]) + string(stack)
}

type client interface {
	ReportErrorEvent(ctx context.Context, req *erpb.ReportErrorEventRequest, opts ...gax.CallOption) (*erpb.ReportErrorEventResponse, error)
	Close() error
}
