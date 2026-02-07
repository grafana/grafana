package httpadapter

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// New creates a new backend.CallResourceHandler adapter for
// handling resource calls using an http.Handler
func New(handler http.Handler) backend.CallResourceHandler {
	return &httpResourceHandler{
		handler: handler,
	}
}

type httpResourceHandler struct {
	handler http.Handler
}

func (h *httpResourceHandler) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	var reqBodyReader io.Reader
	if len(req.Body) > 0 {
		reqBodyReader = bytes.NewReader(req.Body)
	}

	// Shouldn't be needed since adapter adds this, but doesn't hurt to
	// be on the safe side in case someone depends on this/using this in a
	// test for example.
	ctx = backend.WithPluginContext(ctx, req.PluginContext)
	ctx = backend.WithUser(ctx, req.PluginContext.User)
	reqURL, err := url.Parse(req.URL)
	if err != nil {
		return err
	}

	resourceURL := req.Path
	if reqURL.RawQuery != "" {
		resourceURL += "?" + reqURL.RawQuery
	}

	if !strings.HasPrefix(resourceURL, "/") {
		resourceURL = "/" + resourceURL
	}

	httpReq, err := http.NewRequestWithContext(ctx, req.Method, resourceURL, reqBodyReader)
	if err != nil {
		return err
	}

	for key, values := range req.Headers {
		httpReq.Header[key] = values
	}

	writer := newResponseWriter(sender)
	h.handler.ServeHTTP(writer, httpReq)
	writer.close()

	return nil
}

// PluginConfigFromContext returns backend.PluginConfig from context.
//
// Deprecated: PluginConfigFromContext exists for historical compatibility
// and might be removed in a future version. Please migrate to [backend.PluginConfigFromContext].
func PluginConfigFromContext(ctx context.Context) backend.PluginContext {
	return backend.PluginConfigFromContext(ctx)
}

// UserFromContext returns backend.User from context.
//
// Deprecated: UserFromContext exists for historical compatibility
// and might be removed in a future version. Please migrate to [backend.UserFromContext].
func UserFromContext(ctx context.Context) *backend.User {
	return backend.UserFromContext(ctx)
}
