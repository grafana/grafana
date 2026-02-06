// Copyright 2015 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package push provides functions to push metrics to a Pushgateway. It uses a
// builder approach. Create a Pusher with New and then add the various options
// by using its methods, finally calling Add or Push, like this:
//
//	// Easy case:
//	push.New("http://example.org/metrics", "my_job").Gatherer(myRegistry).Push()
//
//	// Complex case:
//	push.New("http://example.org/metrics", "my_job").
//	    Collector(myCollector1).
//	    Collector(myCollector2).
//	    Grouping("zone", "xy").
//	    Client(&myHTTPClient).
//	    BasicAuth("top", "secret").
//	    Add()
//
// See the examples section for more detailed examples.
//
// See the documentation of the Pushgateway to understand the meaning of
// the grouping key and the differences between Push and Add:
// https://github.com/prometheus/pushgateway
package push

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	contentTypeHeader = "Content-Type"
	// base64Suffix is appended to a label name in the request URL path to
	// mark the following label value as base64 encoded.
	base64Suffix = "@base64"
)

var errJobEmpty = errors.New("job name is empty")

// HTTPDoer is an interface for the one method of http.Client that is used by Pusher
type HTTPDoer interface {
	Do(*http.Request) (*http.Response, error)
}

// Pusher manages a push to the Pushgateway. Use New to create one, configure it
// with its methods, and finally use the Add or Push method to push.
type Pusher struct {
	error error

	url, job string
	grouping map[string]string

	gatherers  prometheus.Gatherers
	registerer prometheus.Registerer

	client             HTTPDoer
	header             http.Header
	useBasicAuth       bool
	username, password string

	expfmt expfmt.Format
}

// New creates a new Pusher to push to the provided URL with the provided job
// name (which must not be empty). You can use just host:port or ip:port as url,
// in which case “http://” is added automatically. Alternatively, include the
// schema in the URL. However, do not include the “/metrics/jobs/…” part.
func New(url, job string) *Pusher {
	var (
		reg = prometheus.NewRegistry()
		err error
	)
	if job == "" {
		err = errJobEmpty
	}
	if !strings.Contains(url, "://") {
		url = "http://" + url
	}
	url = strings.TrimSuffix(url, "/")

	return &Pusher{
		error:      err,
		url:        url,
		job:        job,
		grouping:   map[string]string{},
		gatherers:  prometheus.Gatherers{reg},
		registerer: reg,
		client:     &http.Client{},
		expfmt:     expfmt.NewFormat(expfmt.TypeProtoDelim),
	}
}

// Push collects/gathers all metrics from all Collectors and Gatherers added to
// this Pusher. Then, it pushes them to the Pushgateway configured while
// creating this Pusher, using the configured job name and any added grouping
// labels as grouping key. All previously pushed metrics with the same job and
// other grouping labels will be replaced with the metrics pushed by this
// call. (It uses HTTP method “PUT” to push to the Pushgateway.)
//
// Push returns the first error encountered by any method call (including this
// one) in the lifetime of the Pusher.
func (p *Pusher) Push() error {
	return p.push(context.Background(), http.MethodPut)
}

// PushContext is like Push but includes a context.
//
// If the context expires before HTTP request is complete, an error is returned.
func (p *Pusher) PushContext(ctx context.Context) error {
	return p.push(ctx, http.MethodPut)
}

// Add works like push, but only previously pushed metrics with the same name
// (and the same job and other grouping labels) will be replaced. (It uses HTTP
// method “POST” to push to the Pushgateway.)
func (p *Pusher) Add() error {
	return p.push(context.Background(), http.MethodPost)
}

// AddContext is like Add but includes a context.
//
// If the context expires before HTTP request is complete, an error is returned.
func (p *Pusher) AddContext(ctx context.Context) error {
	return p.push(ctx, http.MethodPost)
}

// Gatherer adds a Gatherer to the Pusher, from which metrics will be gathered
// to push them to the Pushgateway. The gathered metrics must not contain a job
// label of their own.
//
// For convenience, this method returns a pointer to the Pusher itself.
func (p *Pusher) Gatherer(g prometheus.Gatherer) *Pusher {
	p.gatherers = append(p.gatherers, g)
	return p
}

// Collector adds a Collector to the Pusher, from which metrics will be
// collected to push them to the Pushgateway. The collected metrics must not
// contain a job label of their own.
//
// For convenience, this method returns a pointer to the Pusher itself.
func (p *Pusher) Collector(c prometheus.Collector) *Pusher {
	if p.error == nil {
		p.error = p.registerer.Register(c)
	}
	return p
}

// Error returns the error that was encountered.
func (p *Pusher) Error() error {
	return p.error
}

// Grouping adds a label pair to the grouping key of the Pusher, replacing any
// previously added label pair with the same label name. Note that setting any
// labels in the grouping key that are already contained in the metrics to push
// will lead to an error.
//
// For convenience, this method returns a pointer to the Pusher itself.
func (p *Pusher) Grouping(name, value string) *Pusher {
	if p.error == nil {
		//nolint:staticcheck // TODO: Don't use deprecated model.NameValidationScheme.
		if !model.NameValidationScheme.IsValidLabelName(name) {
			p.error = fmt.Errorf("grouping label has invalid name: %s", name)
			return p
		}
		p.grouping[name] = value
	}
	return p
}

