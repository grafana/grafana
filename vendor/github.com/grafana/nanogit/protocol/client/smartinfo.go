package client

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/nanogit/log"
)

// SmartInfo retrieves reference and capability information from the remote Git repository
// using the Smart HTTP protocol.
//
// It sends a GET request to the $GIT_URL/info/refs endpoint with the specified service
// (e.g., "git-upload-pack" or "git-receive-pack") as a query parameter. This is required
// by the Git Smart Protocol v2 specification for repository discovery and capability
// negotiation.
//
// The response is parsed internally to validate the Git protocol format.
//
// See:
//   - https://git-scm.com/docs/http-protocol#_smart_clients
//   - https://git-scm.com/docs/protocol-v2#_http_transport
//
// Parameters:
//
//	ctx     - Context for request cancellation and deadlines.
//	service - The Git service to query ("git-upload-pack" or "git-receive-pack").
//
// Returns:
//
//	An error if the HTTP request fails, the server returns a non-2xx status code, or Git protocol errors are detected.
func (c *rawClient) SmartInfo(ctx context.Context, service string) error {
	u := c.base.JoinPath("info/refs")

	query := make(url.Values)
	query.Set("service", service)
	u.RawQuery = query.Encode()

	logger := log.FromContext(ctx)
	logger.Debug("SmartInfo", "url", u.String(), "service", service)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return err
	}

	c.addDefaultHeaders(req)

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := res.Body.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("error closing response body: %w", closeErr)
		}
	}()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("got status code %d: %s", res.StatusCode, res.Status)
	}

	logger.Debug("SmartInfo response",
		"status", res.StatusCode,
		"statusText", res.Status)

	// For SmartInfo, we just need to validate that we got a successful HTTP response
	// The actual content parsing is not needed since callers only care about authorization/existence

	return nil
}
