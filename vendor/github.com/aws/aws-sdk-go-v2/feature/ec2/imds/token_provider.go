package imds

import (
	"context"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/logging"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const (
	// Headers for Token and TTL
	tokenHeader     = "x-aws-ec2-metadata-token"
	defaultTokenTTL = 5 * time.Minute
)

type tokenProvider struct {
	client   *Client
	tokenTTL time.Duration

	token    *apiToken
	tokenMux sync.RWMutex

	disabled uint32 // Atomic updated
}

func newTokenProvider(client *Client, ttl time.Duration) *tokenProvider {
	return &tokenProvider{
		client:   client,
		tokenTTL: ttl,
	}
}

// apiToken provides the API token used by all operation calls for th EC2
// Instance metadata service.
type apiToken struct {
	token   string
	expires time.Time
}

var timeNow = time.Now

// Expired returns if the token is expired.
func (t *apiToken) Expired() bool {
	// Calling Round(0) on the current time will truncate the monotonic reading only. Ensures credential expiry
	// time is always based on reported wall-clock time.
	return timeNow().Round(0).After(t.expires)
}

func (t *tokenProvider) ID() string { return "APITokenProvider" }

// HandleFinalize is the finalize stack middleware, that if the token provider is
// enabled, will attempt to add the cached API token to the request. If the API
// token is not cached, it will be retrieved in a separate API call, getToken.
//
// For retry attempts, handler must be added after attempt retryer.
//
// If request for getToken fails the token provider may be disabled from future
// requests, depending on the response status code.
func (t *tokenProvider) HandleFinalize(
	ctx context.Context, input middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if t.fallbackEnabled() && !t.enabled() {
		// short-circuits to insecure data flow if token provider is disabled.
		return next.HandleFinalize(ctx, input)
	}

	req, ok := input.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unexpected transport request type %T", input.Request)
	}

	tok, err := t.getToken(ctx)
	if err != nil {
		// If the error allows the token to downgrade to insecure flow allow that.
		var bypassErr *bypassTokenRetrievalError
		if errors.As(err, &bypassErr) {
			return next.HandleFinalize(ctx, input)
		}

		return out, metadata, fmt.Errorf("failed to get API token, %w", err)
	}

	req.Header.Set(tokenHeader, tok.token)

	return next.HandleFinalize(ctx, input)
}

// HandleDeserialize is the deserialize stack middleware for determining if the
// operation the token provider is decorating failed because of a 401
// unauthorized status code. If the operation failed for that reason the token
// provider needs to be re-enabled so that it can start adding the API token to
// operation calls.
func (t *tokenProvider) HandleDeserialize(
	ctx context.Context, input middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, input)
	if err == nil {
		return out, metadata, err
	}

	resp, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, fmt.Errorf("expect HTTP transport, got %T", out.RawResponse)
	}

	if resp.StatusCode == http.StatusUnauthorized { // unauthorized
		t.enable()
		err = &retryableError{Err: err, isRetryable: true}
	}

	return out, metadata, err
}

func (t *tokenProvider) getToken(ctx context.Context) (tok *apiToken, err error) {
	if t.fallbackEnabled() && !t.enabled() {
		return nil, &bypassTokenRetrievalError{
			Err: fmt.Errorf("cannot get API token, provider disabled"),
		}
	}

	t.tokenMux.RLock()
	tok = t.token
	t.tokenMux.RUnlock()

	if tok != nil && !tok.Expired() {
		return tok, nil
	}

	tok, err = t.updateToken(ctx)
	if err != nil {
		return nil, err
	}

	return tok, nil
}

func (t *tokenProvider) updateToken(ctx context.Context) (*apiToken, error) {
	t.tokenMux.Lock()
	defer t.tokenMux.Unlock()

	// Prevent multiple requests to update retrieving the token.
	if t.token != nil && !t.token.Expired() {
		tok := t.token
		return tok, nil
	}

	result, err := t.client.getToken(ctx, &getTokenInput{
		TokenTTL: t.tokenTTL,
	})
	if err != nil {
		var statusErr interface{ HTTPStatusCode() int }
		if errors.As(err, &statusErr) {
			switch statusErr.HTTPStatusCode() {
			// Disable future get token if failed because of 403, 404, or 405
			case http.StatusForbidden,
				http.StatusNotFound,
				http.StatusMethodNotAllowed:

				if t.fallbackEnabled() {
					logger := middleware.GetLogger(ctx)
					logger.Logf(logging.Warn, "falling back to IMDSv1: %v", err)
					t.disable()
				}

			// 400 errors are terminal, and need to be upstreamed
			case http.StatusBadRequest:
				return nil, err
			}
		}

		// Disable if request send failed or timed out getting response
		var re *smithyhttp.RequestSendError
		var ce *smithy.CanceledError
		if errors.As(err, &re) || errors.As(err, &ce) {
			atomic.StoreUint32(&t.disabled, 1)
		}

		if !t.fallbackEnabled() {
			// NOTE: getToken() is an implementation detail of some outer operation
			// (e.g. GetMetadata). It has its own retries that have already been exhausted.
			// Mark the underlying error as a terminal error.
			err = &retryableError{Err: err, isRetryable: false}
			return nil, err
		}

		// Token couldn't be retrieved, fallback to IMDSv1 insecure flow for this request
		// and allow the request to proceed. Future requests _may_ re-attempt fetching a
		// token if not disabled.
		return nil, &bypassTokenRetrievalError{Err: err}
	}

	tok := &apiToken{
		token:   result.Token,
		expires: timeNow().Add(result.TokenTTL),
	}
	t.token = tok

	return tok, nil
}

// enabled returns if the token provider is current enabled or not.
func (t *tokenProvider) enabled() bool {
	return atomic.LoadUint32(&t.disabled) == 0
}

// fallbackEnabled returns false if EnableFallback is [aws.FalseTernary], true otherwise
func (t *tokenProvider) fallbackEnabled() bool {
	switch t.client.options.EnableFallback {
	case aws.FalseTernary:
		return false
	default:
		return true
	}
}

// disable disables the token provider and it will no longer attempt to inject
// the token, nor request updates.
func (t *tokenProvider) disable() {
	atomic.StoreUint32(&t.disabled, 1)
}

// enable enables the token provide to start refreshing tokens, and adding them
// to the pending request.
func (t *tokenProvider) enable() {
	t.tokenMux.Lock()
	t.token = nil
	t.tokenMux.Unlock()
	atomic.StoreUint32(&t.disabled, 0)
}

type bypassTokenRetrievalError struct {
	Err error
}

func (e *bypassTokenRetrievalError) Error() string {
	return fmt.Sprintf("bypass token retrieval, %v", e.Err)
}

func (e *bypassTokenRetrievalError) Unwrap() error { return e.Err }

type retryableError struct {
	Err         error
	isRetryable bool
}

func (e *retryableError) RetryableError() bool { return e.isRetryable }

func (e *retryableError) Error() string { return e.Err.Error() }