// Client sets a custom HTTP client for the Pusher. For convenience, this method
// returns a pointer to the Pusher itself.
// Pusher only needs one method of the custom HTTP client: Do(*http.Request).
// Thus, rather than requiring a fully fledged http.Client,
// the provided client only needs to implement the HTTPDoer interface.
// Since *http.Client naturally implements that interface, it can still be used normally.
func (p *Pusher) Client(c HTTPDoer) *Pusher {
	p.client = c
	return p
}

// Header sets a custom HTTP header for the Pusher's client. For convenience, this method
// returns a pointer to the Pusher itself.
func (p *Pusher) Header(header http.Header) *Pusher {
	p.header = header
	return p
}

// BasicAuth configures the Pusher to use HTTP Basic Authentication with the
// provided username and password. For convenience, this method returns a
// pointer to the Pusher itself.
func (p *Pusher) BasicAuth(username, password string) *Pusher {
	p.useBasicAuth = true
	p.username = username
	p.password = password
	return p
}

// Format configures the Pusher to use an encoding format given by the
// provided expfmt.Format. The default format is expfmt.FmtProtoDelim and
// should be used with the standard Prometheus Pushgateway. Custom
// implementations may require different formats. For convenience, this
// method returns a pointer to the Pusher itself.
func (p *Pusher) Format(format expfmt.Format) *Pusher {
	p.expfmt = format
	return p
}

// Delete sends a “DELETE” request to the Pushgateway configured while creating
// this Pusher, using the configured job name and any added grouping labels as
// grouping key. Any added Gatherers and Collectors added to this Pusher are
// ignored by this method.
//
// Delete returns the first error encountered by any method call (including this
// one) in the lifetime of the Pusher.
func (p *Pusher) Delete() error {
	if p.error != nil {
		return p.error
	}
	req, err := http.NewRequest(http.MethodDelete, p.fullURL(), nil)
	if err != nil {
		return err
	}
	if p.header != nil {
		req.Header = p.header
	}
	if p.useBasicAuth {
		req.SetBasicAuth(p.username, p.password)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body) // Ignore any further error as this is for an error message only.
		return fmt.Errorf("unexpected status code %d while deleting %s: %s", resp.StatusCode, p.fullURL(), body)
	}
	return nil
}

func (p *Pusher) push(ctx context.Context, method string) error {
	if p.error != nil {
		return p.error
	}
	mfs, err := p.gatherers.Gather()
	if err != nil {
		return err
	}
	buf := &bytes.Buffer{}
	enc := expfmt.NewEncoder(buf, p.expfmt)
	// Check for pre-existing grouping labels:
	for _, mf := range mfs {
		for _, m := range mf.GetMetric() {
			for _, l := range m.GetLabel() {
				if l.GetName() == "job" {
					return fmt.Errorf("pushed metric %s (%s) already contains a job label", mf.GetName(), m)
				}
				if _, ok := p.grouping[l.GetName()]; ok {
					return fmt.Errorf(
						"pushed metric %s (%s) already contains grouping label %s",
						mf.GetName(), m, l.GetName(),
					)
				}
			}
		}
		if err := enc.Encode(mf); err != nil {
			return fmt.Errorf(
				"failed to encode metric family %s, error is %w",
				mf.GetName(), err)
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, p.fullURL(), buf)
	if err != nil {
		return err
	}
	if p.header != nil {
		req.Header = p.header
	}
	if p.useBasicAuth {
		req.SetBasicAuth(p.username, p.password)
	}
	req.Header.Set(contentTypeHeader, string(p.expfmt))
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// Depending on version and configuration of the PGW, StatusOK or StatusAccepted may be returned.
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body) // Ignore any further error as this is for an error message only.
		return fmt.Errorf("unexpected status code %d while pushing to %s: %s", resp.StatusCode, p.fullURL(), body)
	}
	return nil
}

// fullURL assembles the URL used to push/delete metrics and returns it as a
// string. The job name and any grouping label values containing a '/' will
// trigger a base64 encoding of the affected component and proper suffixing of
// the preceding component. Similarly, an empty grouping label value will be
// encoded as base64 just with a single `=` padding character (to avoid an empty
// path component). If the component does not contain a '/' but other special
// characters, the usual url.QueryEscape is used for compatibility with older
// versions of the Pushgateway and for better readability.
func (p *Pusher) fullURL() string {
	urlComponents := []string{}
	if encodedJob, base64 := encodeComponent(p.job); base64 {
		urlComponents = append(urlComponents, "job"+base64Suffix, encodedJob)
	} else {
		urlComponents = append(urlComponents, "job", encodedJob)
	}
	for ln, lv := range p.grouping {
		if encodedLV, base64 := encodeComponent(lv); base64 {
			urlComponents = append(urlComponents, ln+base64Suffix, encodedLV)
		} else {
			urlComponents = append(urlComponents, ln, encodedLV)
		}
	}
	return fmt.Sprintf("%s/metrics/%s", p.url, strings.Join(urlComponents, "/"))
}

// encodeComponent encodes the provided string with base64.RawURLEncoding in
// case it contains '/' and as "=" in case it is empty. If neither is the case,
// it uses url.QueryEscape instead. It returns true in the former two cases.
func encodeComponent(s string) (string, bool) {
	if s == "" {
		return "=", true
	}
	if strings.Contains(s, "/") {
		return base64.RawURLEncoding.EncodeToString([]byte(s)), true
	}
	return url.QueryEscape(s), false
}
