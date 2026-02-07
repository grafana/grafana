// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

// Package http provides HTTP servicing related code.
//
// Important type is Service which handles HTTP operations. It is internally used by library and it is not necessary to use it directly for common operations.
// It can be useful when creating custom InfluxDB2 server API calls using generated code from the domain package, that are not yet exposed by API of this library.
//
// Service can be obtained from client using HTTPService() method.
// It can be also created directly. To instantiate a Service use NewService(). Remember, the authorization param is in form "Token your-auth-token". e.g. "Token DXnd7annkGteV5Wqx9G3YjO9Ezkw87nHk8OabcyHCxF5451kdBV0Ag2cG7OmZZgCUTHroagUPdxbuoyen6TSPw==".
//
//	srv := http.NewService("http://localhost:8086", "Token my-token", http.DefaultOptions())
package http

import (
	"context"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strconv"

	http2 "github.com/influxdata/influxdb-client-go/v2/internal/http"
	"github.com/influxdata/influxdb-client-go/v2/internal/log"
)

// RequestCallback defines function called after a request is created before any call
type RequestCallback func(req *http.Request)

// ResponseCallback defines function called after a successful response was received
type ResponseCallback func(resp *http.Response) error

// Service handles HTTP operations with taking care of mandatory request headers and known errors
type Service interface {
	// DoPostRequest sends HTTP POST request to the given url with body
	DoPostRequest(ctx context.Context, url string, body io.Reader, requestCallback RequestCallback, responseCallback ResponseCallback) *Error
	// DoHTTPRequest sends given HTTP request and handles response
	DoHTTPRequest(req *http.Request, requestCallback RequestCallback, responseCallback ResponseCallback) *Error
	// DoHTTPRequestWithResponse sends given HTTP request and returns response
	DoHTTPRequestWithResponse(req *http.Request, requestCallback RequestCallback) (*http.Response, error)
	// SetAuthorization sets the authorization header value
	SetAuthorization(authorization string)
	// Authorization returns current authorization header value
	Authorization() string
	// ServerAPIURL returns URL to InfluxDB2 server API space
	ServerAPIURL() string
	// ServerURL returns URL to InfluxDB2 server
	ServerURL() string
}

// service implements Service interface
type service struct {
	serverAPIURL  string
	serverURL     string
	authorization string
	client        Doer
	userAgent     string
}

// NewService creates instance of http Service with given parameters
func NewService(serverURL, authorization string, httpOptions *Options) Service {
	apiURL, err := url.Parse(serverURL)
	serverAPIURL := serverURL
	if err == nil {
		apiURL, err = apiURL.Parse("api/v2/")
		if err == nil {
			serverAPIURL = apiURL.String()
		}
	}
	return &service{
		serverAPIURL:  serverAPIURL,
		serverURL:     serverURL,
		authorization: authorization,
		client:        httpOptions.HTTPDoer(),
		userAgent:     http2.FormatUserAgent(httpOptions.ApplicationName()),
	}
}

func (s *service) ServerAPIURL() string {
	return s.serverAPIURL
}

func (s *service) ServerURL() string {
	return s.serverURL
}

func (s *service) SetAuthorization(authorization string) {
	s.authorization = authorization
}

func (s *service) Authorization() string {
	return s.authorization
}

func (s *service) DoPostRequest(ctx context.Context, url string, body io.Reader, requestCallback RequestCallback, responseCallback ResponseCallback) *Error {
	return s.doHTTPRequestWithURL(ctx, http.MethodPost, url, body, requestCallback, responseCallback)
}

func (s *service) doHTTPRequestWithURL(ctx context.Context, method, url string, body io.Reader, requestCallback RequestCallback, responseCallback ResponseCallback) *Error {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return NewError(err)
	}
	return s.DoHTTPRequest(req, requestCallback, responseCallback)
}

func (s *service) DoHTTPRequest(req *http.Request, requestCallback RequestCallback, responseCallback ResponseCallback) *Error {
	resp, err := s.DoHTTPRequestWithResponse(req, requestCallback)
	if err != nil {
		return NewError(err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return s.parseHTTPError(resp)
	}
	if responseCallback != nil {
		err := responseCallback(resp)
		if err != nil {
			return NewError(err)
		}
	}
	return nil
}

func (s *service) DoHTTPRequestWithResponse(req *http.Request, requestCallback RequestCallback) (*http.Response, error) {
	log.Infof("HTTP %s req to %s", req.Method, req.URL.String())
	if len(s.authorization) > 0 {
		req.Header.Set("Authorization", s.authorization)
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", s.userAgent)
	}
	if requestCallback != nil {
		requestCallback(req)
	}
	return s.client.Do(req)
}

func (s *service) parseHTTPError(r *http.Response) *Error {
	// successful status code range
	if r.StatusCode >= 200 && r.StatusCode < 300 {
		return nil
	}
	defer func() {
		// discard body so connection can be reused
		_, _ = io.Copy(io.Discard, r.Body)
		_ = r.Body.Close()
	}()

	perror := NewError(nil)
	perror.StatusCode = r.StatusCode

	if v := r.Header.Get("Retry-After"); v != "" {
		r, err := strconv.ParseUint(v, 10, 32)
		if err == nil {
			perror.RetryAfter = uint(r)
		}
	}

	// json encoded error
	ctype, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if ctype == "application/json" {
		perror.Err = json.NewDecoder(r.Body).Decode(perror)
	} else {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			perror.Err = err
			return perror
		}

		perror.Code = r.Status
		perror.Message = string(body)
	}

	if perror.Code == "" && perror.Message == "" {
		switch r.StatusCode {
		case http.StatusTooManyRequests:
			perror.Code = "too many requests"
			perror.Message = "exceeded rate limit"
		case http.StatusServiceUnavailable:
			perror.Code = "unavailable"
			perror.Message = "service temporarily unavailable"
		default:
			perror.Code = r.Status
			perror.Message = r.Header.Get("X-Influxdb-Error")
		}
	}

	return perror
}
