// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package client

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"net/http/httputil"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/opentracing/opentracing-go"

	"github.com/go-openapi/runtime"
	"github.com/go-openapi/runtime/logger"
	"github.com/go-openapi/runtime/middleware"
	"github.com/go-openapi/runtime/yamlpc"
)

const (
	schemeHTTP  = "http"
	schemeHTTPS = "https"
)

// TLSClientOptions to configure client authentication with mutual TLS
type TLSClientOptions struct {
	// Certificate is the path to a PEM-encoded certificate to be used for
	// client authentication. If set then Key must also be set.
	Certificate string

	// LoadedCertificate is the certificate to be used for client authentication.
	// This field is ignored if Certificate is set. If this field is set, LoadedKey
	// is also required.
	LoadedCertificate *x509.Certificate

	// Key is the path to an unencrypted PEM-encoded private key for client
	// authentication. This field is required if Certificate is set.
	Key string

	// LoadedKey is the key for client authentication. This field is required if
	// LoadedCertificate is set.
	LoadedKey crypto.PrivateKey

	// CA is a path to a PEM-encoded certificate that specifies the root certificate
	// to use when validating the TLS certificate presented by the server. If this field
	// (and LoadedCA) is not set, the system certificate pool is used. This field is ignored if LoadedCA
	// is set.
	CA string

	// LoadedCA specifies the root certificate to use when validating the server's TLS certificate.
	// If this field (and CA) is not set, the system certificate pool is used.
	LoadedCA *x509.Certificate

	// LoadedCAPool specifies a pool of RootCAs to use when validating the server's TLS certificate.
	// If set, it will be combined with the other loaded certificates (see LoadedCA and CA).
	// If neither LoadedCA or CA is set, the provided pool with override the system
	// certificate pool.
	// The caller must not use the supplied pool after calling TLSClientAuth.
	LoadedCAPool *x509.CertPool

	// ServerName specifies the hostname to use when verifying the server certificate.
	// If this field is set then InsecureSkipVerify will be ignored and treated as
	// false.
	ServerName string

	// InsecureSkipVerify controls whether the certificate chain and hostname presented
	// by the server are validated. If true, any certificate is accepted.
	InsecureSkipVerify bool

	// VerifyPeerCertificate, if not nil, is called after normal
	// certificate verification. It receives the raw ASN.1 certificates
	// provided by the peer and also any verified chains that normal processing found.
	// If it returns a non-nil error, the handshake is aborted and that error results.
	//
	// If normal verification fails then the handshake will abort before
	// considering this callback. If normal verification is disabled by
	// setting InsecureSkipVerify then this callback will be considered but
	// the verifiedChains argument will always be nil.
	VerifyPeerCertificate func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error

	// SessionTicketsDisabled may be set to true to disable session ticket and
	// PSK (resumption) support. Note that on clients, session ticket support is
	// also disabled if ClientSessionCache is nil.
	SessionTicketsDisabled bool

	// ClientSessionCache is a cache of ClientSessionState entries for TLS
	// session resumption. It is only used by clients.
	ClientSessionCache tls.ClientSessionCache

	// Prevents callers using unkeyed fields.
	_ struct{}
}

