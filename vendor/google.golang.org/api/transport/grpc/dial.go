// Copyright 2015 Google LLC.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package grpc supports network connections to GRPC servers.
// This package is not intended for use by end developers. Use the
// google.golang.org/api/option package to configure API clients.
package grpc

import (
	"context"
	"errors"
	"log"
	"net"
	"os"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials"
	"cloud.google.com/go/auth/grpctransport"
	"cloud.google.com/go/auth/oauth2adapt"
	"cloud.google.com/go/compute/metadata"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"golang.org/x/oauth2"
	"golang.org/x/time/rate"
	"google.golang.org/api/internal"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	grpcgoogle "google.golang.org/grpc/credentials/google"
	grpcinsecure "google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/credentials/oauth"
	"google.golang.org/grpc/stats"

	// Install grpclb, which is required for direct path.
	_ "google.golang.org/grpc/balancer/grpclb"
)

// Check env to disable DirectPath traffic.
const disableDirectPath = "GOOGLE_CLOUD_DISABLE_DIRECT_PATH"

// Check env to decide if using google-c2p resolver for DirectPath traffic.
const enableDirectPathXds = "GOOGLE_CLOUD_ENABLE_DIRECT_PATH_XDS"

// Set at init time by dial_socketopt.go. If nil, socketopt is not supported.
var timeoutDialerOption grpc.DialOption

// Log rate limiter
var logRateLimiter = rate.Sometimes{Interval: 1 * time.Second}

// Assign to var for unit test replacement
var dialContext = grpc.DialContext

// Assign to var for unit test replacement
var dialContextNewAuth = grpctransport.Dial

// otelStatsHandler is a singleton otelgrpc.clientHandler to be used across
// all dial connections to avoid the memory leak documented in
// https://github.com/open-telemetry/opentelemetry-go-contrib/issues/4226
//
// TODO: If 4226 has been fixed in opentelemetry-go-contrib, replace this
// singleton with inline usage for simplicity.
var (
	initOtelStatsHandlerOnce sync.Once
	otelStatsHandler         stats.Handler
)

// otelGRPCStatsHandler returns singleton otelStatsHandler for reuse across all
// dial connections.
func otelGRPCStatsHandler() stats.Handler {
	initOtelStatsHandlerOnce.Do(func() {
		otelStatsHandler = otelgrpc.NewClientHandler()
	})
	return otelStatsHandler
}

// Dial returns a GRPC connection for use communicating with a Google cloud
// service, configured with the given ClientOptions.
func Dial(ctx context.Context, opts ...option.ClientOption) (*grpc.ClientConn, error) {
	o, err := processAndValidateOpts(opts)
	if err != nil {
		return nil, err
	}
	if o.GRPCConnPool != nil {
		return o.GRPCConnPool.Conn(), nil
	}
	if o.IsNewAuthLibraryEnabled() {
		pool, err := dialPoolNewAuth(ctx, true, 1, o)
		if err != nil {
			return nil, err
		}
		return pool.Connection(), nil
	}
	// NOTE(cbro): We removed support for option.WithGRPCConnPool (GRPCConnPoolSize)
	// on 2020-02-12 because RoundRobin and WithBalancer are deprecated and we need to remove usages of it.
	//
	// Connection pooling is only done via DialPool.
	return dial(ctx, false, o)
}

// DialInsecure returns an insecure GRPC connection for use communicating
// with fake or mock Google cloud service implementations, such as emulators.
// The connection is configured with the given ClientOptions.
func DialInsecure(ctx context.Context, opts ...option.ClientOption) (*grpc.ClientConn, error) {
	o, err := processAndValidateOpts(opts)
	if err != nil {
		return nil, err
	}
	if o.IsNewAuthLibraryEnabled() {
		pool, err := dialPoolNewAuth(ctx, false, 1, o)
		if err != nil {
			return nil, err
		}
		return pool.Connection(), nil
	}
	return dial(ctx, true, o)
}

