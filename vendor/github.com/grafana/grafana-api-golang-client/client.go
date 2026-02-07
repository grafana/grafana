package gapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"time"

	"github.com/hashicorp/go-cleanhttp"
)

// Client is a Grafana API client.
type Client struct {
	config  Config
	baseURL url.URL
	client  *http.Client
}

// Config contains client configuration.
type Config struct {
	// APIKey is an optional API key or service account token.
	APIKey string
	// BasicAuth is optional basic auth credentials.
	BasicAuth *url.Userinfo
	// HTTPHeaders are optional HTTP headers.
	HTTPHeaders map[string]string
	// Client provides an optional HTTP client, otherwise a default will be used.
	Client *http.Client
	// OrgID provides an optional organization ID
	// with BasicAuth, it defaults to last used org
	// with APIKey, it is disallowed because service account tokens are scoped to a single org
	OrgID int64
	// NumRetries contains the number of attempted retries
	NumRetries int
	// RetryTimeout says how long to wait before retrying a request
	RetryTimeout time.Duration
	// RetryStatusCodes contains the list of status codes to retry, use "x" as a wildcard for a single digit (default: [429, 5xx])
	RetryStatusCodes []string
}

// New creates a new Grafana client.
func New(baseURL string, cfg Config) (*Client, error) {
	u, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}

	if cfg.BasicAuth != nil {
		u.User = cfg.BasicAuth
	}

	cli := cfg.Client
	if cli == nil {
		cli = cleanhttp.DefaultClient()
	}

	return &Client{
		config:  cfg,
		baseURL: *u,
		client:  cli,
	}, nil
}

// WithOrgID returns a new client with the provided organization ID.
func (c Client) WithOrgID(orgID int64) *Client {
	c.config.OrgID = orgID
	return &c
}

func (c *Client) request(method, requestPath string, query url.Values, body []byte, responseStruct interface{}) error {
	var (
		req          *http.Request
		resp         *http.Response
		err          error
		bodyContents []byte
	)
	retryStatusCodes := c.config.RetryStatusCodes
	if len(retryStatusCodes) == 0 {
		retryStatusCodes = []string{"429", "5xx"}
	}

	// retry logic
	for n := 0; n <= c.config.NumRetries; n++ {
		req, err = c.newRequest(method, requestPath, query, bytes.NewReader(body))
		if err != nil {
			return err
		}

		// Wait a bit if that's not the first request
		if n != 0 {
			if c.config.RetryTimeout == 0 {
				c.config.RetryTimeout = time.Second * 5
			}
			time.Sleep(c.config.RetryTimeout)
		}

		resp, err = c.client.Do(req)

		// If err is not nil, retry again
		// That's either caused by client policy, or failure to speak HTTP (such as network connectivity problem). A
		// non-2xx status code doesn't cause an error.
		if err != nil {
			continue
		}

		// read the body (even on non-successful HTTP status codes), as that's what the unit tests expect
		bodyContents, err = io.ReadAll(resp.Body)
		resp.Body.Close() //nolint:errcheck

		// if there was an error reading the body, try again
		if err != nil {
			continue
		}

		shouldRetry, err := matchRetryCode(resp.StatusCode, retryStatusCodes)
		if err != nil {
			return err
		}
		if !shouldRetry {
			break
		}
	}
	if err != nil {
		return err
	}

	if os.Getenv("GF_LOG") != "" {
		log.Printf("response status %d with body %v", resp.StatusCode, string(bodyContents))
	}

	// check status code.
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound{
			BodyContents: bodyContents,
		}
	case resp.StatusCode >= 400:
		return fmt.Errorf("status: %d, body: %v", resp.StatusCode, string(bodyContents))
	}

	if responseStruct == nil {
		return nil
	}

	err = json.Unmarshal(bodyContents, responseStruct)
	if err != nil {
		return err
	}

	return nil
}

func (c *Client) newRequest(method, requestPath string, query url.Values, body io.Reader) (*http.Request, error) {
	url := c.baseURL
	url.Path = path.Join(url.Path, requestPath)
	url.RawQuery = query.Encode()
	req, err := http.NewRequest(method, url.String(), body)
	if err != nil {
		return req, err
	}

	// cannot use both API key and org ID. API keys are scoped to single org
	if c.config.APIKey != "" {
		req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", c.config.APIKey))
	}
	if c.config.OrgID != 0 {
		req.Header.Add("X-Grafana-Org-Id", strconv.FormatInt(c.config.OrgID, 10))
	}

	if c.config.HTTPHeaders != nil {
		for k, v := range c.config.HTTPHeaders {
			req.Header.Add(k, v)
		}
	}

	if os.Getenv("GF_LOG") != "" {
		if body == nil {
			log.Printf("request (%s) to %s with no body data", method, url.String())
		} else {
			reader := body.(*bytes.Reader)
			if reader.Len() == 0 {
				log.Printf("request (%s) to %s with no body data", method, url.String())
			} else {
				contents := make([]byte, reader.Len())
				if _, err := reader.Read(contents); err != nil {
					return nil, fmt.Errorf("cannot read body contents for logging: %w", err)
				}
				if _, err := reader.Seek(0, io.SeekStart); err != nil {
					return nil, fmt.Errorf("failed to seek body reader to start after logging: %w", err)
				}
				log.Printf("request (%s) to %s with body data: %s", method, url.String(), string(contents))
			}
		}
	}

	req.Header.Add("Content-Type", "application/json")
	return req, err
}

// matchRetryCode checks if the status code matches any of the configured retry status codes.
func matchRetryCode(gottenCode int, retryCodes []string) (bool, error) {
	gottenCodeStr := strconv.Itoa(gottenCode)
	for _, retryCode := range retryCodes {
		if len(retryCode) != 3 {
			return false, fmt.Errorf("invalid retry status code: %s", retryCode)
		}
		matched := true
		for i := range retryCode {
			c := retryCode[i]
			if c == 'x' {
				continue
			}
			if gottenCodeStr[i] != c {
				matched = false
				break
			}
		}
		if matched {
			return true, nil
		}
	}

	return false, nil
}
