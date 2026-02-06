package grpcutils

import (
	"context"
	"crypto/tls"
	"errors"
	"net/http"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func NewUnsafeAuthenticator(tracer trace.Tracer) func(ctx context.Context) (context.Context, error) {
	return NewAuthenticatorInterceptor(
		authn.NewDefaultAuthenticator(
			authn.NewUnsafeAccessTokenVerifier(authn.VerifierConfig{}),
			authn.NewUnsafeIDTokenVerifier(authn.VerifierConfig{}),
		),
		tracer,
	)
}

func NewAuthenticator(cfg *AuthenticatorConfig, tracer trace.Tracer) func(ctx context.Context) (context.Context, error) {
	client := http.DefaultClient
	if cfg.AllowInsecure {
		client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	}

	kr := authn.NewKeyRetriever(authn.KeyRetrieverConfig{
		SigningKeysURL: cfg.SigningKeysURL,
	}, authn.WithHTTPClientKeyRetrieverOpt(client))

	auth := authn.NewDefaultAuthenticator(
		authn.NewAccessTokenVerifier(authn.VerifierConfig{AllowedAudiences: cfg.AllowedAudiences}, kr),
		authn.NewIDTokenVerifier(authn.VerifierConfig{}, kr),
	)

	return NewAuthenticatorInterceptor(auth, tracer)
}

func NewAuthenticatorInterceptor(auth authn.Authenticator, tracer trace.Tracer) func(ctx context.Context) (context.Context, error) {
	return func(ctx context.Context) (context.Context, error) {
		ctx, span := tracer.Start(ctx, "grpcutils.Authenticate")
		defer span.End()

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, errors.New("missing metedata in context")
		}

		info, err := auth.Authenticate(ctx, authn.NewGRPCTokenProvider(md))
		if err != nil {
			span.RecordError(err)
			if authn.IsUnauthenticatedErr(err) {
				return nil, status.Error(codes.Unauthenticated, err.Error())
			}

			return ctx, status.Error(codes.Internal, err.Error())
		}

		// FIXME: Add attribute with service subject once https://github.com/grafana/authlib/issues/139 is closed.
		span.SetAttributes(attribute.String("subject", info.GetUID()))
		if extra := info.GetExtra(); extra[authn.ServiceIdentityKey] != nil {
			span.SetAttributes(attribute.String("service_identity", extra[authn.ServiceIdentityKey][0]))
		}

		return types.WithAuthInfo(ctx, info), nil
	}
}