// TLSClientAuth creates a tls.Config for mutual auth
func TLSClientAuth(opts TLSClientOptions) (*tls.Config, error) {
	// create client tls config
	cfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	// load client cert if specified
	if opts.Certificate != "" {
		cert, err := tls.LoadX509KeyPair(opts.Certificate, opts.Key)
		if err != nil {
			return nil, fmt.Errorf("tls client cert: %v", err)
		}
		cfg.Certificates = []tls.Certificate{cert}
	} else if opts.LoadedCertificate != nil {
		block := pem.Block{Type: "CERTIFICATE", Bytes: opts.LoadedCertificate.Raw}
		certPem := pem.EncodeToMemory(&block)

		var keyBytes []byte
		switch k := opts.LoadedKey.(type) {
		case *rsa.PrivateKey:
			keyBytes = x509.MarshalPKCS1PrivateKey(k)
		case *ecdsa.PrivateKey:
			var err error
			keyBytes, err = x509.MarshalECPrivateKey(k)
			if err != nil {
				return nil, fmt.Errorf("tls client priv key: %v", err)
			}
		default:
			return nil, errors.New("tls client priv key: unsupported key type")
		}

		block = pem.Block{Type: "PRIVATE KEY", Bytes: keyBytes}
		keyPem := pem.EncodeToMemory(&block)

		cert, err := tls.X509KeyPair(certPem, keyPem)
		if err != nil {
			return nil, fmt.Errorf("tls client cert: %v", err)
		}
		cfg.Certificates = []tls.Certificate{cert}
	}

	cfg.InsecureSkipVerify = opts.InsecureSkipVerify

	cfg.VerifyPeerCertificate = opts.VerifyPeerCertificate
	cfg.SessionTicketsDisabled = opts.SessionTicketsDisabled
	cfg.ClientSessionCache = opts.ClientSessionCache

	// When no CA certificate is provided, default to the system cert pool
	// that way when a request is made to a server known by the system trust store,
	// the name is still verified
	switch {
	case opts.LoadedCA != nil:
		caCertPool := basePool(opts.LoadedCAPool)
		caCertPool.AddCert(opts.LoadedCA)
		cfg.RootCAs = caCertPool
	case opts.CA != "":
		// load ca cert
		caCert, err := os.ReadFile(opts.CA)
		if err != nil {
			return nil, fmt.Errorf("tls client ca: %v", err)
		}
		caCertPool := basePool(opts.LoadedCAPool)
		caCertPool.AppendCertsFromPEM(caCert)
		cfg.RootCAs = caCertPool
	case opts.LoadedCAPool != nil:
		cfg.RootCAs = opts.LoadedCAPool
	}

	// apply servername overrride
	if opts.ServerName != "" {
		cfg.InsecureSkipVerify = false
		cfg.ServerName = opts.ServerName
	}

	return cfg, nil
}

func basePool(pool *x509.CertPool) *x509.CertPool {
	if pool == nil {
		return x509.NewCertPool()
	}
	return pool
}

// TLSTransport creates a http client transport suitable for mutual tls auth
func TLSTransport(opts TLSClientOptions) (http.RoundTripper, error) {
	cfg, err := TLSClientAuth(opts)
	if err != nil {
		return nil, err
	}

	return &http.Transport{TLSClientConfig: cfg}, nil
}

// TLSClient creates a http.Client for mutual auth
func TLSClient(opts TLSClientOptions) (*http.Client, error) {
	transport, err := TLSTransport(opts)
	if err != nil {
		return nil, err
	}
	return &http.Client{Transport: transport}, nil
}

// DefaultTimeout the default request timeout
var DefaultTimeout = 30 * time.Second

// Runtime represents an API client that uses the transport
// to make http requests based on a swagger specification.
type Runtime struct {
	DefaultMediaType      string
	DefaultAuthentication runtime.ClientAuthInfoWriter
	Consumers             map[string]runtime.Consumer
	Producers             map[string]runtime.Producer

	Transport http.RoundTripper
	Jar       http.CookieJar
	// Spec      *spec.Document
	Host     string
	BasePath string
	Formats  strfmt.Registry
	Context  context.Context //nolint:containedctx  // we precisely want this type to contain the request context

	Debug  bool
	logger logger.Logger

	clientOnce *sync.Once
	client     *http.Client
	schemes    []string
	response   ClientResponseFunc
}

// New creates a new default runtime for a swagger api runtime.Client
func New(host, basePath string, schemes []string) *Runtime {
	var rt Runtime
	rt.DefaultMediaType = runtime.JSONMime

	// TODO: actually infer this stuff from the spec
	rt.Consumers = map[string]runtime.Consumer{
		runtime.YAMLMime:    yamlpc.YAMLConsumer(),
		runtime.JSONMime:    runtime.JSONConsumer(),
		runtime.XMLMime:     runtime.XMLConsumer(),
		runtime.TextMime:    runtime.TextConsumer(),
		runtime.HTMLMime:    runtime.TextConsumer(),
		runtime.CSVMime:     runtime.CSVConsumer(),
		runtime.DefaultMime: runtime.ByteStreamConsumer(),
	}
	rt.Producers = map[string]runtime.Producer{
		runtime.YAMLMime:    yamlpc.YAMLProducer(),
		runtime.JSONMime:    runtime.JSONProducer(),
		runtime.XMLMime:     runtime.XMLProducer(),
		runtime.TextMime:    runtime.TextProducer(),
		runtime.HTMLMime:    runtime.TextProducer(),
		runtime.CSVMime:     runtime.CSVProducer(),
		runtime.DefaultMime: runtime.ByteStreamProducer(),
	}
	rt.Transport = http.DefaultTransport
	rt.Jar = nil
	rt.Host = host
	rt.BasePath = basePath
	rt.Context = context.Background()
	rt.clientOnce = new(sync.Once)
	if !strings.HasPrefix(rt.BasePath, "/") {
		rt.BasePath = "/" + rt.BasePath
	}

	rt.Debug = logger.DebugEnabled()
	rt.logger = logger.StandardLogger{}
	rt.response = newResponse

	if len(schemes) > 0 {
		rt.schemes = schemes
	}
	return &rt
}

