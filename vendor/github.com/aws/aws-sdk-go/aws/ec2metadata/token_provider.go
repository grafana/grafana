package ec2metadata

import (
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/request"
)

// A tokenProvider struct provides access to EC2Metadata client
// and atomic instance of a token, along with configuredTTL for it.
// tokenProvider also provides an atomic flag to disable the
// fetch token operation.
// The disabled member will use 0 as false, and 1 as true.
type tokenProvider struct {
	client        *EC2Metadata
	token         atomic.Value
	configuredTTL time.Duration
	disabled      uint32
}

// A ec2Token struct helps use of token in EC2 Metadata service ops
type ec2Token struct {
	token string
	credentials.Expiry
}

// newTokenProvider provides a pointer to a tokenProvider instance
func newTokenProvider(c *EC2Metadata, duration time.Duration) *tokenProvider {
	return &tokenProvider{client: c, configuredTTL: duration}
}

// check if fallback is enabled
func (t *tokenProvider) fallbackEnabled() bool {
	return t.client.Config.EC2MetadataEnableFallback == nil || *t.client.Config.EC2MetadataEnableFallback
}

// fetchTokenHandler fetches token for EC2Metadata service client by default.
func (t *tokenProvider) fetchTokenHandler(r *request.Request) {
	// short-circuits to insecure data flow if tokenProvider is disabled.
	if v := atomic.LoadUint32(&t.disabled); v == 1 && t.fallbackEnabled() {
		return
	}

	if ec2Token, ok := t.token.Load().(ec2Token); ok && !ec2Token.IsExpired() {
		r.HTTPRequest.Header.Set(tokenHeader, ec2Token.token)
		return
	}

	output, err := t.client.getToken(r.Context(), t.configuredTTL)

	if err != nil {
		// only attempt fallback to insecure data flow if IMDSv1 is enabled
		if !t.fallbackEnabled() {
			r.Error = awserr.New("EC2MetadataError", "failed to get IMDSv2 token and fallback to IMDSv1 is disabled", err)
			return
		}

		// change the disabled flag on token provider to true and fallback
		if requestFailureError, ok := err.(awserr.RequestFailure); ok {
			switch requestFailureError.StatusCode() {
			case http.StatusForbidden, http.StatusNotFound, http.StatusMethodNotAllowed:
				atomic.StoreUint32(&t.disabled, 1)
				if t.client.Config.LogLevel.Matches(aws.LogDebugWithDeprecated) {
					t.client.Config.Logger.Log(fmt.Sprintf("WARN: failed to get session token, falling back to IMDSv1: %v", requestFailureError))
				}
			case http.StatusBadRequest:
				r.Error = requestFailureError
			}
		}
		return
	}

	newToken := ec2Token{
		token: output.Token,
	}
	newToken.SetExpiration(time.Now().Add(output.TTL), ttlExpirationWindow)
	t.token.Store(newToken)

	// Inject token header to the request.
	if ec2Token, ok := t.token.Load().(ec2Token); ok {
		r.HTTPRequest.Header.Set(tokenHeader, ec2Token.token)
	}
}

// enableTokenProviderHandler enables the token provider
func (t *tokenProvider) enableTokenProviderHandler(r *request.Request) {
	// If the error code status is 401, we enable the token provider
	if e, ok := r.Error.(awserr.RequestFailure); ok && e != nil &&
		e.StatusCode() == http.StatusUnauthorized {
		t.token.Store(ec2Token{})
		atomic.StoreUint32(&t.disabled, 0)
	}
}
