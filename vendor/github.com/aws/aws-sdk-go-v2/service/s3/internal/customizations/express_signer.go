package customizations

import (
	"context"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/smithy-go/middleware"
)

const (
	s3ExpressSignerVersion = "com.amazonaws.s3#sigv4express"
	headerAmzSessionToken  = "x-amz-s3session-token"
)

// adapts a v4 signer for S3Express
type s3ExpressSignerAdapter struct {
	v4 v4.HTTPSigner
}

// SignHTTP performs S3Express signing on a request, which is identical to
// SigV4 signing save for an additional header containing the S3Express
// session token.
func (s *s3ExpressSignerAdapter) SignHTTP(ctx context.Context, credentials aws.Credentials, r *http.Request, payloadHash string, service string, region string, signingTime time.Time, optFns ...func(*v4.SignerOptions)) error {
	r.Header.Set(headerAmzSessionToken, credentials.SessionToken)
	optFns = append(optFns, func(o *v4.SignerOptions) {
		o.DisableSessionToken = true
	})
	return s.v4.SignHTTP(ctx, credentials, r, payloadHash, service, region, signingTime, optFns...)
}

// adapts S3ExpressCredentialsProvider to the standard AWS
// CredentialsProvider interface
type s3ExpressCredentialsAdapter struct {
	provider S3ExpressCredentialsProvider
	bucket   string
}

func (c *s3ExpressCredentialsAdapter) Retrieve(ctx context.Context) (aws.Credentials, error) {
	return c.provider.Retrieve(ctx, c.bucket)
}

// S3ExpressSignHTTPRequestMiddleware signs S3 S3Express requests.
//
// This is NOT mutually exclusive with existing v4 or v4a signer handling on
// the stack itself, but only one handler will actually perform signing based
// on the provided signing version in the context.
type S3ExpressSignHTTPRequestMiddleware struct {
	Credentials S3ExpressCredentialsProvider
	Signer      v4.HTTPSigner
	LogSigning  bool
}

// ID identifies S3ExpressSignHTTPRequestMiddleware.
func (*S3ExpressSignHTTPRequestMiddleware) ID() string {
	return "S3ExpressSigning"
}

// HandleFinalize will sign the request if the S3Express signer has been
// selected.
func (m *S3ExpressSignHTTPRequestMiddleware) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if GetSignerVersion(ctx) != s3ExpressSignerVersion {
		return next.HandleFinalize(ctx, in)
	}

	mw := v4.NewSignHTTPRequestMiddleware(v4.SignHTTPRequestMiddlewareOptions{
		CredentialsProvider: m.credentialsAdapter(ctx),
		Signer:              m.signerAdapter(),
		LogSigning:          m.LogSigning,
	})
	return mw.HandleFinalize(ctx, in, next)
}

func (m *S3ExpressSignHTTPRequestMiddleware) credentialsAdapter(ctx context.Context) aws.CredentialsProvider {
	return &s3ExpressCredentialsAdapter{
		provider: m.Credentials,
		bucket:   GetBucket(ctx),
	}
}

func (m *S3ExpressSignHTTPRequestMiddleware) signerAdapter() v4.HTTPSigner {
	return &s3ExpressSignerAdapter{v4: m.Signer}
}

type s3ExpressPresignerAdapter struct {
	v4 v4.HTTPPresigner
}

// SignHTTP performs S3Express signing on a request, which is identical to
// SigV4 signing save for an additional header containing the S3Express
// session token.
func (s *s3ExpressPresignerAdapter) PresignHTTP(ctx context.Context, credentials aws.Credentials, r *http.Request, payloadHash string, service string, region string, signingTime time.Time, optFns ...func(*v4.SignerOptions)) (
	string, http.Header, error,
) {
	r.Header.Set(headerAmzSessionToken, credentials.SessionToken)
	optFns = append(optFns, func(o *v4.SignerOptions) {
		o.DisableSessionToken = true
	})
	return s.v4.PresignHTTP(ctx, credentials, r, payloadHash, service, region, signingTime, optFns...)
}

var (
	_ aws.CredentialsProvider = &s3ExpressCredentialsAdapter{}
	_ v4.HTTPSigner           = &s3ExpressSignerAdapter{}
)