// NewWithClient allows you to create a new transport with a configured http.Client
func NewWithClient(host, basePath string, schemes []string, client *http.Client) *Runtime {
	rt := New(host, basePath, schemes)
	if client != nil {
		rt.clientOnce.Do(func() {
			rt.client = client
		})
	}
	return rt
}

// WithOpenTracing adds opentracing support to the provided runtime.
// A new client span is created for each request.
// If the context of the client operation does not contain an active span, no span is created.
// The provided opts are applied to each spans - for example to add global tags.
func (r *Runtime) WithOpenTracing(opts ...opentracing.StartSpanOption) runtime.ClientTransport {
	return newOpenTracingTransport(r, r.Host, opts)
}

// WithOpenTelemetry adds opentelemetry support to the provided runtime.
// A new client span is created for each request.
// If the context of the client operation does not contain an active span, no span is created.
// The provided opts are applied to each spans - for example to add global tags.
func (r *Runtime) WithOpenTelemetry(opts ...OpenTelemetryOpt) runtime.ClientTransport {
	return newOpenTelemetryTransport(r, r.Host, opts)
}

func (r *Runtime) pickScheme(schemes []string) string {
	if v := r.selectScheme(r.schemes); v != "" {
		return v
	}
	if v := r.selectScheme(schemes); v != "" {
		return v
	}
	return schemeHTTP
}

func (r *Runtime) selectScheme(schemes []string) string {
	schLen := len(schemes)
	if schLen == 0 {
		return ""
	}

	scheme := schemes[0]
	// prefer https, but skip when not possible
	if scheme != schemeHTTPS && schLen > 1 {
		for _, sch := range schemes {
			if sch == schemeHTTPS {
				scheme = sch
				break
			}
		}
	}
	return scheme
}

func transportOrDefault(left, right http.RoundTripper) http.RoundTripper {
	if left == nil {
		return right
	}
	return left
}

// EnableConnectionReuse drains the remaining body from a response
// so that go will reuse the TCP connections.
//
// This is not enabled by default because there are servers where
// the response never gets closed and that would make the code hang forever.
// So instead it's provided as a http client middleware that can be used to override
// any request.
func (r *Runtime) EnableConnectionReuse() {
	if r.client == nil {
		r.Transport = KeepAliveTransport(
			transportOrDefault(r.Transport, http.DefaultTransport),
		)
		return
	}

	r.client.Transport = KeepAliveTransport(
		transportOrDefault(r.client.Transport,
			transportOrDefault(r.Transport, http.DefaultTransport),
		),
	)
}

// takes a client operation and creates equivalent http.Request
func (r *Runtime) createHttpRequest(operation *runtime.ClientOperation) (*request, *http.Request, error) { //nolint:revive,stylecheck
	params, _, auth := operation.Params, operation.Reader, operation.AuthInfo

	request := newRequest(operation.Method, operation.PathPattern, params)

	var accept []string
	accept = append(accept, operation.ProducesMediaTypes...)
	if err := request.SetHeaderParam(runtime.HeaderAccept, accept...); err != nil {
		return nil, nil, err
	}

	if auth == nil && r.DefaultAuthentication != nil {
		auth = runtime.ClientAuthInfoWriterFunc(func(req runtime.ClientRequest, reg strfmt.Registry) error {
			if req.GetHeaderParams().Get(runtime.HeaderAuthorization) != "" {
				return nil
			}
			return r.DefaultAuthentication.AuthenticateRequest(req, reg)
		})
	}
	// if auth != nil {
	//	if err := auth.AuthenticateRequest(request, r.Formats); err != nil {
	//		return nil, err
	//	}
	//}

	// TODO: pick appropriate media type
	cmt := r.DefaultMediaType
	for _, mediaType := range operation.ConsumesMediaTypes {
		// Pick first non-empty media type
		if mediaType != "" {
			cmt = mediaType
			break
		}
	}

	if _, ok := r.Producers[cmt]; !ok && cmt != runtime.MultipartFormMime && cmt != runtime.URLencodedFormMime {
		return nil, nil, fmt.Errorf("none of producers: %v registered. try %s", r.Producers, cmt)
	}

	req, err := request.buildHTTP(cmt, r.BasePath, r.Producers, r.Formats, auth)
	if err != nil {
		return nil, nil, err
	}
	req.URL.Scheme = r.pickScheme(operation.Schemes)
	req.URL.Host = r.Host
	req.Host = r.Host
	return request, req, nil
}

