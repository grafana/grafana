package bearer

import (
	"context"
	"fmt"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// Message is the middleware stack's request transport message value.
type Message interface{}

// Signer provides an interface for implementations to decorate a request
// message with a bearer token. The signer is responsible for validating the
// message type is compatible with the signer.
type Signer interface {
	SignWithBearerToken(context.Context, Token, Message) (Message, error)
}

// AuthenticationMiddleware provides the Finalize middleware step for signing
// an request message with a bearer token.
type AuthenticationMiddleware struct {
	signer        Signer
	tokenProvider TokenProvider
}

// AddAuthenticationMiddleware helper adds the AuthenticationMiddleware to the
// middleware Stack in the Finalize step with the options provided.
func AddAuthenticationMiddleware(s *middleware.Stack, signer Signer, tokenProvider TokenProvider) error {
	return s.Finalize.Add(
		NewAuthenticationMiddleware(signer, tokenProvider),
		middleware.After,
	)
}

// NewAuthenticationMiddleware returns an initialized AuthenticationMiddleware.
func NewAuthenticationMiddleware(signer Signer, tokenProvider TokenProvider) *AuthenticationMiddleware {
	return &AuthenticationMiddleware{
		signer:        signer,
		tokenProvider: tokenProvider,
	}
}

const authenticationMiddlewareID = "BearerTokenAuthentication"

// ID returns the resolver identifier
func (m *AuthenticationMiddleware) ID() string {
	return authenticationMiddlewareID
}

// HandleFinalize implements the FinalizeMiddleware interface in order to
// update the request with bearer token authentication.
func (m *AuthenticationMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	token, err := m.tokenProvider.RetrieveBearerToken(ctx)
	if err != nil {
		return out, metadata, fmt.Errorf("failed AuthenticationMiddleware wrap message, %w", err)
	}

	signedMessage, err := m.signer.SignWithBearerToken(ctx, token, in.Request)
	if err != nil {
		return out, metadata, fmt.Errorf("failed AuthenticationMiddleware sign message, %w", err)
	}

	in.Request = signedMessage
	return next.HandleFinalize(ctx, in)
}

// SignHTTPSMessage provides a bearer token authentication implementation that
// will sign the message with the provided bearer token.
//
// Will fail if the message is not a smithy-go HTTP request or the request is
// not HTTPS.
type SignHTTPSMessage struct{}

// NewSignHTTPSMessage returns an initialized signer for HTTP messages.
func NewSignHTTPSMessage() *SignHTTPSMessage {
	return &SignHTTPSMessage{}
}

// SignWithBearerToken returns a copy of the HTTP request with the bearer token
// added via the "Authorization" header, per RFC 6750, https://datatracker.ietf.org/doc/html/rfc6750.
//
// Returns an error if the request's URL scheme is not HTTPS, or the request
// message is not an smithy-go HTTP Request pointer type.
func (SignHTTPSMessage) SignWithBearerToken(ctx context.Context, token Token, message Message) (Message, error) {
	req, ok := message.(*smithyhttp.Request)
	if !ok {
		return nil, fmt.Errorf("expect smithy-go HTTP Request, got %T", message)
	}

	if !req.IsHTTPS() {
		return nil, fmt.Errorf("bearer token with HTTP request requires HTTPS")
	}

	reqClone := req.Clone()
	reqClone.Header.Set("Authorization", "Bearer "+token.Value)

	return reqClone, nil
}
