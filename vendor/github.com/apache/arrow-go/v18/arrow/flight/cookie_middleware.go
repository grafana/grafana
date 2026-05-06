// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package flight

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/exp/maps"
	"google.golang.org/grpc/metadata"
)

// endOfTime is the time when session (non-persistent) cookies expire.
// This instant is representable in most date/time formats (not just
// Go's time.Time) and should be far enough in the future.
// taken from Go's net/http/cookiejar/jar.go
var endOfTime = time.Date(9999, 12, 31, 23, 59, 59, 0, time.UTC)

// NewClientCookieMiddleware returns a go-routine safe middleware for flight
// clients which properly handles Set-Cookie headers to store cookies
// in a cookie jar, and then requests are sent with those cookies added
// as a Cookie header.
func NewClientCookieMiddleware() ClientMiddleware {
	return CreateClientMiddleware(&clientCookieMiddleware{jar: make(map[string]http.Cookie)})
}

func NewCookieMiddleware() CookieMiddleware {
	return &clientCookieMiddleware{jar: make(map[string]http.Cookie)}
}

// CookieMiddleware is a go-routine safe middleware for flight clients
// which properly handles Set-Cookie headers for storing cookies.
// This can be passed into `CreateClientMiddleware` to create a new
// middleware object. You can also clone it to create middleware for a
// new client which starts with the same cookies.
type CookieMiddleware interface {
	CustomClientMiddleware
	// Clone creates a new CookieMiddleware that starts out with the same
	// cookies that this one already has. This is useful when creating a
	// new client connection for the same server.
	Clone() CookieMiddleware
}

type clientCookieMiddleware struct {
	jar map[string]http.Cookie
	mx  sync.Mutex
}

func (cc *clientCookieMiddleware) Clone() CookieMiddleware {
	cc.mx.Lock()
	defer cc.mx.Unlock()
	return &clientCookieMiddleware{jar: maps.Clone(cc.jar)}
}

func (cc *clientCookieMiddleware) StartCall(ctx context.Context) context.Context {
	cc.mx.Lock()
	defer cc.mx.Unlock()

	if len(cc.jar) == 0 {
		return ctx
	}

	now := time.Now()

	// Per RFC 6265 section 5.4, rather than adding multiple cookie strings
	// or multiple cookie headers, multiple cookies are all sent as a single
	// header value separated by semicolons.

	// we will also clear any expired cookies from the jar while we determine
	// the cookies to send.
	cookies := make([]string, 0, len(cc.jar))
	for id, c := range cc.jar {
		if !c.Expires.After(now) {
			delete(cc.jar, id)
			continue
		}

		cookies = append(cookies, (&http.Cookie{Name: c.Name, Value: c.Value}).String())
	}

	if len(cookies) == 0 {
		return ctx
	}

	return metadata.AppendToOutgoingContext(ctx, "Cookie", strings.Join(cookies, ";"))
}

func processCookieExpire(c *http.Cookie, now time.Time) (remove bool) {
	// MaxAge takes precedence over Expires
	if c.MaxAge < 0 {
		return true
	} else if c.MaxAge > 0 {
		c.Expires = now.Add(time.Duration(c.MaxAge) * time.Second)
	} else {
		if c.Expires.IsZero() {
			c.Expires = endOfTime
		} else {
			if !c.Expires.After(now) {
				return true
			}
		}
	}

	return
}

func (cc *clientCookieMiddleware) HeadersReceived(ctx context.Context, md metadata.MD) {
	// instead of replicating the logic for processing the Set-Cookie
	// header, let's just make a fake response and use the built-in
	// cookie processing. It's very non-trivial
	cookies := (&http.Response{
		Header: http.Header{"Set-Cookie": md.Get("set-cookie")},
	}).Cookies()

	now := time.Now()

	cc.mx.Lock()
	defer cc.mx.Unlock()

	for _, c := range cookies {
		id := c.Name + c.Path
		if processCookieExpire(c, now) {
			delete(cc.jar, id)
			continue
		}

		cc.jar[id] = *c
	}
}
