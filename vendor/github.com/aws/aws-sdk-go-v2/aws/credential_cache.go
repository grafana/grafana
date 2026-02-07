package aws

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	sdkrand "github.com/aws/aws-sdk-go-v2/internal/rand"
	"github.com/aws/aws-sdk-go-v2/internal/sync/singleflight"
)

// CredentialsCacheOptions are the options
type CredentialsCacheOptions struct {

	// ExpiryWindow will allow the credentials to trigger refreshing prior to
	// the credentials actually expiring. This is beneficial so race conditions
	// with expiring credentials do not cause request to fail unexpectedly
	// due to ExpiredTokenException exceptions.
	//
	// An ExpiryWindow of 10s would cause calls to IsExpired() to return true
	// 10 seconds before the credentials are actually expired. This can cause an
	// increased number of requests to refresh the credentials to occur.
	//
	// If ExpiryWindow is 0 or less it will be ignored.
	ExpiryWindow time.Duration

	// ExpiryWindowJitterFrac provides a mechanism for randomizing the
	// expiration of credentials within the configured ExpiryWindow by a random
	// percentage. Valid values are between 0.0 and 1.0.
	//
	// As an example if ExpiryWindow is 60 seconds and ExpiryWindowJitterFrac
	// is 0.5 then credentials will be set to expire between 30 to 60 seconds
	// prior to their actual expiration time.
	//
	// If ExpiryWindow is 0 or less then ExpiryWindowJitterFrac is ignored.
	// If ExpiryWindowJitterFrac is 0 then no randomization will be applied to the window.
	// If ExpiryWindowJitterFrac < 0 the value will be treated as 0.
	// If ExpiryWindowJitterFrac > 1 the value will be treated as 1.
	ExpiryWindowJitterFrac float64
}

// CredentialsCache provides caching and concurrency safe credentials retrieval
// via the provider's retrieve method.
//
// CredentialsCache will look for optional interfaces on the Provider to adjust
// how the credential cache handles credentials caching.
//
//   - HandleFailRefreshCredentialsCacheStrategy - Allows provider to handle
//     credential refresh failures. This could return an updated Credentials
//     value, or attempt another means of retrieving credentials.
//
//   - AdjustExpiresByCredentialsCacheStrategy - Allows provider to adjust how
//     credentials Expires is modified. This could modify how the Credentials
//     Expires is adjusted based on the CredentialsCache ExpiryWindow option.
//     Such as providing a floor not to reduce the Expires below.
type CredentialsCache struct {
	provider CredentialsProvider

	options CredentialsCacheOptions
	creds   atomic.Value
	sf      singleflight.Group
}

// NewCredentialsCache returns a CredentialsCache that wraps provider. Provider
// is expected to not be nil. A variadic list of one or more functions can be
// provided to modify the CredentialsCache configuration. This allows for
// configuration of credential expiry window and jitter.
func NewCredentialsCache(provider CredentialsProvider, optFns ...func(options *CredentialsCacheOptions)) *CredentialsCache {
	options := CredentialsCacheOptions{}

	for _, fn := range optFns {
		fn(&options)
	}

	if options.ExpiryWindow < 0 {
		options.ExpiryWindow = 0
	}

	if options.ExpiryWindowJitterFrac < 0 {
		options.ExpiryWindowJitterFrac = 0
	} else if options.ExpiryWindowJitterFrac > 1 {
		options.ExpiryWindowJitterFrac = 1
	}

	return &CredentialsCache{
		provider: provider,
		options:  options,
	}
}

// Retrieve returns the credentials. If the credentials have already been
// retrieved, and not expired the cached credentials will be returned. If the
// credentials have not been retrieved yet, or expired the provider's Retrieve
// method will be called.
//
// Returns and error if the provider's retrieve method returns an error.
func (p *CredentialsCache) Retrieve(ctx context.Context) (Credentials, error) {
	if creds, ok := p.getCreds(); ok && !creds.Expired() {
		return creds, nil
	}

	resCh := p.sf.DoChan("", func() (interface{}, error) {
		return p.singleRetrieve(&suppressedContext{ctx})
	})
	select {
	case res := <-resCh:
		return res.Val.(Credentials), res.Err
	case <-ctx.Done():
		return Credentials{}, &RequestCanceledError{Err: ctx.Err()}
	}
}

