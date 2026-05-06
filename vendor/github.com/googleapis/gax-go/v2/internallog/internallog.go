// Copyright 2024, Google Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Package internallog in intended for internal use by generated clients only.
package internallog

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/googleapis/gax-go/v2/internallog/internal"
)

// New returns a new [slog.Logger] default logger, or the provided logger if
// non-nil. The returned logger will be a no-op logger unless the environment
// variable GOOGLE_SDK_GO_LOGGING_LEVEL is set.
func New(l *slog.Logger) *slog.Logger {
	if l != nil {
		return l
	}
	return internal.NewLoggerWithWriter(os.Stderr)
}

// HTTPRequest returns a lazily evaluated [slog.LogValuer] for a
// [http.Request] and the associated body.
func HTTPRequest(req *http.Request, body []byte) slog.LogValuer {
	return &request{
		req:     req,
		payload: body,
	}
}

type request struct {
	req     *http.Request
	payload []byte
}

func (r *request) LogValue() slog.Value {
	if r == nil || r.req == nil {
		return slog.Value{}
	}
	var groupValueAttrs []slog.Attr
	groupValueAttrs = append(groupValueAttrs, slog.String("method", r.req.Method))
	groupValueAttrs = append(groupValueAttrs, slog.String("url", r.req.URL.String()))

	var headerAttr []slog.Attr
	for k, val := range r.req.Header {
		headerAttr = append(headerAttr, slog.String(k, strings.Join(val, ",")))
	}
	if len(headerAttr) > 0 {
		groupValueAttrs = append(groupValueAttrs, slog.Any("headers", headerAttr))
	}

	if len(r.payload) > 0 {
		if attr, ok := processPayload(r.payload); ok {
			groupValueAttrs = append(groupValueAttrs, attr)
		}
	}
	return slog.GroupValue(groupValueAttrs...)
}

// HTTPResponse returns a lazily evaluated [slog.LogValuer] for a
// [http.Response] and the associated body.
func HTTPResponse(resp *http.Response, body []byte) slog.LogValuer {
	return &response{
		resp:    resp,
		payload: body,
	}
}

type response struct {
	resp    *http.Response
	payload []byte
}

func (r *response) LogValue() slog.Value {
	if r == nil {
		return slog.Value{}
	}
	var groupValueAttrs []slog.Attr
	groupValueAttrs = append(groupValueAttrs, slog.String("status", fmt.Sprint(r.resp.StatusCode)))

	var headerAttr []slog.Attr
	for k, val := range r.resp.Header {
		headerAttr = append(headerAttr, slog.String(k, strings.Join(val, ",")))
	}
	if len(headerAttr) > 0 {
		groupValueAttrs = append(groupValueAttrs, slog.Any("headers", headerAttr))
	}

	if len(r.payload) > 0 {
		if attr, ok := processPayload(r.payload); ok {
			groupValueAttrs = append(groupValueAttrs, attr)
		}
	}
	return slog.GroupValue(groupValueAttrs...)
}

func processPayload(payload []byte) (slog.Attr, bool) {
	peekChar := payload[0]
	if peekChar == '{' {
		// JSON object
		var m map[string]any
		if err := json.Unmarshal(payload, &m); err == nil {
			return slog.Any("payload", m), true
		}
	} else if peekChar == '[' {
		// JSON array
		var m []any
		if err := json.Unmarshal(payload, &m); err == nil {
			return slog.Any("payload", m), true
		}
	} else {
		// Everything else
		buf := &bytes.Buffer{}
		if err := json.Compact(buf, payload); err != nil {
			// Write raw payload incase of error
			buf.Write(payload)
		}
		return slog.String("payload", buf.String()), true
	}
	return slog.Attr{}, false
}
