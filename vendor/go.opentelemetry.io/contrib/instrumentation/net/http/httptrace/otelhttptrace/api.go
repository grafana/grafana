// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otelhttptrace // import "go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace"

import (
	"context"
	"net/http"
	"net/http/httptrace"
)

// W3C client.
func W3C(ctx context.Context, req *http.Request) (context.Context, *http.Request) {
	ctx = httptrace.WithClientTrace(ctx, NewClientTrace(ctx))
	req = req.WithContext(ctx)
	return ctx, req
}
