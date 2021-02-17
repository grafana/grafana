package sigv4

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
	"github.com/aws/aws-sdk-go/private/protocol/rest"
)

type AuthType string

const (
	Default     AuthType = "default"
	Keys        AuthType = "keys"
	Credentials AuthType = "credentials"
)

// Host header is likely not necessary here
// (see https://github.com/golang/go/blob/cad6d1fef5147d31e94ee83934c8609d3ad150b7/src/net/http/request.go#L92)
// but adding for completeness
var permittedHeaders = map[string]struct{}{
	"Host":            {},
	"Uber-Trace-Id":   {},
	"User-Agent":      {},
	"Accept":          {},
	"Accept-Encoding": {},
}

type middleware struct {
	config *Config
	next   http.RoundTripper
}

type Config struct {
	AuthType string

	Profile string

	Service string

	AccessKey string
	SecretKey string

	AssumeRoleARN string
	ExternalID    string
	Region        string
}

// The RoundTripperFunc type is an adapter to allow the use of ordinary
// functions as RoundTrippers. If f is a function with the appropriate
// signature, RoundTripperFunc(f) is a RoundTripper that calls f.
type RoundTripperFunc func(req *http.Request) (*http.Response, error)

// RoundTrip implements the RoundTripper interface.
func (rt RoundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return rt(r)
}

// New instantiates a new signing middleware with an optional succeeding
// middleware. The http.DefaultTransport will be used if nil
func New(config *Config, next http.RoundTripper) http.RoundTripper {
	return RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
		if next == nil {
			next = http.DefaultTransport
		}
		return (&middleware{
			config: config,
			next:   next,
		}).exec(r)
	})
}

func (m *middleware) exec(req *http.Request) (*http.Response, error) {
	_, err := m.signRequest(req)
	if err != nil {
		return nil, err
	}

	return m.next.RoundTrip(req)
}

func (m *middleware) signRequest(req *http.Request) (http.Header, error) {
	signer, err := m.signer()
	if err != nil {
		return nil, err
	}

	body, err := replaceBody(req)
	if err != nil {
		return nil, err
	}

	if strings.Contains(req.URL.RawPath, "%2C") {
		req.URL.RawPath = rest.EscapePath(req.URL.RawPath, false)
	}

	stripHeaders(req)

	return signer.Sign(req, bytes.NewReader(body), m.config.Service, m.config.Region, time.Now().UTC())
}

func (m *middleware) signer() (*v4.Signer, error) {
	authType := AuthType(m.config.AuthType)

	var c *credentials.Credentials
	switch authType {
	case Keys:
		c = credentials.NewStaticCredentials(m.config.AccessKey, m.config.SecretKey, "")
	case Credentials:
		c = credentials.NewSharedCredentials("", m.config.Profile)
	case Default:
		// passing nil credentials will force AWS to allow a more complete credential chain vs the explicit default
		s, err := session.NewSession(&aws.Config{
			Region: aws.String(m.config.Region),
		})
		if err != nil {
			return nil, err
		}

		if m.config.AssumeRoleARN != "" {
			return v4.NewSigner(stscreds.NewCredentials(s, m.config.AssumeRoleARN)), nil
		}

		return v4.NewSigner(s.Config.Credentials), nil
	case "":
		return nil, fmt.Errorf("invalid SigV4 auth type")
	}

	if m.config.AssumeRoleARN != "" {
		s, err := session.NewSession(&aws.Config{
			Region:      aws.String(m.config.Region),
			Credentials: c},
		)
		if err != nil {
			return nil, err
		}
		return v4.NewSigner(stscreds.NewCredentials(s, m.config.AssumeRoleARN)), nil
	}

	return v4.NewSigner(c), nil
}

func replaceBody(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return []byte{}, nil
	}
	payload, err := ioutil.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	req.Body = ioutil.NopCloser(bytes.NewReader(payload))
	return payload, nil
}

func stripHeaders(req *http.Request) {
	for h := range req.Header {
		if _, exists := permittedHeaders[h]; !exists {
			req.Header.Del(h)
		}
	}
}