func (r *Runtime) CreateHttpRequest(operation *runtime.ClientOperation) (req *http.Request, err error) { //nolint:revive,stylecheck
	_, req, err = r.createHttpRequest(operation)
	return
}

// Submit a request and when there is a body on success it will turn that into the result
// all other things are turned into an api error for swagger which retains the status code
func (r *Runtime) Submit(operation *runtime.ClientOperation) (interface{}, error) {
	_, readResponse, _ := operation.Params, operation.Reader, operation.AuthInfo

	request, req, err := r.createHttpRequest(operation)
	if err != nil {
		return nil, err
	}

	r.clientOnce.Do(func() {
		r.client = &http.Client{
			Transport: r.Transport,
			Jar:       r.Jar,
		}
	})

	if r.Debug {
		b, err2 := httputil.DumpRequestOut(req, true)
		if err2 != nil {
			return nil, err2
		}
		r.logger.Debugf("%s\n", string(b))
	}

	var parentCtx context.Context
	switch {
	case operation.Context != nil:
		parentCtx = operation.Context
	case r.Context != nil:
		parentCtx = r.Context
	default:
		parentCtx = context.Background()
	}

	var (
		ctx    context.Context
		cancel context.CancelFunc
	)
	if request.timeout == 0 {
		// There may be a deadline in the context passed to the operation.
		// Otherwise, there is no timeout set.
		ctx, cancel = context.WithCancel(parentCtx)
	} else {
		// Sets the timeout passed from request params (by default runtime.DefaultTimeout).
		// If there is already a deadline in the parent context, the shortest will
		// apply.
		ctx, cancel = context.WithTimeout(parentCtx, request.timeout)
	}
	defer cancel()

	var client *http.Client
	if operation.Client != nil {
		client = operation.Client
	} else {
		client = r.client
	}
	req = req.WithContext(ctx)
	res, err := client.Do(req) // make requests, by default follows 10 redirects before failing
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	ct := res.Header.Get(runtime.HeaderContentType)
	if ct == "" { // this should really never occur
		ct = r.DefaultMediaType
	}

	if r.Debug {
		printBody := true
		if ct == runtime.DefaultMime {
			printBody = false // Spare the terminal from a binary blob.
		}
		b, err2 := httputil.DumpResponse(res, printBody)
		if err2 != nil {
			return nil, err2
		}
		r.logger.Debugf("%s\n", string(b))
	}

	mt, _, err := mime.ParseMediaType(ct)
	if err != nil {
		return nil, fmt.Errorf("parse content type: %s", err)
	}

	cons, ok := r.Consumers[mt]
	if !ok {
		if cons, ok = r.Consumers["*/*"]; !ok {
			// scream about not knowing what to do
			return nil, fmt.Errorf("no consumer: %q", ct)
		}
	}
	return readResponse.ReadResponse(r.response(res), cons)
}

// SetDebug changes the debug flag.
// It ensures that client and middlewares have the set debug level.
func (r *Runtime) SetDebug(debug bool) {
	r.Debug = debug
	middleware.Debug = debug
}

// SetLogger changes the logger stream.
// It ensures that client and middlewares use the same logger.
func (r *Runtime) SetLogger(logger logger.Logger) {
	r.logger = logger
	middleware.Logger = logger
}

type ClientResponseFunc = func(*http.Response) runtime.ClientResponse //nolint:revive

// SetResponseReader changes the response reader implementation.
func (r *Runtime) SetResponseReader(f ClientResponseFunc) {
	if f == nil {
		return
	}
	r.response = f
}
