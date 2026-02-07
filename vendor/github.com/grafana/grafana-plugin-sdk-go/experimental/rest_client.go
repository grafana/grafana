package experimental

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"time"
)

// Client implements a REST client that can be easily mocked in tests and manages
// connection setup and teardown behavior internally
type Client interface {
	// Fetch performs an HTTP GET and returns the body as []byte to prep for marshalling.
	Fetch(ctx context.Context, uriPath, uriQuery string) ([]byte, error)

	// Get performs an HTTP GET and returns the response.
	// This can be used directly from resource calls that don't need to marshal the data
	Get(ctx context.Context, uriPath, uriQuery string) (*http.Response, error)
}

type restClient struct {
	url     string
	headers map[string]string
	client  *http.Client
}

// NewRestClient creates a Client.
func NewRestClient(url string, headers map[string]string) Client {
	return &restClient{
		url:     url,
		headers: headers,
		client: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					MinVersion:    tls.VersionTLS12,
					Renegotiation: tls.RenegotiateFreelyAsClient,
				},
				Proxy: http.ProxyFromEnvironment,
				Dial: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
					DualStack: true,
				}).Dial,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
			},
			Timeout: time.Second * 30,
		},
	}
}

// Fetch performs an HTTP GET and returns the body as []byte to prep for marshalling.
func (c *restClient) Fetch(ctx context.Context, path string, params string) ([]byte, error) {
	resp, err := c.Get(ctx, path, params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close() //nolint
	if resp.StatusCode != 200 {
		return nil, errors.New(resp.Status)
	}
	responseData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return responseData, err
}

// Get performs an HTTP GET and returns the response.
// This can be used directly from resource calls that don't need to marshal the data
func (c *restClient) Get(ctx context.Context, uriPath, uriQuery string) (*http.Response, error) {
	u, err := url.Parse(c.url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, uriPath)
	u.RawQuery = uriQuery
	var req *http.Request
	req, err = http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range c.headers {
		req.Header.Set(key, value)
	}

	return c.client.Do(req)
}
