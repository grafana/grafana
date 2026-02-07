package receivers

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"

	"github.com/prometheus/common/model"
)

type AlertStateType string

const (
	ColorAlertFiring   = "#D63232"
	ColorAlertResolved = "#36a64f"

	AlertStateAlerting AlertStateType = "alerting"
	AlertStateOK       AlertStateType = "ok"
)

func GetAlertStatusColor(status model.AlertStatus) string {
	if status == model.AlertFiring {
		return ColorAlertFiring
	}
	return ColorAlertResolved
}

type HTTPCfg struct {
	Body     []byte
	User     string
	Password string
}

// HMACConfig contains configuration for HMAC signing of HTTP requests
type HMACConfig struct {
	// Secret to use for HMAC signing.
	Secret string `json:"secret,omitempty" yaml:"secret,omitempty"`
	// Header is the name of the header containing the HMAC signature.
	Header string `json:"header,omitempty" yaml:"header,omitempty"`
	// TimestampHeader is the name of the header containing the timestamp
	// used to generate the HMAC signature. If empty, timestamp is not included.
	TimestampHeader string `yaml:"timestampHeader,omitempty" json:"timestampHeader,omitempty"`
}

type TLSConfig struct {
	CACertificate      string `json:"caCertificate,omitempty" yaml:"caCertificate,omitempty"`
	ClientCertificate  string `json:"clientCertificate,omitempty" yaml:"clientCertificate,omitempty"`
	ClientKey          string `json:"clientKey,omitempty" yaml:"clientKey,omitempty"`
	InsecureSkipVerify bool   `json:"insecureSkipVerify,omitempty" yaml:"insecureSkipVerify,omitempty"`
	ServerName         string
}

func (cfg *TLSConfig) ToCryptoTLSConfig() (*tls.Config, error) {
	tlsCfg := &tls.Config{
		InsecureSkipVerify: cfg.InsecureSkipVerify,
		ServerName:         cfg.ServerName,
	}

	if cfg.CACertificate != "" {
		tlsCfg.RootCAs = x509.NewCertPool()
		ok := tlsCfg.RootCAs.AppendCertsFromPEM([]byte(cfg.CACertificate))
		if !ok {
			return nil, errors.New("unable to use the provided CA certificate")
		}
	}

	if cfg.ClientCertificate != "" || cfg.ClientKey != "" {
		cert, err := tls.X509KeyPair([]byte(cfg.ClientCertificate), []byte(cfg.ClientKey))
		if err != nil {
			return nil, fmt.Errorf("failed to load client certificate: %w", err)
		}
		tlsCfg.Certificates = append(tlsCfg.Certificates, cert)
	}

	return tlsCfg, nil
}

// SendHTTPRequest sends an HTTP request.
// Stubbable by tests.
//
//nolint:unused, varcheck
var SendHTTPRequest = func(ctx context.Context, url *url.URL, cfg HTTPCfg, logger log.Logger) ([]byte, error) {
	var reader io.Reader
	if len(cfg.Body) > 0 {
		reader = bytes.NewReader(cfg.Body)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url.String(), reader)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	if cfg.User != "" && cfg.Password != "" {
		request.SetBasicAuth(cfg.User, cfg.Password)
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "Grafana")
	netTransport := &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}
	netClient := &http.Client{
		Timeout:   time.Second * 30,
		Transport: netTransport,
	}
	resp, err := netClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			level.Error(logger).Log("msg", "failed to close response Body", "err", err)
		}
	}()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response Body: %w", err)
	}

	if resp.StatusCode/100 != 2 {
		level.Warn(logger).Log("msg", "HTTP request failed", "url", request.URL.String(), "statusCode", resp.Status, "Body",
			string(respBody))
		return nil, fmt.Errorf("failed to send HTTP request - status code %d", resp.StatusCode)
	}

	level.Debug(logger).Log("msg", "sending HTTP request succeeded", "url", request.URL.String(), "statusCode", resp.Status)
	return respBody, nil
}

func JoinURLPath(base, additionalPath string, logger log.Logger) string {
	u, err := url.Parse(base)
	if err != nil {
		level.Debug(logger).Log("msg", "failed to parse URL while joining URL", "url", base, "err", err.Error())
		return base
	}

	u.Path = path.Join(u.Path, additionalPath)

	return u.String()
}

// GetBoundary is used for overriding the behaviour for tests
// and set a boundary for multipart Body. DO NOT set this outside tests.
var GetBoundary = func() string {
	return ""
}

// Copied from https://github.com/prometheus/alertmanager/blob/main/notify/util.go, please remove once we're on-par with upstream.
// truncationMarker is the character used to represent a truncation.
const truncationMarker = "…"

// Copied from https://github.com/prometheus/alertmanager/blob/main/notify/util.go, please remove once we're on-par with upstream.
// TruncateInrunes truncates a string to fit the given size in Runes.
func TruncateInRunes(s string, n int) (string, bool) {
	r := []rune(s)
	if len(r) <= n {
		return s, false
	}

	if n <= 3 {
		return string(r[:n]), true
	}

	return string(r[:n-1]) + truncationMarker, true
}

// TruncateInBytes truncates a string to fit the given size in Bytes.
// TODO: This is more advanced than the upstream's TruncateInBytes. We should consider upstreaming this, and removing it from here.
func TruncateInBytes(s string, n int) (string, bool) {
	// First, measure the string the w/o a to-rune conversion.
	if len(s) <= n {
		return s, false
	}

	// The truncationMarker itself is 3 bytes, we can't return any part of the string when it's less than 3.
	if n <= 3 {
		switch n {
		case 3:
			return truncationMarker, true
		default:
			return strings.Repeat(".", n), true
		}
	}

	// Now, to ensure we don't butcher the string we need to remove using runes.
	r := []rune(s)
	truncationTarget := n - 3

	// Next, let's truncate the runes to the lower possible number.
	truncatedRunes := r[:truncationTarget]
	for len(string(truncatedRunes)) > truncationTarget {
		truncatedRunes = r[:len(truncatedRunes)-1]
	}

	return string(truncatedRunes) + truncationMarker, true
}

type extraDataKey int

const (
	ExtraDataKey extraDataKey = iota
)

func GetExtraDataFromContext(ctx context.Context) ([]json.RawMessage, bool) {
	v, ok := ctx.Value(ExtraDataKey).([]json.RawMessage)
	return v, ok
}
