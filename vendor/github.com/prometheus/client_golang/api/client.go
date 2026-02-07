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

// Package api provides clients for the HTTP APIs.
package api

import (
	"bytes"
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// DefaultRoundTripper is used if no RoundTripper is set in Config.
var DefaultRoundTripper http.RoundTripper = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSHandshakeTimeout: 10 * time.Second,
}

// Config defines configuration parameters for a new client.
type Config struct {
	// The address of the Prometheus to connect to.
	Address string

	// Client is used by the Client to drive HTTP requests. If not provided,
	// a new one based on the provided RoundTripper (or DefaultRoundTripper) will be used.
	Client *http.Client

	// RoundTripper is used by the Client to drive HTTP requests. If not
	// provided, DefaultRoundTripper will be used.
	RoundTripper http.RoundTripper
}

func (cfg *Config) roundTripper() http.RoundTripper {
	if cfg.RoundTripper == nil {
		return DefaultRoundTripper
	}
	return cfg.RoundTripper
}

func (cfg *Config) client() http.Client {
	if cfg.Client == nil {
		return http.Client{
			Transport: cfg.roundTripper(),
		}
	}
	return *cfg.Client
}

func (cfg *Config) validate() error {
	if cfg.Client != nil && cfg.RoundTripper != nil {
		return errors.New("api.Config.RoundTripper and api.Config.Client are mutually exclusive")
	}
	return nil
}

// Client is the interface for an API client.
type Client interface {
	URL(ep string, args map[string]string) *url.URL
	Do(context.Context, *http.Request) (*http.Response, []byte, error)
}

type CloseIdler interface {
	CloseIdleConnections()
}

// NewClient returns a new Client.
//
// It is safe to use the returned Client from multiple goroutines.
func NewClient(cfg Config) (Client, error) {
	u, err := url.Parse(cfg.Address)
	if err != nil {
		return nil, err
	}
	u.Path = strings.TrimRight(u.Path, "/")

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &httpClient{
		endpoint: u,
		client:   cfg.client(),
	}, nil
}

type httpClient struct {
	endpoint *url.URL
	client   http.Client
}

func (c *httpClient) URL(ep string, args map[string]string) *url.URL {
	p := path.Join(c.endpoint.Path, ep)

	for arg, val := range args {
		arg = ":" + arg
		p = strings.ReplaceAll(p, arg, val)
	}

	u := *c.endpoint
	u.Path = p

	return &u
}

func (c *httpClient) CloseIdleConnections() {
	c.client.CloseIdleConnections()
}

func (c *httpClient) Do(ctx context.Context, req *http.Request) (*http.Response, []byte, error) {
	if ctx != nil {
		req = req.WithContext(ctx)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, nil, err
	}

	var body []byte
	done := make(chan error, 1)
	go func() {
		var buf bytes.Buffer
		_, err := buf.ReadFrom(resp.Body)
		body = buf.Bytes()
		done <- err
	}()

	select {
	case <-ctx.Done():
		resp.Body.Close()
		<-done
		return resp, nil, ctx.Err()
	case err = <-done:
		resp.Body.Close()
		return resp, body, err
	}
}
