// Copyright 2015 Google LLC.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package http supports network connections to HTTP servers.
// This package is not intended for use by end developers. Use the
// google.golang.org/api/option package to configure API clients.
package http

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials"
	"cloud.google.com/go/auth/httptransport"
	"cloud.google.com/go/auth/oauth2adapt"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"golang.org/x/net/http2"
	"golang.org/x/oauth2"
	"google.golang.org/api/googleapi/transport"
	"google.golang.org/api/internal"
	"google.golang.org/api/internal/cert"
	"google.golang.org/api/option"
)

// NewClient returns an HTTP client for use communicating with a Google cloud
// service, configured with the given ClientOptions. It also returns the endpoint
// for the service as specified in the options.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*http.Client, string, error) {
	settings, err := newSettings(opts)
	if err != nil {
		return nil, "", err
	}
	clientCertSource, dialTLSContext, endpoint, err := internal.GetHTTPTransportConfigAndEndpoint(settings)
	if err != nil {
		return nil, "", err
	}
	// TODO(cbro): consider injecting the User-Agent even if an explicit HTTP client is provided?
	if settings.HTTPClient != nil {
		return settings.HTTPClient, endpoint, nil
	}

	if settings.IsNewAuthLibraryEnabled() {
		client, err := newClientNewAuth(ctx, nil, settings)
		if err != nil {
			return nil, "", err
		}
		return client, endpoint, nil
	}
	trans, err := newTransport(ctx, defaultBaseTransport(ctx, clientCertSource, dialTLSContext), settings)
	if err != nil {
		return nil, "", err
	}
	return &http.Client{Transport: trans}, endpoint, nil
}

// newClientNewAuth is an adapter to call new auth library.
func newClientNewAuth(ctx context.Context, base http.RoundTripper, ds *internal.DialSettings) (*http.Client, error) {
	// honor options if set
	var creds *auth.Credentials
	if ds.InternalCredentials != nil {
		creds = oauth2adapt.AuthCredentialsFromOauth2Credentials(ds.InternalCredentials)
	} else if ds.Credentials != nil {
		creds = oauth2adapt.AuthCredentialsFromOauth2Credentials(ds.Credentials)
	} else if ds.AuthCredentials != nil {
		creds = ds.AuthCredentials
	} else if ds.TokenSource != nil {
		credOpts := &auth.CredentialsOptions{
			TokenProvider: oauth2adapt.TokenProviderFromTokenSource(ds.TokenSource),
		}
		if ds.QuotaProject != "" {
			credOpts.QuotaProjectIDProvider = auth.CredentialsPropertyFunc(func(ctx context.Context) (string, error) {
				return ds.QuotaProject, nil
			})
		}
		creds = auth.NewCredentials(credOpts)
	}

	var skipValidation bool
	// If our clients explicitly setup the credential skip validation as it is
	// assumed correct
	if ds.SkipValidation || ds.InternalCredentials != nil {
		skipValidation = true
	}

	// Defaults for older clients that don't set this value yet
	defaultEndpointTemplate := ds.DefaultEndpointTemplate
	if defaultEndpointTemplate == "" {
		defaultEndpointTemplate = ds.DefaultEndpoint
	}

	var aud string
	if len(ds.Audiences) > 0 {
		aud = ds.Audiences[0]
	}
	headers := http.Header{}
	if ds.QuotaProject != "" {
		headers.Set("X-goog-user-project", ds.QuotaProject)
	}
	if ds.RequestReason != "" {
		headers.Set("X-goog-request-reason", ds.RequestReason)
	}
	if ds.UserAgent != "" {
		headers.Set("User-Agent", ds.UserAgent)
	}
	client, err := httptransport.NewClient(&httptransport.Options{
		DisableTelemetry:      ds.TelemetryDisabled,
		DisableAuthentication: ds.NoAuth,
		Headers:               headers,
		Endpoint:              ds.Endpoint,
		APIKey:                ds.APIKey,
		Credentials:           creds,
		ClientCertProvider:    ds.ClientCertSource,
		BaseRoundTripper:      base,
		DetectOpts: &credentials.DetectOptions{
			Scopes:          ds.Scopes,
			Audience:        aud,
			CredentialsFile: ds.CredentialsFile,
			CredentialsJSON: ds.CredentialsJSON,
			Logger:          ds.Logger,
		},
		InternalOptions: &httptransport.InternalOptions{
			EnableJWTWithScope:      ds.EnableJwtWithScope,
			DefaultAudience:         ds.DefaultAudience,
			DefaultEndpointTemplate: defaultEndpointTemplate,
			DefaultMTLSEndpoint:     ds.DefaultMTLSEndpoint,
			DefaultScopes:           ds.DefaultScopes,
			SkipValidation:          skipValidation,
		},
		UniverseDomain: ds.UniverseDomain,
		Logger:         ds.Logger,
	})
	if err != nil {
		return nil, err
	}
	return client, nil
}