// DialPool returns a pool of GRPC connections for the given service.
// This differs from the connection pooling implementation used by Dial, which uses a custom GRPC load balancer.
// DialPool should be used instead of Dial when a pool is used by default or a different custom GRPC load balancer is needed.
// The context and options are shared between each Conn in the pool.
// The pool size is configured using the WithGRPCConnectionPool option.
//
// This API is subject to change as we further refine requirements. It will go away if gRPC stubs accept an interface instead of the concrete ClientConn type. See https://github.com/grpc/grpc-go/issues/1287.
func DialPool(ctx context.Context, opts ...option.ClientOption) (ConnPool, error) {
	o, err := processAndValidateOpts(opts)
	if err != nil {
		return nil, err
	}
	if o.GRPCConnPool != nil {
		return o.GRPCConnPool, nil
	}

	if o.IsNewAuthLibraryEnabled() {
		if o.GRPCConn != nil {
			return &singleConnPool{o.GRPCConn}, nil
		}
		pool, err := dialPoolNewAuth(ctx, true, o.GRPCConnPoolSize, o)
		if err != nil {
			return nil, err
		}
		return &poolAdapter{pool}, nil
	}

	poolSize := o.GRPCConnPoolSize
	if o.GRPCConn != nil {
		// WithGRPCConn is technically incompatible with WithGRPCConnectionPool.
		// Always assume pool size is 1 when a grpc.ClientConn is explicitly used.
		poolSize = 1
	}
	o.GRPCConnPoolSize = 0 // we don't *need* to set this to zero, but it's safe to.

	if poolSize == 0 || poolSize == 1 {
		// Fast path for common case for a connection pool with a single connection.
		conn, err := dial(ctx, false, o)
		if err != nil {
			return nil, err
		}
		return &singleConnPool{conn}, nil
	}

	pool := &roundRobinConnPool{}
	for i := 0; i < poolSize; i++ {
		conn, err := dial(ctx, false, o)
		if err != nil {
			defer pool.Close() // NOTE: error from Close is ignored.
			return nil, err
		}
		pool.conns = append(pool.conns, conn)
	}
	return pool, nil
}

// dialPoolNewAuth is an adapter to call new auth library.
func dialPoolNewAuth(ctx context.Context, secure bool, poolSize int, ds *internal.DialSettings) (grpctransport.GRPCClientConnPool, error) {
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

	var aud string
	if len(ds.Audiences) > 0 {
		aud = ds.Audiences[0]
	}
	metadata := map[string]string{}
	if ds.QuotaProject != "" {
		metadata["X-goog-user-project"] = ds.QuotaProject
	}
	if ds.RequestReason != "" {
		metadata["X-goog-request-reason"] = ds.RequestReason
	}

	// Defaults for older clients that don't set this value yet
	defaultEndpointTemplate := ds.DefaultEndpointTemplate
	if defaultEndpointTemplate == "" {
		defaultEndpointTemplate = ds.DefaultEndpoint
	}

	pool, err := dialContextNewAuth(ctx, secure, &grpctransport.Options{
		DisableTelemetry:      ds.TelemetryDisabled,
		DisableAuthentication: ds.NoAuth,
		Endpoint:              ds.Endpoint,
		Metadata:              metadata,
		GRPCDialOpts:          prepareDialOptsNewAuth(ds),
		PoolSize:              poolSize,
		Credentials:           creds,
		ClientCertProvider:    ds.ClientCertSource,
		APIKey:                ds.APIKey,
		DetectOpts: &credentials.DetectOptions{
			Scopes:          ds.Scopes,
			Audience:        aud,
			CredentialsFile: ds.CredentialsFile,
			CredentialsJSON: ds.CredentialsJSON,
			Logger:          ds.Logger,
		},
		InternalOptions: &grpctransport.InternalOptions{
			EnableNonDefaultSAForDirectPath: ds.AllowNonDefaultServiceAccount,
			EnableDirectPath:                ds.EnableDirectPath,
			EnableDirectPathXds:             ds.EnableDirectPathXds,
			EnableJWTWithScope:              ds.EnableJwtWithScope,
			AllowHardBoundTokens:            ds.AllowHardBoundTokens,
			DefaultAudience:                 ds.DefaultAudience,
			DefaultEndpointTemplate:         defaultEndpointTemplate,
			DefaultMTLSEndpoint:             ds.DefaultMTLSEndpoint,
			DefaultScopes:                   ds.DefaultScopes,
			SkipValidation:                  skipValidation,
		},
		UniverseDomain: ds.UniverseDomain,
		Logger:         ds.Logger,
	})
	return pool, err
}

