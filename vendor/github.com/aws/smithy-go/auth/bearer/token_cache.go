package bearer

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	smithycontext "github.com/aws/smithy-go/context"
	"github.com/aws/smithy-go/internal/sync/singleflight"
)

// package variable that can be override in unit tests.
var timeNow = time.Now

// TokenCacheOptions provides a set of optional configuration options for the
// TokenCache TokenProvider.
type TokenCacheOptions struct {
	// The duration before the token will expire when the credentials will be
	// refreshed. If DisableAsyncRefresh is true, the RetrieveBearerToken calls
	// will be blocking.
	//
	// Asynchronous refreshes are deduplicated, and only one will be in-flight
	// at a time. If the token expires while an asynchronous refresh is in
	// flight, the next call to RetrieveBearerToken will block on that refresh
	// to return.
	RefreshBeforeExpires time.Duration

	// The timeout the underlying TokenProvider's RetrieveBearerToken call must
	// return within, or will be canceled. Defaults to 0, no timeout.
	//
	// If 0 timeout, its possible for the underlying tokenProvider's
	// RetrieveBearerToken call to block forever. Preventing subsequent
	// TokenCache attempts to refresh the token.
	//
	// If this timeout is reached all pending deduplicated calls to
	// TokenCache RetrieveBearerToken will fail with an error.
	RetrieveBearerTokenTimeout time.Duration

	// The minimum duration between asynchronous refresh attempts. If the next
	// asynchronous recent refresh attempt was within the minimum delay
	// duration, the call to retrieve will return the current cached token, if
	// not expired.
	//
	// The asynchronous retrieve is deduplicated across multiple calls when
	// RetrieveBearerToken is called. The asynchronous retrieve is not a
	// periodic task. It is only performed when the token has not yet expired,
	// and the current item is within the RefreshBeforeExpires window, and the
	// TokenCache's RetrieveBearerToken method is called.
	//
	// If 0, (default) there will be no minimum delay between asynchronous
	// refresh attempts.
	//
	// If DisableAsyncRefresh is true, this option is ignored.
	AsyncRefreshMinimumDelay time.Duration

	// Sets if the TokenCache will attempt to refresh the token in the
	// background asynchronously instead of blocking for credentials to be
	// refreshed. If disabled token refresh will be blocking.
	//
	// The first call to RetrieveBearerToken will always be blocking, because
	// there is no cached token.
	DisableAsyncRefresh bool
}

// TokenCache provides an utility to cache Bearer Authentication tokens from a
// wrapped TokenProvider. The TokenCache can be has options to configure the
// cache's early and asynchronous refresh of the token.
type TokenCache struct {
	options  TokenCacheOptions
	provider TokenProvider

	cachedToken            atomic.Value
	lastRefreshAttemptTime atomic.Value
	sfGroup                singleflight.Group
}

// NewTokenCache returns a initialized TokenCache that implements the
// TokenProvider interface. Wrapping the provider passed in. Also taking a set
// of optional functional option parameters to configure the token cache.
func NewTokenCache(provider TokenProvider, optFns ...func(*TokenCacheOptions)) *TokenCache {
	var options TokenCacheOptions
	for _, fn := range optFns {
		fn(&options)
	}

	return &TokenCache{
		options:  options,
		provider: provider,
	}
}

// RetrieveBearerToken returns the token if it could be obtained, or error if a
// valid token could not be retrieved.
//
// The passed in Context's cancel/deadline/timeout will impacting only this
// individual retrieve call and not any other already queued up calls. This
// means underlying provider's RetrieveBearerToken calls could block for ever,
// and not be canceled with the Context. Set RetrieveBearerTokenTimeout to
// provide a timeout, preventing the underlying TokenProvider blocking forever.
//
// By default, if the passed in Context is canceled, all of its values will be
// considered expired. The wrapped TokenProvider will not be able to lookup the
// values from the Context once it is expired. This is done to protect against
// expired values no longer being valid. To disable this behavior, use
// smithy-go's context.WithPreserveExpiredValues to add a value to the Context
// before calling RetrieveBearerToken to enable support for expired values.
//
// Without RetrieveBearerTokenTimeout there is the potential for a underlying
// Provider's RetrieveBearerToken call to sit forever. Blocking in subsequent
// attempts at refreshing the token.
func (p *TokenCache) RetrieveBearerToken(ctx context.Context) (Token, error) {
	cachedToken, ok := p.getCachedToken()
	if !ok || cachedToken.Expired(timeNow()) {
		return p.refreshBearerToken(ctx)
	}

	// Check if the token should be refreshed before it expires.
	refreshToken := cachedToken.Expired(timeNow().Add(p.options.RefreshBeforeExpires))
	if !refreshToken {
		return cachedToken, nil
	}

	if p.options.DisableAsyncRefresh {
		return p.refreshBearerToken(ctx)
	}

	p.tryAsyncRefresh(ctx)

	return cachedToken, nil
}

// tryAsyncRefresh attempts to asynchronously refresh the token returning the
// already cached token. If it AsyncRefreshMinimumDelay option is not zero, and
// the duration since the last refresh is less than that value, nothing will be
// done.
func (p *TokenCache) tryAsyncRefresh(ctx context.Context) {
	if p.options.AsyncRefreshMinimumDelay != 0 {
		var lastRefreshAttempt time.Time
		if v := p.lastRefreshAttemptTime.Load(); v != nil {
			lastRefreshAttempt = v.(time.Time)
		}

		if timeNow().Before(lastRefreshAttempt.Add(p.options.AsyncRefreshMinimumDelay)) {
			return
		}
	}

	// Ignore the returned channel so this won't be blocking, and limit the
	// number of additional goroutines created.
	p.sfGroup.DoChan("async-refresh", func() (interface{}, error) {
		res, err := p.refreshBearerToken(ctx)
		if p.options.AsyncRefreshMinimumDelay != 0 {
			var refreshAttempt time.Time
			if err != nil {
				refreshAttempt = timeNow()
			}
			p.lastRefreshAttemptTime.Store(refreshAttempt)
		}

		return res, err
	})
}

func (p *TokenCache) refreshBearerToken(ctx context.Context) (Token, error) {
	resCh := p.sfGroup.DoChan("refresh-token", func() (interface{}, error) {
		ctx := smithycontext.WithSuppressCancel(ctx)
		if v := p.options.RetrieveBearerTokenTimeout; v != 0 {
			var cancel func()
			ctx, cancel = context.WithTimeout(ctx, v)
			defer cancel()
		}
		return p.singleRetrieve(ctx)
	})

	select {
	case res := <-resCh:
		return res.Val.(Token), res.Err
	case <-ctx.Done():
		return Token{}, fmt.Errorf("retrieve bearer token canceled, %w", ctx.Err())
	}
}

func (p *TokenCache) singleRetrieve(ctx context.Context) (interface{}, error) {
	token, err := p.provider.RetrieveBearerToken(ctx)
	if err != nil {
		return Token{}, fmt.Errorf("failed to retrieve bearer token, %w", err)
	}

	p.cachedToken.Store(&token)
	return token, nil
}

// getCachedToken returns the currently cached token and true if found. Returns
// false if no token is cached.
func (p *TokenCache) getCachedToken() (Token, bool) {
	v := p.cachedToken.Load()
	if v == nil {
		return Token{}, false
	}

	t := v.(*Token)
	if t == nil || t.Value == "" {
		return Token{}, false
	}

	return *t, true
}
