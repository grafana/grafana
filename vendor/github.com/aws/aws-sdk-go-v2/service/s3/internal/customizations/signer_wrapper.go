package customizations

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/internal/v4a"
	"github.com/aws/smithy-go/middleware"
)

type signerVersionKey struct{}

// GetSignerVersion retrieves the signer version to use for signing
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetSignerVersion(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, signerVersionKey{}).(string)
	return v
}

// SetSignerVersion sets the signer version to be used for signing the request
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetSignerVersion(ctx context.Context, version string) context.Context {
	return middleware.WithStackValue(ctx, signerVersionKey{}, version)
}

// SignHTTPRequestMiddlewareOptions is the configuration options for the SignHTTPRequestMiddleware middleware.
type SignHTTPRequestMiddlewareOptions struct {

	// credential provider
	CredentialsProvider aws.CredentialsProvider

	// log signing
	LogSigning bool

	// v4 signer
	V4Signer v4.HTTPSigner

	//v4a signer
	V4aSigner v4a.HTTPSigner
}

// NewSignHTTPRequestMiddleware constructs a SignHTTPRequestMiddleware using the given Signer for signing requests
func NewSignHTTPRequestMiddleware(options SignHTTPRequestMiddlewareOptions) *SignHTTPRequestMiddleware {
	return &SignHTTPRequestMiddleware{
		credentialsProvider: options.CredentialsProvider,
		v4Signer:            options.V4Signer,
		v4aSigner:           options.V4aSigner,
		logSigning:          options.LogSigning,
	}
}

// SignHTTPRequestMiddleware is a `FinalizeMiddleware` implementation to select HTTP Signing method
type SignHTTPRequestMiddleware struct {

	// credential provider
	credentialsProvider aws.CredentialsProvider

	// log signing
	logSigning bool

	// v4 signer
	v4Signer v4.HTTPSigner

	//v4a signer
	v4aSigner v4a.HTTPSigner
}

// ID is the SignHTTPRequestMiddleware identifier
func (s *SignHTTPRequestMiddleware) ID() string {
	return "Signing"
}

// HandleFinalize will take the provided input and handle signing for either
// SigV4 or SigV4A as called for.
func (s *SignHTTPRequestMiddleware) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	sv := GetSignerVersion(ctx)

	if strings.EqualFold(sv, v4.Version) {
		mw := v4.NewSignHTTPRequestMiddleware(v4.SignHTTPRequestMiddlewareOptions{
			CredentialsProvider: s.credentialsProvider,
			Signer:              s.v4Signer,
			LogSigning:          s.logSigning,
		})
		return mw.HandleFinalize(ctx, in, next)
	} else if strings.EqualFold(sv, v4a.Version) {
		v4aCredentialProvider, ok := s.credentialsProvider.(v4a.CredentialsProvider)
		if !ok {
			return out, metadata, fmt.Errorf("invalid credential-provider provided for sigV4a Signer")
		}

		mw := v4a.NewSignHTTPRequestMiddleware(v4a.SignHTTPRequestMiddlewareOptions{
			Credentials: v4aCredentialProvider,
			Signer:      s.v4aSigner,
			LogSigning:  s.logSigning,
		})
		return mw.HandleFinalize(ctx, in, next)
	}

	return next.HandleFinalize(ctx, in)
}

// RegisterSigningMiddleware registers the wrapper signing middleware to the stack. If a signing middleware is already
// present, this provided middleware will be swapped. Otherwise the middleware will be added at the tail of the
// finalize step.
func RegisterSigningMiddleware(stack *middleware.Stack, signingMiddleware *SignHTTPRequestMiddleware) (err error) {
	const signedID = "Signing"
	_, present := stack.Finalize.Get(signedID)
	if present {
		_, err = stack.Finalize.Swap(signedID, signingMiddleware)
	} else {
		err = stack.Finalize.Add(signingMiddleware, middleware.After)
	}
	return err
}