func (p *CredentialsCache) singleRetrieve(ctx context.Context) (interface{}, error) {
	currCreds, ok := p.getCreds()
	if ok && !currCreds.Expired() {
		return currCreds, nil
	}

	newCreds, err := p.provider.Retrieve(ctx)
	if err != nil {
		handleFailToRefresh := defaultHandleFailToRefresh
		if cs, ok := p.provider.(HandleFailRefreshCredentialsCacheStrategy); ok {
			handleFailToRefresh = cs.HandleFailToRefresh
		}
		newCreds, err = handleFailToRefresh(ctx, currCreds, err)
		if err != nil {
			return Credentials{}, fmt.Errorf("failed to refresh cached credentials, %w", err)
		}
	}

	if newCreds.CanExpire && p.options.ExpiryWindow > 0 {
		adjustExpiresBy := defaultAdjustExpiresBy
		if cs, ok := p.provider.(AdjustExpiresByCredentialsCacheStrategy); ok {
			adjustExpiresBy = cs.AdjustExpiresBy
		}

		randFloat64, err := sdkrand.CryptoRandFloat64()
		if err != nil {
			return Credentials{}, fmt.Errorf("failed to get random provider, %w", err)
		}

		var jitter time.Duration
		if p.options.ExpiryWindowJitterFrac > 0 {
			jitter = time.Duration(randFloat64 *
				p.options.ExpiryWindowJitterFrac * float64(p.options.ExpiryWindow))
		}

		newCreds, err = adjustExpiresBy(newCreds, -(p.options.ExpiryWindow - jitter))
		if err != nil {
			return Credentials{}, fmt.Errorf("failed to adjust credentials expires, %w", err)
		}
	}

	p.creds.Store(&newCreds)
	return newCreds, nil
}

// getCreds returns the currently stored credentials and true. Returning false
// if no credentials were stored.
func (p *CredentialsCache) getCreds() (Credentials, bool) {
	v := p.creds.Load()
	if v == nil {
		return Credentials{}, false
	}

	c := v.(*Credentials)
	if c == nil || !c.HasKeys() {
		return Credentials{}, false
	}

	return *c, true
}

// ProviderSources returns a list of where the underlying credential provider
// has been sourced, if available. Returns empty if the provider doesn't implement
// the interface
func (p *CredentialsCache) ProviderSources() []CredentialSource {
	asSource, ok := p.provider.(CredentialProviderSource)
	if !ok {
		return []CredentialSource{}
	}
	return asSource.ProviderSources()
}

// Invalidate will invalidate the cached credentials. The next call to Retrieve
// will cause the provider's Retrieve method to be called.
func (p *CredentialsCache) Invalidate() {
	p.creds.Store((*Credentials)(nil))
}

// IsCredentialsProvider returns whether credential provider wrapped by CredentialsCache
// matches the target provider type.
func (p *CredentialsCache) IsCredentialsProvider(target CredentialsProvider) bool {
	return IsCredentialsProvider(p.provider, target)
}

// HandleFailRefreshCredentialsCacheStrategy is an interface for
// CredentialsCache to allow CredentialsProvider  how failed to refresh
// credentials is handled.
type HandleFailRefreshCredentialsCacheStrategy interface {
	// Given the previously cached Credentials, if any, and refresh error, may
	// returns new or modified set of Credentials, or error.
	//
	// Credential caches may use default implementation if nil.
	HandleFailToRefresh(context.Context, Credentials, error) (Credentials, error)
}

// defaultHandleFailToRefresh returns the passed in error.
func defaultHandleFailToRefresh(ctx context.Context, _ Credentials, err error) (Credentials, error) {
	return Credentials{}, err
}

// AdjustExpiresByCredentialsCacheStrategy is an interface for CredentialCache
// to allow CredentialsProvider to intercept adjustments to Credentials expiry
// based on expectations and use cases of CredentialsProvider.
//
// Credential caches may use default implementation if nil.
type AdjustExpiresByCredentialsCacheStrategy interface {
	// Given a Credentials as input, applying any mutations and
	// returning the potentially updated Credentials, or error.
	AdjustExpiresBy(Credentials, time.Duration) (Credentials, error)
}

// defaultAdjustExpiresBy adds the duration to the passed in credentials Expires,
// and returns the updated credentials value. If Credentials value's CanExpire
// is false, the passed in credentials are returned unchanged.
func defaultAdjustExpiresBy(creds Credentials, dur time.Duration) (Credentials, error) {
	if !creds.CanExpire {
		return creds, nil
	}

	creds.Expires = creds.Expires.Add(dur)
	return creds, nil
}
