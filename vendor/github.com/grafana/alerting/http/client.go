package http

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"golang.org/x/oauth2"

	commoncfg "github.com/prometheus/common/config"

	"github.com/grafana/alerting/receivers"
)

var ErrInvalidMethod = errors.New("webhook only supports HTTP methods PUT or POST")

type clientConfiguration struct {
	userAgent    string
	dialer       net.Dialer // We use Dialer here instead of DialContext as our mqtt client doesn't support DialContext.
	customDialer bool
}

// defaultDialTimeout is the default timeout for the dialer, 30 seconds to match http.DefaultTransport.
const defaultDialTimeout = 30 * time.Second

type Client struct {
	cfg               clientConfiguration
	oauth2TokenSource oauth2.TokenSource
}

func NewClient(httpClientConfig *HTTPClientConfig, opts ...ClientOption) (*Client, error) {
	cfg := clientConfiguration{
		userAgent: "Grafana",
		dialer:    net.Dialer{},
	}
	for _, opt := range opts {
		if opt != nil {
			opt(&cfg)
		}
	}
	if cfg.dialer.Timeout == 0 {
		// Mostly defensive to ensure that timeout semantics don't change when given a custom dialer without a timeout.
		cfg.dialer.Timeout = defaultDialTimeout
	}

	client := &Client{
		cfg: cfg,
	}

	if httpClientConfig != nil && httpClientConfig.OAuth2 != nil {
		if err := ValidateOAuth2Config(httpClientConfig.OAuth2); err != nil {
			return nil, fmt.Errorf("invalid OAuth2 configuration: %w", err)
		}
		// If the user has provided an OAuth2 config, we need to prepare the OAuth2 token source. This needs to
		// be stored outside of the request so that the token expiration/re-use will work as expected.
		tokenSource, err := NewOAuth2TokenSource(*httpClientConfig.OAuth2, cfg)
		if err != nil {
			return nil, err
		}
		client.oauth2TokenSource = tokenSource
	}

	return client, nil
}

type ClientOption func(*clientConfiguration)

func WithUserAgent(userAgent string) ClientOption {
	return func(c *clientConfiguration) {
		c.userAgent = userAgent
	}
}

func WithDialer(dialer net.Dialer) ClientOption {
	return func(c *clientConfiguration) {
		c.dialer = dialer
		c.customDialer = true
	}
}

func ToHTTPClientOption(option ...ClientOption) []commoncfg.HTTPClientOption {
	cfg := clientConfiguration{}
	for _, opt := range option {
		if opt == nil {
			continue
		}
		opt(&cfg)
	}
	result := make([]commoncfg.HTTPClientOption, 0, len(option))
	if cfg.userAgent != "" {
		result = append(result, commoncfg.WithUserAgent(cfg.userAgent))
	}
	if cfg.customDialer {
		result = append(result, commoncfg.WithDialContextFunc(cfg.dialer.DialContext))
	}
	return result
}

func (ns *Client) SendWebhook(ctx context.Context, l log.Logger, webhook *receivers.SendWebhookSettings) error {
	// This method was moved from https://github.com/grafana/grafana/blob/71d04a326be9578e2d678f23c1efa61768e0541f/pkg/services/notifications/webhook.go#L38
	if webhook.HTTPMethod == "" {
		webhook.HTTPMethod = http.MethodPost
	}
	level.Debug(l).Log("msg", "sending webhook", "url", webhook.URL, "http method", webhook.HTTPMethod)

	if webhook.HTTPMethod != http.MethodPost && webhook.HTTPMethod != http.MethodPut {
		return fmt.Errorf("%w: %s", ErrInvalidMethod, webhook.HTTPMethod)
	}

	request, err := http.NewRequestWithContext(ctx, webhook.HTTPMethod, webhook.URL, bytes.NewReader([]byte(webhook.Body)))
	if err != nil {
		return err
	}
	url, err := url.Parse(webhook.URL)
	if err != nil {
		// Should not be possible - NewRequestWithContext should also err if the URL is bad.
		return err
	}

	if webhook.ContentType == "" {
		webhook.ContentType = "application/json"
	}

	request.Header.Set("Content-Type", webhook.ContentType)
	request.Header.Set("User-Agent", ns.cfg.userAgent)

	if webhook.User != "" && webhook.Password != "" {
		request.Header.Set("Authorization", GetBasicAuthHeader(webhook.User, webhook.Password))
	}

	for k, v := range webhook.HTTPHeader {
		request.Header.Set(k, v)
	}

	client := NewTLSClient(webhook.TLSConfig, ns.cfg.dialer.DialContext)

	if webhook.HMACConfig != nil {
		level.Debug(l).Log("msg", "Adding HMAC roundtripper to client")
		client.Transport, err = NewHMACRoundTripper(
			client.Transport,
			clock.New(),
			webhook.HMACConfig.Secret,
			webhook.HMACConfig.Header,
			webhook.HMACConfig.TimestampHeader,
		)
		if err != nil {
			level.Error(l).Log("msg", "Failed to add HMAC roundtripper to client", "err", err)
			return err
		}
	}

	if ns.oauth2TokenSource != nil {
		level.Debug(l).Log("msg", "Adding OAuth2 roundtripper to client")
		client.Transport = NewOAuth2RoundTripper(ns.oauth2TokenSource, client.Transport)
	}

	resp, err := client.Do(request)
	if err != nil {
		return redactURL(err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			level.Warn(l).Log("msg", "Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if webhook.Validation != nil {
		err := webhook.Validation(body, resp.StatusCode)
		if err != nil {
			level.Debug(l).Log("msg", "Webhook failed validation", "url", url.Redacted(), "statuscode", resp.Status, "body", string(body), "err", err)
			return fmt.Errorf("webhook failed validation: %w", err)
		}
	}

	if resp.StatusCode/100 == 2 {
		level.Debug(l).Log("msg", "Webhook succeeded", "url", url.Redacted(), "statuscode", resp.Status)
		return nil
	}

	level.Debug(l).Log("msg", "Webhook failed", "url", url.Redacted(), "statuscode", resp.Status, "body", string(body))
	return fmt.Errorf("webhook response status %v", resp.Status)
}

func redactURL(err error) error {
	var e *url.Error
	if !errors.As(err, &e) {
		return err
	}
	e.URL = "<redacted>"
	return e
}

func GetBasicAuthHeader(user string, password string) string {
	var userAndPass = user + ":" + password
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(userAndPass))
}