func prepareDialOptsNewAuth(ds *internal.DialSettings) []grpc.DialOption {
	var opts []grpc.DialOption
	if ds.UserAgent != "" {
		opts = append(opts, grpc.WithUserAgent(ds.UserAgent))
	}

	return append(opts, ds.GRPCDialOpts...)
}

// dryRunAsync is a wrapper for oauth2.TokenSource that performs a sync refresh
// after an async refresh. Token generated by async refresh is not used.
//
// This is an EXPERIMENTAL feature and may be removed or changed in the future.
// It is a temporary struct to determine if the async refresh
// is working properly.
// TODO(b/372244283): Remove after b/358175516 has been fixed
type dryRunAsync struct {
	asyncTokenSource oauth2.TokenSource
	syncTokenSource  oauth2.TokenSource
	errHandler       func()
}

// TODO(b/372244283): Remove after b/358175516 has been fixed
func newDryRunAsync(ts oauth2.TokenSource, errHandler func()) dryRunAsync {
	tp := auth.NewCachedTokenProvider(oauth2adapt.TokenProviderFromTokenSource(ts), nil)
	asyncTs := oauth2adapt.TokenSourceFromTokenProvider(tp)
	return dryRunAsync{
		syncTokenSource:  ts,
		asyncTokenSource: asyncTs,
		errHandler:       errHandler,
	}
}

// Token returns a token or an error.
// TODO(b/372244283): Remove after b/358175516 has been fixed
func (async dryRunAsync) Token() (*oauth2.Token, error) {
	_, err := async.asyncTokenSource.Token()
	if err != nil {
		async.errHandler()
	}
	return async.syncTokenSource.Token()
}

