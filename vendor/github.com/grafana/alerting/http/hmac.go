package http

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/benbjohnson/clock"
)

const (
	// defaultHeaderName is the default HTTP header used for the HMAC signature
	defaultHeaderName = "X-Grafana-Alerting-Signature"
	// timestampSeparator is used to separate the timestamp from the request body in the HMAC calculation
	timestampSeparator = ":"
)

// HMACRoundTripper is an HTTP transport that signs outgoing requests using HMAC SHA256.
// It can optionally include a timestamp in the signature calculation (if timestampHeader is not empty)
// and supports custom header names for both the signature and timestamp values.
type HMACRoundTripper struct {
	wrapped         http.RoundTripper
	clk             clock.Clock
	secret          string
	header          string
	timestampHeader string
}

// NewHMACRoundTripper creates a new HMACRoundTripper that wraps the provided RoundTripper.
// It signs requests using the provided secret key and places the signature in the specified header.
// If header is empty, it defaults to "X-Grafana-Alert-Signature".
// If timestampHeader is non-empty, the current timestamp will be included in the signature
// calculation and set in the specified header.
func NewHMACRoundTripper(wrapped http.RoundTripper, clk clock.Clock, secret, header, timestampHeader string) (*HMACRoundTripper, error) {
	if secret == "" {
		return nil, errors.New("secret must be provided")
	}
	if header == "" {
		header = defaultHeaderName
	}
	return &HMACRoundTripper{
		wrapped:         wrapped,
		clk:             clk,
		secret:          secret,
		header:          header,
		timestampHeader: timestampHeader,
	}, nil
}

func (rt *HMACRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := rt.sign(req); err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}
	return rt.wrapped.RoundTrip(req)
}

// sign computes the HMAC SHA256 signature for the request body.
// If a timestamp header is configured, it includes the current timestamp in the signature.
// The computed signature is then set in the request header, and the request body is restored.
func (rt *HMACRoundTripper) sign(req *http.Request) error {
	if req.Body == nil {
		return nil
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return fmt.Errorf("failed to read request body: %w", err)
	}
	req.Body.Close()
	req.Body = io.NopCloser(bytes.NewReader(body))

	hash := hmac.New(sha256.New, []byte(rt.secret))

	if rt.timestampHeader != "" {
		timestamp := strconv.FormatInt(rt.clk.Now().Unix(), 10)
		req.Header.Set(rt.timestampHeader, timestamp)
		hash.Write([]byte(timestamp))
		hash.Write([]byte(timestampSeparator))
	}

	hash.Write(body)
	signature := hex.EncodeToString(hash.Sum(nil))
	req.Header.Set(rt.header, signature)

	return nil
}