// NewTransport creates an http.RoundTripper for use communicating with a Google
// cloud service, configured with the given ClientOptions. Its RoundTrip method delegates to base.
func NewTransport(ctx context.Context, base http.RoundTripper, opts ...option.ClientOption) (http.RoundTripper, error) {
	settings, err := newSettings(opts)
	if err != nil {
		return nil, err
	}
	if settings.HTTPClient != nil {
		return nil, errors.New("transport/http: WithHTTPClient passed to NewTransport")
	}
	if settings.IsNewAuthLibraryEnabled() {
		client, err := newClientNewAuth(ctx, base, settings)
		if err != nil {
			return nil, err
		}
		return client.Transport, nil
	}
	return newTransport(ctx, base, settings)
}

func newTransport(ctx context.Context, base http.RoundTripper, settings *internal.DialSettings) (http.RoundTripper, error) {
	paramTransport := &parameterTransport{
		base:          base,
		userAgent:     settings.UserAgent,
		requestReason: settings.RequestReason,
	}
	var trans http.RoundTripper = paramTransport
	trans = addOpenTelemetryTransport(trans, settings)
	switch {
	case settings.NoAuth:
		// Do nothing.
	case settings.APIKey != "":
		paramTransport.quotaProject = internal.GetQuotaProject(nil, settings.QuotaProject)
		trans = &transport.APIKey{
			Transport: trans,
			Key:       settings.APIKey,
		}
	default:
		creds, err := internal.Creds(ctx, settings)
		if err != nil {
			return nil, err
		}
		paramTransport.quotaProject = internal.GetQuotaProject(creds, settings.QuotaProject)
		ts := creds.TokenSource
		if settings.ImpersonationConfig == nil && settings.TokenSource != nil {
			ts = settings.TokenSource
		}
		trans = &oauth2.Transport{
			Base:   trans,
			Source: ts,
		}
	}
	return trans, nil
}

func newSettings(opts []option.ClientOption) (*internal.DialSettings, error) {
	var o internal.DialSettings
	for _, opt := range opts {
		opt.Apply(&o)
	}
	if err := o.Validate(); err != nil {
		return nil, err
	}
	if o.GRPCConn != nil {
		return nil, errors.New("unsupported gRPC connection specified")
	}
	return &o, nil
}

type parameterTransport struct {
	userAgent     string
	quotaProject  string
	requestReason string

	base http.RoundTripper
}

func (t *parameterTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	rt := t.base
	if rt == nil {
		return nil, errors.New("transport: no Transport specified")
	}
	newReq := *req
	newReq.Header = make(http.Header)
	for k, vv := range req.Header {
		newReq.Header[k] = vv
	}
	if t.userAgent != "" {
		// TODO(cbro): append to existing User-Agent header?
		newReq.Header.Set("User-Agent", t.userAgent)
	}

	// Attach system parameters into the header
	if t.quotaProject != "" {
		newReq.Header.Set("X-Goog-User-Project", t.quotaProject)
	}
	if t.requestReason != "" {
		newReq.Header.Set("X-Goog-Request-Reason", t.requestReason)
	}

	return rt.RoundTrip(&newReq)
}

// defaultBaseTransport returns the base HTTP transport. It uses a default
// transport, taking most defaults from http.DefaultTransport.
// If TLSCertificate is available, set TLSClientConfig as well.
func defaultBaseTransport(ctx context.Context, clientCertSource cert.Source, dialTLSContext func(context.Context, string, string) (net.Conn, error)) http.RoundTripper {
	// Copy http.DefaultTransport except for MaxIdleConnsPerHost setting,
	// which is increased due to reported performance issues under load in the
	// GCS client. Transport.Clone is only available in Go 1.13 and up.
	trans := clonedTransport(http.DefaultTransport)
	if trans == nil {
		trans = fallbackBaseTransport()
	}
	trans.MaxIdleConnsPerHost = 100

	if clientCertSource != nil {
		trans.TLSClientConfig = &tls.Config{
			GetClientCertificate: clientCertSource,
		}
	}
	if dialTLSContext != nil {
		// If DialTLSContext is set, TLSClientConfig wil be ignored
		trans.DialTLSContext = dialTLSContext
	}

	configureHTTP2(trans)

	return trans
}

// configureHTTP2 configures the ReadIdleTimeout HTTP/2 option for the
// transport. This allows broken idle connections to be pruned more quickly,
// preventing the client from attempting to re-use connections that will no
// longer work.
func configureHTTP2(trans *http.Transport) {
	http2Trans, err := http2.ConfigureTransports(trans)
	if err == nil {
		http2Trans.ReadIdleTimeout = time.Second * 31
	}
}

// fallbackBaseTransport is used in <go1.13 as well as in the rare case if
// http.DefaultTransport has been reassigned something that's not a
// *http.Transport.
func fallbackBaseTransport() *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).DialContext,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}

func addOpenTelemetryTransport(trans http.RoundTripper, settings *internal.DialSettings) http.RoundTripper {
	if settings.TelemetryDisabled {
		return trans
	}
	return otelhttp.NewTransport(trans)
}

// clonedTransport returns the given RoundTripper as a cloned *http.Transport.
// It returns nil if the RoundTripper can't be cloned or coerced to
// *http.Transport.
func clonedTransport(rt http.RoundTripper) *http.Transport {
	t, ok := rt.(*http.Transport)
	if !ok {
		return nil
	}
	return t.Clone()
}