func dial(ctx context.Context, insecure bool, o *internal.DialSettings) (*grpc.ClientConn, error) {
	if o.HTTPClient != nil {
		return nil, errors.New("unsupported HTTP client specified")
	}
	if o.GRPCConn != nil {
		return o.GRPCConn, nil
	}
	transportCreds, endpoint, err := internal.GetGRPCTransportConfigAndEndpoint(o)
	if err != nil {
		return nil, err
	}

	if insecure {
		transportCreds = grpcinsecure.NewCredentials()
	}

	// Initialize gRPC dial options with transport-level security options.
	grpcOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(transportCreds),
	}

	// Authentication can only be sent when communicating over a secure connection.
	//
	// TODO: Should we be more lenient in the future and allow sending credentials
	// when dialing an insecure connection?
	if !o.NoAuth && !insecure {
		if o.APIKey != "" {
			grpcOpts = append(grpcOpts, grpc.WithPerRPCCredentials(grpcAPIKey{
				apiKey:        o.APIKey,
				requestReason: o.RequestReason,
			}))
		} else {
			creds, err := internal.Creds(ctx, o)
			if err != nil {
				return nil, err
			}

			ts := creds.TokenSource
			// TODO(b/372244283): Remove after b/358175516 has been fixed
			if o.EnableAsyncRefreshDryRun != nil {
				ts = newDryRunAsync(ts, o.EnableAsyncRefreshDryRun)
			}
			grpcOpts = append(grpcOpts, grpc.WithPerRPCCredentials(grpcTokenSource{
				TokenSource:   oauth.TokenSource{TokenSource: ts},
				quotaProject:  internal.GetQuotaProject(creds, o.QuotaProject),
				requestReason: o.RequestReason,
			}))
			// Attempt Direct Path:
			logRateLimiter.Do(func() {
				logDirectPathMisconfig(endpoint, creds.TokenSource, o)
			})
			if isDirectPathEnabled(endpoint, o) && isTokenSourceDirectPathCompatible(creds.TokenSource, o) && metadata.OnGCE() {
				// Overwrite all of the previously specific DialOptions, DirectPath uses its own set of credentials and certificates.
				grpcOpts = []grpc.DialOption{
					grpc.WithCredentialsBundle(grpcgoogle.NewDefaultCredentialsWithOptions(
						grpcgoogle.DefaultCredentialsOptions{
							PerRPCCreds: oauth.TokenSource{TokenSource: creds.TokenSource},
						})),
				}
				if timeoutDialerOption != nil {
					grpcOpts = append(grpcOpts, timeoutDialerOption)
				}
				// Check if google-c2p resolver is enabled for DirectPath
				if isDirectPathXdsUsed(o) {
					// google-c2p resolver target must not have a port number
					if addr, _, err := net.SplitHostPort(endpoint); err == nil {
						endpoint = "google-c2p:///" + addr
					} else {
						endpoint = "google-c2p:///" + endpoint
					}
				} else {
					if !strings.HasPrefix(endpoint, "dns:///") {
						endpoint = "dns:///" + endpoint
					}
					grpcOpts = append(grpcOpts,
						// For now all DirectPath go clients will be using the following lb config, but in future
						// when different services need different configs, then we should change this to a
						// per-service config.
						grpc.WithDisableServiceConfig(),
						grpc.WithDefaultServiceConfig(`{"loadBalancingConfig":[{"grpclb":{"childPolicy":[{"pick_first":{}}]}}]}`))
				}
				// TODO(cbro): add support for system parameters (quota project, request reason) via chained interceptor.
			}
		}
	}

	// Add tracing, but before the other options, so that clients can override the
	// gRPC stats handler.
	// This assumes that gRPC options are processed in order, left to right.
	grpcOpts = addOpenTelemetryStatsHandler(grpcOpts, o)
	grpcOpts = append(grpcOpts, o.GRPCDialOpts...)
	if o.UserAgent != "" {
		grpcOpts = append(grpcOpts, grpc.WithUserAgent(o.UserAgent))
	}

	return dialContext(ctx, endpoint, grpcOpts...)
}

func addOpenTelemetryStatsHandler(opts []grpc.DialOption, settings *internal.DialSettings) []grpc.DialOption {
	if settings.TelemetryDisabled {
		return opts
	}
	return append(opts, grpc.WithStatsHandler(otelGRPCStatsHandler()))
}

// grpcTokenSource supplies PerRPCCredentials from an oauth.TokenSource.
type grpcTokenSource struct {
	oauth.TokenSource

	// Additional metadata attached as headers.
	quotaProject  string
	requestReason string
}

// GetRequestMetadata gets the request metadata as a map from a grpcTokenSource.
func (ts grpcTokenSource) GetRequestMetadata(ctx context.Context, uri ...string) (
	map[string]string, error) {
	metadata, err := ts.TokenSource.GetRequestMetadata(ctx, uri...)
	if err != nil {
		return nil, err
	}

	// Attach system parameter
	if ts.quotaProject != "" {
		metadata["X-goog-user-project"] = ts.quotaProject
	}
	if ts.requestReason != "" {
		metadata["X-goog-request-reason"] = ts.requestReason
	}
	return metadata, nil
}

// grpcAPIKey supplies PerRPCCredentials from an API Key.
type grpcAPIKey struct {
	apiKey string

	// Additional metadata attached as headers.
	requestReason string
}