// PresignHTTPRequestMiddlewareOptions is the options for the PresignHTTPRequestMiddleware middleware.
type PresignHTTPRequestMiddlewareOptions struct {
	CredentialsProvider aws.CredentialsProvider
	ExpressCredentials  S3ExpressCredentialsProvider
	V4Presigner         v4.HTTPPresigner
	V4aPresigner        v4a.HTTPPresigner
	LogSigning          bool
}

// PresignHTTPRequestMiddleware provides the Finalize middleware for creating a
// presigned URL for an HTTP request.
//
// Will short circuit the middleware stack and not forward onto the next
// Finalize handler.
type PresignHTTPRequestMiddleware struct {

	// cred provider and signer for sigv4
	credentialsProvider aws.CredentialsProvider

	// s3Express credentials
	expressCredentials S3ExpressCredentialsProvider

	// sigV4 signer
	v4Signer v4.HTTPPresigner

	// sigV4a signer
	v4aSigner v4a.HTTPPresigner

	// log signing
	logSigning bool
}

// NewPresignHTTPRequestMiddleware constructs a PresignHTTPRequestMiddleware using the given Signer for signing requests
func NewPresignHTTPRequestMiddleware(options PresignHTTPRequestMiddlewareOptions) *PresignHTTPRequestMiddleware {
	return &PresignHTTPRequestMiddleware{
		credentialsProvider: options.CredentialsProvider,
		expressCredentials:  options.ExpressCredentials,
		v4Signer:            options.V4Presigner,
		v4aSigner:           options.V4aPresigner,
		logSigning:          options.LogSigning,
	}
}

// ID provides the middleware ID.
func (*PresignHTTPRequestMiddleware) ID() string { return "PresignHTTPRequest" }

// HandleFinalize will take the provided input and create a presigned url for
// the http request using the SigV4 or SigV4a presign authentication scheme.
//
// Since the signed request is not a valid HTTP request
func (p *PresignHTTPRequestMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	// fetch signer type from context
	signerVersion := GetSignerVersion(ctx)

	switch signerVersion {
	case "aws.auth#sigv4a":
		mw := v4a.NewPresignHTTPRequestMiddleware(v4a.PresignHTTPRequestMiddlewareOptions{
			CredentialsProvider: &v4a.SymmetricCredentialAdaptor{
				SymmetricProvider: p.credentialsProvider,
			},
			Presigner:  p.v4aSigner,
			LogSigning: p.logSigning,
		})
		return mw.HandleFinalize(ctx, in, next)
	case "aws.auth#sigv4":
		mw := v4.NewPresignHTTPRequestMiddleware(v4.PresignHTTPRequestMiddlewareOptions{
			CredentialsProvider: p.credentialsProvider,
			Presigner:           p.v4Signer,
			LogSigning:          p.logSigning,
		})
		return mw.HandleFinalize(ctx, in, next)
	case s3ExpressSignerVersion:
		mw := v4.NewPresignHTTPRequestMiddleware(v4.PresignHTTPRequestMiddlewareOptions{
			CredentialsProvider: &s3ExpressCredentialsAdapter{
				provider: p.expressCredentials,
				bucket:   GetBucket(ctx),
			},
			Presigner:  &s3ExpressPresignerAdapter{v4: p.v4Signer},
			LogSigning: p.logSigning,
		})
		return mw.HandleFinalize(ctx, in, next)
	default:
		return out, metadata, fmt.Errorf("unsupported signer type \"%s\"", signerVersion)
	}
}

// RegisterPreSigningMiddleware registers the wrapper pre-signing middleware to the stack. If a pre-signing middleware is already
// present, this provided middleware will be swapped. Otherwise the middleware will be added at the tail of the
// finalize step.
func RegisterPreSigningMiddleware(stack *middleware.Stack, signingMiddleware *PresignHTTPRequestMiddleware) (err error) {
	const signedID = "PresignHTTPRequest"
	_, present := stack.Finalize.Get(signedID)
	if present {
		_, err = stack.Finalize.Swap(signedID, signingMiddleware)
	} else {
		err = stack.Finalize.Add(signingMiddleware, middleware.After)
	}
	return err
}