// GetRequestMetadata gets the request metadata as a map from a grpcAPIKey.
func (ts grpcAPIKey) GetRequestMetadata(ctx context.Context, uri ...string) (
	map[string]string, error) {
	metadata := map[string]string{
		"X-goog-api-key": ts.apiKey,
	}
	if ts.requestReason != "" {
		metadata["X-goog-request-reason"] = ts.requestReason
	}
	return metadata, nil
}

// RequireTransportSecurity indicates whether the credentials requires transport security.
func (ts grpcAPIKey) RequireTransportSecurity() bool {
	return true
}

func isDirectPathEnabled(endpoint string, o *internal.DialSettings) bool {
	if !o.EnableDirectPath {
		return false
	}
	if !checkDirectPathEndPoint(endpoint) {
		return false
	}
	if strings.EqualFold(os.Getenv(disableDirectPath), "true") {
		return false
	}
	return true
}

func isDirectPathXdsUsed(o *internal.DialSettings) bool {
	// Method 1: Enable DirectPath xDS by env;
	if strings.EqualFold(os.Getenv(enableDirectPathXds), "true") {
		return true
	}
	// Method 2: Enable DirectPath xDS by option;
	if o.EnableDirectPathXds {
		return true
	}
	return false

}

func isTokenSourceDirectPathCompatible(ts oauth2.TokenSource, o *internal.DialSettings) bool {
	if ts == nil {
		return false
	}
	tok, err := ts.Token()
	if err != nil {
		return false
	}
	if tok == nil {
		return false
	}
	if o.AllowNonDefaultServiceAccount {
		return true
	}
	if source, _ := tok.Extra("oauth2.google.tokenSource").(string); source != "compute-metadata" {
		return false
	}
	if acct, _ := tok.Extra("oauth2.google.serviceAccount").(string); acct != "default" {
		return false
	}
	return true
}

func checkDirectPathEndPoint(endpoint string) bool {
	// Only [dns:///]host[:port] is supported, not other schemes (e.g., "tcp://" or "unix://").
	// Also don't try direct path if the user has chosen an alternate name resolver
	// (i.e., via ":///" prefix).
	//
	// TODO(cbro): once gRPC has introspectible options, check the user hasn't
	// provided a custom dialer in gRPC options.
	if strings.Contains(endpoint, "://") && !strings.HasPrefix(endpoint, "dns:///") {
		return false
	}

	if endpoint == "" {
		return false
	}

	return true
}

func logDirectPathMisconfig(endpoint string, ts oauth2.TokenSource, o *internal.DialSettings) {
	if isDirectPathXdsUsed(o) {
		// Case 1: does not enable DirectPath
		if !isDirectPathEnabled(endpoint, o) {
			log.Println("WARNING: DirectPath is misconfigured. Please set the EnableDirectPath option along with the EnableDirectPathXds option.")
		} else {
			// Case 2: credential is not correctly set
			if !isTokenSourceDirectPathCompatible(ts, o) {
				log.Println("WARNING: DirectPath is misconfigured. Please make sure the token source is fetched from GCE metadata server and the default service account is used.")
			}
			// Case 3: not running on GCE
			if !metadata.OnGCE() {
				log.Println("WARNING: DirectPath is misconfigured. DirectPath is only available in a GCE environment.")
			}
		}
	}
}

func processAndValidateOpts(opts []option.ClientOption) (*internal.DialSettings, error) {
	var o internal.DialSettings
	for _, opt := range opts {
		opt.Apply(&o)
	}
	if err := o.Validate(); err != nil {
		return nil, err
	}

	return &o, nil
}

type connPoolOption struct{ ConnPool }

// WithConnPool returns a ClientOption that specifies the ConnPool
// connection to use as the basis of communications.
//
// This is only to be used by Google client libraries internally, for example
// when creating a longrunning API client that shares the same connection pool
// as a service client.
func WithConnPool(p ConnPool) option.ClientOption {
	return connPoolOption{p}
}

func (o connPoolOption) Apply(s *internal.DialSettings) {
	s.GRPCConnPool = o.ConnPool
}
